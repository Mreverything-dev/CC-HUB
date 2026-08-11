// frontend/src/features/livestream/pages/LivePage.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { livestreamService } from '@/services/api/livestream.service';
import { Livestream, StreamViewer } from '@/types/livestream.types';
import { useLiveStreamSignaling } from '../../hooks/useLiveStreamSignaling';
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
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

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
  const [newMessage, setNewMessage] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const streamRef = useRef<Livestream | null>(null);
  const hasJoinedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isHost = stream?.is_host ?? false;
  const isLive = stream?.status === 'live';
  const signalingEnabled = isLive && (isHost || !!stream?.can_view);

  const {
    videoRef,
    mediaError,
    hostOffline,
    chatMessages,
    sendChatMessage,
    toggleCameraTrack,
    toggleMicTrack,
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

  const toggleViewers = () => {
    setShowViewers(!showViewers);
    if (!showViewers) {
      fetchViewers();
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendChatMessage(newMessage);
    setNewMessage('');
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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

  return (
    <div className="min-h-screen bg-[#060B12] flex flex-col">
      {/* Main Content */}
      <div className={`flex-1 flex ${isChatOpen ? 'flex-col lg:flex-row' : 'flex-col'}`}>
        {/* Video Area */}
        <div className={`flex-1 bg-[#0A111A] relative ${isChatOpen ? 'lg:w-3/4' : 'w-full'}`}>
          {/* Video Player */}
          <div className="aspect-video relative">
            {isLive && !hostOffline ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isHost}
                className="w-full h-full object-cover bg-[#060B12]"
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-[#060B12]">
                <div className="text-center">
                  <VideoCameraIcon className="h-16 w-16 mx-auto mb-4 text-[#94A3B8] opacity-30" />
                  <p className="text-[#94A3B8]">
                    {streamEnded ? 'This stream has ended' : 'Stream is offline'}
                  </p>
                </div>
              </div>
            )}

            {/* Overlay Controls */}
            {isLive && !hostOffline && (
              <>
                {/* LIVE Badge */}
                <div className="absolute top-4 left-4 flex items-center gap-3">
                  <span className="px-3 py-1 bg-[#EF4444] text-white text-sm font-bold rounded-full animate-pulse">
                    LIVE
                  </span>
                  <span className="text-sm text-[#94A3B8]">
                    {viewerCount} watching
                  </span>
                </div>

                {/* Host Info */}
                <div className="absolute bottom-4 left-4 flex items-center gap-3 bg-[#060B12]/80 rounded-lg p-2">
                  <div className="w-8 h-8 rounded-full bg-[#00C8FF] flex items-center justify-center text-[#060B12] font-bold text-sm">
                    {stream.host_username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#F1F5F9]">
                      {stream.host_username || 'Host'}
                    </p>
                    <span className="text-xs text-[#94A3B8]">{stream.host_role || 'User'}</span>
                  </div>
                </div>

                {/* Controls */}
                {isHost && (
                  <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-[#060B12]/80 rounded-lg p-2">
                    <button
                      onClick={toggleCamera}
                      className={`p-2 rounded-lg transition ${
                        isCameraOn ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#94A3B8]'
                      }`}
                    >
                      <VideoCameraIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={toggleMic}
                      className={`p-2 rounded-lg transition ${
                        isMicOn ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#94A3B8]'
                      }`}
                    >
                      <MicrophoneIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleEndStream}
                      className="px-3 py-2 bg-[#EF4444] text-white rounded-lg text-sm font-medium hover:bg-[#EF4444]/80 transition"
                    >
                      End Live
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Chat Area */}
        {isChatOpen && (
          <div className="lg:w-1/4 bg-[#0A111A] border-l border-[#1E3447] flex flex-col h-[60vh] lg:h-auto">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-3 border-b border-[#1E3447]">
              <div className="flex items-center gap-2">
                <ChatBubbleLeftIcon className="h-5 w-5 text-[#00C8FF]" />
                <span className="text-sm font-medium text-[#F1F5F9]">Live Chat</span>
                <button
                  onClick={toggleViewers}
                  className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#F1F5F9] transition"
                >
                  <UsersIcon className="h-4 w-4" />
                  <span>{viewerCount}</span>
                </button>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-[#94A3B8] hover:text-[#F1F5F9]"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages.length === 0 ? (
                <div className="text-center text-[#94A3B8] text-sm py-8">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#1E3447] flex items-center justify-center text-[#F1F5F9] text-xs font-bold overflow-hidden flex-shrink-0">
                      {msg.avatar ? (
                        <img src={msg.avatar} alt={msg.username} className="w-full h-full object-cover" />
                      ) : (
                        msg.username?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-[#F1F5F9]">{msg.username}</span>
                      {msg.user_id === user?.id && (
                        <span className="ml-1.5 text-[10px] text-[#00C8FF]">(You)</span>
                      )}
                      <p className="text-sm text-[#94A3B8] break-words">{msg.message}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            {isLive && !hostOffline && (
              <form onSubmit={sendMessage} className="p-3 border-t border-[#1E3447]">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 bg-[#0D1722] border border-[#1E3447] rounded-lg text-sm text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#00C8FF]"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-[#00C8FF] text-[#060B12] rounded-lg text-sm font-medium hover:bg-[#00C8FF]/80 transition disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Info Bar */}
      <div className="bg-[#0A111A] border-t border-[#1E3447] p-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-[#F1F5F9] truncate">
                {stream.title}
              </h1>
              {stream.description && (
                <p className="text-sm text-[#94A3B8] hidden md:block truncate">
                  {stream.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Like Button */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition ${
                isLiked
                  ? 'bg-[#EF4444]/20 text-[#EF4444]'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#162534]'
              }`}
            >
              {isLiked ? (
                <HeartSolidIcon className="h-5 w-5" />
              ) : (
                <HeartIcon className="h-5 w-5" />
              )}
              <span className="text-sm">{likeCount}</span>
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="p-2 text-[#94A3B8] hover:text-[#F1F5F9] rounded-lg hover:bg-[#162534] transition"
            >
              <ShareIcon className="h-5 w-5" />
            </button>

            {/* Report Button */}
            <button
              onClick={handleReport}
              className="p-2 text-[#94A3B8] hover:text-[#EF4444] rounded-lg hover:bg-[#162534] transition"
            >
              <FlagIcon className="h-5 w-5" />
            </button>

            {/* Chat Toggle */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`p-2 rounded-lg transition ${
                isChatOpen
                  ? 'text-[#00C8FF] bg-[#162534]'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#162534]'
              }`}
            >
              <ChatBubbleLeftIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Viewers Modal */}
      {showViewers && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0A111A] rounded-2xl max-w-md w-full max-h-[80vh] border border-[#1E3447]">
            <div className="flex items-center justify-between p-4 border-b border-[#1E3447]">
              <h3 className="text-lg font-bold text-[#F1F5F9]">
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
    </div>
  );
}
