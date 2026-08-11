// frontend/src/features/livestream/pages/LivestreamsPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { livestreamService } from '@/services/api/livestream.service';
import { Livestream } from '@/types/livestream.types';
import GoLiveModal from '../../components/GoLiveModal';
import { Card } from '@/components/ui/Card/Card';

import toast from 'react-hot-toast';
import { VideoCameraIcon, UserGroupIcon, GlobeAltIcon, UserIcon } from '@heroicons/react/24/outline';

export default function LivestreamsPage() {
  const navigate = useNavigate();
  const [streams, setStreams] = useState<Livestream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGoLive, setShowGoLive] = useState(false);

  useEffect(() => {
    fetchStreams();
  }, []);

  const fetchStreams = async () => {
    setIsLoading(true);
    try {
      const response = await livestreamService.getStreams('live');
      setStreams(response.data);
    } catch (error) {
      console.error('Failed to fetch streams:', error);
      toast.error('Failed to load streams');
    } finally {
      setIsLoading(false);
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public': return <GlobeAltIcon className="h-4 w-4" />;
      case 'friends': return <UserIcon className="h-4 w-4" />;
      case 'section': return <UserGroupIcon className="h-4 w-4" />;
      default: return null;
    }
  };

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'public': return 'Public';
      case 'friends': return 'Friends Only';
      case 'section': return 'Section';
      default: return visibility;
    }
  };

  const handleStreamClick = (streamId: string) => {
    navigate(`/live/${streamId}`);
  };

  const handleGoLive = () => {
    setShowGoLive(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#060B12]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060B12] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#F1F5F9]">Live Streams</h1>
            <p className="text-[#94A3B8] mt-1">Watch and interact with live content</p>
          </div>
          <button
            onClick={handleGoLive}
            className="flex items-center gap-2 px-4 py-2 bg-[#EF4444] text-white rounded-lg font-medium hover:bg-[#EF4444]/80 transition"
          >
            <VideoCameraIcon className="h-5 w-5" />
            Go Live
          </button>
        </div>

        {/* Streams Grid */}
        {streams.length === 0 ? (
          <div className="text-center py-20">
            <VideoCameraIcon className="h-16 w-16 mx-auto text-[#94A3B8] opacity-30" />
            <h3 className="text-xl font-medium text-[#F1F5F9] mt-4">No Live Streams</h3>
            <p className="text-[#94A3B8] mt-2">There are no active streams right now</p>
            <button
              onClick={handleGoLive}
              className="mt-4 px-4 py-2 bg-[#00C8FF] text-[#060B12] rounded-lg font-medium hover:bg-[#00C8FF]/80 transition"
            >
              Start a Stream
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {streams.map((stream) => (
              <div
                key={stream.id}
                onClick={() => handleStreamClick(stream.id)}
                className="cursor-pointer group"
              >
                <Card className="bg-[#0A111A] border border-[#1E3447] hover:border-[#00C8FF]/50 transition overflow-hidden">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-[#060B12] relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <VideoCameraIcon className="h-12 w-12 text-[#94A3B8] opacity-30" />
                    </div>
                    {/* Live Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-2">
                      <span className="px-2 py-1 bg-[#EF4444] text-white text-xs font-bold rounded-full animate-pulse">
                        LIVE
                      </span>
                      <span className="text-xs text-[#94A3B8]">
                        {stream.viewer_count} watching
                      </span>
                    </div>
                    {/* Visibility */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-[#060B12]/80 rounded-full text-xs text-[#94A3B8]">
                      {getVisibilityIcon(stream.visibility)}
                      <span>{getVisibilityLabel(stream.visibility)}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-[#00C8FF] flex items-center justify-center text-[#060B12] font-bold text-sm">
                        {stream.host_username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#F1F5F9]">
                          {stream.host_username}
                        </p>
                        <span className="text-xs text-[#94A3B8]">{stream.host_role}</span>
                      </div>
                    </div>
                    <h3 className="text-sm font-medium text-[#F1F5F9] line-clamp-1">
                      {stream.title}
                    </h3>
                    {stream.description && (
                      <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1">
                        {stream.description}
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Go Live Modal */}
      {showGoLive && (
        <GoLiveModal
          onClose={() => setShowGoLive(false)}
          onStreamCreated={(streamId) => {
            navigate(`/live/${streamId}`);
          }}
        />
      )}
    </div>
  );
}