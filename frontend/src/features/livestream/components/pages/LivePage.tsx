// frontend/src/features/livestream/pages/LivePage.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CodeXml } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { livestreamService } from '@/services/api/livestream.service';
import { Livestream, StreamViewer } from '@/types/livestream.types';
import { useLiveStreamSignaling, StreamChatMsg } from '../../hooks/useLiveStreamSignaling';
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
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  PaperAirplaneIcon,
  ComputerDesktopIcon,
  StopIcon,
  FaceSmileIcon,
  ArrowUturnLeftIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢'];

export default function LivePage() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stream, setStream] = useState<Livestream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [viewers, setViewers] = useState<StreamViewer[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [commentMenuFor, setCommentMenuFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const streamRef = useRef<Livestream | null>(null);
  const hasJoinedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const isHost = stream?.is_host ?? false;
  const isLive = stream?.status === 'live';
  const signalingEnabled = isLive && (isHost || !!stream?.can_view);

  const {
    videoRef,
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
  } = useLiveStreamSignaling({ streamId: streamId!, isHost, enabled: signalingEnabled });

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    fetchStream();
    // Poll viewer count while live. Reads streamRef (not `stream`) so the
    // closure always sees the latest status instead of the value captured
    // when the interval was created.
    const interval = setInterval(() => {
      if (streamRef.current?.status === 'live') {
        refreshViewerCount();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [streamId]);

  // Leave the stream (viewer only) when navigating away.
  useEffect(() => {
    return () => {
      if (hasJoinedRef.current && !streamRef.current?.is_host) {
        livestreamService.leaveStream(streamId!).catch(() => {});
      }
    };
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
      const response = await livestreamService.getStream(streamId!);
      let data = response.data;

      // Host landing on their own scheduled stream: start it so viewers can join.
      if (data.is_host && data.status === 'scheduled') {
        const startRes = await livestreamService.startStream(streamId!);
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
        toast.error('You don\'t have permission to view this stream');
        navigate('/livestreams');
      } else {
        toast.error('Failed to load stream');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const joinStream = async () => {
    try {
      await livestreamService.joinStream(streamId!);
      hasJoinedRef.current = true;
    } catch (error) {
      console.error('Failed to join stream:', error);
    }
  };

  const refreshViewerCount = async () => {
    try {
      const response = await livestreamService.getStream(streamId!);
      setViewerCount(response.data.viewer_count);
    } catch (error) {
      console.error('Failed to refresh viewer count:', error);
    }
  };

  const fetchViewers = async () => {
    try {
      const response = await livestreamService.getViewers(streamId!);
      setViewers(response.data);
    } catch (error) {
      console.error('Failed to fetch viewers:', error);
    }
  };

  const handleEndStream = async () => {
    if (!confirm('Are you sure you want to end this stream?')) return;
    try {
      await livestreamService.endStream(streamId!);
      toast.success('Stream ended');
      navigate('/livestreams');
    } catch (error) {
      toast.error('Failed to end stream');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: stream?.title || 'Live Stream',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
  };

  const toggleCamera = () => {
    const next = !isCameraOn;
    setIsCameraOn(next);
    toggleCameraTrack(next);
  };

  const toggleMic = () => {
    const next = !isMicOn;
    setIsMicOn(next);
    toggleMicTrack(next);
  };

  // Local playback controls for the received/preview <video> element itself
  // (separate from the host's outgoing camera/mic track toggles above).
  const togglePlayPause = () => {
    const video = videoRef.current;
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
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      playerRef.current?.requestFullscreen();
    }
  };

  const toggleViewers = () => {
    setShowViewers(!showViewers);
    if (!showViewers) {
      fetchViewers();
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendChatMessage(newMessage, replyingTo?.id ?? null);
    setNewMessage('');
    setReplyingTo(null);
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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
            <span className="text-sm font-medium text-[#F1F5F9] truncate">
              {isOwn ? 'You' : msg.username}
            </span>
            <span className="text-[10px] text-[#64748B] flex-shrink-0">
              {formatDistanceToNowStrict(new Date(msg.timestamp), { addSuffix: true })}
            </span>
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

              {/* Reaction chips */}
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

              {/* Hover actions: react / reply / delete */}
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

  const handleReport = () => {
    toast.success('Report submitted. We will review this stream.');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#060B12]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF]"></div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#060B12]">
        <div className="text-center">
          <h2 className="text-xl font-bold text-[#F1F5F9]">Stream not found</h2>
          <button
            onClick={() => navigate('/livestreams')}
            className="mt-4 px-4 py-2 bg-[#00C8FF] text-[#060B12] rounded-lg font-medium hover:bg-[#00C8FF]/80 transition"
          >
            Back to Streams
          </button>
        </div>
      </div>
    );
  }

  const streamEnded = stream.status === 'ended' || hostOffline;
  const showPlayer = isLive && !hostOffline;

  return (
    <div className="min-h-screen bg-[#060B12] text-[#F1F5F9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        {/* Page header */}
        <div className="pb-4 mb-5 border-b border-[#1E3447]">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F5F9]">Live Stream</h1>
        </div>

        {/* Stream info row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 flex-shrink-0 rounded-full border border-[#00C8FF]/40 bg-[#00C8FF]/10 flex items-center justify-center">
              <CodeXml className="h-5 w-5 text-[#00C8FF]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-[#F1F5F9] truncate">{stream.title}</h2>
              <p className="text-sm text-[#94A3B8] flex items-center gap-1.5">
                {isLive ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Live now
                  </span>
                ) : (
                  <span>{streamEnded ? 'Ended' : 'Offline'}</span>
                )}
                <span>•</span>
                <span>{stream.host_username}</span>
              </p>
            </div>
          </div>

          {/* Compact action row */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition ${
                isLiked
                  ? 'bg-[#EF4444]/20 text-[#EF4444]'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#162534]'
              }`}
              title="Like"
            >
              {isLiked ? <HeartSolidIcon className="h-4 w-4" /> : <HeartIcon className="h-4 w-4" />}
              <span className="text-xs">{likeCount}</span>
            </button>
            <button
              onClick={handleShare}
              title="Share"
              className="p-2 text-[#94A3B8] hover:text-[#F1F5F9] rounded-lg hover:bg-[#162534] transition"
            >
              <ShareIcon className="h-4 w-4" />
            </button>
            <button
              onClick={handleReport}
              title="Report"
              className="p-2 text-[#94A3B8] hover:text-[#EF4444] rounded-lg hover:bg-[#162534] transition"
            >
              <FlagIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              title={isChatOpen ? 'Hide chat' : 'Show chat'}
              className={`p-2 rounded-lg transition ${
                isChatOpen ? 'text-[#00C8FF] bg-[#162534]' : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#162534]'
              }`}
            >
              <ChatBubbleLeftIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Video + Chat */}
        <div className={`flex flex-col ${isChatOpen ? 'lg:flex-row' : ''} gap-4 lg:h-[65vh]`}>
          {/* Video player card */}
          <div
            ref={playerRef}
            className={`rounded-2xl border border-[#1E3447] bg-[#0D1722] overflow-hidden flex flex-col ${
              isChatOpen ? 'lg:w-3/4' : 'w-full'
            }`}
          >
            <div className="relative flex-1 aspect-video lg:aspect-auto bg-[#060B12]">
              {showPlayer ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isHost || isMuted}
                    className="w-full h-full object-cover"
                  />
                  {!isHost && waitingForHost && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#060B12]">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF] mx-auto mb-3" />
                        <p className="text-[#94A3B8]">Waiting for the host to start streaming...</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <VideoCameraIcon className="h-16 w-16 mx-auto mb-4 text-[#94A3B8] opacity-30" />
                    <p className="text-[#94A3B8]">
                      {streamEnded ? 'This stream has ended' : 'Stream is offline'}
                    </p>
                  </div>
                </div>
              )}

              {showPlayer && (
                <>
                  {/* Top-left: LIVE + viewer count */}
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

                  {/* Top-right: close / leave */}
                  <button
                    onClick={() => navigate('/livestreams')}
                    title="Leave stream"
                    className="absolute top-4 right-4 p-1.5 bg-[#060B12]/80 rounded-full text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#060B12] transition"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>

                  {/* Host-only broadcast controls */}
                  {isHost && (
                    <div className="absolute top-14 right-4 flex items-center gap-2 bg-[#060B12]/80 rounded-lg p-1.5">
                      <button
                        onClick={toggleCamera}
                        title={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
                        className={`p-1.5 rounded-md transition ${
                          isCameraOn ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#94A3B8]'
                        }`}
                      >
                        <VideoCameraIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={toggleMic}
                        title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                        className={`p-1.5 rounded-md transition ${
                          isMicOn ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#94A3B8]'
                        }`}
                      >
                        <MicrophoneIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={toggleScreenShare}
                        title={isScreenSharing ? 'Stop screen share' : 'Share your screen'}
                        className={`p-1.5 rounded-md transition ${
                          isScreenSharing ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#94A3B8]'
                        }`}
                      >
                        <ComputerDesktopIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={toggleRecording}
                        title={isRecording ? 'Stop recording' : 'Record this stream'}
                        className={`p-1.5 rounded-md transition ${
                          isRecording ? 'bg-[#EF4444] text-white' : 'bg-[#1E3447] text-[#94A3B8]'
                        }`}
                      >
                        {isRecording ? (
                          <StopIcon className="h-4 w-4" />
                        ) : (
                          <span className="block h-3 w-3 rounded-full bg-[#EF4444]" />
                        )}
                      </button>
                      <button
                        onClick={handleEndStream}
                        className="px-2.5 py-1.5 bg-[#EF4444] text-white rounded-md text-xs font-semibold hover:bg-[#EF4444]/80 transition"
                      >
                        End Live
                      </button>
                    </div>
                  )}

                  {/* Viewer recording control (records the incoming stream locally) */}
                  {!isHost && (
                    <button
                      onClick={toggleRecording}
                      title={isRecording ? 'Stop recording' : 'Record this stream'}
                      className={`absolute top-14 right-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                        isRecording
                          ? 'bg-[#EF4444] text-white'
                          : 'bg-[#060B12]/80 text-[#94A3B8] hover:text-[#F1F5F9]'
                      }`}
                    >
                      {isRecording ? <StopIcon className="h-3.5 w-3.5" /> : <span className="block h-2.5 w-2.5 rounded-full bg-[#EF4444]" />}
                      {isRecording ? 'Stop' : 'Record'}
                    </button>
                  )}

                  {/* Screen-share indicator (visible to everyone) */}
                  {isScreenSharing && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 bg-[#00C8FF]/15 border border-[#00C8FF]/40 rounded-full text-xs font-medium text-[#00C8FF]">
                      <ComputerDesktopIcon className="h-3.5 w-3.5" />
                      Sharing screen
                    </div>
                  )}

                  {/* Bottom control bar */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#060B12]/95 to-transparent px-4 pt-8 pb-3">
                    <div className="flex items-center gap-3">
                      <button onClick={togglePlayPause} title={isPaused ? 'Play' : 'Pause'} className="text-[#F1F5F9] hover:text-[#00C8FF] transition">
                        {isPaused ? <PlayIcon className="h-5 w-5" /> : <PauseIcon className="h-5 w-5" />}
                      </button>
                      {/* Non-interactive "at live edge" indicator - there is no seekable
                          timeline on a live WebRTC broadcast, only a live/paused state. */}
                      <div className="flex-1 h-1 rounded-full bg-[#1E3447] overflow-hidden">
                        <div className="h-full w-full bg-[#00C8FF]" />
                      </div>
                      <button onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} className="text-[#F1F5F9] hover:text-[#00C8FF] transition">
                        {isMuted ? <SpeakerXMarkIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
                      </button>
                      <button onClick={toggleFullscreen} title="Fullscreen" className="text-[#F1F5F9] hover:text-[#00C8FF] transition">
                        <ArrowsPointingOutIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Chat panel */}
          {isChatOpen && (
            <div className="lg:w-1/4 rounded-2xl border border-[#1E3447] bg-[#0D1722] flex flex-col h-[50vh] lg:h-full">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E3447] flex-shrink-0">
                <div className="flex items-center gap-2">
                  <ChatBubbleLeftIcon className="h-4 w-4 text-[#00C8FF]" />
                  <span className="text-sm font-semibold text-[#F1F5F9]">Live Chat</span>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-[#94A3B8] hover:text-[#F1F5F9] transition lg:hidden"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 themed-scrollbar">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-[#94A3B8] text-sm py-8">
                    No messages yet. Start the conversation!
                  </div>
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
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        className="text-[#64748B] hover:text-[#F1F5F9] transition"
                      >
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
      </div>

      {/* Viewers Modal */}
      {showViewers && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0D1722] rounded-2xl max-w-md w-full max-h-[80vh] border border-[#1E3447]">
            <div className="flex items-center justify-between p-4 border-b border-[#1E3447]">
              <h3 className="text-lg font-bold text-[#F1F5F9] flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-[#00C8FF]" />
                Viewers ({viewerCount})
              </h3>
              <button
                onClick={() => setShowViewers(false)}
                className="text-[#94A3B8] hover:text-[#F1F5F9]"
              >
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
                      <p className="text-xs text-[#94A3B8]">
                        Joined {new Date(viewer.joined_at).toLocaleTimeString()}
                      </p>
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
