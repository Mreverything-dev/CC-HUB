// frontend/src/features/livestream/hooks/useLiveStreamSignaling.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { socketService } from '@/lib/socket';
import { useChatStore } from '@/features/chat/store/chat.store';
import { livestreamService } from '@/services/api/livestream.service';
import { usePendingStreamStore } from '../store/pendingStream.store';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export type PipPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type PipSize = 'small' | 'medium' | 'large';

export interface PipConfig {
  position: PipPosition;
  size: PipSize;
  mirrored: boolean;
  hidden: boolean;
}

const DEFAULT_PIP_CONFIG: PipConfig = { position: 'bottom-right', size: 'small', mirrored: false, hidden: false };

// Fraction of the composited canvas's width the camera PiP occupies -
// mirrors GoLiveModal's own preview sizing (small/medium/large).
// Exported so LiveStreamStage's local PiP preview can size itself with the
// exact same fraction-of-frame ratio instead of its own fixed pixel widths -
// otherwise the streamer's local preview and what viewers actually receive
// in the composited stream are two independently-sized boxes with no
// guaranteed correspondence.
export const PIP_SIZE_RATIO: Record<PipSize, number> = { small: 0.22, medium: 0.32, large: 0.42 };

// The composite only needs to look like "a webcam in the corner of a
// screen share", not match the screen capture's own resolution/frame rate -
// drawing and then encoding a full 1440p/4K canvas at display refresh rate
// is real, avoidable CPU cost that shows up as viewer-side lag. Downscaling
// to 720p-ish and capping the draw rate cuts that cost substantially with
// no visible quality loss for this use case.
const COMPOSITE_MAX_DIMENSION = 1280;
const COMPOSITE_FPS = 20;

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
  /** Ephemeral "X joined/left the live." notice - never persisted as a
   * StreamComment, just interleaved into the same ordered chat list. */
  is_system?: boolean;
}

interface UseLiveStreamSignalingOptions {
  streamId: string;
  isHost: boolean;
  /** Only start acquiring media / signaling once the stream is confirmed live and viewable. */
  enabled: boolean;
  /** HOST only: called once, synchronously within the acquisition effect,
   * if a PiP config was actually claimed from Go Live setup - lets the
   * caller sync its OWN position/size/mirror UI state to match, without
   * racing to separately read the (one-shot, already-cleared-by-then)
   * pending store itself. */
  onClaimedPipConfig?: (config: PipConfig) => void;
}

/**
 * Drives the WebRTC side of a livestream over the app's existing Socket.IO
 * connection (see backend app/websocket/manager.py `stream:*` handlers).
 * Host: opens one RTCPeerConnection per viewer and pushes its local camera
 * track to each. Viewer: opens a single RTCPeerConnection to the host and
 * renders the incoming track. The server only relays SDP/ICE payloads and
 * enforces who's allowed to host/watch - it never touches media.
 */
export function useLiveStreamSignaling({ streamId, isHost, enabled, onClaimedPipConfig }: UseLiveStreamSignalingOptions) {
  // The livestream signaling reuses the app's single shared Socket.IO
  // connection (owned/connected by SocketProvider at the app root). That
  // connection may still be mid-handshake when this hook's effects first
  // run (e.g. a fresh page load straight into /live/:id), so every effect
  // below gates on this reactive flag instead of firing once and hoping the
  // socket happens to already be connected - otherwise host announcements/
  // viewer joins/event listeners can silently never happen.
  const isSocketConnected = useChatStore((s) => s.isConnected);

  // The actual <video> DOM node, kept as a plain ref for every internal
  // read/write in this hook. Exposed to the caller as a *callback* ref (see
  // `videoRef` below, returned at the bottom) rather than this object
  // directly - a callback fires the instant React attaches a NEW node to
  // it, for ANY reason (conditional rendering resolving, a remount, a key
  // change...), which is what lets a stream that arrives before the
  // <video> element exists yet still get attached the moment it does,
  // instead of only on the next unrelated re-render that happens to touch it.
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  // HOST only: a small camera-preview element shown as a PiP overlay while
  // screen-sharing (mirrors the same idea already used in GoLiveModal's own
  // dual-stream preview) - always bound to the camera specifically,
  // regardless of what the main videoElRef is currently showing.
  const pipVideoElRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  // HOST only: the composited "screen + camera-in-corner" pipeline. WebRTC
  // only ever sends ONE video track per sender - there's no such thing as a
  // "picture in picture" on the wire - so making the camera actually
  // visible to VIEWERS while screen-sharing means drawing both onto an
  // offscreen canvas every frame and sending THAT canvas's captured stream
  // instead of the raw screen track. These two <video> elements are never
  // attached to the DOM; they exist purely as decode sources for drawImage().
  const compositeScreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const compositeCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeStreamRef = useRef<MediaStream | null>(null);
  const compositeIntervalRef = useRef<number | null>(null);
  const pipConfigRef = useRef<PipConfig>(DEFAULT_PIP_CONFIG);
  // HOST only: mirrors the video compositing pipeline above, but for audio -
  // WebRTC sends one audio track per sender too, so "mic AND system/desktop
  // audio together" needs the two source tracks mixed into a single track
  // via the Web Audio API before sending, same idea as the canvas composite.
  // Whether system audio should be included at all (independent of whether
  // the mic is on - see updateOutgoingAudioSource) - seeded from GoLiveModal's
  // handoff, defaults off since a page refresh/direct link never has a
  // screen-share audio track to begin with.
  const isSystemAudioOnRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedAudioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micAudioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const systemAudioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  // Whichever audio track is currently being sent to viewers (mic-only,
  // system-audio-only, or the mixed track) - mirrors activeVideoTrackRef.
  const activeAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  // VIEWER only: the remote stream, built defensively by accumulating
  // tracks from `ontrack` rather than trusting `event.streams[0]` alone -
  // some paths/browsers can deliver that array empty even though the track
  // itself is valid.
  const remoteStreamRef = useRef<MediaStream | null>(null);
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
  // Browsers block autoplay of unmuted <video> without a fresh user gesture -
  // when that happens we fall back to muted playback (always allowed) so the
  // viewer actually SEES the stream, and surface this so the UI can prompt
  // them to unmute (a click on an already-playing element is always allowed).
  const [needsUnmute, setNeedsUnmute] = useState(false);

  // Persisted chat history: the database is the source of truth for
  // persistence, this socket connection is the source of truth for realtime
  // delivery only - fetched independently of `enabled` (a viewer opening a
  // page before the host goes live, or after it ended, should still see the
  // existing conversation). Merges rather than overwrites and dedupes by id
  // so a real-time message that arrives before this REST call resolves is
  // never duplicated, then re-sorts by server timestamp so history and
  // realtime messages interleave in the correct order regardless of which
  // arrived first.
  useEffect(() => {
    let cancelled = false;
    livestreamService
      .getComments(streamId)
      .then((res) => {
        if (cancelled) return;
        setChatMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const history = (res.data as unknown as StreamChatMsg[]).filter((m) => !existingIds.has(m.id));
          if (history.length === 0) return prev;
          return [...prev, ...history].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        });
      })
      .catch((err) => {
        console.error('Failed to load stream chat history:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [streamId]);

  // VIEWER only: attach the remote stream to the <video> element and make
  // sure it actually plays. autoPlay + unmuted is silently blocked by every
  // major browser without a fresh user gesture - `.play()` here surfaces
  // that instead of failing invisibly, and falls back to muted playback
  // (which browsers always allow) so the viewer sees video even if audio
  // needs an explicit unmute click afterward.
  const attachRemoteStream = useCallback((stream: MediaStream) => {
    const video = videoElRef.current;
    if (!video) {
      console.warn('[WebRTC] Remote stream ready but no <video> element is mounted yet');
      return;
    }
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      console.log('[WebRTC] Attaching remote stream to video element');
    }
    video.play().then(
      () => console.log('[WebRTC] Video playback started'),
      (err) => {
        console.warn('[WebRTC] Autoplay blocked, retrying muted:', err?.name || err);
        video.muted = true;
        setNeedsUnmute(true);
        video.play().catch((err2) => console.error('[WebRTC] Muted autoplay also failed:', err2));
      }
    );
  }, []);

  const createPeerConnection = useCallback(
    (remoteSid: string) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.sendStreamIceCandidate(streamId, remoteSid, event.candidate.toJSON());
        }
      };

      pc.onsignalingstatechange = () => console.log('[WebRTC] signalingState:', pc.signalingState);
      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] iceConnectionState:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          console.error('[WebRTC] ICE failed - likely needs a TURN server for this network path');
        }
      };
      pc.onicegatheringstatechange = () => console.log('[WebRTC] iceGatheringState:', pc.iceGatheringState);

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] connectionState:', pc.connectionState);
        if (pc.connectionState === 'connected') setIsConnected(true);
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
          if (peersRef.current.get(remoteSid) === pc) {
            peersRef.current.delete(remoteSid);
          }
          if (pc.connectionState !== 'closed') setIsConnected(false);
        }
      };

      if (!isHost) {
        // Reset per fresh peer connection (a new host connection means a new
        // remote stream, not a continuation of a stale one).
        remoteStreamRef.current = null;

        pc.ontrack = (event) => {
          console.log('[WebRTC] Remote track received:', event.track.kind);
          // event.streams[0] is normally populated (the host adds tracks via
          // addTrack(track, localStream)), but a defensive fallback that
          // accumulates tracks manually covers any path/browser where it
          // isn't, rather than silently dropping the track.
          let stream = event.streams[0];
          if (stream) {
            remoteStreamRef.current = stream;
          } else {
            if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
            remoteStreamRef.current.addTrack(event.track);
            stream = remoteStreamRef.current;
          }
          console.log('[WebRTC] Remote stream received');
          attachRemoteStream(stream);
          setIsConnected(true);
        };
      }

      peersRef.current.set(remoteSid, pc);
      return pc;
    },
    [isHost, streamId, attachRemoteStream]
  );

  const offerToViewer = useCallback(
    async (viewerSid: string) => {
      const localStream = localStreamRef.current;
      if (!localStream) {
        pendingViewersRef.current.add(viewerSid);
        return;
      }
      const pc = createPeerConnection(viewerSid);
      // Send whichever video/audio track is currently live (camera or
      // screen-share video; mic, system audio, or a mix of both - see
      // updateOutgoingAudioSource), so viewers who join mid-share get the
      // right source instead of whatever was true at connection start.
      const videoTrack = activeVideoTrackRef.current ?? localStream.getVideoTracks()[0];
      const audioTrack = activeAudioTrackRef.current ?? localStream.getAudioTracks()[0];
      console.log('[WebRTC] Adding tracks to peer connection for viewer', viewerSid, {
        video: videoTrack ? 1 : 0,
        audio: audioTrack ? 1 : 0,
      });
      if (videoTrack) pc.addTrack(videoTrack, localStream);
      if (audioTrack) pc.addTrack(audioTrack, localStream);
      try {
        console.log('[WebRTC] Creating offer');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.sendStreamOffer(streamId, viewerSid, offer);
        console.log('[WebRTC] Offer sent');
      } catch (err) {
        console.error('[WebRTC] Failed to create/send stream offer:', err);
      }
    },
    [createPeerConnection, streamId]
  );

  /** Renegotiates an existing peer connection - used when a track is added
   * post-connection (e.g. addTrack for a viewer whose peer connection had no
   * video sender yet, see replaceOutgoingVideoTrack's fallback below). */
  const renegotiate = useCallback(
    async (remoteSid: string, pc: RTCPeerConnection) => {
      try {
        console.log('[WebRTC] Renegotiating with', remoteSid);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.sendStreamOffer(streamId, remoteSid, offer);
      } catch (err) {
        console.error('[WebRTC] Renegotiation failed:', err);
      }
    },
    [streamId]
  );

  // HOST: acquire camera/mic and clean up on unmount. Deliberately does NOT
  // depend on isSocketConnected - re-running this on every reconnect would
  // re-prompt for camera/mic and tear down a perfectly good local stream.
  useEffect(() => {
    if (!enabled || !isHost) return;
    let cancelled = false;

    (async () => {
      // Reuse the camera/mic/screen streams already acquired during Go Live
      // setup (GoLiveModal) instead of prompting for permission again and
      // risking a different device being picked the second time - these are
      // the SAME MediaStream objects, not a new capture. A direct link/page
      // refresh never populates this, so claiming it just returns nulls and
      // the fresh-getUserMedia path below runs exactly as it always has.
      const pending = usePendingStreamStore.getState().claimPendingStreams();
      const pendingCameraLive = !!pending.cameraStream?.getTracks().some((t) => t.readyState === 'live');
      const pendingMicLive = !!pending.micStream?.getTracks().some((t) => t.readyState === 'live');
      const pendingScreenLive = !!pending.screenStream?.getTracks().some((t) => t.readyState === 'live');
      const hasAnyPending = pendingCameraLive || pendingMicLive || pendingScreenLive;

      if (hasAnyPending) {
        // Seed the compositor with the position/size/mirror already chosen
        // in setup, and let the caller sync its own UI to match - reading
        // this straight off `pending` here (not re-querying the store
        // separately later) is what avoids racing the one-shot claim above.
        pipConfigRef.current = pending.pipConfig;
        onClaimedPipConfig?.(pending.pipConfig);
        isSystemAudioOnRef.current = pending.isSystemAudioOn;
      }

      let mediaStream: MediaStream;
      let reusedPending = false;

      if (hasAnyPending) {
        reusedPending = true;
        // Reuse exactly the tracks the user actually chose during setup -
        // never fall back to a fresh getUserMedia() just because no camera
        // track was handed off. That fallback used to run unconditionally
        // whenever pending.cameraStream was null (e.g. a screen-only
        // broadcast with the camera never turned on), which silently started
        // the camera hardware the user explicitly chose not to use AND left
        // the real pending.screenStream completely unclaimed/unused. Camera
        // and mic were independently acquired in GoLiveModal (see
        // startCamera/startMic there), so their tracks are simply combined
        // into one container here - every existing getVideoTracks()/
        // getAudioTracks() call elsewhere in this file keeps working
        // unchanged against that container.
        mediaStream = new MediaStream();
        if (pendingCameraLive) {
          pending.cameraStream!.getVideoTracks().forEach((t) => mediaStream.addTrack(t));
        } else {
          pending.cameraStream?.getTracks().forEach((t) => t.stop());
        }
        if (pendingMicLive) {
          pending.micStream!.getAudioTracks().forEach((t) => {
            t.enabled = pending.isMicOn;
            mediaStream.addTrack(t);
          });
        } else {
          pending.micStream?.getTracks().forEach((t) => t.stop());
        }
        console.log('[WebRTC] Reusing camera/mic streams from Go Live setup', {
          camera: pendingCameraLive,
          mic: pendingMicLive,
        });
      } else {
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
      }

      if (cancelled) {
        mediaStream.getTracks().forEach((t) => t.stop());
        if (reusedPending) pending.screenStream?.getTracks().forEach((t) => t.stop());
        return;
      }
      console.log('[WebRTC] Local stream acquired');
      console.log('[WebRTC] Video tracks:', mediaStream.getVideoTracks().length);
      console.log('[WebRTC] Audio tracks:', mediaStream.getAudioTracks().length);
      localStreamRef.current = mediaStream;

      // Inherit an active screen-share from setup too, so whichever source
      // (screen or camera) was primary in GoLiveModal stays primary here -
      // independent of whether a camera/mic track was also reused above.
      if (reusedPending && pendingScreenLive) {
        screenStreamRef.current = pending.screenStream;
        setIsScreenSharing(true);
        const [screenTrack] = pending.screenStream!.getVideoTracks();
        if (screenTrack) screenTrack.onended = () => stopScreenShare();
        console.log('[WebRTC] Reusing screen-share stream from Go Live setup');
      } else {
        if (reusedPending) pending.screenStream?.getTracks().forEach((t) => t.stop());
        activeVideoTrackRef.current = mediaStream.getVideoTracks()[0] ?? null;
      }

      if (videoElRef.current) {
        videoElRef.current.srcObject = screenStreamRef.current ?? mediaStream;
        videoElRef.current.play().catch((err) => console.warn('[WebRTC] Local preview play() failed:', err));
      }
      reattachPipStream();
      // Sets activeVideoTrackRef correctly for the pendingScreen case above
      // (composited if the camera is also on and visible, raw screen track
      // otherwise) - a no-op for viewer routing right now since no peer
      // connections exist yet, but this is what offerToViewer reads from
      // the moment the first viewer joins, so it must be correct by now.
      updateOutgoingVideoSource();
      updateOutgoingAudioSource();
      setHasLocalMedia(true);
    })();

    return () => {
      cancelled = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      stopCompositing();
      stopAudioMixing();
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      isSystemAudioOnRef.current = false;
      activeAudioTrackRef.current = null;
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
      // A fresh offer is proof the host is back - without this, a host who
      // briefly dropped and reconnected would stay permanently marked
      // offline for this viewer (nothing else ever clears it), hiding the
      // <video> element forever even once media starts flowing again.
      setHostOffline(false);
      console.log('[WebRTC] Offer received from host');
      // Reuse the existing connection for this host sid if one's already up
      // (a renegotiation offer, e.g. the host adding a video track after
      // starting audio-only) instead of discarding it for a fresh one, which
      // would orphan whatever was already connected.
      const pc = peersRef.current.get(data.host_sid) ?? createPeerConnection(data.host_sid);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketService.sendStreamAnswer(streamId, answer);
        console.log('[WebRTC] Answer sent');
      } catch (err) {
        console.error('[WebRTC] Failed to handle stream offer:', err);
      }
    };

    const handleAnswer = async (data: { viewer_sid: string; sdp: RTCSessionDescriptionInit }) => {
      if (!isHost) return;
      const pc = peersRef.current.get(data.viewer_sid);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        console.log('[WebRTC] Answer applied for', data.viewer_sid);
      } catch (err) {
        console.error('[WebRTC] Failed to apply stream answer:', err);
      }
    };

    const handleIceCandidate = async (data: { from_sid: string; candidate: RTCIceCandidateInit }) => {
      const pc = peersRef.current.get(data.from_sid);
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('[WebRTC] Failed to add ICE candidate:', err);
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
      remoteStreamRef.current = null;
      if (videoElRef.current) videoElRef.current.srcObject = null;
    };

    const handleChatMessage = (data: StreamChatMsg) => {
      setChatMessages((prev) => [...prev, { ...data, reactions: data.reactions ?? [] }]);
    };

    const handleSystemMessage = (data: { stream_id: string; message: string; timestamp: string }) => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          user_id: 'system',
          username: 'System',
          message: data.message,
          timestamp: data.timestamp,
          reactions: [],
          is_system: true,
        },
      ]);
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
    socket.on('stream:system_message', handleSystemMessage);
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
      socket.off('stream:system_message', handleSystemMessage);
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

  /** Swaps the outgoing video track on every live peer connection. Most
   * peers already have a video sender (from the initial offer) so this is
   * just replaceTrack() - no renegotiation needed. A peer that connected
   * with NO video track at all (host started audio/screen-only) has no
   * video sender to replace, so falls back to addTrack + a fresh
   * renegotiation offer instead of silently doing nothing. */
  const replaceOutgoingVideoTrack = useCallback(
    (track: MediaStreamTrack) => {
      activeVideoTrackRef.current = track;
      peersRef.current.forEach((pc, remoteSid) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(track).catch((err) => console.error('[WebRTC] replaceTrack failed:', err));
        } else {
          pc.addTrack(track);
          renegotiate(remoteSid, pc);
        }
      });
    },
    [renegotiate]
  );

  /** Mirrors replaceOutgoingVideoTrack, for audio. Never called with `null`
   * (see updateOutgoingAudioSource - "nothing to send" is represented by
   * sending a disabled/silent track, exactly how the pre-existing
   * microphone mute already worked), so a sender's track is always
   * identifiable by kind on every call, same guarantee the video version
   * already relies on. */
  const replaceOutgoingAudioTrack = useCallback(
    (track: MediaStreamTrack) => {
      activeAudioTrackRef.current = track;
      peersRef.current.forEach((pc, remoteSid) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (sender) {
          sender.replaceTrack(track).catch((err) => console.error('[WebRTC] replaceTrack (audio) failed:', err));
        } else {
          pc.addTrack(track);
          renegotiate(remoteSid, pc);
        }
      });
    },
    [renegotiate]
  );

  const stopAudioMixing = useCallback(() => {
    micAudioSourceNodeRef.current?.disconnect();
    micAudioSourceNodeRef.current = null;
    systemAudioSourceNodeRef.current?.disconnect();
    systemAudioSourceNodeRef.current = null;
    mixedAudioDestRef.current?.stream.getTracks().forEach((t) => t.stop());
    mixedAudioDestRef.current = null;
  }, []);

  /** Decides what viewers should actually hear right now - mic-only, system
   * (desktop) audio only, both mixed together via the Web Audio API, or
   * silence - and swaps the outgoing audio track accordingly. Mirrors
   * updateOutgoingVideoSource's "decide, then replaceTrack" shape exactly.
   *
   * Muting is handled entirely through each source track's own `.enabled`
   * flag (exactly how the microphone toggle already worked before this),
   * never by swapping to a null track - a disabled track still sends
   * silence over WebRTC, and a MediaStreamAudioSourceNode still respects its
   * source track's `.enabled` when feeding the mixer. That's what makes all
   * four Mic/System combinations fall out of just two real branches below,
   * with no separate "both off" case to hand-write. */
  const updateOutgoingAudioSource = useCallback(() => {
    const micTrack = localStreamRef.current?.getAudioTracks()[0] ?? null;
    const systemTrack = isSystemAudioOnRef.current
      ? screenStreamRef.current?.getAudioTracks().find((t) => t.readyState === 'live') ?? null
      : null;

    if (micTrack && systemTrack) {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      const ctx = audioContextRef.current;
      ctx.resume().catch(() => {});
      if (!mixedAudioDestRef.current) mixedAudioDestRef.current = ctx.createMediaStreamDestination();
      const dest = mixedAudioDestRef.current;

      // Source nodes are tied to whatever track they were created from, so
      // they're rebuilt any time this recomputes (cheap, and idempotent
      // callers like screen-share start/stop don't run often enough for
      // that to matter).
      micAudioSourceNodeRef.current?.disconnect();
      micAudioSourceNodeRef.current = ctx.createMediaStreamSource(new MediaStream([micTrack]));
      micAudioSourceNodeRef.current.connect(dest);

      systemAudioSourceNodeRef.current?.disconnect();
      systemAudioSourceNodeRef.current = ctx.createMediaStreamSource(new MediaStream([systemTrack]));
      systemAudioSourceNodeRef.current.connect(dest);

      const mixedTrack = dest.stream.getAudioTracks()[0];
      if (mixedTrack) {
        replaceOutgoingAudioTrack(mixedTrack);
        return;
      }
    }

    stopAudioMixing();
    const fallbackTrack = systemTrack ?? micTrack;
    if (fallbackTrack) replaceOutgoingAudioTrack(fallbackTrack);
  }, [replaceOutgoingAudioTrack, stopAudioMixing]);

  const stopCompositing = useCallback(() => {
    if (compositeIntervalRef.current !== null) {
      clearInterval(compositeIntervalRef.current);
      compositeIntervalRef.current = null;
    }
    compositeStreamRef.current?.getTracks().forEach((t) => t.stop());
    compositeStreamRef.current = null;
  }, []);

  /** Draws the screen (downscaled, see COMPOSITE_MAX_DIMENSION) and the
   * camera (small, positioned per pipConfigRef) onto an offscreen canvas at
   * a fixed, capped rate (COMPOSITE_FPS, via setInterval rather than
   * requestAnimationFrame - a composite feeding captureStream() only needs
   * to hit a steady target rate, not the display's own refresh rate, and
   * drawing/encoding more often than that is pure wasted CPU that shows up
   * as lag), and returns a MediaStream whose video track IS that composited
   * canvas. This is the only way to make the camera PiP actually visible to
   * viewers - WebRTC sends one video track per sender, there's no "picture
   * in picture" on the wire, so the composite has to happen before the
   * track is sent, not on the receiving end. Idempotent: safe to call while
   * already running. */
  const startCompositing = useCallback(() => {
    const screenStream = screenStreamRef.current;
    const cameraStream = localStreamRef.current;
    if (!screenStream) return null;

    const ensureOffscreenVideo = (stream: MediaStream, ref: React.MutableRefObject<HTMLVideoElement | null>) => {
      if (!ref.current) ref.current = document.createElement('video');
      const video = ref.current;
      video.muted = true;
      video.playsInline = true;
      if (video.srcObject !== stream) video.srcObject = stream;
      video.play().catch(() => {});
      return video;
    };

    const screenVideo = ensureOffscreenVideo(screenStream, compositeScreenVideoRef);
    const cameraVideo = cameraStream && cameraStream.getVideoTracks().length > 0
      ? ensureOffscreenVideo(cameraStream, compositeCameraVideoRef)
      : null;

    if (!compositeCanvasRef.current) compositeCanvasRef.current = document.createElement('canvas');
    const canvas = compositeCanvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    if (compositeIntervalRef.current === null) {
      const draw = () => {
        if (screenVideo.videoWidth === 0) return;

        // Downscale to a capped resolution instead of matching the
        // screen's native capture size - a 1440p/4K canvas costs
        // dramatically more to draw AND encode every frame than a ~720p
        // one, for no visible benefit on a "webcam in the corner" overlay.
        const scale = Math.min(
          1,
          COMPOSITE_MAX_DIMENSION / Math.max(screenVideo.videoWidth, screenVideo.videoHeight)
        );
        const targetW = Math.round(screenVideo.videoWidth * scale);
        const targetH = Math.round(screenVideo.videoHeight * scale);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

        const cfg = pipConfigRef.current;
        if (cameraVideo && cameraVideo.videoWidth > 0 && !cfg.hidden) {
          const pipW = canvas.width * PIP_SIZE_RATIO[cfg.size];
          const pipH = pipW * (cameraVideo.videoHeight / cameraVideo.videoWidth);
          const margin = canvas.width * 0.02;
          // Bottom placements get extra clearance from the edge - matches
          // the equivalent offset in LiveStreamStage's PIP_POSITION_CLASSES,
          // which pushes the host's local preview up above their own
          // on-screen player controls (a full-width bar pinned to the
          // bottom edge). Keeping both offsets in sync keeps what the host
          // sees a true WYSIWYG preview of what's actually composited.
          const bottomClearance = canvas.height * 0.12;
          const x = cfg.position.includes('right') ? canvas.width - pipW - margin : margin;
          const y = cfg.position.includes('bottom') ? canvas.height - pipH - bottomClearance : margin;

          ctx.save();
          if (cfg.mirrored) {
            ctx.translate(x + pipW, y);
            ctx.scale(-1, 1);
            ctx.drawImage(cameraVideo, 0, 0, pipW, pipH);
          } else {
            ctx.drawImage(cameraVideo, x, y, pipW, pipH);
          }
          ctx.restore();
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = Math.max(2, canvas.width * 0.0015);
          ctx.strokeRect(x, y, pipW, pipH);
        }
      };
      draw(); // first frame immediately, so the stream isn't blank until the first interval tick
      compositeIntervalRef.current = window.setInterval(draw, 1000 / COMPOSITE_FPS);
    }

    if (!compositeStreamRef.current) {
      compositeStreamRef.current = canvas.captureStream(COMPOSITE_FPS);
    }
    return compositeStreamRef.current;
  }, []);

  /** Decides what viewers should actually receive right now - the
   * composited screen+camera canvas (screen-sharing, camera on, PiP not
   * hidden), the raw screen track (screen-sharing with no visible camera),
   * or the raw camera track (no screen share) - and swaps the outgoing
   * track accordingly. Called any time any of those inputs change. */
  const updateOutgoingVideoSource = useCallback(() => {
    const isSharingScreen = !!screenStreamRef.current;
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    const cameraVisible = !!cameraTrack && cameraTrack.enabled && !pipConfigRef.current.hidden;

    if (isSharingScreen && cameraVisible) {
      const compositeTrack = startCompositing()?.getVideoTracks()[0];
      if (compositeTrack) replaceOutgoingVideoTrack(compositeTrack);
      return;
    }

    stopCompositing();
    const fallbackTrack = isSharingScreen ? screenStreamRef.current?.getVideoTracks()[0] : cameraTrack;
    if (fallbackTrack) replaceOutgoingVideoTrack(fallbackTrack);
  }, [startCompositing, stopCompositing, replaceOutgoingVideoTrack]);

  /** Updates the camera PiP's position/size/mirror/hidden state - takes
   * effect on the very next composited frame, no restart needed, since the
   * draw loop reads pipConfigRef live. Toggling `hidden` additionally
   * starts/stops compositing itself (nothing to draw a hidden PiP into). */
  const setPipConfig = useCallback(
    (config: Partial<PipConfig>) => {
      const hiddenChanged = 'hidden' in config && config.hidden !== pipConfigRef.current.hidden;
      pipConfigRef.current = { ...pipConfigRef.current, ...config };
      if (hiddenChanged) updateOutgoingVideoSource();
    },
    [updateOutgoingVideoSource]
  );

  const toggleCameraTrack = useCallback(
    (on: boolean) => {
      localStreamRef.current?.getVideoTracks().forEach((t) => {
        t.enabled = on;
      });
      updateOutgoingVideoSource();
    },
    [updateOutgoingVideoSource]
  );

  const toggleMicTrack = useCallback((on: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
  }, []);

  const stopScreenShare = useCallback(() => {
    // .getTracks() covers the system-audio track too, if there was one -
    // it lives on this same MediaStream, not a separate one.
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setIsScreenSharing(false);
    isSystemAudioOnRef.current = false;
    if (videoElRef.current) videoElRef.current.srcObject = localStreamRef.current;
    updateOutgoingVideoSource();
    updateOutgoingAudioSource();
  }, [updateOutgoingVideoSource, updateOutgoingAudioSource]);

  const startScreenShare = useCallback(async () => {
    if (!isHost) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;

      screenStreamRef.current = screenStream;
      if (videoElRef.current) videoElRef.current.srcObject = screenStream;
      setIsScreenSharing(true);
      // Whatever system/desktop-audio track the browser happened to grant
      // for this share (never guaranteed) is included by default - there's
      // no GoLiveModal-equivalent setup step for a mid-broadcast screen
      // share to have set this via, so "on if available" is the only sane
      // default (same as GoLiveModal's own default-on-when-available).
      isSystemAudioOnRef.current = screenStream.getAudioTracks().length > 0;
      updateOutgoingVideoSource();
      updateOutgoingAudioSource();

      // Browser's native "Stop sharing" bar/button ends the track directly.
      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      // User cancelling the picker rejects the promise - not a real error.
      console.warn('[WebRTC] Screen share not started:', err);
    }
  }, [isHost, updateOutgoingVideoSource, updateOutgoingAudioSource, stopScreenShare]);

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
    // Viewer: the remote stream received over WebRTC (kept in this ref the
    // moment `ontrack` fires, independent of the <video> element's own
    // srcObject/mount state) - never the thumbnail or local preview.
    const sourceStream = isHost ? localStreamRef.current : remoteStreamRef.current;
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

  const acknowledgeUnmute = useCallback(() => setNeedsUnmute(false), []);

  /** HOST only: whichever MediaStream the host is currently broadcasting
   * locally - the active screen-share stream if one is running, otherwise
   * the camera/mic stream. Single source of truth for "what should the
   * host's own local preview show right now", used by startScreenShare,
   * stopScreenShare, and reattachStream alike so they can never drift out
   * of sync with each other. */
  const getHostPreviewStream = useCallback(() => screenStreamRef.current ?? localStreamRef.current, []);

  /** Re-attaches whichever stream should currently be showing to whatever
   * <video> element videoElRef now points to. Does nothing if there's no
   * stream yet, or no element mounted. */
  const reattachStream = useCallback(() => {
    const video = videoElRef.current;
    if (!video) return;
    if (isHost) {
      const previewStream = getHostPreviewStream();
      if (previewStream) {
        video.srcObject = previewStream;
        video.play().catch((err) => console.warn('[WebRTC] Local preview play() failed:', err));
      }
    } else if (remoteStreamRef.current) {
      attachRemoteStream(remoteStreamRef.current);
    }
  }, [isHost, attachRemoteStream, getHostPreviewStream]);

  // The callback ref returned as `videoRef` below - pass it directly to
  // <video ref={videoRef}>. Unlike a plain useRef object, this function
  // fires the instant React attaches (or detaches) a DOM node, for ANY
  // reason: `isLoading` resolving, `showPlayer` flipping true, a minimize/
  // restore remount, anything. That's what makes attachment reliable
  // regardless of *why* or *when* the <video> element appears - a stream
  // that already arrived (ontrack fired before any <video> existed to
  // attach it to) gets attached the moment an element shows up, instead of
  // silently staying unattached until some unrelated state change happens
  // to re-run the attach logic.
  const videoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoElRef.current = el;
      if (el) reattachStream();
    },
    [reattachStream]
  );

  /** HOST only: re-attaches the camera specifically (never the screen) to
   * whatever <video> element pipVideoElRef now points to - the small PiP
   * overlay shown while screen-sharing. Same callback-ref rationale as
   * videoRef: this overlay is conditionally rendered (only while screen-
   * sharing with the camera on), so its <video> element mounts/unmounts on
   * its own schedule and needs the same "reattach on mount" treatment. */
  const reattachPipStream = useCallback(() => {
    const video = pipVideoElRef.current;
    if (!video || !isHost) return;
    const camStream = localStreamRef.current;
    if (camStream && camStream.getVideoTracks().length > 0) {
      if (video.srcObject !== camStream) video.srcObject = camStream;
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [isHost]);

  const pipVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      pipVideoElRef.current = el;
      if (el) reattachPipStream();
    },
    [reattachPipStream]
  );

  return {
    // Callback ref - pass directly to <video ref={videoRef}>.
    videoRef,
    // Plain ref object holding the same element, for imperative reads
    // elsewhere (play/pause/mute controls) - .current is always in sync
    // with whatever videoRef last attached.
    videoElRef,
    // HOST only: callback ref for the small camera PiP overlay shown while
    // screen-sharing - pass directly to <video ref={pipVideoRef}>.
    pipVideoRef,
    isConnected,
    // HOST only: true once getUserMedia()/its fallbacks have resolved and
    // the local <video> preview actually has something to show - distinct
    // from `isHost` itself (true immediately once the stream is marked live
    // server-side, well before the camera/mic prompt even resolves) and
    // from `isConnected` (tracks peer connections to VIEWERS, which stays
    // false for a host with nobody watching yet even though their own
    // camera is perfectly fine).
    hasLocalMedia,
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
    // HOST only: adjusts the camera PiP that's actually composited into the
    // outgoing broadcast (position/size/mirror/hidden) - see setPipConfig.
    setPipConfig,
    isRecording,
    toggleRecording,
    // True once the browser's autoplay policy forced the incoming stream to
    // start muted - the UI should prompt the viewer to unmute (a click on an
    // already-playing element is always allowed, unlike starting unmuted).
    needsUnmute,
    acknowledgeUnmute,
    reattachStream,
  };
}
