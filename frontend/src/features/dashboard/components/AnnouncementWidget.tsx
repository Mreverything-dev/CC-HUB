// frontend/src/features/dashboard/components/AnnouncementWidget.tsx
import { formatRelativeTime } from '@/lib/formatters';
import { MegaphoneIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { Announcement } from '@/types/announcement.types';

const TYPE_ICON: Record<string, string> = {
  general: '📢',
  academic: '📅',
  event: '🎤',
  emergency: '🚨',
};

interface AnnouncementWidgetProps {
  announcements: Announcement[];
  isLoading: boolean;
  onViewAll: () => void;
}

export function AnnouncementWidget({ announcements, isLoading, onViewAll }: AnnouncementWidgetProps) {
  const latest = announcements.slice(0, 4);

  return (
    <div className="rounded-2xl border border-[rgba(0,200,245,0.18)] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl p-4 sm:p-5 transition hover:border-[#00C8FF]/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F1F5F9]">
          <MegaphoneIcon className="h-4 w-4 text-[#00C8FF]" />
          Announcements
        </h3>
        <button onClick={onViewAll} className="text-xs text-[#00C8FF] hover:text-[#00E0FF] hover:underline">
          View all
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-[#64748B] py-4 text-center">Loading...</p>
      ) : latest.length === 0 ? (
        <div className="text-center py-6">
          <DocumentTextIcon className="h-6 w-6 text-[#1E3447] mx-auto mb-2" />
          <p className="text-xs text-[#64748B]">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {latest.map((a) => (
            <button
              key={a.id}
              onClick={onViewAll}
              className="w-full flex items-start gap-2.5 text-left px-2 py-2 rounded-xl hover:bg-white/5 transition"
            >
              <span className="text-base leading-none mt-0.5">{TYPE_ICON[a.type] || '📢'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#F1F5F9] font-medium truncate">{a.title}</p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {formatRelativeTime(a.created_at)} • {a.created_by_role}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
