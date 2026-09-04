// frontend/src/features/livestream/hooks/useMeethubMeshSignaling.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { socketService } from '@/lib/socket';
import { useChatStore } from '@/features/chat/store/chat.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { livestreamService } from '@/services/api/livestream.service';
import { usePendingStreamStore } from '../store/pendingStream.store';
import toast from 'react-hot-toast';

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
  is_system?: boolean;
}

export interface MeshParticipant {
  sid: string;
  userId: string;
  username: string;
}

interface UseMeethubMeshSignalingOptions {
  streamId: string;
  enabled: boolean;
  /** Fired when the organizer removes this user from the meeting - the page
   * should navigate away. */
  onRemoved?: () => void;
}

/**
 * True multi-party WebRTC mesh for a Meethub session: every participant
 * opens a direct peer connection to every other participant, over the app's
 * existing Socket.IO connection (see backend app/websocket/manager.py's
 * "MEETHUB MESH SIGNALING" section - meeting:mesh_offer/answer/ice_candidate
 * mirror the existing single-host stream:offer/answer/ice_candidate relay
 * pattern, just symmetric). Camera/mic are OFF by default and acquired
 * lazily, once, the first time the user toggles each on - every toggle after
 * that is a plain track.enabled flip (no renegotiation), which is what keeps
 * this robust instead of renegotiating on every click.
 *
 * This hook does not import from or modify useLiveStreamSignaling.ts at all
 * - that hook stays exactly as it was for plain Livestream, single-host
 * broadcasts. The small chat slice below is intentionally duplicated (not
 * shared) from it, since it's simple and genuinely identical, and pulling a
 * shared piece out risks destabilizing the untouched Livestream code path.
 */
export function useMeethubMeshSignaling({ streamId, enabled, onRemoved }: UseMeethubMeshSignalingOptions) {
  const isSocketConnected = useChatStore((s) => s.isConnected);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  // Every peer connection always gets exactly one video + one audio
  // transceiver up front - a real sender if we already have that kind of
  // track, or a 'recvonly' placeholder if we don't yet. This is what makes
  // renegotiation safe regardless of who happens to initiate the offer: per
  // WebRTC's offer/answer rules, an ANSWER can never introduce a media line
  // that wasn't in the OFFER, so a receive-only participant's offer (zero
  // tracks) would otherwise have no m=video/m=audio line at all for the
  // other side's already-attached camera/mic to be answered into - the
  // track would silently never reach the wire. Declaring recvonly
  // placeholders upfront guarantees both m-lines always exist, so whichever
  // side later gets a track just upgrades that line's direction to
  // sendrecv/sendonly in a renegotiation instead of needing a new line.
  const videoTransceiversRef = useRef<Map<string, RTCRtpTransceiver>>(new Map());
  const audioTransceiversRef = useRef<Map<string, RTCRtpTransceiver>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // True once meeting:mesh_peers has actually arrived for this join - the
  // server can only send it from inside stream_viewer_join AFTER that
  // handler's own async DB work has finished registering us
  // (_is_registered_viewer). meeting:request_present requires that same
  // registration, so anything that requests the presenter slot (the Go
  // Live carry-over claim below, or a user clicking Share Screen) must wait
  // for this instead of firing immediately - emitting too early was
  // silently rejected ("Not a recognized participant of this meeting"),
  // which broke both the presentation and the system audio riding on it.
  const isJoinConfirmedRef = useRef(false);
  const needsPresentRequestRef = useRef(false);
  const localCameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const localMicTrackRef = useRef<MediaStreamTrack | null>(null);
  const localScreenTrackRef = useRef<MediaStreamTrack | null>(null);
  // The screen share's system/desktop-audio track, if the browser granted
  // one - independent of the mic, since a peer connection only carries ONE
  // outgoing audio track. When both are present they're mixed into a single
  // combined track (see updateOutgoingAudioTrack) using the exact same Web
  // Audio API approach useLiveStreamSignaling.ts already uses for plain
  // Livestream's own mic+system-audio mixing.
  const localSystemAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  // Whatever is CURRENTLY actually attached to every peer's audio sender -
  // the raw mic track, the raw system-audio track, or a mixed track - kept
  // separate from localMicTrackRef so mic on/off state (isMicOn, force-mute)
  // never has to know or care whether mixing is happening underneath it.
  const outgoingAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micAudioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const systemAudioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mixedAudioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const localStreamObjRef = useRef<MediaStream>(new MediaStream());

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // Single-presenter lock, server-authoritative (see backend
  // manager.py's meeting_presenters) - null means nobody is presenting.
  // Screen sharing only; camera/mic are never gated by this.
  const [presenterUserId, setPresenterUserId] = useState<string | null>(null);
  const [presenterUsername, setPresenterUsername] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Map<string, MeshParticipant>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [chatMessages, setChatMessages] = useState<StreamChatMsg[]>([]);

  // The local self-view mirrors whatever is actually being sent out - screen
  // takes priority over camera, exactly matching setOutgoingVideoTrack's own
  // priority rule - so the presenter's own tile shows their screen while
  // sharing instead of going blank (the remote side was always receiving it
  // correctly; only the local preview was never wired up to show it).
  const refreshLocalStreamObj = useCallback(() => {
    const ms = localStreamObjRef.current;
    ms.getTracks().forEach((t) => ms.removeTrack(t));
    const videoTrack = localScreenTrackRef.current || localCameraTrackRef.current;
    if (videoTrack) ms.addTrack(videoTrack);
    if (localMicTrackRef.current) ms.addTrack(localMicTrackRef.current);
    setLocalStream(new MediaStream(ms.getTracks()));
  }, []);

  // ---- Chat history (persisted) - same StreamComment table/endpoint as the
  // existing Livestream chat, just fetched/subscribed independently here. ----
  useEffect(() => {
    if (!streamId) return;
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
      .catch((err) => console.error('Failed to load meeting chat history:', err));
    return () => {
      cancelled = true;
    };
  }, [streamId]);

  const flushPendingIce = useCallback(async (remoteSid: string, pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current.get(remoteSid);
    if (!queued || queued.length === 0) return;
    pendingIceRef.current.delete(remoteSid);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[Meethub] Failed to add queued ICE candidate:', err);
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (remoteSid: string): RTCPeerConnection => {
      const existing = peersRef.current.get(remoteSid);
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.emit('meeting:mesh_ice_candidate', {
            stream_id: streamId,
            target_sid: remoteSid,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          const existingStream = next.get(remoteSid) ?? new MediaStream();
          if (!existingStream.getTracks().includes(event.track)) {
            existingStream.addTrack(event.track);
          }
          next.set(remoteSid, new MediaStream(existingStream.getTracks()));
          return next;
        });
        event.track.onended = () => {
          setRemoteStreams((prev) => {
            const stream = prev.get(remoteSid);
            if (!stream) return prev;
            stream.removeTrack(event.track);
            const next = new Map(prev);
            next.set(remoteSid, new MediaStream(stream.getTracks()));
            return next;
          });
        };
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
          if (peersRef.current.get(remoteSid) === pc) {
            peersRef.current.delete(remoteSid);
            videoTransceiversRef.current.delete(remoteSid);
            audioTransceiversRef.current.delete(remoteSid);
          }
        }
      };
      peersRef.current.set(remoteSid, pc);
      return pc;
    },
    [streamId]
  );

  // Resolves (creating if necessary) this peer's video/audio transceivers
  // and attaches whatever local tracks currently exist. Must be called at
  // two different points depending on role, because a browser's incoming
  // offer always creates ITS OWN fresh transceivers for its m-lines rather
  // than reusing ones added beforehand via addTransceiver() - confirmed by
  // direct inspection: pre-creating transceivers before setRemoteDescription
  // left them permanently unassociated (mid stays null forever) while two
  // brand-new ones appeared from the offer instead, so a track attached to
  // the pre-created ones never reached the wire. So:
  //  - Offering (sendOfferTo): call BEFORE createOffer() - pc has no
  //    transceivers yet, so this creates them, and createOffer() serializes
  //    them into the offer's m-lines.
  //  - Answering (handleMeshOffer): call AFTER setRemoteDescription() - the
  //    incoming offer has already created the transceivers; this just finds
  //    them and attaches our track/upgrades direction if we have one.
  // Idempotent per remoteSid via the ref maps, so calling it from both
  // places over a connection's lifetime is safe.
  const ensureTransceivers = useCallback((pc: RTCPeerConnection, remoteSid: string) => {
    if (!videoTransceiversRef.current.has(remoteSid)) {
      const outgoingVideo = localScreenTrackRef.current || localCameraTrackRef.current;
      const existing = pc.getTransceivers().find((t) => (t.receiver.track?.kind ?? t.sender.track?.kind) === 'video');
      let transceiver: RTCRtpTransceiver;
      if (existing) {
        transceiver = existing;
        if (outgoingVideo) {
          transceiver.sender.replaceTrack(outgoingVideo).catch((err) => console.error('[Meethub] initial video attach failed:', err));
          transceiver.direction = 'sendrecv';
        }
      } else {
        transceiver = outgoingVideo
          ? pc.addTransceiver(outgoingVideo, { direction: 'sendrecv', streams: [localStreamObjRef.current] })
          : pc.addTransceiver('video', { direction: 'recvonly' });
      }
      videoTransceiversRef.current.set(remoteSid, transceiver);
    }

    if (!audioTransceiversRef.current.has(remoteSid)) {
      // Reads whatever is CURRENTLY the correct thing to send (raw mic,
      // raw system audio, or a mixed combination of both - see
      // updateOutgoingAudioTrack), not the raw mic track directly, so a
      // presenter's system/desktop audio reaches a newly-connecting peer
      // exactly like their mic already does.
      const outgoingAudio = outgoingAudioTrackRef.current;
      const existing = pc.getTransceivers().find((t) => (t.receiver.track?.kind ?? t.sender.track?.kind) === 'audio');
      let transceiver: RTCRtpTransceiver;
      if (existing) {
        transceiver = existing;
        if (outgoingAudio) {
          transceiver.sender.replaceTrack(outgoingAudio).catch((err) => console.error('[Meethub] initial audio attach failed:', err));
          transceiver.direction = 'sendrecv';
        }
      } else {
        transceiver = outgoingAudio
          ? pc.addTransceiver(outgoingAudio, { direction: 'sendrecv', streams: [localStreamObjRef.current] })
          : pc.addTransceiver('audio', { direction: 'recvonly' });
      }
      audioTransceiversRef.current.set(remoteSid, transceiver);
    }
  }, []);

  const sendOfferTo = useCallback(
    async (remoteSid: string) => {
      const pc = createPeerConnection(remoteSid);
      ensureTransceivers(pc, remoteSid);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.emit('meeting:mesh_offer', { stream_id: streamId, target_sid: remoteSid, sdp: offer });
      } catch (err) {
        console.error('[Meethub] Failed to create/send offer:', err);
      }
    },
    [createPeerConnection, ensureTransceivers, streamId]
  );

  const closePeer = useCallback((remoteSid: string) => {
    const pc = peersRef.current.get(remoteSid);
    pc?.close();
    peersRef.current.delete(remoteSid);
    videoTransceiversRef.current.delete(remoteSid);
    audioTransceiversRef.current.delete(remoteSid);
    pendingIceRef.current.delete(remoteSid);
    setRemoteStreams((prev) => {
      if (!prev.has(remoteSid)) return prev;
      const next = new Map(prev);
      next.delete(remoteSid);
      return next;
    });
    setParticipants((prev) => {
      if (!prev.has(remoteSid)) return prev;
      const next = new Map(prev);
      next.delete(remoteSid);
      return next;
    });
  }, []);

  // ---- Join / mesh handshake / teardown ----
  useEffect(() => {
    if (!enabled || !isSocketConnected) return;

    // Reuse whatever camera/mic/screen was already captured during Go Live
    // setup (GoLiveModal) instead of starting empty and forcing the user to
    // re-toggle everything (and, for screen share, re-prompt for capture) -
    // same one-shot store useLiveStreamSignaling already claims for plain
    // Livestream. Must happen before joinStreamAsViewer so these refs are
    // already populated by the time any peer could possibly connect to us -
    // no peer can discover us until the server processes that join.
    const pending = usePendingStreamStore.getState().claimPendingStreams();
    const pendingCameraTrack = pending.cameraStream?.getVideoTracks().find((t) => t.readyState === 'live') ?? null;
    const pendingMicTrack = pending.micStream?.getAudioTracks().find((t) => t.readyState === 'live') ?? null;
    const pendingScreenTrack = pending.screenStream?.getVideoTracks().find((t) => t.readyState === 'live') ?? null;
    // The screen stream can carry its OWN audio track too (system/desktop
    // audio, requested by GoLiveModal's own getDisplayMedia({audio:true})
    // call) - previously extracted only the video track here and silently
    // dropped this one, which is why a presenter who pre-configured screen
    // share in Go Live setup never had their system audio reach viewers.
    const pendingSystemAudioTrack = pending.screenStream?.getAudioTracks().find((t) => t.readyState === 'live') ?? null;

    if (pendingCameraTrack) {
      localCameraTrackRef.current = pendingCameraTrack;
      setIsCameraOn(true);
    } else {
      pending.cameraStream?.getTracks().forEach((t) => t.stop());
    }
    if (pendingMicTrack) {
      pendingMicTrack.enabled = pending.isMicOn;
      localMicTrackRef.current = pendingMicTrack;
      setIsMicOn(pending.isMicOn);
    } else {
      pending.micStream?.getTracks().forEach((t) => t.stop());
    }
    if (pendingScreenTrack) {
      localScreenTrackRef.current = pendingScreenTrack;
      pendingScreenTrack.onended = () => {
        if (localScreenTrackRef.current === pendingScreenTrack) stopScreenShare();
      };
      setIsScreenSharing(true);
    }
    if (pendingSystemAudioTrack) {
      localSystemAudioTrackRef.current = pendingSystemAudioTrack;
      pendingSystemAudioTrack.onended = () => {
        if (localSystemAudioTrackRef.current === pendingSystemAudioTrack) {
          localSystemAudioTrackRef.current = null;
          updateOutgoingAudioTrack();
        }
      };
    }
    if (pendingCameraTrack || pendingMicTrack || pendingScreenTrack) {
      refreshLocalStreamObj();
    }
    if (pendingMicTrack || pendingSystemAudioTrack) {
      // No peers exist yet at this point, so this only computes and stores
      // outgoingAudioTrackRef (mixed if both are present) for
      // ensureTransceivers to read once the first peer actually connects -
      // exactly the same "seed the ref before joinStreamAsViewer" reasoning
      // already used for camera/screen above.
      updateOutgoingAudioTrack();
    }

    // Whether we still owe the server a formal presenter-slot request for a
    // screen carried over from Go Live setup - deferred until
    // isJoinConfirmedRef flips true (see handleMeshPeers below) rather than
    // fired right here. See isJoinConfirmedRef's own comment for why.
    isJoinConfirmedRef.current = false;
    needsPresentRequestRef.current = pendingScreenTrack !== null;

    socketService.joinStreamAsViewer(streamId);

    interface MeshPeersPayload {
      stream_id: string;
      peers: { sid: string; user_id: string; username: string | null }[];
    }
    interface MeshPeerJoinedPayload {
      stream_id: string;
      sid: string;
      user_id: string;
      username: string | null;
    }
    interface MeshSdpPayload {
      stream_id: string;
      from_sid: string;
      sdp: RTCSessionDescriptionInit;
    }
    interface MeshIcePayload {
      stream_id: string;
      from_sid: string;
      candidate: RTCIceCandidateInit;
    }
    interface MeshPeerLeftPayload {
      stream_id: string;
      sid: string;
    }

    const handleMeshPeers = (data: MeshPeersPayload) => {
      if (data.stream_id !== streamId) return;
      setParticipants((prev) => {
        const next = new Map(prev);
        data.peers.forEach((p) => next.set(p.sid, { sid: p.sid, userId: p.user_id, username: p.username || 'Participant' }));
        return next;
      });
      data.peers.forEach((p) => sendOfferTo(p.sid));

      // Only NOW is our own stream_viewer_join guaranteed to have finished
      // registering us server-side (see isJoinConfirmedRef's own comment) -
      // safe to formally request the presenter slot, whether that request
      // came from the Go Live carry-over claim or from a Share Screen click
      // that happened to land before this point.
      isJoinConfirmedRef.current = true;
      if (needsPresentRequestRef.current) {
        needsPresentRequestRef.current = false;
        socketService.emit('meeting:request_present', { stream_id: streamId });
      }
    };

    const handleMeshPeerJoined = (data: MeshPeerJoinedPayload) => {
      if (data.stream_id !== streamId) return;
      setParticipants((prev) => {
        const next = new Map(prev);
        next.set(data.sid, { sid: data.sid, userId: data.user_id, username: data.username || 'Participant' });
        return next;
      });
      // They initiate the offer to us (new-joiner-initiates convention) -
      // nothing to do here yet, createPeerConnection happens on receipt.
    };

    const handleMeshOffer = async (data: MeshSdpPayload) => {
      if (data.stream_id !== streamId) return;
      const pc = createPeerConnection(data.from_sid);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        // Only now do the offer's own transceivers actually exist (a
        // browser creates fresh ones from the incoming m-lines rather than
        // reusing anything added beforehand) - see ensureTransceivers' own
        // comment for the full explanation.
        ensureTransceivers(pc, data.from_sid);
        await flushPendingIce(data.from_sid, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketService.emit('meeting:mesh_answer', { stream_id: streamId, target_sid: data.from_sid, sdp: answer });
      } catch (err) {
        console.error('[Meethub] Failed to answer offer:', err);
      }
    };

    const handleMeshAnswer = async (data: MeshSdpPayload) => {
      if (data.stream_id !== streamId) return;
      const pc = peersRef.current.get(data.from_sid);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await flushPendingIce(data.from_sid, pc);
      } catch (err) {
        console.error('[Meethub] Failed to apply answer:', err);
      }
    };

    const handleMeshIce = async (data: MeshIcePayload) => {
      if (data.stream_id !== streamId) return;
      const pc = peersRef.current.get(data.from_sid);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('[Meethub] Failed to add ICE candidate:', err);
        }
      } else {
        const queue = pendingIceRef.current.get(data.from_sid) ?? [];
        queue.push(data.candidate);
        pendingIceRef.current.set(data.from_sid, queue);
      }
    };

    const handleMeshPeerLeft = (data: MeshPeerLeftPayload) => {
      if (data.stream_id !== streamId) return;
      closePeer(data.sid);
    };

    const handleForceMuted = () => {
      if (localMicTrackRef.current) localMicTrackRef.current.enabled = false;
      setIsMicOn(false);
      toast('The organizer muted your microphone.', { icon: '🔇' });
    };

    const handlePresentResponse = async (data: { granted: boolean; presenter_user_id: string; presenter_username: string }) => {
      if (!data.granted) {
        // A screen track may already be attached locally (carried over from
        // Go Live setup) even though the server didn't actually grant the
        // slot (e.g. someone else claimed it a moment earlier) - release it
        // rather than silently keeping a capture the server never
        // authorized.
        if (localScreenTrackRef.current) await stopScreenShareLocal();
        toast.error('Someone is currently presenting.');
        return;
      }
      // Already have the track (carried over from Go Live setup) - just
      // make sure it's on the wire for any peer that might already be
      // connected, no second capture prompt.
      if (localScreenTrackRef.current) {
        await setOutgoingVideoTrack(localScreenTrackRef.current);
        await updateOutgoingAudioTrack();
        return;
      }
      // Only now - after the server has actually granted the slot - do we
      // prompt for screen capture. If the user cancels the picker or denies
      // permission, release the slot immediately rather than leaving it
      // locked for a presentation that never starts. Requests system/desktop
      // audio too (audio: true) - matches GoLiveModal's and Livestream's own
      // getDisplayMedia call exactly; the browser only grants it if the user
      // actually picks a source that supports it, never guaranteed.
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = displayStream.getVideoTracks()[0];
        localScreenTrackRef.current = screenTrack;
        screenTrack.onended = () => {
          if (localScreenTrackRef.current === screenTrack) stopScreenShare();
        };
        const systemAudioTrack = displayStream.getAudioTracks()[0] ?? null;
        localSystemAudioTrackRef.current = systemAudioTrack;
        if (systemAudioTrack) {
          systemAudioTrack.onended = () => {
            if (localSystemAudioTrackRef.current === systemAudioTrack) {
              localSystemAudioTrackRef.current = null;
              updateOutgoingAudioTrack();
            }
          };
        }
        setIsScreenSharing(true);
        refreshLocalStreamObj();
        await setOutgoingVideoTrack(screenTrack);
        await updateOutgoingAudioTrack();
      } catch (err: any) {
        if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
          console.error('[Meethub] Screen share failed:', err);
        }
        socketService.emit('meeting:stop_presenting', { stream_id: streamId });
      }
    };

    const handlePresenterChanged = (data: {
      stream_id: string;
      presenter_user_id: string | null;
      presenter_username: string | null;
    }) => {
      if (data.stream_id !== streamId) return;
      setPresenterUserId(data.presenter_user_id);
      setPresenterUsername(data.presenter_username);
      // If I'm still actively capturing my screen but the slot now belongs
      // to someone else (or nobody) - the organizer force-stopped me - clean
      // up locally without re-notifying the server, which would just bounce
      // right back into this same handler.
      if (localScreenTrackRef.current && data.presenter_user_id !== currentUserId) {
        stopScreenShareLocal();
      }
    };

    const handleRemoved = () => {
      toast.error('You were removed from this meeting by the organizer.');
      livestreamService.leaveStream(streamId).catch(() => {});
      onRemoved?.();
    };

    const handleChatMessage = (data: StreamChatMsg) => {
      setChatMessages((prev) => [...prev, { ...data, reactions: data.reactions ?? [] }]);
    };

    const handleSystemMessage = (data: { stream_id: string; message: string; timestamp: string }) => {
      if (data.stream_id !== streamId) return;
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
      setChatMessages((prev) => prev.map((msg) => (msg.id === data.comment_id ? { ...msg, is_deleted: true, message: '' } : msg)));
    };

    socketService.on('meeting:mesh_peers', handleMeshPeers);
    socketService.on('meeting:mesh_peer_joined', handleMeshPeerJoined);
    socketService.on('meeting:mesh_offer', handleMeshOffer);
    socketService.on('meeting:mesh_answer', handleMeshAnswer);
    socketService.on('meeting:mesh_ice_candidate', handleMeshIce);
    socketService.on('meeting:mesh_peer_left', handleMeshPeerLeft);
    socketService.on('meeting:force_muted', handleForceMuted);
    socketService.on('meeting:present_response', handlePresentResponse);
    socketService.on('meeting:presenter_changed', handlePresenterChanged);
    socketService.on('meeting:removed', handleRemoved);
    socketService.on('stream:chat_message', handleChatMessage);
    socketService.on('stream:system_message', handleSystemMessage);
    socketService.on('stream:comment_reaction', handleCommentReaction);
    socketService.on('stream:comment_deleted', handleCommentDeleted);

    return () => {
      socketService.off('meeting:mesh_peers', handleMeshPeers);
      socketService.off('meeting:mesh_peer_joined', handleMeshPeerJoined);
      socketService.off('meeting:mesh_offer', handleMeshOffer);
      socketService.off('meeting:mesh_answer', handleMeshAnswer);
      socketService.off('meeting:mesh_ice_candidate', handleMeshIce);
      socketService.off('meeting:mesh_peer_left', handleMeshPeerLeft);
      socketService.off('meeting:force_muted', handleForceMuted);
      socketService.off('meeting:present_response', handlePresentResponse);
      socketService.off('meeting:presenter_changed', handlePresenterChanged);
      socketService.off('meeting:removed', handleRemoved);
      socketService.off('stream:chat_message', handleChatMessage);
      socketService.off('stream:system_message', handleSystemMessage);
      socketService.off('stream:comment_reaction', handleCommentReaction);
      socketService.off('stream:comment_deleted', handleCommentDeleted);

      socketService.leaveStream(streamId);
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      videoTransceiversRef.current.clear();
      audioTransceiversRef.current.clear();
      pendingIceRef.current.clear();
      localCameraTrackRef.current?.stop();
      localMicTrackRef.current?.stop();
      localScreenTrackRef.current?.stop();
      localSystemAudioTrackRef.current?.stop();
      stopAudioMixing();
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      localCameraTrackRef.current = null;
      localMicTrackRef.current = null;
      localScreenTrackRef.current = null;
      localSystemAudioTrackRef.current = null;
      outgoingAudioTrackRef.current = null;
      isJoinConfirmedRef.current = false;
      needsPresentRequestRef.current = false;
      setParticipants(new Map());
      setRemoteStreams(new Map());
      setLocalStream(null);
      setIsCameraOn(false);
      setIsMicOn(false);
      setIsScreenSharing(false);
      setPresenterUserId(null);
      setPresenterUsername(null);
    };
  }, [
    enabled,
    isSocketConnected,
    streamId,
    currentUserId,
    createPeerConnection,
    sendOfferTo,
    closePeer,
    flushPendingIce,
    ensureTransceivers,
    onRemoved,
  ]);

  // ---- Outgoing video/audio track helpers - shared by camera/mic-first-
  // enable and screen-share start/stop. Each peer's video/audio transceiver
  // already exists (see createPeerConnection) - swapping the track via
  // replaceTrack() never needs renegotiation, but the FIRST time a track
  // goes from null to non-null (or back to null), the transceiver's
  // direction has to move between 'recvonly' and 'sendrecv', which DOES
  // require a fresh offer so the other side's SDP reflects the change. ----
  const setOutgoingVideoTrack = useCallback(
    async (track: MediaStreamTrack | null) => {
      const toRenegotiate: string[] = [];
      videoTransceiversRef.current.forEach((transceiver, remoteSid) => {
        transceiver.sender.replaceTrack(track).catch((err) => console.error('[Meethub] replaceTrack (video) failed:', err));
        const newDirection = track ? 'sendrecv' : 'recvonly';
        if (transceiver.direction !== newDirection) {
          transceiver.direction = newDirection;
          toRenegotiate.push(remoteSid);
        }
      });
      for (const remoteSid of toRenegotiate) {
        const pc = peersRef.current.get(remoteSid);
        if (!pc) continue;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketService.emit('meeting:mesh_offer', { stream_id: streamId, target_sid: remoteSid, sdp: offer });
        } catch (err) {
          console.error('[Meethub] Renegotiation (video) failed:', err);
        }
      }
    },
    [streamId]
  );

  const setOutgoingAudioTrack = useCallback(
    async (track: MediaStreamTrack | null) => {
      const toRenegotiate: string[] = [];
      audioTransceiversRef.current.forEach((transceiver, remoteSid) => {
        transceiver.sender.replaceTrack(track).catch((err) => console.error('[Meethub] replaceTrack (audio) failed:', err));
        const newDirection = track ? 'sendrecv' : 'recvonly';
        if (transceiver.direction !== newDirection) {
          transceiver.direction = newDirection;
          toRenegotiate.push(remoteSid);
        }
      });
      for (const remoteSid of toRenegotiate) {
        const pc = peersRef.current.get(remoteSid);
        if (!pc) continue;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketService.emit('meeting:mesh_offer', { stream_id: streamId, target_sid: remoteSid, sdp: offer });
        } catch (err) {
          console.error('[Meethub] Renegotiation (audio) failed:', err);
        }
      }
    },
    [streamId]
  );

  const stopAudioMixing = useCallback(() => {
    micAudioSourceNodeRef.current?.disconnect();
    micAudioSourceNodeRef.current = null;
    systemAudioSourceNodeRef.current?.disconnect();
    systemAudioSourceNodeRef.current = null;
    mixedAudioDestRef.current?.stream.getTracks().forEach((t) => t.stop());
    mixedAudioDestRef.current = null;
  }, []);

  /** Decides what every peer should actually hear right now - mic-only,
   * system (desktop) audio only, both mixed together via the Web Audio API,
   * or nothing - and swaps the outgoing audio track on every peer
   * connection accordingly. Reuses the EXACT same mixing approach
   * useLiveStreamSignaling.ts already uses for plain Livestream
   * (updateOutgoingAudioSource) - an AudioContext with two
   * MediaStreamAudioSourceNodes feeding one MediaStreamAudioDestinationNode
   * - adapted here to push the result onto every mesh peer's audio sender
   * instead of Livestream's single outgoing sender.
   *
   * Muting is still handled entirely through each source track's own
   * `.enabled` flag (never by swapping to a null track), so mic mute/
   * force-mute keep working completely unchanged - a disabled track still
   * feeds silence into the mixer exactly like it already sends silence over
   * a direct WebRTC sender. */
  const updateOutgoingAudioTrack = useCallback(async () => {
    const micTrack = localMicTrackRef.current;
    const systemTrack = localSystemAudioTrackRef.current?.readyState === 'live' ? localSystemAudioTrackRef.current : null;

    if (micTrack && systemTrack) {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      const ctx = audioContextRef.current;
      ctx.resume().catch(() => {});
      if (!mixedAudioDestRef.current) mixedAudioDestRef.current = ctx.createMediaStreamDestination();
      const dest = mixedAudioDestRef.current;

      micAudioSourceNodeRef.current?.disconnect();
      micAudioSourceNodeRef.current = ctx.createMediaStreamSource(new MediaStream([micTrack]));
      micAudioSourceNodeRef.current.connect(dest);

      systemAudioSourceNodeRef.current?.disconnect();
      systemAudioSourceNodeRef.current = ctx.createMediaStreamSource(new MediaStream([systemTrack]));
      systemAudioSourceNodeRef.current.connect(dest);

      const mixedTrack = dest.stream.getAudioTracks()[0] ?? null;
      outgoingAudioTrackRef.current = mixedTrack;
      await setOutgoingAudioTrack(mixedTrack);
      return;
    }

    stopAudioMixing();
    const fallbackTrack = systemTrack ?? micTrack ?? null;
    outgoingAudioTrackRef.current = fallbackTrack;
    await setOutgoingAudioTrack(fallbackTrack);
  }, [setOutgoingAudioTrack, stopAudioMixing]);

  const toggleCamera = useCallback(async () => {
    if (localCameraTrackRef.current) {
      const nextEnabled = !localCameraTrackRef.current.enabled;
      localCameraTrackRef.current.enabled = nextEnabled;
      setIsCameraOn(nextEnabled);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      localCameraTrackRef.current = track;
      refreshLocalStreamObj();
      setIsCameraOn(true);
      // A screen share already takes priority on the wire - the camera
      // becomes the outgoing video the moment screen sharing stops.
      if (!localScreenTrackRef.current) await setOutgoingVideoTrack(track);
    } catch (err: any) {
      console.error('[Meethub] Camera access denied:', err);
      // Same per-error-type messages GoLiveModal already uses for the exact
      // same getUserMedia() call in its pre-meeting setup - a denied
      // permission (most common on mobile, where the browser's own prompt
      // is easy to dismiss without noticing) reads very differently from no
      // camera existing at all, so this doesn't collapse both into one
      // generic message the way the previous text did.
      const message =
        err?.name === 'NotAllowedError'
          ? 'Camera access was denied. Allow access in your browser settings and try again.'
          : err?.name === 'NotFoundError'
          ? 'No camera was found on this device.'
          : 'Unable to access your camera. Please check your permissions.';
      toast.error(message);
    }
  }, [refreshLocalStreamObj, setOutgoingVideoTrack]);

  const toggleMic = useCallback(async () => {
    if (localMicTrackRef.current) {
      const nextEnabled = !localMicTrackRef.current.enabled;
      localMicTrackRef.current.enabled = nextEnabled;
      setIsMicOn(nextEnabled);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      localMicTrackRef.current = track;
      refreshLocalStreamObj();
      setIsMicOn(true);
      await updateOutgoingAudioTrack();
    } catch (err: any) {
      console.error('[Meethub] Microphone access denied:', err);
      // Same per-error-type messages GoLiveModal already uses - see
      // toggleCamera's own comment above for why this isn't one generic string.
      const message =
        err?.name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow access in your browser settings and try again.'
          : err?.name === 'NotFoundError'
          ? 'No microphone was found on this device.'
          : 'Unable to access your microphone. Please check your permissions.';
      toast.error(message);
    }
  }, [refreshLocalStreamObj, updateOutgoingAudioTrack]);

  // Local-only cleanup - stops capturing and reverts the outgoing video,
  // WITHOUT notifying the server. Used both by the public stopScreenShare
  // below (which adds the server notification) and by the
  // meeting:presenter_changed handler above for when the organizer force-
  // stops someone else's presentation (that path must never re-emit
  // meeting:stop_presenting, or the notification would just bounce back).
  const stopScreenShareLocal = useCallback(async () => {
    localScreenTrackRef.current?.stop();
    localScreenTrackRef.current = null;
    localSystemAudioTrackRef.current?.stop();
    localSystemAudioTrackRef.current = null;
    setIsScreenSharing(false);
    refreshLocalStreamObj();
    await setOutgoingVideoTrack(localCameraTrackRef.current);
    await updateOutgoingAudioTrack();
  }, [setOutgoingVideoTrack, updateOutgoingAudioTrack, refreshLocalStreamObj]);

  const stopScreenShare = useCallback(async () => {
    await stopScreenShareLocal();
    socketService.emit('meeting:stop_presenting', { stream_id: streamId });
  }, [stopScreenShareLocal, streamId]);

  // Does NOT call getDisplayMedia() directly - the single-presenter slot is
  // server-authoritative (see backend manager.py's meeting_presenters), so
  // this only ever asks for it. The actual screen capture happens in the
  // meeting:present_response handler above, once (and only if) the server
  // confirms the grant - this is what makes two near-simultaneous clicks
  // resolve to exactly one presenter instead of a client-side race.
  const startScreenShare = useCallback(() => {
    if (presenterUserId && presenterUserId !== currentUserId) {
      toast.error('Someone is currently presenting.');
      return;
    }
    if (!isJoinConfirmedRef.current) {
      // Clicked before our own stream_viewer_join finished registering us
      // server-side (see isJoinConfirmedRef's own comment) - queue it
      // instead of emitting into a request the server would reject.
      // handleMeshPeers flushes this the moment registration is confirmed,
      // which for a real user happens well before they'd ever click this
      // fast - this only guards the rare very-early-click edge case.
      needsPresentRequestRef.current = true;
      return;
    }
    socketService.emit('meeting:request_present', { stream_id: streamId });
  }, [presenterUserId, currentUserId, streamId]);

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [isScreenSharing, stopScreenShare, startScreenShare]);

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

  return {
    localStream,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    toggleCamera,
    toggleMic,
    toggleScreenShare,
    presenterUserId,
    presenterUsername,
    participants,
    remoteStreams,
    chatMessages,
    sendChatMessage,
    reactToComment,
    deleteComment,
  };
}
