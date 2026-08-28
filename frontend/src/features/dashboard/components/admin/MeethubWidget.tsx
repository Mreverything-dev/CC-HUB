// frontend/src/features/dashboard/components/admin/MeethubWidget.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AcademicCapIcon, EyeIcon } from '@heroicons/react/24/outline';
import { meethubService } from '@/services/api/meethub.service';
import { MeethubSession } from '@/types/meethub.types';
import { socketService } from '@/lib/socket';
import { useChatStore } from '@/features/chat/store/chat.store';

/**
 * Dashboard widget for live Meethub meetings - kept completely separate from
 * LiveStreamsWidget/useLiveStreamsFeed (a Meethub session is deliberately
 * excluded from that feed - see backend LivestreamService.get_streams'
 * include_meethub flag) so a meeting never gets mixed into the Livestream
 * card list, matching the same visual shape only for consistency.
 */
export function MeethubWidget() {
  const navigate = useNavigate();
  const isSocketConnected = useChatStore((s) => s.isConnected);
  const [sessions, setSessions] = useState<MeethubSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    meethubService
      .getMySessions('live')
      .then((res) => {
        if (!cancelled) setSessions(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSocketConnected) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleEnded = (data: { stream_id: string }) => {
      setSessions((prev) => prev.filter((s) => s.livestream_id !== data.stream_id));
    };
    socket.on('stream:ended', handleEnded);
    return () => {
      socket.off('stream:ended', handleEnded);
    };
  }, [isSocketConnected]);

  return (
    <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] backdrop-blur-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F1F5F9]">
          <AcademicCapIcon className="h-4 w-4 text-[#00C8FF]" />
          Meethub
        </h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-[#0A111A] animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-[#64748B] py-6 text-center">No Meethub meetings live</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/meethub/${s.id}`)}
              className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border border-[#1E3447] hover:border-[#00C8FF]/30 hover:bg-white/5 transition"
            >
              <div className="relative flex-shrink-0 h-9 w-14 rounded-lg overflow-hidden bg-[#0A111A] border border-[#1E3447]">
                {s.thumbnail_url ? (
                  <img src={s.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <AcademicCapIcon className="h-4 w-4 text-[#1E3447]" />
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-[#00C8FF]/15 text-[#00C8FF]">
                Meethub
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#F1F5F9] font-medium truncate">{s.title}</p>
                <p className="text-xs text-[#64748B] truncate">{s.organizer_username}</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-[#94A3B8] flex-shrink-0">
                <EyeIcon className="h-3.5 w-3.5" />
                {s.viewer_count}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate('/meethub')}
        className="w-full mt-3 pt-3 border-t border-[#1E3447] text-sm font-medium text-[#00C8FF] hover:text-[#00E0FF] transition"
      >
        View all
      </button>
    </div>
  );
}
