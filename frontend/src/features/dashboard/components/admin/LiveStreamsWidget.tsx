// frontend/src/features/dashboard/components/admin/LiveStreamsWidget.tsx
import { useNavigate } from 'react-router-dom';
import { EyeIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import { Livestream } from '@/types/livestream.types';

interface LiveStreamsWidgetProps {
  liveStreams: Livestream[];
  upcomingStreams: Livestream[];
  isLoading?: boolean;
}

export function LiveStreamsWidget({ liveStreams, upcomingStreams, isLoading }: LiveStreamsWidgetProps) {
  const navigate = useNavigate();
  const combined = [...liveStreams, ...upcomingStreams.slice(0, Math.max(0, 3 - liveStreams.length))];

  return (
    <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] backdrop-blur-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F1F5F9]">
          <VideoCameraIcon className="h-4 w-4 text-[#00C8FF]" />
          Live Streams
        </h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-[#0A111A] animate-pulse" />
          ))}
        </div>
      ) : combined.length === 0 ? (
        <p className="text-sm text-[#64748B] py-6 text-center">No live or scheduled streams</p>
      ) : (
        <div className="space-y-2">
          {combined.map((s) => (
            <button
              key={s.id}
              onClick={() => (s.status === 'live' ? navigate(`/live/${s.id}`) : navigate('/livestreams'))}
              className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border border-[#1E3447] hover:border-[#00C8FF]/30 hover:bg-white/5 transition"
            >
              <div
                className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${
                  s.status === 'live'
                    ? 'bg-[#EF4444]/15 text-[#EF4444]'
                    : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                }`}
              >
                {s.status === 'live' ? 'Live' : 'Scheduled'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#F1F5F9] font-medium truncate">{s.title}</p>
                <p className="text-xs text-[#64748B] truncate">Prof. {s.host_username}</p>
              </div>
              {s.status === 'live' && (
                <span className="flex items-center gap-1 text-xs text-[#94A3B8] flex-shrink-0">
                  <EyeIcon className="h-3.5 w-3.5" />
                  {s.viewer_count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate('/livestreams')}
        className="w-full mt-3 pt-3 border-t border-[#1E3447] text-sm font-medium text-[#00C8FF] hover:text-[#00E0FF] transition"
      >
        View all
      </button>
    </div>
  );
}
