// frontend/src/features/livestream/pages/LivestreamsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { livestreamService } from '@/services/api/livestream.service';
import { Livestream } from '@/types/livestream.types';
import { useSections } from '@/features/sections/hooks/useSections';
import GoLiveModal from '../../components/GoLiveModal';
import { LiveStreamCard } from '../LiveStreamCard';
import { UpcomingStreamCard } from '../UpcomingStreamCard';
import { STREAM_CATEGORY_FILTER_OPTIONS, matchesStreamCategory } from '../../constants';
import toast from 'react-hot-toast';
import {
  VideoCameraIcon,
  MagnifyingGlassIcon,
  SignalIcon,
  EyeIcon,
  UserGroupIcon,
  FilmIcon,
} from '@heroicons/react/24/outline';

function StatCard({ icon: Icon, value, label, tint }: { icon: typeof SignalIcon; value: number; label: string; tint: string }) {
  return (
    <div className="rounded-2xl border border-[#1E3447] bg-[rgba(15,25,38,0.75)] backdrop-blur-xl p-3.5 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tint}`}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-[#F1F5F9] leading-tight">{value}</p>
        <p className="text-[11px] text-[#94A3B8] truncate">{label}</p>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#1E3447] bg-[#0A111A] overflow-hidden animate-pulse">
      <div className="aspect-video bg-[#162534]" />
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-[#162534]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-24 rounded bg-[#162534]" />
            <div className="h-2 w-14 rounded bg-[#162534]" />
          </div>
        </div>
        <div className="h-3 w-3/4 rounded bg-[#162534]" />
        <div className="h-4 w-16 rounded-full bg-[#162534]" />
      </div>
    </div>
  );
}

export default function LivestreamsPage() {
  const navigate = useNavigate();
  const { sections } = useSections();
  const [liveStreams, setLiveStreams] = useState<Livestream[]>([]);
  const [upcomingStreams, setUpcomingStreams] = useState<Livestream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGoLive, setShowGoLive] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [reminders, setReminders] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchStreams();
  }, []);

  const fetchStreams = async () => {
    setIsLoading(true);
    try {
      const [liveRes, upcomingRes] = await Promise.all([
        livestreamService.getStreams('live'),
        livestreamService.getStreams('scheduled'),
      ]);
      setLiveStreams(liveRes.data);
      setUpcomingStreams(upcomingRes.data);
    } catch (error) {
      console.error('Failed to fetch streams:', error);
      toast.error('Failed to load streams');
    } finally {
      setIsLoading(false);
    }
  };

  const sectionNameById = useMemo(() => {
    const map = new Map<string, string>();
    (sections || []).forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sections]);

  const getSectionName = (stream: Livestream) => {
    const id = stream.target_section_ids?.[0];
    return id ? sectionNameById.get(id) || null : null;
  };

  const matchesSearch = (stream: Livestream) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      stream.title.toLowerCase().includes(q) ||
      stream.host_username?.toLowerCase().includes(q) ||
      (getSectionName(stream) || '').toLowerCase().includes(q)
    );
  };

  const filteredLive = liveStreams.filter((s) => matchesSearch(s) && matchesStreamCategory(s.title, s.description, category));
  const filteredUpcoming = upcomingStreams.filter((s) => matchesSearch(s) && matchesStreamCategory(s.title, s.description, category));

  const stats = useMemo(() => {
    const combined = [...liveStreams, ...upcomingStreams];
    const totalWatching = liveStreams.reduce((sum, s) => sum + (s.viewer_count || 0), 0);
    const streamerIds = new Set(combined.map((s) => s.host_id));
    return {
      liveNow: liveStreams.length,
      totalWatching,
      streamers: streamerIds.size,
      totalStreams: combined.length,
    };
  }, [liveStreams, upcomingStreams]);

  const toggleReminder = (streamId: string) => {
    setReminders((prev) => {
      const next = new Set(prev);
      if (next.has(streamId)) {
        next.delete(streamId);
        toast.success("Reminder removed");
      } else {
        next.add(streamId);
        toast.success("We'll remind you when it starts");
      }
      return next;
    });
  };

  const handleStreamClick = (streamId: string) => navigate(`/live/${streamId}`);
  const handleGoLive = () => setShowGoLive(true);

  return (
    <div className="min-h-screen bg-[#060B12] py-6 px-4 sm:py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F5F9] flex items-center gap-2">
              Live Streams
              <SignalIcon className="h-6 w-6 text-[#00C8FF]" />
            </h1>
            <p className="text-[#94A3B8] mt-1 text-sm">Watch and interact with live content</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <MagnifyingGlassIcon className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search streams, users, or sections..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#1E3447] bg-[rgba(15,25,38,0.75)] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
              />
            </div>
            <button
              onClick={handleGoLive}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-br from-[#EF4444] to-[#c62828] text-white rounded-xl font-semibold text-sm shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:opacity-90 active:scale-[0.98] transition flex-shrink-0"
            >
              <VideoCameraIcon className="h-5 w-5" />
              <span>Go Live</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={SignalIcon} value={stats.liveNow} label="Live Now" tint="bg-[#EF4444]/10 text-[#EF4444]" />
          <StatCard icon={EyeIcon} value={stats.totalWatching} label="Total Watching" tint="bg-[#3B82F6]/10 text-[#3B82F6]" />
          <StatCard icon={UserGroupIcon} value={stats.streamers} label="Streamers" tint="bg-[#8B5CF6]/10 text-[#8B5CF6]" />
          <StatCard icon={FilmIcon} value={stats.totalStreams} label="Total Streams" tint="bg-[#00C8FF]/10 text-[#00C8FF]" />
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-1.5 mb-6 overflow-x-auto themed-scrollbar pb-1 -mx-1 px-1">
          {STREAM_CATEGORY_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setCategory(opt.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition border ${
                category === opt.id
                  ? 'border-[#00C8FF]/40 bg-[#00C8FF]/10 text-[#00C8FF]'
                  : 'border-[#1E3447] text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Live Now */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-[#EF4444] animate-pulse" />
            <h2 className="text-base font-semibold text-[#F1F5F9]">Live Now</h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
          ) : filteredLive.length === 0 ? (
            <div className="rounded-2xl border border-[#1E3447] bg-[#0A111A] py-14 text-center">
              <VideoCameraIcon className="h-12 w-12 mx-auto text-[#1E3447]" />
              <h3 className="text-base font-medium text-[#F1F5F9] mt-3">
                {liveStreams.length === 0 ? 'No Live Streams' : 'No streams match your filters'}
              </h3>
              <p className="text-[#94A3B8] text-sm mt-1">
                {liveStreams.length === 0 ? 'There are no active streams right now' : 'Try a different search or category'}
              </p>
              {liveStreams.length === 0 && (
                <button
                  onClick={handleGoLive}
                  className="mt-4 px-4 py-2 bg-[#00C8FF] text-[#060B12] rounded-xl font-medium text-sm hover:bg-[#00C8FF]/80 transition"
                >
                  Start a Stream
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredLive.map((stream) => (
                <LiveStreamCard
                  key={stream.id}
                  stream={stream}
                  sectionName={getSectionName(stream)}
                  onClick={() => handleStreamClick(stream.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Streams */}
        {(isLoading || upcomingStreams.length > 0) && (
          <div>
            <h2 className="text-base font-semibold text-[#F1F5F9] mb-3">Upcoming Streams</h2>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[0, 1].map((i) => <CardSkeleton key={i} />)}
              </div>
            ) : filteredUpcoming.length === 0 ? (
              <div className="rounded-2xl border border-[#1E3447] bg-[#0A111A] py-8 text-center text-sm text-[#94A3B8]">
                No upcoming streams match your filters
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredUpcoming.map((stream) => (
                  <UpcomingStreamCard
                    key={stream.id}
                    stream={stream}
                    sectionName={getSectionName(stream)}
                    isReminderSet={reminders.has(stream.id)}
                    onToggleReminder={() => toggleReminder(stream.id)}
                  />
                ))}
              </div>
            )}
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
