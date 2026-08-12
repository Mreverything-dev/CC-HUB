// frontend/src/features/livestream/hooks/useLiveStreamSignaling.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { socketService } from '@/lib/socket';
import { useChatStore } from '@/features/chat/store/chat.store';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export interface StreamCommentReaction {
  user_id: string;
  reaction: string;
}

export interface StreamChatMsg {
  id: string;
  user_id: string;
  username: string;
  avatar?: string | null;
  message: string;
  timestamp: string;
  parent_comment_id?: string | null;
  is_deleted?: boolean;
  reactions: StreamCommentReaction[];
}

interface UseLiveStreamSignalingOptions {
  streamId: string;
  isHost: boolean;
  /** Only start acquiring media / signaling once the stream is confirmed live and viewable. */
  enabled: boolean;
}

/**
 * Drives the WebRTC side of a livestream over the app's existing Socket.IO
 * connection (see backend app/websocket/manager.py `stream:*` handlers).
 * Host: opens one RTCPeerConnection per viewer and pushes its local camera
 * track to each. Viewer: opens a single RTCPeerConnection to the host and
 * renders the incoming track. The server only relays SDP/ICE payloads and
 * enforces who's allowed to host/watch - it never touches media.
 */
export function useLiveStreamSignaling({ streamId, isHost, enabled }: UseLiveStreamSignalingOptions) {
  // The livestream signaling reuses the app's single shared Socket.IO
  // connection (owned/connected by SocketProvider at the app root). That
  // connection may still be mid-handshake when this hook's effects first
  // run (e.g. a fresh page load straight into /live/:id), so every effect
  // below gates on this reactive flag instead of firing once and hoping the
  // socket happens to already be connected - otherwise host announcements/
  // viewer joins/event listeners can silently never happen.
  const isSocketConnected = useChatStore((s) => s.isConnected);

  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Whichever video track is currently being sent to viewers (camera or
  // screen-share) - used so viewers who join mid-share still get the screen.
  const activeVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingViewersRef = useRef<Set<string>>(new Set());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [isConnected, setIsConnected] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [hostOffline, setHostOffline] = useState(false);
  // Viewer joined successfully but the host hasn't started broadcasting yet
  // (or dropped and hasn't reconnected) - normal, self-healing state, not
  // an error. Cleared as soon as an offer actually arrives.
  const [waitingForHost, setWaitingForHost] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<StreamChatMsg[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasLocalMedia, setHasLocalMedia] = useState(false);

  const createPeerConnection = useCallback(
    (remoteSid: string) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.sendStreamIceCandidate(streamId, remoteSid, event.candidate.toJSON());
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setIsConnected(true);
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
          if (peersRef.current.get(remoteSid) === pc) {
            peersRef.current.delete(remoteSid);
          }
        }
      };

      if (!isHost) {
        pc.ontrack = (event) => {
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
          }
          setIsConnected(true);
        };
      }

      peersRef.current.set(remoteSid, pc);
      return pc;
    },
    [isHost, streamId]
  );

  const offerToViewer = useCallback(
    async (viewerSid: string) => {
      const localStream = localStreamRef.current;
      if (!localStream) {
        pendingViewersRef.current.add(viewerSid);
        return;
      }
      const pc = createPeerConnection(viewerSid);
      // Send whichever video track is currently live (camera or screen-share)
      // plus the mic audio, so viewers who join mid-share see the screen too.
      const videoTrack = activeVideoTrackRef.current ?? localStream.getVideoTracks()[0];
      if (videoTrack) pc.addTrack(videoTrack, localStream);
      localStream.getAudioTracks().forEach((track) => pc.addTrack(track, localStream));
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.sendStreamOffer(streamId, viewerSid, offer);
      } catch (err) {
        console.error('Failed to create/send stream offer:', err);
      }
    },
    [createPeerConnection, streamId]
  );

  // HOST: acquire camera/mic and clean up on unmount. Deliberately does NOT
  // depend on isSocketConnected - re-running this on every reconnect would
  // re-prompt for camera/mic and tear down a perfectly good local stream.
  useEffect(() => {
    if (!enabled || !isHost) return;
    let cancelled = false;

    (async () => {
      let mediaStream: MediaStream;
      try {
        // Preferred: camera + mic.
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        console.warn('Camera+mic unavailable, retrying with audio only:', err);
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setMediaError('No camera detected - continuing with audio only. Use "Share screen" to broadcast video.');
        } catch (err2) {
          // No camera AND no mic (or both denied) - still let the host go
          // live with an empty local stream so they can broadcast via
          // screen-share instead of being blocked entirely.
          console.warn('No camera or microphone available, continuing with no local media:', err2);
          mediaStream = new MediaStream();
          setMediaError('No camera or microphone detected. Use "Share screen" to broadcast video.');
        }
      }

      if (cancelled) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = mediaStream;
      activeVideoTrackRef.current = mediaStream.getVideoTracks()[0] ?? null;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setHasLocalMedia(true);
    })();

    return () => {
      cancelled = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      activeVideoTrackRef.current = null;
      setHasLocalMedia(false);
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
    };
  }, [enabled, isHost]);

  // HOST: announce the broadcast once BOTH the camera is ready AND the
  // shared socket connection is actually up - either can become true after
  // the other, and this re-fires if the socket drops and reconnects (a new
  // sid means the server no longer knows this connection is the host).
  useEffect(() => {
    if (!enabled || !isHost || !hasLocalMedia || !isSocketConnected) return;
    socketService.announceStreamHost(streamId);

    // Any viewers who tried to join before we were ready to answer them.
    const pending = Array.from(pendingViewersRef.current);
    pendingViewersRef.current.clear();
    pending.forEach((sid) => offerToViewer(sid));
  }, [enabled, isHost, hasLocalMedia, isSocketConnected, streamId, offerToViewer]);

  // VIEWER: join the stream room once the socket is connected; leave + tear
  // down on unmount. Also re-fires on reconnect for the same reason as above.
  useEffect(() => {
    if (!enabled || isHost || !isSocketConnected) return;
    setJoinError(null);
    socketService.joinStreamAsViewer(streamId);

    return () => {
      socketService.leaveStream(streamId);
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
    };
  }, [enabled, isHost, streamId, isSocketConnected]);

  // Socket event wiring, shared by both roles. Gated on isSocketConnected so
  // it (re)subscribes once a real socket instance exists, instead of
  // possibly running once before SocketProvider has connected and never
  // trying again.
  useEffect(() => {
    if (!enabled || !isSocketConnected) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleViewerReady = (data: { viewer_sid: string }) => {
      if (!isHost) return;
      offerToViewer(data.viewer_sid);
    };

    const handleOffer = async (data: { host_sid: string; sdp: RTCSessionDescriptionInit }) => {
      if (isHost) return;
      setWaitingForHost(false);
      const pc = createPeerConnection(data.host_sid);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketService.sendStreamAnswer(streamId, answer);
      } catch (err) {
        console.error('Failed to handle stream offer:', err);
      }
    };

    const handleAnswer = async (data: { viewer_sid: string; sdp: RTCSessionDescriptionInit }) => {
      if (!isHost) return;
      const pc = peersRef.current.get(data.viewer_sid);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } catch (err) {
        console.error('Failed to apply stream answer:', err);
      }
    };

    const handleIceCandidate = async (data: { from_sid: string; candidate: RTCIceCandidateInit }) => {
      const pc = peersRef.current.get(data.from_sid);
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('Failed to add ICE candidate:', err);
      }
    };

    const handleViewerLeft = (data: { viewer_sid: string }) => {
      const pc = peersRef.current.get(data.viewer_sid);
      pc?.close();
      peersRef.current.delete(data.viewer_sid);
      pendingViewersRef.current.delete(data.viewer_sid);
    };

    const handleHostLeft = () => {
      setHostOffline(true);
      setWaitingForHost(false);
      setIsConnected(false);
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const handleChatMessage = (data: StreamChatMsg) => {
      setChatMessages((prev) => [...prev, { ...data, reactions: data.reactions ?? [] }]);
    };

    const handleCommentReaction = (data: { comment_id: string; user_id: string; reaction: string | null }) => {
      setChatMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== data.comment_id) return msg;
          const withoutUser = msg.reactions.filter((r) => r.user_id !== data.user_id);
          return {
            ...msg,
            reactions: data.reaction ? [...withoutUser, { user_id: data.user_id, reaction: data.reaction }] : withoutUser,
          };
        })
      );
    };

    const handleCommentDeleted = (data: { comment_id: string }) => {
      setChatMessages((prev) =>
        prev.map((msg) => (msg.id === data.comment_id ? { ...msg, is_deleted: true, message: '' } : msg))
      );
    };

    const handleStreamError = (data: { code?: string; message: string }) => {
      if (data.code === 'HOST_OFFLINE') {
        // Not a real failure - the viewer is validated and registered, just
        // waiting for the host to (re)start. The backend re-notifies the
        // host of this viewer as soon as it announces, so this self-heals
        // into a normal stream:offer with no action needed here.
        setWaitingForHost(true);
        return;
      }
      console.error('Stream signaling error:', data.code, data.message);
      setJoinError(data.message);
    };

    socket.on('stream:viewer_ready', handleViewerReady);
    socket.on('stream:offer', handleOffer);
    socket.on('stream:answer', handleAnswer);
    socket.on('stream:ice_candidate', handleIceCandidate);
    socket.on('stream:viewer_left', handleViewerLeft);
    socket.on('stream:host_left', handleHostLeft);
    socket.on('stream:chat_message', handleChatMessage);
    socket.on('stream:comment_reaction', handleCommentReaction);
    socket.on('stream:comment_deleted', handleCommentDeleted);
    socket.on('stream:error', handleStreamError);

    return () => {
      socket.off('stream:viewer_ready', handleViewerReady);
      socket.off('stream:offer', handleOffer);
      socket.off('stream:answer', handleAnswer);
      socket.off('stream:ice_candidate', handleIceCandidate);
      socket.off('stream:viewer_left', handleViewerLeft);
      socket.off('stream:host_left', handleHostLeft);
      socket.off('stream:chat_message', handleChatMessage);
      socket.off('stream:comment_reaction', handleCommentReaction);
      socket.off('stream:comment_deleted', handleCommentDeleted);
      socket.off('stream:error', handleStreamError);
    };
  }, [enabled, isHost, streamId, createPeerConnection, offerToViewer, isSocketConnected]);

  const sendChatMessage = useCallback(
    (message: string, parentCommentId?: string | null) => {
      if (!message.trim()) return;
      socketService.sendStreamChatMessage(streamId, message.trim(), parentCommentId);
    },
    [streamId]
  );

  const reactToComment = useCallback(
    (commentId: string, reaction: string) => {
      socketService.sendStreamCommentReaction(streamId, commentId, reaction);
    },
    [streamId]
  );

  const deleteComment = useCallback(
    (commentId: string) => {
      socketService.deleteStreamComment(streamId, commentId);
    },
    [streamId]
  );

  const toggleCameraTrack = useCallback((on: boolean) => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = on;
    });
  }, []);

  const toggleMicTrack = useCallback((on: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
  }, []);

  /** Swaps the outgoing video track on every live peer connection - no
   * renegotiation needed since replaceTrack() reuses the existing senders. */
  const replaceOutgoingVideoTrack = useCallback((track: MediaStreamTrack) => {
    activeVideoTrackRef.current = track;
    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      sender?.replaceTrack(track).catch((err) => console.error('replaceTrack failed:', err));
    });
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setIsScreenSharing(false);

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (cameraTrack) {
      replaceOutgoingVideoTrack(cameraTrack);
      if (videoRef.current) videoRef.current.srcObject = localStreamRef.current;
    }
  }, [replaceOutgoingVideoTrack]);

  const startScreenShare = useCallback(async () => {
    if (!isHost) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;

      screenStreamRef.current = screenStream;
      replaceOutgoingVideoTrack(screenTrack);
      if (videoRef.current) videoRef.current.srcObject = screenStream;
      setIsScreenSharing(true);

      // Browser's native "Stop sharing" bar/button ends the track directly.
      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      // User cancelling the picker rejects the promise - not a real error.
      console.warn('Screen share not started:', err);
    }
  }, [isHost, replaceOutgoingVideoTrack, stopScreenShare]);

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  /** Records whatever is currently on screen: the host's outgoing feed
   * (camera or shared screen), or the viewer's incoming stream. Saves a
   * .webm file locally when stopped - purely client-side, no upload. */
  const startRecording = useCallback(() => {
    const sourceStream = isHost ? localStreamRef.current : (videoRef.current?.srcObject as MediaStream | null);
    if (!sourceStream) {
      console.error('No active stream to record yet.');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      console.error('MediaRecorder is not supported in this browser.');
      return;
    }

    // For the host, record the currently active video track (camera or
    // screen) plus mic audio, rather than the raw camera-only localStream.
    const recordStream = isHost
      ? new MediaStream([
          ...(activeVideoTrackRef.current ? [activeVideoTrackRef.current] : []),
          ...sourceStream.getAudioTracks(),
        ])
      : sourceStream;

    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported(type));

    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `livestream-${streamId}-${Date.now()}.webm`;
      link.click();
      URL.revokeObjectURL(url);
      recordedChunksRef.current = [];
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, [isHost, streamId]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    videoRef,
    isConnected,
    mediaError,
    hostOffline,
    waitingForHost,
    joinError,
    chatMessages,
    sendChatMessage,
    reactToComment,
    deleteComment,
    toggleCameraTrack,
    toggleMicTrack,
    isScreenSharing,
    toggleScreenShare,
    isRecording,
    toggleRecording,
  };
}
