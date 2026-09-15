// frontend/src/features/livestream/components/LiveStreamStage.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime, formatTime, formatDurationClock, parseServerDate } from '@/lib/formatters';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChatStore } from '@/features/chat/store/chat.store';
import { socketService } from '@/lib/socket';
import { livestreamService } from '@/services/api/livestream.service';
import { mediaService } from '@/services/api/media.service';
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

const PIP_POSITION_CLASSES: Record<PipPosition, string> = {
  'top-left': 'top-16 left-4',
  'top-right': 'top-16 right-4',
  'bottom-left': 'bottom-20 left-4',
  'bottom-right': 'bottom-20 right-4',
};
const PIP_POSITION_LABELS: Record<PipPosition, string> = {
  'top-left': 'Top left',
  'top-right': 'Top right',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
};

export function LiveStreamStage() {
  const streamId = useLiveSessionStore((s) => s.streamId);
  const isHostSession = useLiveSessionStore((s) => s.isHost);
  const isMinimized = useLiveSessionStore((s) => s.isMinimized);
  const minimize = useLiveSessionStore((s) => s.minimize);
  const restore = useLiveSessionStore((s) => s.restore);
  const endSession = useLiveSessionStore((s) => s.endSession);

  if (!streamId) return null;

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
  const navigate = useNavigate();
  const [stream, setStream] = useState<Livestream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [viewers, setViewers] = useState<StreamViewer[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraPipHidden, setIsCameraPipHidden] = useState(false);
  const [pipPosition, setPipPosition] = useState<PipPosition>('bottom-right');
  const [pipSize, setPipSize] = useState<PipSize>('small');
  const [isPipMirrored, setIsPipMirrored] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isEndingStream, setIsEndingStream] = useState(false);

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

  useEffect(() => {
    setPipConfig({ position: pipPosition, size: pipSize, mirrored: isPipMirrored, hidden: isCameraPipHidden });
  }, [pipPosition, pipSize, isPipMirrored, isCameraPipHidden, setPipConfig]);

  useEffect(() => {
    if (needsUnmute) setIsMuted(true);
  }, [needsUnmute]);

  const [liveDurationSeconds, setLiveDurationSeconds] = useState(0);
  useEffect(() => {
    if (!isLive || hostOffline || !stream?.started_at) return;
    const startedAtMs = parseServerDate(stream.started_at).getTime();
    const tick = () => setLiveDurationSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isLive, hostOffline, stream?.started_at]);

  const goToStreamerProfile = () => {
    if (stream?.host_id) navigate(`/profile/${stream.host_id}`);
  };

  const thumbnailCaptureAttemptedRef = useRef(false);
  useEffect(() => {
    if (!isHost || !hasLocalMedia || thumbnailCaptureAttemptedRef.current) return;
    if (stream?.thumbnail_url) {
      thumbnailCaptureAttemptedRef.current = true;
      return;
    }
    const video = videoElRef.current;
    if (!video) return;

    let cancelled = false;
    const captureNow = () => {
      if (cancelled || thumbnailCaptureAttemptedRef.current) return;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;
      thumbnailCaptureAttemptedRef.current = true;

      (async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
          if (!blob || cancelled) return;

          const file = new File([blob], `stream-${streamId}-thumbnail.jpg`, { type: 'image/jpeg' });
          const uploaded = await mediaService.uploadFiles([file]);
          const url = uploaded.urls[0];
          if (!url || cancelled) return;

          await livestreamService.updateStream(streamId, { thumbnail_url: url });
          setStream((prev) => (prev && !prev.thumbnail_url ? { ...prev, thumbnail_url: url } : prev));
        } catch (err) {
          console.warn('[Livestream] Auto thumbnail capture failed (non-fatal):', err);
        }
      })();
    };

    captureNow();
    video.addEventListener('loadeddata', captureNow);
    return () => {
      cancelled = true;
      video.removeEventListener('loadeddata', captureNow);
    };
  }, [isHost, hasLocalMedia, stream?.thumbnail_url, streamId, videoElRef]);

  const isSocketConnected = useChatStore((s) => s.isConnected);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

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

  const handleEndStream = () => {
    setShowEndConfirm(true);
  };

  const confirmEndStream = async () => {
    if (isEndingStream) return;
    setIsEndingStream(true);
    try {
      await livestreamService.endStream(streamId);
      toast.success('Stream ended');
      setShowEndConfirm(false);
      onEnd();
    } catch (error) {
      toast.error('Failed to end stream');
      setIsEndingStream(false);
    }
  };

  const handleLeaveLive = () => {
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
          <span className="text-[11px] text-text-muted italic px-3 py-1 rounded-full bg-glass">
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
        <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-text-primary text-xs font-bold overflow-hidden flex-shrink-0">
          {msg.avatar ? (
            <img src={msg.avatar} alt={msg.username} className="w-full h-full object-cover" />
          ) : (
            msg.username?.charAt(0).toUpperCase() || 'U'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-medium text-text-primary truncate">{isOwn ? 'You' : msg.username}</span>
            <span className="text-[10px] text-text-muted flex-shrink-0">{formatRelativeTime(msg.timestamp)}</span>
          </div>

          {msg.is_deleted ? (
            <p className="mt-0.5 inline-block px-2.5 py-1.5 rounded-xl bg-glass text-sm text-text-muted italic">
              This comment was deleted
            </p>
          ) : (
            <>
              <p className="mt-0.5 inline-block px-2.5 py-1.5 rounded-xl bg-glass text-sm text-text-primary break-words">
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
                          ? 'bg-text-primary/10 border-text-primary/40 text-text-primary'
                          : 'bg-bg border-border text-text-secondary hover:border-text-primary/30'
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
                    className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                  >
                    <FaceSmileIcon className="h-3.5 w-3.5" />
                    React
                  </button>
                  {reactionPickerFor === msg.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setReactionPickerFor(null)} />
                      <div className="absolute bottom-full left-0 mb-1 flex items-center gap-1 px-2 py-1.5 rounded-full border border-border bg-bg shadow-lg z-20">
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
                    className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                  >
                    <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                    Reply
                  </button>
                )}

                {canDelete && (
                  <div className="relative ml-auto">
                    <button
                      onClick={() => setCommentMenuFor(commentMenuFor === msg.id ? null : msg.id)}
                      className="text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                    >
                      <EllipsisVerticalIcon className="h-4 w-4" />
                    </button>
                    {commentMenuFor === msg.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setCommentMenuFor(null)} />
                        <div className="absolute right-0 top-full mt-1 w-32 rounded-xl border border-border bg-bg shadow-xl z-20 overflow-hidden">
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
    connecting: { label: 'Connecting…', dotClass: 'bg-text-primary animate-pulse', textClass: 'text-text-primary' },
    live: { label: 'Live now', dotClass: 'bg-emerald-400', textClass: 'text-emerald-400' },
    reconnecting: { label: 'Reconnecting…', dotClass: 'bg-[#F59E0B] animate-pulse', textClass: 'text-[#F59E0B]' },
    ended: { label: 'Ended', dotClass: 'bg-text-muted', textClass: 'text-text-secondary' },
  };

  const videoPoster = phase === 'live' ? undefined : stream?.thumbnail_url || undefined;

  // ============================================
  // MINIMIZED (picture-in-picture) MODE
  // ============================================
  if (isMinimized) {
    return (
      <>
      <div className="fixed bottom-6 left-6 z-50 w-72 sm:w-80 rounded-2xl border border-border bg-bg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg/80 flex-shrink-0">
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
            <span className="text-xs font-medium text-text-primary truncate">{stream?.title || 'Live Stream'}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onRestore}
              title="Restore"
              className="p-1 text-text-secondary hover:text-text-primary rounded-md hover:bg-glass transition"
            >
              <ArrowsPointingOutIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={isHost ? handleEndStream : handleLeaveLive}
              title={isHost ? 'End Live' : 'Leave Live'}
              className="p-1 text-text-secondary hover:text-[#EF4444] rounded-md hover:bg-glass transition"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="relative aspect-video bg-bg">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-text-primary" />
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
              <VideoCameraIcon className="h-8 w-8 text-text-secondary opacity-30" />
            </div>
          )}
          {showPlayer && (
            <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 rounded-full text-[10px] text-white">
              <EyeIcon className="h-3 w-3" />
              {viewerCount}
            </span>
          )}
          {!isHost && showPlayer && needsUnmute && (
            <button
              onClick={toggleMute}
              title="Tap to unmute"
              className="absolute bottom-1.5 left-1.5 p-1 rounded-full bg-black/60 text-text-primary animate-pulse"
            >
              <SpeakerXMarkIcon className="h-3 w-3" />
            </button>
          )}
        </div>

        {isHost && showPlayer && (
          <div className="flex items-center justify-center gap-2 px-2 py-1.5 border-t border-border flex-shrink-0">
            <button
              onClick={toggleMic}
              className={`p-1.5 rounded-md transition ${isMicOn ? 'bg-text-primary text-bg' : 'bg-border text-text-secondary'}`}
            >
              <MicrophoneIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {showEndConfirm && (
        <ConfirmDialog
          title="End Livestream?"
          message={
            <>
              Are you sure you want to end this stream?
              <br />
              Your current livestream will be ended for all viewers.
            </>
          }
          confirmLabel="End Live"
          loadingLabel="Ending stream..."
          isLoading={isEndingStream}
          onConfirm={confirmEndStream}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}
      </>
    );
  }

  // ============================================
  // DOCKED (expanded, non-fullscreen) MODE
  // ============================================
  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-[90rem] h-full sm:h-[92vh] rounded-none sm:rounded-2xl border border-border bg-bg text-text-primary shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-4 sm:px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={goToStreamerProfile}
              title={stream?.host_username ? `View ${stream.host_username}'s profile` : undefined}
              className="flex-shrink-0 rounded-full transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/60"
            >
              <Avatar src={stream?.host_avatar} name={stream?.host_username} size="md" />
            </button>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-text-primary truncate">
                {stream?.title || 'Live Stream'}
              </h2>
              <p className="text-sm text-text-secondary flex items-center gap-1.5 flex-wrap">
                <span className={`flex items-center gap-1 ${PHASE_META[phase].textClass}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${PHASE_META[phase].dotClass}`} />
                  {PHASE_META[phase].label}
                </span>
                {phase === 'live' && (
                  <>
                    <span>•</span>
                    <span className="font-mono tabular-nums text-text-primary">
                      {formatDurationClock(liveDurationSeconds)}
                    </span>
                  </>
                )}
                {stream?.host_username && (
                  <>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={goToStreamerProfile}
                      className="hover:text-text-primary hover:underline transition truncate"
                    >
                      {stream.host_username}
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onMinimize}
              title="Minimize"
              className="p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-glass transition"
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-[#EF4444] hover:bg-[#EF4444]/10 border border-border hover:border-[#EF4444]/30 transition"
              >
                <ArrowRightOnRectangleIcon className="h-3.5 w-3.5" />
                Leave Live
              </button>
            )}
          </div>
        </div>

        {/* Compact action row */}
        <div className="flex items-center gap-1 px-4 sm:px-6 py-2 border-b border-border flex-shrink-0">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition ${
              isLiked ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'text-text-secondary hover:text-text-primary hover:bg-glass'
            }`}
            title="Like"
          >
            {isLiked ? <HeartSolidIcon className="h-4 w-4" /> : <HeartIcon className="h-4 w-4" />}
            <span className="text-xs">{likeCount}</span>
          </button>
          <button onClick={handleShare} title="Share" className="p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-glass transition">
            <ShareIcon className="h-4 w-4" />
          </button>
          <button onClick={handleReport} title="Report" className="p-2 text-text-secondary hover:text-[#EF4444] rounded-lg hover:bg-glass transition">
            <FlagIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            title={isChatOpen ? 'Hide chat' : 'Show chat'}
            className={`p-2 rounded-lg transition ${isChatOpen ? 'text-text-primary bg-glass' : 'text-text-secondary hover:text-text-primary hover:bg-glass'}`}
          >
            <ChatBubbleLeftIcon className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
          </div>
        ) : !stream ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-bold text-text-primary">Stream not found</h3>
              <button
                onClick={onEnd}
                className="mt-4 px-4 py-2 border border-border bg-glass text-text-primary rounded-lg font-medium hover:bg-glass-hover transition"
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
              className={`rounded-2xl border border-border bg-bg overflow-hidden flex flex-col min-h-0 ${
                isChatOpen ? 'flex-[3] lg:flex-none lg:w-3/4' : 'flex-1 w-full'
              }`}
            >
              <div
                className="relative flex-1 min-h-0 bg-bg"
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
                      className="w-full h-full object-contain"
                    />
                    {!isHost && (phase === 'connecting' || phase === 'reconnecting') && (
                      <div className="absolute inset-0 flex items-center justify-center bg-bg/80">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary mx-auto mb-3" />
                          <p className="text-text-secondary">
                            {phase === 'reconnecting'
                              ? 'Connection lost - reconnecting...'
                              : waitingForHost
                              ? 'Waiting for the host to start streaming...'
                              : 'Connecting to the stream...'}
                          </p>
                        </div>
                      </div>
                    )}
                    {!isHost && needsUnmute && (
                      <button
                        onClick={toggleMute}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-bg/90 border border-text-primary/40 text-sm font-medium text-text-primary hover:border-text-primary transition animate-pulse"
                      >
                        <SpeakerXMarkIcon className="h-4 w-4 text-text-primary" />
                        Tap to unmute
                      </button>
                    )}

                    {isHost && isScreenSharing && (
                      <div
                        style={{ width: `${PIP_SIZE_RATIO[pipSize] * 100}%` }}
                        className={`group/pip absolute ${PIP_POSITION_CLASSES[pipPosition]} aspect-video rounded-xl overflow-hidden border-2 border-border bg-bg shadow-lg ${
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
                                  pipPosition === pos ? 'bg-text-primary border-text-primary' : 'bg-white/10 border-white/30 hover:bg-white/25'
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
                              className={`p-1 rounded transition ${isPipMirrored ? 'bg-text-primary text-bg' : 'bg-white/10 text-white hover:bg-white/20'}`}
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
                        className={`absolute ${PIP_POSITION_CLASSES[pipPosition]} flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm text-white/70 hover:text-white text-[11px] font-medium transition`}
                      >
                        <EyeSlashIcon className="h-3.5 w-3.5" />
                        Camera hidden
                      </button>
                    )}
                  </>
                ) : (
                  <div
                    className={`relative flex items-center justify-center h-full bg-cover bg-center ${
                      stream?.thumbnail_url ? '' : 'bg-gradient-to-br from-bg via-bg to-border'
                    }`}
                    style={stream?.thumbnail_url ? { backgroundImage: `url(${stream.thumbnail_url})` } : undefined}
                  >
                    {stream?.thumbnail_url && <div className="absolute inset-0 bg-bg/50" />}
                    <div className="relative text-center px-4 py-3 rounded-xl bg-bg/70 backdrop-blur-sm">
                      {!streamEnded && (
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary mx-auto mb-3" />
                      )}
                      <VideoCameraIcon
                        className={`h-16 w-16 mx-auto mb-4 text-text-secondary opacity-30 ${streamEnded ? '' : 'hidden'}`}
                      />
                      <p className="text-text-secondary">
                        {streamEnded ? 'This livestream has ended' : 'Connecting to live stream...'}
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
                      {phase === 'live' && (
                        <span className="px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-full text-xs font-mono tabular-nums text-white">
                          {formatDurationClock(liveDurationSeconds)}
                        </span>
                      )}
                      <button
                        onClick={toggleViewers}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-black/70 rounded-full text-xs text-white hover:bg-black/90 transition"
                        title="View viewers"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        {viewerCount}
                      </button>
                    </div>

                    {isHost && (
                      <div
                        className={`absolute top-4 right-4 flex items-center gap-2 bg-black/70 rounded-lg p-1.5 transition-opacity duration-300 ${
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
                          className={`p-1.5 rounded-md transition ${isMicOn ? 'bg-text-primary text-bg' : 'bg-border text-text-secondary'}`}
                        >
                          <MicrophoneIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={toggleScreenShare}
                          title={isScreenSharing ? 'Stop screen share' : 'Share your screen'}
                          className={`p-1.5 rounded-md transition ${isScreenSharing ? 'bg-text-primary text-bg' : 'bg-border text-text-secondary'}`}
                        >
                          <ComputerDesktopIcon className="h-4 w-4" />
                        </button>
                        {isScreenSharing && (
                          <button
                            onClick={() => setIsCameraPipHidden((v) => !v)}
                            title={isCameraPipHidden ? 'Show camera' : 'Hide camera'}
                            className={`p-1.5 rounded-md transition ${isCameraPipHidden ? 'bg-border text-text-secondary' : 'bg-text-primary text-bg'}`}
                          >
                            {isCameraPipHidden ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                          </button>
                        )}
                        <button
                          onClick={toggleRecording}
                          title={isRecording ? 'Stop recording' : 'Record this stream'}
                          className={`p-1.5 rounded-md transition ${isRecording ? 'bg-[#EF4444] text-white' : 'bg-border text-text-secondary'}`}
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
                        } ${isRecording ? 'bg-[#EF4444] text-white' : 'bg-black/70 text-white/70 hover:text-white'}`}
                      >
                        {isRecording ? <StopIcon className="h-3.5 w-3.5" /> : <span className="block h-2.5 w-2.5 rounded-full bg-[#EF4444]" />}
                        {isRecording ? 'Stop' : 'Record'}
                      </button>
                    )}

                    {isScreenSharing && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 bg-text-primary/15 border border-text-primary/40 rounded-full text-xs font-medium text-text-primary">
                        <ComputerDesktopIcon className="h-3.5 w-3.5" />
                        Sharing screen
                      </div>
                    )}

                    <div
                      className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 to-transparent px-3 sm:px-4 pt-10 pb-3 transition-opacity duration-300 ${
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
                          className="p-1.5 sm:p-1 text-white hover:text-text-primary transition flex-shrink-0"
                        >
                          {isPaused ? <PlayIcon className="h-5 w-5" /> : <PauseIcon className="h-5 w-5" />}
                        </button>

                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444] animate-pulse flex-shrink-0" />
                          <span className="text-xs font-bold uppercase tracking-wide text-white">Live</span>
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
                              className="w-16 sm:w-20 accent-text-primary"
                            />
                          </div>
                          <button
                            onClick={toggleMute}
                            title={isMuted ? 'Unmute' : 'Mute'}
                            className="p-1.5 sm:p-1 text-white hover:text-text-primary transition"
                          >
                            {isMuted ? <SpeakerXMarkIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
                          </button>
                        </div>

                        <button
                          onClick={toggleFullscreen}
                          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                          className="p-1.5 sm:p-1 text-white hover:text-text-primary transition flex-shrink-0"
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
            <div className="lg:w-1/4 rounded-2xl border border-border bg-bg flex flex-col flex-[2] min-h-0 lg:flex-none lg:h-full">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
                <ChatBubbleLeftIcon className="h-4 w-4 text-text-primary" />
                <span className="text-sm font-semibold text-text-primary">Live Chat</span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 themed-scrollbar">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-text-secondary text-sm py-8">No messages yet. Start the conversation!</div>
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
                <form onSubmit={sendMessage} className="p-3 border-t border-border flex-shrink-0">
                  {replyingTo && (
                    <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-lg bg-glass text-xs">
                      <span className="text-text-secondary">
                        Replying to <span className="text-text-primary font-medium">@{replyingTo.username}</span>
                      </span>
                      <button type="button" onClick={() => setReplyingTo(null)} className="text-text-muted hover:text-text-primary transition">
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
                      className="flex-1 px-4 py-2 bg-bg border border-border rounded-full text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-border"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      title="Send"
                      className="flex-shrink-0 h-9 w-9 flex items-center justify-center bg-text-primary text-bg rounded-full hover:opacity-90 transition disabled:opacity-40"
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
          <div className="bg-bg rounded-2xl max-w-md w-full max-h-[80vh] border border-border">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-text-primary" />
                Viewers ({viewerCount})
              </h3>
              <button onClick={() => setShowViewers(false)} className="text-text-secondary hover:text-text-primary">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
              {viewers.length === 0 ? (
                <p className="text-center text-text-secondary py-8">No viewers yet</p>
              ) : (
                viewers.map((viewer) => (
                  <button
                    key={viewer.id}
                    type="button"
                    onClick={() => {
                      setShowViewers(false);
                      navigate(`/profile/${viewer.user_id}`);
                    }}
                    className="w-full flex items-center gap-3 p-2 hover:bg-glass rounded-lg transition text-left"
                  >
                    <Avatar src={viewer.avatar} name={viewer.username} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{viewer.username}</p>
                      <p className="text-xs text-text-secondary">Joined {formatTime(viewer.joined_at)}</p>
                    </div>
                  </button>
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

      {showEndConfirm && (
        <ConfirmDialog
          title="End Livestream?"
          message={
            <>
              Are you sure you want to end this stream?
              <br />
              Your current livestream will be ended for all viewers.
            </>
          }
          confirmLabel="End Live"
          loadingLabel="Ending stream..."
          isLoading={isEndingStream}
          onConfirm={confirmEndStream}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}
    </div>
  );
}