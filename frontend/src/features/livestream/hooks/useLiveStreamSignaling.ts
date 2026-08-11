// frontend/src/features/livestream/hooks/useLiveStreamSignaling.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { socketService } from '@/lib/socket';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export interface StreamChatMsg {
  id: string;
  user_id: string;
  username: string;
  avatar?: string | null;
  message: string;
  timestamp: string;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingViewersRef = useRef<Set<string>>(new Set());

  const [isConnected, setIsConnected] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [hostOffline, setHostOffline] = useState(false);
  const [chatMessages, setChatMessages] = useState<StreamChatMsg[]>([]);

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
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
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

  // HOST: acquire camera/mic, announce broadcast, and clean up on unmount.
  useEffect(() => {
    if (!enabled || !isHost) return;
    let cancelled = false;

    (async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        socketService.announceStreamHost(streamId);

        // Any viewers who tried to join before the camera was ready.
        const pending = Array.from(pendingViewersRef.current);
        pendingViewersRef.current.clear();
        pending.forEach((sid) => offerToViewer(sid));
      } catch (err) {
        console.error('Camera/microphone access failed:', err);
        setMediaError('Unable to access camera or microphone. Please check permissions.');
      }
    })();

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
    };
  }, [enabled, isHost, streamId, offerToViewer]);

  // VIEWER: join the stream room; leave + tear down on unmount.
  useEffect(() => {
    if (!enabled || isHost) return;
    socketService.joinStreamAsViewer(streamId);

    return () => {
      socketService.leaveStream(streamId);
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
    };
  }, [enabled, isHost, streamId]);

  // Socket event wiring, shared by both roles.
  useEffect(() => {
    if (!enabled) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleViewerReady = (data: { viewer_sid: string }) => {
      if (!isHost) return;
      offerToViewer(data.viewer_sid);
    };

    const handleOffer = async (data: { host_sid: string; sdp: RTCSessionDescriptionInit }) => {
      if (isHost) return;
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
      setIsConnected(false);
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const handleChatMessage = (data: Omit<StreamChatMsg, 'id'>) => {
      setChatMessages((prev) => [...prev, { ...data, id: `${data.user_id}-${data.timestamp}-${prev.length}` }]);
    };

    const handleStreamError = (data: { message: string }) => {
      console.error('Stream signaling error:', data.message);
    };

    socket.on('stream:viewer_ready', handleViewerReady);
    socket.on('stream:offer', handleOffer);
    socket.on('stream:answer', handleAnswer);
    socket.on('stream:ice_candidate', handleIceCandidate);
    socket.on('stream:viewer_left', handleViewerLeft);
    socket.on('stream:host_left', handleHostLeft);
    socket.on('stream:chat_message', handleChatMessage);
    socket.on('stream:error', handleStreamError);

    return () => {
      socket.off('stream:viewer_ready', handleViewerReady);
      socket.off('stream:offer', handleOffer);
      socket.off('stream:answer', handleAnswer);
      socket.off('stream:ice_candidate', handleIceCandidate);
      socket.off('stream:viewer_left', handleViewerLeft);
      socket.off('stream:host_left', handleHostLeft);
      socket.off('stream:chat_message', handleChatMessage);
      socket.off('stream:error', handleStreamError);
    };
  }, [enabled, isHost, streamId, createPeerConnection, offerToViewer]);

  const sendChatMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return;
      socketService.sendStreamChatMessage(streamId, message.trim());
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

  return {
    videoRef,
    isConnected,
    mediaError,
    hostOffline,
    chatMessages,
    sendChatMessage,
    toggleCameraTrack,
    toggleMicTrack,
  };
}
