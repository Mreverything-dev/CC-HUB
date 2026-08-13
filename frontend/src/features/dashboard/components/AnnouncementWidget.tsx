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
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <MegaphoneIcon className="h-4 w-4 text-[#00d4ff]" />
          Announcements
        </h3>
        <button onClick={onViewAll} className="text-xs text-[#00d4ff] hover:underline">
          View all
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-[#6b6b6b] py-4 text-center">Loading...</p>
      ) : latest.length === 0 ? (
        <div className="text-center py-6">
          <DocumentTextIcon className="h-6 w-6 text-[#3a3a3a] mx-auto mb-2" />
          <p className="text-xs text-[#6b6b6b]">No announcements yet.</p>
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
                <p className="text-sm text-white font-medium truncate">{a.title}</p>
                <p className="text-xs text-[#6b6b6b] mt-0.5">
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
