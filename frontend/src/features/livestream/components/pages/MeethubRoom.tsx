// frontend/src/features/livestream/components/pages/MeethubRoom.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChatStore } from '@/features/chat/store/chat.store';
import { socketService } from '@/lib/socket';
import { livestreamService } from '@/services/api/livestream.service';
import { meethubService } from '@/services/api/meethub.service';
import { MeethubSession, AttendanceRosterEntry, AttendanceStatus } from '@/types/meethub.types';
import { StreamViewer } from '@/types/livestream.types';
import { useMeethubMeshSignaling } from '../../hooks/useMeethubMeshSignaling';
import { useMeethubSession } from '../../hooks/useMeethubSession';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SpeakRequestPanel } from '../SpeakRequestPanel';
import { AttendancePanel, statusBadgeClass, statusLabel } from '../AttendancePanel';
import { meetingSounds, unlockMeetingSounds } from '../../utils/meetingSounds';
import { useIsSpeaking } from '../../hooks/useIsSpeaking';
import { formatParticipantName, sortParticipants } from '../../utils/participantName';
import {
  MicrophoneIcon,
  VideoCameraIcon,
  ComputerDesktopIcon,
  ChatBubbleLeftIcon,
  UsersIcon,
  PhoneXMarkIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  HandRaisedIcon,
  ClipboardDocumentListIcon,
  SpeakerXMarkIcon,
  SpeakerWaveIcon,
  UserMinusIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  StopCircleIcon,
} from '@heroicons/react/24/outline';
import { MicrophoneIcon as MicrophoneSolidIcon, VideoCameraIcon as VideoCameraSolidIcon } from '@heroicons/react/24/solid';

interface Tile {
  key: string;
  userId: string;
  username: string;
  isSelf: boolean;
  stream: MediaStream | null;
  /** True when this tile's video track is a screen share, not a camera -
   * only ever true for the self tile (only the local mesh state knows this;
   * a remote screen-share track looks identical to a camera track on the
   * wire). Used to skip the self-view mirror, which would otherwise flip
   * shared screen content backwards. */
  isScreen?: boolean;
}

function VideoTile({
  tile,
  className = '',
  fit = 'cover',
  volume = 1,
}: {
  tile: Tile;
  className?: string;
  /** 'cover' fills the tile and crops overflow - correct for a camera.
   * 'contain' fits the whole frame inside the tile (letterboxed if the
   * aspect ratio differs) - required for a screen share, where cropping
   * would cut off real content like slides or code. Always pass 'contain'
   * for a tile showing the current presenter's screen. */
  fit?: 'cover' | 'contain';
  /** Local playback volume (0-1) for this viewer only - purely a
   * HTMLMediaElement.volume set on THIS browser's <video> element, never
   * touching the outgoing WebRTC track, so it can never affect what any
   * other participant hears. Self tiles are always `muted` regardless (see
   * below), so this has no audible effect on the self tile either way. */
  volume?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = !!tile.stream?.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
  const audioTrack = tile.stream?.getAudioTracks().find((t) => t.readyState === 'live') ?? null;
  const isSpeaking = useIsSpeaking(audioTrack);

  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject !== tile.stream) {
      videoRef.current.srcObject = tile.stream;
    }
  }, [tile.stream]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-[#0A111A] border-2 transition-colors flex items-center justify-center ${
        isSpeaking ? 'border-[#22C55E] speaking-ring' : 'border-[#1E3447]'
      } ${className || 'aspect-video'}`}
    >
      {/* Always rendered (never display:none) even with no video track - a
          participant can be audio-only (mic on, camera off), and hiding this
          element via `hidden`/display:none suspends the browser's whole
          media pipeline for it, including audio playback, not just the
          picture. `absolute` + `opacity` keeps audio flowing while the
          avatar placeholder below covers it visually. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={tile.isSelf}
        className={`absolute inset-0 w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${hasVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${tile.isSelf && !tile.isScreen ? 'scale-x-[-1]' : ''}`}
      />
      {!hasVideo && (
        <div className="flex flex-col items-center gap-2">
          <Avatar name={tile.username} size="lg" />
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#060B12]/75 backdrop-blur-sm text-[11px] text-[#F1F5F9] font-medium">
        {tile.username}
        {tile.isSelf && ' (You)'}
      </div>
    </div>
  );
}

/** Overlay on the main presentation stage - status + per-viewer minimize +
 * (organizer only) a moderation override to stop someone else's share.
 * Minimize is purely local (see isPresentationMinimized in MeethubRoom). */
function PresentationBanner({
  username,
  isSelf,
  canForceStop,
  onStopOthers,
  onMinimize,
}: {
  username: string;
  isSelf: boolean;
  canForceStop: boolean;
  onStopOthers: () => void;
  onMinimize: () => void;
}) {
  return (
    <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2 pointer-events-none">
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00C8FF]/15 border border-[#00C8FF]/40 text-[#00C8FF] text-xs font-semibold backdrop-blur-sm pointer-events-auto">
        <ComputerDesktopIcon className="h-3.5 w-3.5" />
        {isSelf ? "You're presenting" : `${username} is presenting`}
      </span>
      <span className="flex items-center gap-1.5 pointer-events-auto">
        {canForceStop && (
          <button
            onClick={onStopOthers}
            title={`Stop ${username}'s presentation`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444] text-xs font-medium hover:bg-[#EF4444]/25 transition backdrop-blur-sm"
          >
            <StopCircleIcon className="h-3.5 w-3.5" />
            Stop
          </button>
        )}
        <button
          onClick={onMinimize}
          title="Minimize presentation"
          className="p-1.5 rounded-full bg-[#060B12]/70 text-[#F1F5F9] hover:bg-[#060B12] transition backdrop-blur-sm"
        >
          <ArrowsPointingInIcon className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}

export default function MeethubRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSocketConnected = useChatStore((s) => s.isConnected);

  const [session, setSession] = useState<MeethubSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewers, setViewers] = useState<StreamViewer[]>([]);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'participants' | 'attendance' | 'chat'>('participants');
  const [showSpeakRequests, setShowSpeakRequests] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  // Purely local per-viewer preference - never synced, never read from the
  // server. Minimizing the presentation on my screen must never affect
  // anyone else's.
  const [isPresentationMinimized, setIsPresentationMinimized] = useState(false);
  // Local playback volume for everything I hear from other participants -
  // a pure HTMLMediaElement.volume/.muted setting applied only to this
  // browser's <video> elements (see VideoTile's `volume` prop). Never sent
  // over the socket, never touches any outgoing WebRTC track, so it can
  // never change what anyone else hears.
  //
  // The volume LEVEL persists to localStorage as a per-device convenience
  // (a saved 0 is treated as "not set" and coerced back to full volume, so
  // a viewer can never silently inherit a fully-silent level from a past
  // session). Mute is intentionally NOT persisted at all - localStorage is
  // per-browser, not per-meeting, so remembering "muted" would otherwise
  // mean a viewer who ever muted once on this device would silently start
  // every future meeting unable to hear the presenter with no clear
  // indication why. Every fresh room visit always starts unmuted.
  const [volume, setVolume] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('meethub_volume') : null;
    const parsed = saved !== null ? Number(saved) : NaN;
    const clamped = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
    return clamped > 0 ? clamped : 1;
  });
  const [isVolumeMuted, setIsVolumeMuted] = useState(false);
  const [showVolumePopover, setShowVolumePopover] = useState(false);
  // The popover is positioned with `fixed` + coordinates computed from the
  // button's own rect (recalculated on open) rather than CSS-relative
  // `absolute` anchoring, because the control bar has `overflow-x-auto` -
  // per the CSS overflow spec, setting overflow-x alone forces overflow-y
  // to `auto` too, which would otherwise clip a popover trying to render
  // above the bar. `fixed` positioning escapes that clipping entirely.
  const [volumePopoverPos, setVolumePopoverPos] = useState<{ top: number; left: number } | null>(null);
  const volumeControlRef = useRef<HTMLDivElement>(null);
  const speakerButtonRef = useRef<HTMLButtonElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    // Never persist a volume of exactly 0 - see the state initializer's
    // comment for why a silently-inherited "start muted" default must be
    // impossible.
    if (volume > 0) window.localStorage.setItem('meethub_volume', String(volume));
  }, [volume]);

  useEffect(() => {
    if (!showVolumePopover || !speakerButtonRef.current) {
      setVolumePopoverPos(null);
      return;
    }
    const rect = speakerButtonRef.current.getBoundingClientRect();
    const popoverWidth = 176; // matches the popover's w-44
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - popoverWidth / 2, window.innerWidth - popoverWidth - 8));
    setVolumePopoverPos({ top: rect.top - 8, left });
  }, [showVolumePopover]);

  useEffect(() => {
    if (!showVolumePopover) return;
    // volumeControlRef still wraps the button AND the popover in the DOM
    // tree (fixed positioning only changes where it paints, not where it
    // lives), so this containment check still works unchanged.
    const handleOutsideClick = (e: MouseEvent) => {
      if (volumeControlRef.current && !volumeControlRef.current.contains(e.target as Node)) {
        setShowVolumePopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showVolumePopover]);

  const effectiveVolume = isVolumeMuted ? 0 : volume;

  const dashboardPath =
    user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'professor' ? '/professor/dashboard' : '/student/dashboard';

  const goToDashboard = useCallback(() => navigate(dashboardPath, { replace: true }), [navigate, dashboardPath]);

  const meethubMeta = useMeethubSession(sessionId ?? null, isSocketConnected);

  // Load the session and, if the organizer is the first to arrive, flip it
  // live - same REST call LiveStreamStage's fetchStream() already made for a
  // plain livestream, just orchestrated from this dedicated room page instead.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await meethubService.getSession(sessionId);
        let data = res.data;
        if (data.is_organizer && data.status === 'scheduled') {
          await livestreamService.startStream(data.livestream_id);
          const refreshed = await meethubService.getSession(sessionId);
          data = refreshed.data;
        }
        if (!cancelled) setSession(data);
      } catch (error: any) {
        if (!cancelled) {
          setLoadError(
            error.response?.status === 403
              ? "You don't have permission to join this meeting."
              : 'This meeting could not be found.'
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const fetchViewers = useCallback(() => {
    if (!session) return;
    livestreamService
      .getViewers(session.livestream_id)
      .then((res) => setViewers(res.data))
      .catch(() => {});
  }, [session]);

  // Register as a real StreamViewer (DB row) for the duration of the visit -
  // reuses the exact same join/leave REST endpoints and entry-timer
  // enforcement a plain livestream already has, for every participant
  // including the organizer (there's no separate "host" viewer concept in a
  // mesh meeting).
  useEffect(() => {
    if (!session || session.status !== 'live') return;
    let active = true;
    livestreamService
      .joinStream(session.livestream_id)
      .then(() => {
        if (!active) return;
        hasJoinedRef.current = true;
        fetchViewers();
      })
      .catch((error: any) => {
        toast.error(error.response?.data?.detail || 'Unable to join this meeting.');
      });
    return () => {
      active = false;
      if (hasJoinedRef.current) {
        livestreamService.leaveStream(session.livestream_id).catch(() => {});
        hasJoinedRef.current = false;
      }
    };
  }, [session?.livestream_id, session?.status, fetchViewers]);

  const mesh = useMeethubMeshSignaling({
    streamId: session?.livestream_id || '',
    enabled: !!session && session.status === 'live',
    onRemoved: goToDashboard,
  });

  useEffect(() => {
    fetchViewers();
  }, [mesh.participants.size, fetchViewers]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mesh.chatMessages.length]);

  // ---- System sounds (BUG 3) - purely additive observers over state that
  // already exists; never touches media streams, WebRTC, or attendance
  // logic itself. Unlocking on the first real interaction anywhere in the
  // room satisfies the browser's autoplay policy. ----
  useEffect(() => {
    const unlock = () => {
      unlockMeetingSounds();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  const hasPlayedStartSoundRef = useRef(false);
  useEffect(() => {
    if (session?.status === 'live' && !hasPlayedStartSoundRef.current) {
      hasPlayedStartSoundRef.current = true;
      meetingSounds.start();
    }
  }, [session?.status]);

  // Diffed against the previous peer set so this only ever fires for a
  // genuine join/leave, never a duplicate replay of the same WebSocket
  // event, and never for peers who were already in the room when I joined.
  const knownPeerSidsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const currentSids = new Set(mesh.participants.keys());
    if (knownPeerSidsRef.current === null) {
      knownPeerSidsRef.current = currentSids;
      return;
    }
    const previous = knownPeerSidsRef.current;
    let joined = false;
    let left = false;
    currentSids.forEach((sid) => {
      if (!previous.has(sid)) joined = true;
    });
    previous.forEach((sid) => {
      if (!currentSids.has(sid)) left = true;
    });
    knownPeerSidsRef.current = currentSids;
    if (joined) meetingSounds.join();
    if (left) meetingSounds.leave();
  }, [mesh.participants]);

  // Organizer-only, matching who actually sees the "Raised Hands" button.
  const knownSpeakRequestIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!session?.is_organizer) return;
    const currentIds = new Set(meethubMeta.pendingSpeakRequests.map((r) => r.id));
    if (knownSpeakRequestIdsRef.current === null) {
      knownSpeakRequestIdsRef.current = currentIds;
      return;
    }
    const previous = knownSpeakRequestIdsRef.current;
    let hasNew = false;
    currentIds.forEach((id) => {
      if (!previous.has(id)) hasNew = true;
    });
    knownSpeakRequestIdsRef.current = currentIds;
    if (hasNew) meetingSounds.speakRequest();
  }, [session?.is_organizer, meethubMeta.pendingSpeakRequests]);

  // Subtle, optional - for viewers only (the organizer just clicked the
  // mark button themselves, they don't need an audio confirmation of their
  // own action). The string snapshot naturally de-dupes an identical
  // re-fetch triggered by a repeated meeting:attendance_updated event.
  const knownAttendanceSnapshotRef = useRef<string | null>(null);
  useEffect(() => {
    if (!session?.is_official) return;
    const snapshot = meethubMeta.attendance.map((a) => `${a.user_id}:${a.status ?? ''}`).join('|');
    if (knownAttendanceSnapshotRef.current === null) {
      knownAttendanceSnapshotRef.current = snapshot;
      return;
    }
    if (snapshot !== knownAttendanceSnapshotRef.current && !session.is_organizer) {
      meetingSounds.attendanceUpdate();
    }
    knownAttendanceSnapshotRef.current = snapshot;
  }, [session?.is_official, session?.is_organizer, meethubMeta.attendance]);

  const handleLeave = () => {
    navigate(dashboardPath, { replace: true });
  };

  const confirmEnd = async () => {
    if (!session) return;
    setIsEnding(true);
    try {
      await livestreamService.endStream(session.livestream_id);
      toast.success('Meeting ended.');
      navigate(dashboardPath, { replace: true });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to end the meeting.');
    } finally {
      setIsEnding(false);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    mesh.sendChatMessage(newMessage);
    setNewMessage('');
  };

  const forceMute = (targetUserId: string) => {
    if (!session) return;
    socketService.emit('meeting:force_mute', { stream_id: session.livestream_id, target_user_id: targetUserId });
  };

  const removeParticipant = (targetUserId: string) => {
    if (!session) return;
    socketService.emit('meeting:remove_participant', { stream_id: session.livestream_id, target_user_id: targetUserId });
  };

  // Organizer-only moderation override - the server allows this call from
  // either the current presenter themselves or the organizer; here it's
  // always the organizer stopping someone ELSE's presentation (their own
  // "Stop Presenting" button already goes through mesh.toggleScreenShare).
  const stopPresentersPresentation = () => {
    if (!session) return;
    socketService.emit('meeting:stop_presenting', { stream_id: session.livestream_id });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#060B12] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00C8FF]" />
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="min-h-screen bg-[#060B12] flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-[#F1F5F9] text-lg font-medium">{loadError || 'This meeting could not be found.'}</p>
        <button
          onClick={goToDashboard}
          className="px-4 py-2 bg-[#00C8FF] text-[#060B12] rounded-xl font-medium text-sm hover:bg-[#00C8FF]/80 transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const selfTile: Tile = {
    key: 'self',
    userId: user?.id || 'me',
    username: user?.username || 'You',
    isSelf: true,
    stream: mesh.localStream,
    isScreen: mesh.isScreenSharing,
  };
  const remoteTiles: Tile[] = Array.from(mesh.participants.values()).map((p) => ({
    key: p.sid,
    userId: p.userId,
    username: p.username,
    isSelf: false,
    stream: mesh.remoteStreams.get(p.sid) || null,
  }));
  const tiles = [selfTile, ...remoteTiles];

  // The presenting participant's own single video slot is occupied by their
  // screen (see useMeethubMeshSignaling - one outgoing video track per
  // connection, screen takes priority over camera), so they're shown once,
  // large, in the main stage rather than duplicated in the camera strip.
  const presenterTile: Tile | null = mesh.presenterUserId
    ? tiles.find((t) => t.userId === mesh.presenterUserId) || null
    : null;
  const otherTiles = presenterTile ? tiles.filter((t) => t.key !== presenterTile.key) : tiles;
  const isPresenting = mesh.presenterUserId === selfTile.userId;

  return (
    <div className="h-dvh w-screen bg-[#060B12] text-[#F1F5F9] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1E3447] flex-shrink-0">
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold truncate">{session.title}</h1>
          <p className="text-[11px] text-[#64748B] truncate">
            {session.is_official ? 'Official Class Meeting' : 'Open Meeting'} · Hosted by {session.organizer_username}
          </p>
        </div>
        <button
          onClick={() => (session.is_organizer ? setShowEndConfirm(true) : setShowLeaveConfirm(true))}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#EF4444] text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-[#EF4444]/80 transition flex-shrink-0"
        >
          <PhoneXMarkIcon className="h-4 w-4" />
          {session.is_organizer ? 'End Meeting' : 'Leave Meeting'}
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 flex">
        {/* Video area */}
        <div className="flex-1 min-w-0 flex flex-col relative">
          {!presenterTile && (
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              <div
                className="grid gap-3 h-full"
                style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${tiles.length > 4 ? '200px' : '280px'}, 1fr))` }}
              >
                {tiles.map((tile) => (
                  <VideoTile key={tile.key} tile={tile} volume={effectiveVolume} />
                ))}
              </div>
            </div>
          )}

          {presenterTile && !isPresentationMinimized && (
            <div className="flex-1 min-h-0 flex flex-col gap-3 p-3">
              <div className="relative flex-1 min-h-0">
                <VideoTile tile={presenterTile} className="w-full h-full" fit="contain" volume={effectiveVolume} />
                <PresentationBanner
                  username={presenterTile.username}
                  isSelf={presenterTile.isSelf}
                  canForceStop={session.is_organizer && !presenterTile.isSelf}
                  onStopOthers={stopPresentersPresentation}
                  onMinimize={() => setIsPresentationMinimized(true)}
                />
              </div>
              {otherTiles.length > 0 && (
                <div className="flex-shrink-0 flex gap-2 overflow-x-auto themed-scrollbar" style={{ height: '108px' }}>
                  {otherTiles.map((tile) => (
                    <VideoTile key={tile.key} tile={tile} className="w-40 flex-shrink-0 h-full" volume={effectiveVolume} />
                  ))}
                </div>
              )}
            </div>
          )}

          {presenterTile && isPresentationMinimized && (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                <div
                  className="grid gap-3 h-full"
                  style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${otherTiles.length > 4 ? '200px' : '280px'}, 1fr))` }}
                >
                  {otherTiles.map((tile) => (
                    <VideoTile key={tile.key} tile={tile} volume={effectiveVolume} />
                  ))}
                </div>
              </div>
              <div className="absolute bottom-20 right-4 w-52 z-20 shadow-2xl">
                <VideoTile tile={presenterTile} className="w-full aspect-video" fit="contain" volume={effectiveVolume} />
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                  <button
                    onClick={() => setIsPresentationMinimized(false)}
                    title="Maximize presentation"
                    className="p-1.5 rounded-md bg-[#060B12]/80 text-[#F1F5F9] hover:bg-[#060B12] transition"
                  >
                    <ArrowsPointingOutIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-[#00C8FF]/20 border border-[#00C8FF]/40 text-[#00C8FF] text-[10px] font-semibold">
                  Presenting
                </div>
              </div>
            </>
          )}

          {/* Control bar */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 px-3 py-3 border-t border-[#1E3447] flex-shrink-0 bg-[#0A111A] overflow-x-auto themed-scrollbar">
            <button
              onClick={mesh.toggleMic}
              disabled={!session.is_organizer && !session.allow_participant_mic}
              title={!session.is_organizer && !session.allow_participant_mic ? 'The organizer has disabled microphones' : undefined}
              className={`flex-shrink-0 p-3 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed ${
                mesh.isMicOn ? 'bg-[#1E3447] text-[#F1F5F9]' : 'bg-[#EF4444] text-white'
              }`}
            >
              {mesh.isMicOn ? <MicrophoneSolidIcon className="h-5 w-5" /> : <MicrophoneIcon className="h-5 w-5" />}
            </button>
            <button
              onClick={mesh.toggleCamera}
              disabled={!session.is_organizer && !session.allow_participant_camera}
              title={!session.is_organizer && !session.allow_participant_camera ? 'The organizer has disabled cameras' : undefined}
              className={`flex-shrink-0 p-3 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed ${
                mesh.isCameraOn ? 'bg-[#1E3447] text-[#F1F5F9]' : 'bg-[#EF4444] text-white'
              }`}
            >
              {mesh.isCameraOn ? <VideoCameraSolidIcon className="h-5 w-5" /> : <VideoCameraIcon className="h-5 w-5" />}
            </button>
            {/* Local speaker volume - purely what THIS browser plays back
                (see VideoTile's `volume` prop); never touches any outgoing
                WebRTC track, so it can never affect what anyone else hears. */}
            <div className="flex-shrink-0" ref={volumeControlRef}>
              <button
                ref={speakerButtonRef}
                onClick={() => setShowVolumePopover((v) => !v)}
                title={isVolumeMuted || volume === 0 ? 'Unmute speaker' : 'Speaker volume'}
                className={`flex-shrink-0 p-3 rounded-full transition ${
                  isVolumeMuted || volume === 0 ? 'bg-[#EF4444] text-white' : 'bg-[#1E3447] text-[#F1F5F9] hover:bg-[#243c52]'
                }`}
              >
                {isVolumeMuted || volume === 0 ? <SpeakerXMarkIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
              </button>
              {showVolumePopover && volumePopoverPos && (
                <div
                  style={{ position: 'fixed', top: volumePopoverPos.top, left: volumePopoverPos.left, transform: 'translateY(-100%)' }}
                  className="w-44 p-3 rounded-xl bg-[#0D1722] border border-[#1E3447] shadow-2xl z-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[#94A3B8]">Speaker Volume</span>
                    <button
                      onClick={() => setIsVolumeMuted((v) => !v)}
                      className="text-[10px] font-semibold text-[#00C8FF] hover:text-[#00E0FF] transition"
                    >
                      {isVolumeMuted ? 'Unmute' : 'Mute'}
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(effectiveVolume * 100)}
                    onChange={(e) => {
                      const next = Number(e.target.value) / 100;
                      setVolume(next);
                      if (next > 0) setIsVolumeMuted(false);
                      else setIsVolumeMuted(true);
                    }}
                    className="w-full accent-[#00C8FF]"
                    aria-label="Speaker volume"
                  />
                  <p className="text-center text-[10px] text-[#64748B] mt-0.5">{Math.round(effectiveVolume * 100)}%</p>
                </div>
              )}
            </div>
            <button
              onClick={mesh.toggleScreenShare}
              disabled={!!mesh.presenterUserId && !isPresenting}
              className={`flex-shrink-0 p-3 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed ${
                isPresenting ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#F1F5F9]'
              }`}
              title={
                isPresenting
                  ? 'Stop presenting'
                  : mesh.presenterUserId
                  ? 'Someone is currently presenting'
                  : 'Share your screen'
              }
            >
              <ComputerDesktopIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                setRightPanelOpen(true);
                setRightTab('chat');
              }}
              className="flex-shrink-0 p-3 rounded-full bg-[#1E3447] text-[#F1F5F9] hover:bg-[#243c52] transition lg:hidden"
              title="Chat"
            >
              <ChatBubbleLeftIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                setRightPanelOpen(true);
                setRightTab('participants');
              }}
              className="relative flex-shrink-0 p-3 rounded-full bg-[#1E3447] text-[#F1F5F9] hover:bg-[#243c52] transition lg:hidden"
              title="People"
            >
              <UsersIcon className="h-5 w-5" />
            </button>
            {!session.is_organizer && (
              <button
                onClick={() => meethubMeta.requestToSpeak()}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-3 rounded-full bg-[#00C8FF]/15 border border-[#00C8FF]/40 text-[#00C8FF] text-xs sm:text-sm font-medium hover:bg-[#00C8FF]/25 transition"
              >
                <HandRaisedIcon className="h-4 w-4" />
                Raise Hand
              </button>
            )}
            {session.is_organizer && (
              <button
                onClick={() => setShowSpeakRequests(true)}
                className="relative flex-shrink-0 flex items-center gap-1.5 px-3.5 py-3 rounded-full bg-[#1E3447] text-[#F1F5F9] text-xs sm:text-sm font-medium hover:bg-[#243c52] transition"
              >
                <HandRaisedIcon className="h-4 w-4" />
                Raised Hands
                {meethubMeta.pendingSpeakRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-[#EF4444] text-[9px] font-bold text-white">
                    {meethubMeta.pendingSpeakRequests.length}
                  </span>
                )}
              </button>
            )}
            {session.is_official && (
              <button
                onClick={() => {
                  setRightPanelOpen(true);
                  setRightTab('attendance');
                }}
                className="flex-shrink-0 p-3 rounded-full bg-[#1E3447] text-[#F1F5F9] hover:bg-[#243c52] transition"
                title="Attendance"
              >
                <ClipboardDocumentListIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Right panel - desktop column */}
        {rightPanelOpen && (
          <div className="hidden lg:flex w-80 flex-shrink-0 border-l border-[#1E3447] flex-col bg-[#0A111A]">
            <RightPanelContent
              rightTab={rightTab}
              setRightTab={setRightTab}
              onClose={() => setRightPanelOpen(false)}
              session={session}
              viewers={viewers}
              mesh={mesh}
              currentUserId={user?.id}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              sendMessage={sendMessage}
              chatEndRef={chatEndRef}
              onForceMute={forceMute}
              onRemove={removeParticipant}
              attendance={meethubMeta.attendance}
              onMarkAttendance={meethubMeta.markAttendance}
            />
          </div>
        )}
      </div>

      {/* Right panel - mobile drawer (Sidebar.tsx's overlay + slide-in pattern) */}
      <div className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${rightPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRightPanelOpen(false)} />
        <aside
          className={`absolute inset-y-0 right-0 w-[85vw] max-w-sm flex flex-col bg-[#0A111A] border-l border-[#1E3447] transition-transform duration-300 ease-out ${
            rightPanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <RightPanelContent
            rightTab={rightTab}
            setRightTab={setRightTab}
            onClose={() => setRightPanelOpen(false)}
            session={session}
            viewers={viewers}
            mesh={mesh}
            currentUserId={user?.id}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            sendMessage={sendMessage}
            chatEndRef={chatEndRef}
            onForceMute={forceMute}
            onRemove={removeParticipant}
            attendance={meethubMeta.attendance}
            onMarkAttendance={meethubMeta.markAttendance}
          />
        </aside>
      </div>

      {showSpeakRequests && (
        <SpeakRequestPanel
          requests={meethubMeta.pendingSpeakRequests}
          onApprove={meethubMeta.approve}
          onDeny={meethubMeta.deny}
          onClose={() => setShowSpeakRequests(false)}
        />
      )}

      {showLeaveConfirm && (
        <ConfirmDialog
          title="Leave Meeting?"
          message="You can rejoin later if the meeting is still open."
          confirmLabel="Leave"
          danger={false}
          onConfirm={handleLeave}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}

      {showEndConfirm && (
        <ConfirmDialog
          title="End Meeting?"
          message="This will end the meeting for everyone currently in it."
          confirmLabel="End Meeting"
          loadingLabel="Ending..."
          isLoading={isEnding}
          onConfirm={confirmEnd}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}
    </div>
  );
}

interface RightPanelContentProps {
  rightTab: 'participants' | 'attendance' | 'chat';
  setRightTab: (tab: 'participants' | 'attendance' | 'chat') => void;
  onClose: () => void;
  session: MeethubSession;
  viewers: StreamViewer[];
  mesh: ReturnType<typeof useMeethubMeshSignaling>;
  currentUserId?: string;
  newMessage: string;
  setNewMessage: (v: string) => void;
  sendMessage: (e: React.FormEvent) => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onForceMute: (userId: string) => void;
  onRemove: (userId: string) => void;
  attendance: AttendanceRosterEntry[];
  onMarkAttendance: (userId: string, status: AttendanceStatus) => void;
}

function RightPanelContent({
  rightTab,
  setRightTab,
  onClose,
  session,
  viewers,
  mesh,
  currentUserId,
  newMessage,
  setNewMessage,
  sendMessage,
  chatEndRef,
  onForceMute,
  onRemove,
  attendance,
  onMarkAttendance,
}: RightPanelContentProps) {
  const attendanceByUser = new Map(attendance.map((a) => [a.user_id, a]));
  // Alphabetical by last name (falling back to username) - display-only,
  // matches AttendancePanel's own sorting so both lists stay consistent.
  const sortedViewers = sortParticipants(viewers);
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E3447] flex-shrink-0">
        <div className="flex items-center gap-1 bg-[#0D1722] rounded-lg p-1">
          <button
            onClick={() => setRightTab('participants')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${rightTab === 'participants' ? 'bg-[#00C8FF] text-[#060B12]' : 'text-[#94A3B8]'}`}
          >
            People ({viewers.length})
          </button>
          {session.is_official && (
            <button
              onClick={() => setRightTab('attendance')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${rightTab === 'attendance' ? 'bg-[#00C8FF] text-[#060B12]' : 'text-[#94A3B8]'}`}
            >
              Attendance
            </button>
          )}
          <button
            onClick={() => setRightTab('chat')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${rightTab === 'chat' ? 'bg-[#00C8FF] text-[#060B12]' : 'text-[#94A3B8]'}`}
          >
            Chat
          </button>
        </div>
        <button onClick={onClose} className="p-1 text-[#94A3B8] hover:text-[#F1F5F9]">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {rightTab === 'participants' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sortedViewers.length === 0 ? (
            <p className="text-center text-sm text-[#64748B] py-8">No one has joined yet.</p>
          ) : (
            sortedViewers.map((viewer) => {
              const isOrganizerRow = viewer.user_id === session.organizer_id;
              const attendanceEntry = session.is_official ? attendanceByUser.get(viewer.user_id) : undefined;
              return (
                <div key={viewer.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0D1722] border border-[#1E3447]">
                  <Avatar src={viewer.avatar} name={formatParticipantName(viewer)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#F1F5F9] truncate">
                      {formatParticipantName(viewer)}
                      {viewer.user_id === currentUserId && ' (You)'}
                    </p>
                    {isOrganizerRow && <p className="text-[10px] text-[#00C8FF]">Organizer</p>}
                  </div>
                  {attendanceEntry && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase flex-shrink-0 ${statusBadgeClass(attendanceEntry.status)}`}>
                      {statusLabel(attendanceEntry.status)}
                    </span>
                  )}
                  {session.is_organizer && !isOrganizerRow && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onForceMute(viewer.user_id)}
                        title="Mute this participant"
                        className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 transition"
                      >
                        <SpeakerXMarkIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onRemove(viewer.user_id)}
                        title="Remove from meeting"
                        className="p-1.5 rounded-md text-[#EF4444] hover:bg-[#EF4444]/10 transition"
                      >
                        <UserMinusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : rightTab === 'attendance' ? (
        <AttendancePanel roster={attendance} isOrganizer={session.is_organizer} onMark={onMarkAttendance} />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {mesh.chatMessages.length === 0 ? (
              <p className="text-center text-sm text-[#64748B] py-8">No messages yet.</p>
            ) : (
              mesh.chatMessages.map((msg) =>
                msg.is_system ? (
                  <p key={msg.id} className="text-center text-[11px] text-[#64748B] italic">
                    {msg.message}
                  </p>
                ) : (
                  <div key={msg.id} className="text-sm">
                    <span className="font-semibold text-[#00C8FF]">{msg.username}: </span>
                    <span className={msg.is_deleted ? 'italic text-[#64748B]' : 'text-[#F1F5F9]'}>
                      {msg.is_deleted ? 'Message deleted' : msg.message}
                    </span>
                  </div>
                )
              )
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendMessage} className="flex items-center gap-2 p-3 border-t border-[#1E3447] flex-shrink-0">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Send a message..."
              className="flex-1 px-3 py-2 bg-[#0D1722] border border-[#1E3447] rounded-xl text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF]"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="p-2 bg-[#00C8FF] text-[#060B12] rounded-xl disabled:opacity-40 transition"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </>
  );
}
