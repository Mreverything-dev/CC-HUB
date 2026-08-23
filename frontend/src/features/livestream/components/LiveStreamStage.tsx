// frontend/src/features/livestream/components/LiveStreamStage.tsx
import { useEffect, useRef, useState } from 'react';
import { CodeXml } from 'lucide-react';
import { formatRelativeTime, formatTime } from '@/lib/formatters';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChatStore } from '@/features/chat/store/chat.store';
import { socketService } from '@/lib/socket';
import { livestreamService } from '@/services/api/livestream.service';
import { Livestream, StreamViewer } from '@/types/livestream.types';
import { useLiveStreamSignaling, StreamChatMsg, PipPosition, PipSize, PIP_SIZE_RATIO } from '../hooks/useLiveStreamSignaling';
import { useLiveSessionStore } from '../store/liveSession.store';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  ShareIcon,
  FlagIcon,
  XMarkIcon,
  UsersIcon,
  EyeIcon,
  EyeSlashIcon,
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ArrowPathRoundedSquareIcon,
  PaperAirplaneIcon,
  ComputerDesktopIcon,
  StopIcon,
  FaceSmileIcon,
  ArrowUturnLeftIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢'];

// Bottom placements sit at bottom-20 (not bottom-4, matching the top
// offsets) because the video player has its own full-width control bar
// pinned to bottom-0 (play/pause, mute, fullscreen) with an always-visible
// gradient background - a PiP box at bottom-4 overlapped it directly, and
// the two elements' independent hover/transition states fighting over the
// same screen region was what caused the reported lag specifically at the
// bottom positions (never at the top, which has no equivalent overlap).
const PIP_POSITION_CLASSES: Record<PipPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-20 left-4',
  'bottom-right': 'bottom-20 right-4',
};
const PIP_POSITION_LABELS: Record<PipPosition, string> = {
  'top-left': 'Top left',
  'top-right': 'Top right',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
};

/**
 * Global, route-independent livestream player + chat, mounted once at the
 * app root (see App.tsx, next to ChatWidget) and driven by liveSession.store
 * instead of being owned by a page route. This is what makes minimize work:
 * navigating the underlying Dashboard around never unmounts this component,
 * so the WebRTC connection and chat socket subscriptions never drop - only
 * the CSS layout (docked overlay vs. small floating player) changes.
 */
export function LiveStreamStage() {
  const streamId = useLiveSessionStore((s) => s.streamId);
  const isHostSession = useLiveSessionStore((s) => s.isHost);
  const isMinimized = useLiveSessionStore((s) => s.isMinimized);
  const minimize = useLiveSessionStore((s) => s.minimize);
  const restore = useLiveSessionStore((s) => s.restore);
  const endSession = useLiveSessionStore((s) => s.endSession);

  if (!streamId) return null;

  // key={streamId} forces a full remount (fresh state, fresh signaling
  // connection) when switching to watch a different stream, while the same
  // id keeps this one instance alive - and its WebRTC connection intact -
  // across minimize/restore and every Dashboard navigation in between.
  return (
    <LiveStreamStageInner
      key={streamId}
      streamId={streamId}
      isHost={isHostSession}
      isMinimized={isMinimized}
      onMinimize={minimize}
      onRestore={restore}
      onEnd={endSession}
    />
  );
}

interface StageInnerProps {
  streamId: string;
  isHost: boolean;
  isMinimized: boolean;
  onMinimize: () => void;
  onRestore: () => void;
  onEnd: () => void;
}

function LiveStreamStageInner({ streamId, isHost, isMinimized, onMinimize, onRestore, onEnd }: StageInnerProps) {
  const { user } = useAuthStore();
  const [stream, setStream] = useState<Livestream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [viewers, setViewers] = useState<StreamViewer[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  // HOST only: hides the camera PiP overlay while screen-sharing without
  // touching the camera track/stream at all - purely a local UI toggle.
  const [isCameraPipHidden, setIsCameraPipHidden] = useState(false);
  // HOST only: PiP position/size/mirror - defaults here, overwritten once
  // (via the hook's onClaimedPipConfig) if the host configured these during
  // Go Live setup, then freely adjustable live from here on.
  const [pipPosition, setPipPosition] = useState<PipPosition>('bottom-right');
  const [pipSize, setPipSize] = useState<PipSize>('small');
  const [isPipMirrored, setIsPipMirrored] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Auto-hide player controls (modern livestream-platform behavior) - a
  // pure CSS opacity/pointer-events toggle on the control overlays, never
  // touching the <video> element's mount lifecycle, so this can never cause
  // a stream reconnect or remount (see PERFORMANCE note near showPlayer).
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringControlsRef = useRef(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [commentMenuFor, setCommentMenuFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const streamRef = useRef<Livestream | null>(null);
  const hasJoinedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const isLive = stream?.status === 'live';
  const signalingEnabled = isLive && (isHost || !!stream?.can_view);

  const {
    videoRef,
    videoElRef,
    pipVideoRef,
    isConnected,
    hasLocalMedia,
    mediaError,
    hostOffline,
    waitingForHost,
    joinError,
    chatMessages,
    sendChatMessage,
    reactToComment,
    deleteComment,
    toggleMicTrack,
    isScreenSharing,
    toggleScreenShare,
    setPipConfig,
    isRecording,
    toggleRecording,
    needsUnmute,
    acknowledgeUnmute,
  } = useLiveStreamSignaling({
    streamId,
    isHost,
    enabled: signalingEnabled,
    onClaimedPipConfig: (config) => {
      setPipPosition(config.position);
      setPipSize(config.size);
      setIsPipMirrored(config.mirrored);
      setIsCameraPipHidden(config.hidden);
    },
  });

  // Keeps the actual composited broadcast (what viewers receive) in sync
  // with these local UI controls - takes effect on the next drawn frame,
  // no reconnection/renegotiation involved.
  useEffect(() => {
    setPipConfig({ position: pipPosition, size: pipSize, mirrored: isPipMirrored, hidden: isCameraPipHidden });
  }, [pipPosition, pipSize, isPipMirrored, isCameraPipHidden, setPipConfig]);

  // Autoplay policy forced the incoming stream to start muted (see the
  // hook's attachRemoteStream) - keep the mute button's UI in sync so it
  // correctly shows "muted" and a single click (an in-place unmute on an
  // already-playing element, always allowed) both silences the prompt and
  // actually enables audio.
  useEffect(() => {
    if (needsUnmute) setIsMuted(true);
  }, [needsUnmute]);

  // Note: no effect is needed here to re-attach the stream when switching
  // between the docked and minimized layouts (which mounts a structurally
  // different <video> element each time) - videoRef is a callback ref (see
  // the hook), so it re-attaches automatically the instant ANY new <video>
  // element mounts, regardless of what caused it to mount.

  const isSocketConnected = useChatStore((s) => s.isConnected);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // Root-cause fix for "viewer must refresh to see the stream": a viewer who
  // opened this page while the host hadn't started broadcasting yet fetched
  // stream.status='scheduled' once on mount and nothing ever updated that
  // local value afterward, so `signalingEnabled` (derived from it) stayed
  // false forever and the viewer-join/WebRTC effects never ran. stream:started
  // is already broadcast app-wide (no room filter - the viewer hasn't joined
  // the stream's room yet at this point) when the host goes live, so listen
  // for it here and flip local status to 'live', which flips signalingEnabled
  // and lets useLiveStreamSignaling's own effects take it from there. Also
  // listens for stream:ended as a redundant, room-independent way to reach
  // the Ended state (the room-scoped stream:host_left the signaling hook
  // already handles covers the common case where the viewer did join).
  useEffect(() => {
    if (!isSocketConnected) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleStarted = (data: { id: string }) => {
      if (data.id !== streamId) return;
      setStream((prev) => (prev ? { ...prev, status: 'live' } : prev));
    };
    const handleEnded = (data: { stream_id: string }) => {
      if (data.stream_id !== streamId) return;
      setStream((prev) => (prev ? { ...prev, status: 'ended' } : prev));
    };

    socket.on('stream:started', handleStarted);
    socket.on('stream:ended', handleEnded);
    return () => {
      socket.off('stream:started', handleStarted);
      socket.off('stream:ended', handleEnded);
    };
  }, [streamId, isSocketConnected]);

  useEffect(() => {
    fetchStream();
    const interval = setInterval(() => {
      if (streamRef.current?.status === 'live') {
        refreshViewerCount();
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  // Leave the stream (viewer only) whenever this stage instance goes away -
  // explicit Leave Live click, switching to a different stream, or the whole
  // session ending. Mirrors the original page-unmount cleanup, just relocated
  // here since this component (not a route) now owns the watch session.
  useEffect(() => {
    return () => {
      if (hasJoinedRef.current && !streamRef.current?.is_host) {
        livestreamService.leaveStream(streamId).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  useEffect(() => {
    if (mediaError) toast.error(mediaError);
  }, [mediaError]);

  useEffect(() => {
    if (joinError) toast.error(joinError);
  }, [joinError]);

  const fetchStream = async () => {
    setIsLoading(true);
    try {
      const response = await livestreamService.getStream(streamId);
      let data = response.data;

      if (data.is_host && data.status === 'scheduled') {
        const startRes = await livestreamService.startStream(streamId);
        data = startRes.data;
      }

      setStream(data);
      setViewerCount(data.viewer_count);
      setLikeCount(data.viewer_count);

      if (!data.is_host && data.can_view && data.status === 'live') {
        await joinStream();
        await fetchViewers();
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error("You don't have permission to view this stream");
      } else {
        toast.error('Failed to load stream');
      }
      onEnd();
    } finally {
      setIsLoading(false);
    }
  };

  const joinStream = async () => {
    try {
      await livestreamService.joinStream(streamId);
      hasJoinedRef.current = true;
    } catch (error) {
      console.error('Failed to join stream:', error);
    }
  };

  const refreshViewerCount = async () => {
    try {
      const response = await livestreamService.getStream(streamId);
      setViewerCount(response.data.viewer_count);
    } catch (error) {
      console.error('Failed to refresh viewer count:', error);
    }
  };

  const fetchViewers = async () => {
    try {
      const response = await livestreamService.getViewers(streamId);
      setViewers(response.data);
    } catch (error) {
      console.error('Failed to fetch viewers:', error);
    }
  };

  const handleEndStream = async () => {
    if (!confirm('Are you sure you want to end this stream?')) return;
    try {
      await livestreamService.endStream(streamId);
      toast.success('Stream ended');
      onEnd();
    } catch (error) {
      toast.error('Failed to end stream');
    }
  };

  const handleLeaveLive = () => {
    // The viewer-leave cleanup effect above fires as soon as this instance
    // unmounts (which onEnd() triggers by clearing the session), so there's
    // nothing else to do here - one call, no duplicated leave logic.
    onEnd();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: stream?.title || 'Live Stream', url: `${window.location.origin}/live/${streamId}` });
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/live/${streamId}`);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
  };

  const handleReport = () => {
    toast.success('Report submitted. We will review this stream.');
  };

  const toggleMic = () => {
    const next = !isMicOn;
    setIsMicOn(next);
    toggleMicTrack(next);
  };

  const togglePlayPause = () => {
    const video = videoElRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPaused(false);
    } else {
      video.pause();
      setIsPaused(true);
    }
  };

  const toggleMute = () => {
    const video = videoElRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    acknowledgeUnmute();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      playerRef.current?.requestFullscreen();
    }
  };

  // Keeps the fullscreen button's icon (and any other fullscreen-aware UI)
  // in sync with the ACTUAL browser state, which can also change from
  // outside this button (Escape key, browser/OS fullscreen shortcut).
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleVolumeChange = (next: number) => {
    setVolume(next);
    const video = videoElRef.current;
    if (!video) return;
    video.volume = next;
    if (next > 0 && video.muted) {
      video.muted = false;
      setIsMuted(false);
      acknowledgeUnmute();
    } else if (next === 0 && !video.muted) {
      video.muted = true;
      setIsMuted(true);
    }
  };

  // Reveals the control overlays and (re)starts the auto-hide countdown -
  // called on any mouse movement/click/tap over the player, and whenever
  // playback state changes in a way that should keep controls visible a
  // moment longer. Never hides while paused or while the pointer is
  // resting directly over the controls themselves (isHoveringControlsRef).
  const revealControls = () => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      if (!isHoveringControlsRef.current) setControlsVisible(false);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, []);

  // Controls should stay visible while paused (nothing to auto-hide from -
  // there's no motion to watch), and reappear/restart the countdown the
  // moment the stream actually becomes visible.
  useEffect(() => {
    if (isPaused) {
      setControlsVisible(true);
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    } else {
      revealControls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused]);

  const toggleViewers = () => {
    setShowViewers(!showViewers);
    if (!showViewers) fetchViewers();
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendChatMessage(newMessage, replyingTo?.id ?? null);
    setNewMessage('');
    setReplyingTo(null);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleReply = (msg: StreamChatMsg) => {
    setReplyingTo({ id: msg.id, username: msg.username });
    setReactionPickerFor(null);
    setCommentMenuFor(null);
  };

  const handleReact = (commentId: string, reaction: string) => {
    reactToComment(commentId, reaction);
    setReactionPickerFor(null);
  };

  const handleDeleteComment = () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    deleteComment(deleteTarget);
    setDeleteTarget(null);
    setCommentMenuFor(null);
    setIsDeleting(false);
  };

  const myReactionOn = (msg: StreamChatMsg) => msg.reactions.find((r) => r.user_id === user?.id)?.reaction;

  const reactionCounts = (msg: StreamChatMsg) => {
    const counts = new Map<string, number>();
    msg.reactions.forEach((r) => counts.set(r.reaction, (counts.get(r.reaction) || 0) + 1));
    return Array.from(counts.entries());
  };

  const renderComment = (msg: StreamChatMsg, isReply: boolean) => {
    if (msg.is_system) {
      return (
        <div key={msg.id} className="flex justify-center my-1">
          <span className="text-[11px] text-[#64748B] italic px-3 py-1 rounded-full bg-[#0A111A]/60">
            {msg.message}
          </span>
        </div>
      );
    }

    const isOwn = msg.user_id === user?.id;
    const canDelete = isOwn || isHost;
    const myReaction = myReactionOn(msg);

    return (
      <div key={msg.id} className={`group flex items-start gap-2.5 relative ${isReply ? 'ml-10 mt-2' : ''}`}>
        <div className="w-8 h-8 rounded-full bg-[#1E3447] flex items-center justify-center text-[#F1F5F9] text-xs font-bold overflow-hidden flex-shrink-0">
          {msg.avatar ? (
            <img src={msg.avatar} alt={msg.username} className="w-full h-full object-cover" />
          ) : (
            msg.username?.charAt(0).toUpperCase() || 'U'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-medium text-[#F1F5F9] truncate">{isOwn ? 'You' : msg.username}</span>
            <span className="text-[10px] text-[#64748B] flex-shrink-0">{formatRelativeTime(msg.timestamp)}</span>
          </div>

          {msg.is_deleted ? (
            <p className="mt-0.5 inline-block px-2.5 py-1.5 rounded-xl bg-[#162534]/50 text-sm text-[#64748B] italic">
              This comment was deleted
            </p>
          ) : (
            <>
              <p className="mt-0.5 inline-block px-2.5 py-1.5 rounded-xl bg-[#162534] text-sm text-[#E2E8F0] break-words">
                {msg.message}
              </p>

              {reactionCounts(msg).length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {reactionCounts(msg).map(([emoji, count]) => (
                    <button
                      key={emoji}
                      onClick={() => handleReact(msg.id, emoji)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition ${
                        myReaction === emoji
                          ? 'bg-[#00C8FF]/15 border-[#00C8FF]/50 text-[#00C8FF]'
                          : 'bg-[#0D1722] border-[#1E3447] text-[#94A3B8] hover:border-[#00C8FF]/30'
                      }`}
                    >
                      <span>{emoji}</span>
                      <span>{count}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mt-1 h-5">
                <div className="relative">
                  <button
                    onClick={() => setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)}
                    className="flex items-center gap-1 text-[10px] text-[#64748B] hover:text-[#00C8FF] opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                  >
                    <FaceSmileIcon className="h-3.5 w-3.5" />
                    React
                  </button>
                  {reactionPickerFor === msg.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setReactionPickerFor(null)} />
                      <div className="absolute bottom-full left-0 mb-1 flex items-center gap-1 px-2 py-1.5 rounded-full border border-[#1E3447] bg-[#111E2B] shadow-lg z-20">
                        {REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg.id, emoji)}
                            className="text-base hover:scale-125 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {!isReply && (
                  <button
                    onClick={() => handleReply(msg)}
                    className="flex items-center gap-1 text-[10px] text-[#64748B] hover:text-[#00C8FF] opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                  >
                    <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                    Reply
                  </button>
                )}

                {canDelete && (
                  <div className="relative ml-auto">
                    <button
                      onClick={() => setCommentMenuFor(commentMenuFor === msg.id ? null : msg.id)}
                      className="text-[#64748B] hover:text-[#F1F5F9] opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                    >
                      <EllipsisVerticalIcon className="h-4 w-4" />
                    </button>
                    {commentMenuFor === msg.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setCommentMenuFor(null)} />
                        <div className="absolute right-0 top-full mt-1 w-32 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl z-20 overflow-hidden">
                          <button
                            onClick={() => {
                              setDeleteTarget(msg.id);
                              setCommentMenuFor(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#EF4444] hover:bg-[#EF4444]/10 transition"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const streamEnded = stream?.status === 'ended' || hostOffline;
  const showPlayer = isLive && !hostOffline;

  // Waiting -> Connecting -> Live -> (Reconnecting) -> Ended. Ended is
  // terminal; "waiting" (host hasn't started broadcasting yet) takes
  // priority over a transient socket drop since there's nothing to
  // reconnect a peer connection to yet in that state. "Live" means "there
  // is actually something to show": for a viewer that's isConnected (a
  // remote track has arrived); for a host that's hasLocalMedia (their own
  // getUserMedia() has resolved) - NOT isHost alone, which flips true the
  // instant the stream is marked live server-side, well before the camera/
  // mic prompt even resolves. Using isHost alone here previously caused the
  // thumbnail to be hidden (see videoPoster below) during that gap, leaving
  // the host looking at a blank element until their camera actually attached.
  type StagePhase = 'waiting' | 'connecting' | 'live' | 'reconnecting' | 'ended';
  const phase: StagePhase = streamEnded
    ? 'ended'
    : !isLive
    ? 'waiting'
    : !isSocketConnected
    ? 'reconnecting'
    : (isHost ? hasLocalMedia : isConnected)
    ? 'live'
    : 'connecting';
  const PHASE_META: Record<StagePhase, { label: string; dotClass: string; textClass: string }> = {
    waiting: { label: 'Waiting for host', dotClass: 'bg-[#F59E0B]', textClass: 'text-[#F59E0B]' },
    connecting: { label: 'Connecting…', dotClass: 'bg-[#00C8FF] animate-pulse', textClass: 'text-[#00C8FF]' },
    live: { label: 'Live now', dotClass: 'bg-emerald-400', textClass: 'text-emerald-400' },
    reconnecting: { label: 'Reconnecting…', dotClass: 'bg-[#F59E0B] animate-pulse', textClass: 'text-[#F59E0B]' },
    ended: { label: 'Ended', dotClass: 'bg-[#64748B]', textClass: 'text-[#94A3B8]' },
  };

  // Minimize/restore mount a structurally different <video> element (see
  // videoRef's callback-ref reattach logic in the hook), and a brand new
  // <video> node always shows its `poster` until IT personally renders a
  // first frame - even though the underlying stream never stopped flowing.
  // Once we've actually reached "live", there's nothing left to preview, so
  // omitting poster here means a remount has nothing stale to flash back to
  // (a split-second blank frame while the new element catches up, instead
  // of the old thumbnail image reappearing).
  const videoPoster = phase === 'live' ? undefined : stream?.thumbnail_url || undefined;

  // ============================================
  // MINIMIZED (picture-in-picture) MODE
  // ============================================
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-6 z-50 w-72 sm:w-80 rounded-2xl border border-[#1E3447] bg-[#0D1722] shadow-[0_8px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#1E3447] bg-[#0A111A]/80 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {phase === 'live' ? (
              <span className="flex-shrink-0 px-1.5 py-0.5 bg-[#EF4444] text-white text-[9px] font-bold rounded-full">
                LIVE
              </span>
            ) : (
              <span className={`flex-shrink-0 flex items-center gap-1 text-[9px] font-semibold ${PHASE_META[phase].textClass}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${PHASE_META[phase].dotClass}`} />
              </span>
            )}
            <span className="text-xs font-medium text-[#F1F5F9] truncate">{stream?.title || 'Live Stream'}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onRestore}
              title="Restore"
              className="p-1 text-[#94A3B8] hover:text-[#F1F5F9] rounded-md hover:bg-white/5 transition"
            >
              <ArrowsPointingOutIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={isHost ? handleEndStream : handleLeaveLive}
              title={isHost ? 'End Live' : 'Leave Live'}
              className="p-1 text-[#94A3B8] hover:text-[#EF4444] rounded-md hover:bg-white/5 transition"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="relative aspect-video bg-[#060B12]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00C8FF]" />
            </div>
          ) : showPlayer ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isHost || isMuted}
              poster={videoPoster}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <VideoCameraIcon className="h-8 w-8 text-[#94A3B8] opacity-30" />
            </div>
          )}
          {showPlayer && (
            <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 rounded-full text-[10px] text-[#F1F5F9]">
              <EyeIcon className="h-3 w-3" />
              {viewerCount}
            </span>
          )}
          {!isHost && showPlayer && needsUnmute && (
            <button
              onClick={toggleMute}
              title="Tap to unmute"
              className="absolute bottom-1.5 left-1.5 p-1 rounded-full bg-black/60 text-[#00C8FF] animate-pulse"
            >
              <SpeakerXMarkIcon className="h-3 w-3" />
            </button>
          )}
        </div>

        {isHost && showPlayer && (
          <div className="flex items-center justify-center gap-2 px-2 py-1.5 border-t border-[#1E3447] flex-shrink-0">
            <button
              onClick={toggleMic}
              className={`p-1.5 rounded-md transition ${isMicOn ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#94A3B8]'}`}
            >
              <MicrophoneIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // DOCKED (expanded, non-fullscreen) MODE
  // ============================================
  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-[90rem] h-full sm:h-[92vh] rounded-none sm:rounded-2xl border border-[#1E3447] bg-[#060B12] text-[#F1F5F9] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-4 sm:px-6 py-4 border-b border-[#1E3447] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 flex-shrink-0 rounded-full border border-[#00C8FF]/40 bg-[#00C8FF]/10 flex items-center justify-center">
              <CodeXml className="h-5 w-5 text-[#00C8FF]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-[#F1F5F9] truncate">
                {stream?.title || 'Live Stream'}
              </h2>
              <p className="text-sm text-[#94A3B8] flex items-center gap-1.5">
                <span className={`flex items-center gap-1 ${PHASE_META[phase].textClass}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${PHASE_META[phase].dotClass}`} />
                  {PHASE_META[phase].label}
                </span>
                {stream?.host_username && (
                  <>
                    <span>•</span>
                    <span>{stream.host_username}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onMinimize}
              title="Minimize"
              className="p-2 text-[#94A3B8] hover:text-[#F1F5F9] rounded-lg hover:bg-[#162534] transition"
            >
              <ArrowsPointingInIcon className="h-4 w-4" />
            </button>
            {isHost ? (
              <button
                onClick={handleEndStream}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EF4444] text-white rounded-lg text-xs font-semibold hover:bg-[#EF4444]/80 transition"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
                End Live
              </button>
            ) : (
              <button
                onClick={handleLeaveLive}
                title="Leave Live"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 border border-[#1E3447] hover:border-[#EF4444]/30 transition"
              >
                <ArrowRightOnRectangleIcon className="h-3.5 w-3.5" />
                Leave Live
              </button>
            )}
          </div>
        </div>

        {/* Compact action row */}
        <div className="flex items-center gap-1 px-4 sm:px-6 py-2 border-b border-[#1E3447] flex-shrink-0">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition ${
              isLiked ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#162534]'
            }`}
            title="Like"
          >
            {isLiked ? <HeartSolidIcon className="h-4 w-4" /> : <HeartIcon className="h-4 w-4" />}
            <span className="text-xs">{likeCount}</span>
          </button>
          <button onClick={handleShare} title="Share" className="p-2 text-[#94A3B8] hover:text-[#F1F5F9] rounded-lg hover:bg-[#162534] transition">
            <ShareIcon className="h-4 w-4" />
          </button>
          <button onClick={handleReport} title="Report" className="p-2 text-[#94A3B8] hover:text-[#EF4444] rounded-lg hover:bg-[#162534] transition">
            <FlagIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            title={isChatOpen ? 'Hide chat' : 'Show chat'}
            className={`p-2 rounded-lg transition ${isChatOpen ? 'text-[#00C8FF] bg-[#162534]' : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#162534]'}`}
          >
            <ChatBubbleLeftIcon className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF]" />
          </div>
        ) : !stream ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-bold text-[#F1F5F9]">Stream not found</h3>
              <button
                onClick={onEnd}
                className="mt-4 px-4 py-2 bg-[#00C8FF] text-[#060B12] rounded-lg font-medium hover:bg-[#00C8FF]/80 transition"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className={`flex-1 min-h-0 flex flex-col ${isChatOpen ? 'lg:flex-row' : ''} gap-4 p-4`}>
            {/* Video player */}
            <div
              ref={playerRef}
              className={`rounded-2xl border border-[#1E3447] bg-[#0D1722] overflow-hidden flex flex-col ${
                isChatOpen ? 'lg:w-3/4' : 'w-full'
              }`}
            >
              <div
                className="relative flex-1 aspect-video lg:aspect-auto bg-[#060B12]"
                onMouseMove={revealControls}
                onClick={revealControls}
                onTouchStart={revealControls}
              >
                {showPlayer ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted={isHost || isMuted}
                      poster={videoPoster}
                      className="w-full h-full object-cover"
                    />
                    {!isHost && (phase === 'connecting' || phase === 'reconnecting') && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#060B12]/80">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF] mx-auto mb-3" />
                          <p className="text-[#94A3B8]">
                            {phase === 'reconnecting'
                              ? 'Connection lost - reconnecting...'
                              : waitingForHost
                              ? 'Waiting for the host to start streaming...'
                              : 'Connecting to the stream...'}
                          </p>
                        </div>
                      </div>
                    )}
                    {/* The browser only allows autoplay when muted - this
                        lets the viewer restore audio with one click, which
                        (unlike starting playback unmuted) is always allowed
                        on an element that's already playing. */}
                    {!isHost && needsUnmute && (
                      <button
                        onClick={toggleMute}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-[#060B12]/90 border border-[#00C8FF]/40 text-sm font-medium text-[#F1F5F9] hover:border-[#00C8FF] transition animate-pulse"
                      >
                        <SpeakerXMarkIcon className="h-4 w-4 text-[#00C8FF]" />
                        Tap to unmute
                      </button>
                    )}

                    {/* Camera PiP - actually composited into what viewers
                        receive (see setPipConfig/useLiveStreamSignaling),
                        not just a local monitoring view. Shown whenever
                        screen-sharing with the camera still on; "hidden"
                        only stops it being drawn/sent, never the camera
                        track/stream itself. */}
                    {isHost && isScreenSharing && (
                      <div
                        // Sized as a % of the player width matching
                        // PIP_SIZE_RATIO in useLiveStreamSignaling (the same
                        // ratio the canvas compositor uses against the
                        // broadcast frame width), so this local preview is a
                        // true WYSIWYG match for what viewers receive -
                        // previously this used fixed Tailwind widths
                        // unrelated to the composited size.
                        style={{ width: `${PIP_SIZE_RATIO[pipSize] * 100}%` }}
                        className={`group/pip absolute ${PIP_POSITION_CLASSES[pipPosition]} aspect-video rounded-xl overflow-hidden border-2 border-[#1E3447] bg-[#0A111A] shadow-lg ${
                          isCameraPipHidden ? 'hidden' : ''
                        }`}
                      >
                        <video
                          ref={pipVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className={`w-full h-full object-cover ${isPipMirrored ? 'scale-x-[-1]' : ''}`}
                        />
                        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover/pip:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                          <div className="grid grid-cols-2 gap-1" role="group" aria-label="Camera position">
                            {(Object.keys(PIP_POSITION_CLASSES) as PipPosition[]).map((pos) => (
                              <button
                                key={pos}
                                type="button"
                                onClick={() => setPipPosition(pos)}
                                title={PIP_POSITION_LABELS[pos]}
                                aria-label={PIP_POSITION_LABELS[pos]}
                                className={`h-3 w-3 rounded-sm border transition ${
                                  pipPosition === pos ? 'bg-[#00C8FF] border-[#00C8FF]' : 'bg-white/10 border-white/30 hover:bg-white/25'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setIsPipMirrored((v) => !v)}
                              title="Mirror camera"
                              aria-label="Mirror camera"
                              className={`p-1 rounded transition ${isPipMirrored ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            >
                              <ArrowPathRoundedSquareIcon className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsCameraPipHidden(true)}
                              title="Hide camera"
                              aria-label="Hide camera"
                              className="p-1 rounded bg-white/10 text-white hover:bg-white/20 transition"
                            >
                              <EyeSlashIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {isHost && isScreenSharing && isCameraPipHidden && (
                      <button
                        type="button"
                        onClick={() => setIsCameraPipHidden(false)}
                        className={`absolute ${PIP_POSITION_CLASSES[pipPosition]} flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#060B12]/85 backdrop-blur-sm text-[#94A3B8] hover:text-[#F1F5F9] text-[11px] font-medium transition`}
                      >
                        <EyeSlashIcon className="h-3.5 w-3.5" />
                        Camera hidden
                      </button>
                    )}
                  </>
                ) : (
                  <div
                    className="flex items-center justify-center h-full bg-cover bg-center"
                    style={stream?.thumbnail_url ? { backgroundImage: `url(${stream.thumbnail_url})` } : undefined}
                  >
                    <div className="text-center px-4 py-3 rounded-xl bg-[#060B12]/70 backdrop-blur-sm">
                      <VideoCameraIcon className="h-16 w-16 mx-auto mb-4 text-[#94A3B8] opacity-30" />
                      <p className="text-[#94A3B8]">
                        {streamEnded ? 'This livestream has ended' : 'Waiting for the host to go live...'}
                      </p>
                    </div>
                  </div>
                )}

                {showPlayer && (
                  <>
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <span className="px-3 py-1 bg-[#EF4444] text-white text-xs font-bold rounded-full animate-pulse">
                        LIVE
                      </span>
                      <button
                        onClick={toggleViewers}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-[#060B12]/80 rounded-full text-xs text-[#F1F5F9] hover:bg-[#060B12] transition"
                        title="View viewers"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        {viewerCount}
                      </button>
                    </div>

                    {isHost && (
                      <div
                        className={`absolute top-4 right-4 flex items-center gap-2 bg-[#060B12]/80 rounded-lg p-1.5 transition-opacity duration-300 ${
                          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                        onMouseEnter={() => {
                          isHoveringControlsRef.current = true;
                          setControlsVisible(true);
                        }}
                        onMouseLeave={() => {
                          isHoveringControlsRef.current = false;
                          revealControls();
                        }}
                      >
                        <button
                          onClick={toggleMic}
                          title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                          className={`p-1.5 rounded-md transition ${isMicOn ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#94A3B8]'}`}
                        >
                          <MicrophoneIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={toggleScreenShare}
                          title={isScreenSharing ? 'Stop screen share' : 'Share your screen'}
                          className={`p-1.5 rounded-md transition ${isScreenSharing ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#94A3B8]'}`}
                        >
                          <ComputerDesktopIcon className="h-4 w-4" />
                        </button>
                        {isScreenSharing && (
                          <button
                            onClick={() => setIsCameraPipHidden((v) => !v)}
                            title={isCameraPipHidden ? 'Show camera' : 'Hide camera'}
                            className={`p-1.5 rounded-md transition ${isCameraPipHidden ? 'bg-[#1E3447] text-[#94A3B8]' : 'bg-[#00C8FF] text-[#060B12]'}`}
                          >
                            {isCameraPipHidden ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                          </button>
                        )}
                        <button
                          onClick={toggleRecording}
                          title={isRecording ? 'Stop recording' : 'Record this stream'}
                          className={`p-1.5 rounded-md transition ${isRecording ? 'bg-[#EF4444] text-white' : 'bg-[#1E3447] text-[#94A3B8]'}`}
                        >
                          {isRecording ? <StopIcon className="h-4 w-4" /> : <span className="block h-3 w-3 rounded-full bg-[#EF4444]" />}
                        </button>
                      </div>
                    )}

                    {!isHost && (
                      <button
                        onClick={toggleRecording}
                        onMouseEnter={() => {
                          isHoveringControlsRef.current = true;
                          setControlsVisible(true);
                        }}
                        onMouseLeave={() => {
                          isHoveringControlsRef.current = false;
                          revealControls();
                        }}
                        title={isRecording ? 'Stop recording' : 'Record this stream'}
                        className={`absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-opacity duration-300 ${
                          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        } ${isRecording ? 'bg-[#EF4444] text-white' : 'bg-[#060B12]/80 text-[#94A3B8] hover:text-[#F1F5F9]'}`}
                      >
                        {isRecording ? <StopIcon className="h-3.5 w-3.5" /> : <span className="block h-2.5 w-2.5 rounded-full bg-[#EF4444]" />}
                        {isRecording ? 'Stop' : 'Record'}
                      </button>
                    )}

                    {isScreenSharing && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 bg-[#00C8FF]/15 border border-[#00C8FF]/40 rounded-full text-xs font-medium text-[#00C8FF]">
                        <ComputerDesktopIcon className="h-3.5 w-3.5" />
                        Sharing screen
                      </div>
                    )}

                    <div
                      className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#060B12]/95 to-transparent px-3 sm:px-4 pt-10 pb-3 transition-opacity duration-300 ${
                        controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}
                      onMouseEnter={() => {
                        isHoveringControlsRef.current = true;
                        setControlsVisible(true);
                      }}
                      onMouseLeave={() => {
                        isHoveringControlsRef.current = false;
                        revealControls();
                      }}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button
                          onClick={togglePlayPause}
                          title={isPaused ? 'Play' : 'Pause'}
                          className="p-1.5 sm:p-1 text-[#F1F5F9] hover:text-[#00C8FF] transition flex-shrink-0"
                        >
                          {isPaused ? <PlayIcon className="h-5 w-5" /> : <PauseIcon className="h-5 w-5" />}
                        </button>

                        {/* A true live broadcast has no seekable history, so
                            this is a status indicator, not a fake/misleading
                            scrub bar - it fills the space a progress bar
                            would, without implying you can seek. */}
                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444] animate-pulse flex-shrink-0" />
                          <span className="text-xs font-bold uppercase tracking-wide text-[#F1F5F9]">Live</span>
                        </div>

                        <div
                          className="group/volume relative flex items-center flex-shrink-0"
                          onMouseEnter={() => {
                            isHoveringControlsRef.current = true;
                            setControlsVisible(true);
                          }}
                        >
                          <div className="hidden group-hover/volume:flex items-center pr-2">
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={isMuted ? 0 : volume}
                              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                              title="Volume"
                              className="w-16 sm:w-20 accent-[#00C8FF]"
                            />
                          </div>
                          <button
                            onClick={toggleMute}
                            title={isMuted ? 'Unmute' : 'Mute'}
                            className="p-1.5 sm:p-1 text-[#F1F5F9] hover:text-[#00C8FF] transition"
                          >
                            {isMuted ? <SpeakerXMarkIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
                          </button>
                        </div>

                        <button
                          onClick={toggleFullscreen}
                          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                          className="p-1.5 sm:p-1 text-[#F1F5F9] hover:text-[#00C8FF] transition flex-shrink-0"
                        >
                          {isFullscreen ? <ArrowsPointingInIcon className="h-5 w-5" /> : <ArrowsPointingOutIcon className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Chat panel */}
            {isChatOpen && (
            <div className="lg:w-1/4 rounded-2xl border border-[#1E3447] bg-[#0D1722] flex flex-col h-[40vh] lg:h-full">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1E3447] flex-shrink-0">
                <ChatBubbleLeftIcon className="h-4 w-4 text-[#00C8FF]" />
                <span className="text-sm font-semibold text-[#F1F5F9]">Live Chat</span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 themed-scrollbar">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-[#94A3B8] text-sm py-8">No messages yet. Start the conversation!</div>
                ) : (
                  chatMessages
                    .filter((msg) => !msg.parent_comment_id)
                    .map((msg) => (
                      <div key={msg.id}>
                        {renderComment(msg, false)}
                        {chatMessages
                          .filter((reply) => reply.parent_comment_id === msg.id)
                          .map((reply) => renderComment(reply, true))}
                      </div>
                    ))
                )}
                <div ref={chatEndRef} />
              </div>

              {showPlayer && (
                <form onSubmit={sendMessage} className="p-3 border-t border-[#1E3447] flex-shrink-0">
                  {replyingTo && (
                    <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-lg bg-[#162534] text-xs">
                      <span className="text-[#94A3B8]">
                        Replying to <span className="text-[#00C8FF] font-medium">@{replyingTo.username}</span>
                      </span>
                      <button type="button" onClick={() => setReplyingTo(null)} className="text-[#64748B] hover:text-[#F1F5F9] transition">
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Say something...'}
                      className="flex-1 px-4 py-2 bg-[#060B12] border border-[#1E3447] rounded-full text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF]"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      title="Send"
                      className="flex-shrink-0 h-9 w-9 flex items-center justify-center bg-[#00C8FF] text-[#060B12] rounded-full hover:opacity-90 transition disabled:opacity-40"
                    >
                      <PaperAirplaneIcon className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>
            )}
          </div>
        )}
      </div>

      {/* Viewers Modal */}
      {showViewers && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
          <div className="bg-[#0D1722] rounded-2xl max-w-md w-full max-h-[80vh] border border-[#1E3447]">
            <div className="flex items-center justify-between p-4 border-b border-[#1E3447]">
              <h3 className="text-lg font-bold text-[#F1F5F9] flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-[#00C8FF]" />
                Viewers ({viewerCount})
              </h3>
              <button onClick={() => setShowViewers(false)} className="text-[#94A3B8] hover:text-[#F1F5F9]">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
              {viewers.length === 0 ? (
                <p className="text-center text-[#94A3B8] py-8">No viewers yet</p>
              ) : (
                viewers.map((viewer) => (
                  <div key={viewer.id} className="flex items-center gap-3 p-2 hover:bg-[#162534] rounded-lg transition">
                    <div className="w-8 h-8 rounded-full bg-[#1E3447] flex items-center justify-center text-[#F1F5F9] text-xs font-bold">
                      {viewer.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#F1F5F9]">{viewer.username}</p>
                      <p className="text-xs text-[#94A3B8]">Joined {formatTime(viewer.joined_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Comment"
          message="Are you sure you want to delete this comment? This cannot be undone."
          confirmLabel="Delete"
          isLoading={isDeleting}
          onConfirm={handleDeleteComment}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
