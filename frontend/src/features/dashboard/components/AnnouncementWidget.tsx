// frontend/src/features/dashboard/components/AnnouncementWidget.tsx
import { formatRelativeTime } from '@/lib/formatters';
import { MegaphoneIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { Announcement } from '@/types/announcement.types';
import { Avatar } from './Avatar';

interface AnnouncementWidgetProps {
  announcements: Announcement[];
  isLoading: boolean;
  onViewAll: () => void;
}

export function AnnouncementWidget({ announcements, isLoading, onViewAll }: AnnouncementWidgetProps) {
  const latest = announcements.slice(0, 4);

  return (
    <div className="rounded-2xl bg-glass backdrop-blur-xl p-4 sm:p-5 shadow-md shadow-black/5 transition hover:shadow-lg hover:shadow-black/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <MegaphoneIcon className="h-4 w-4 text-[#00C8FF]" />
          Latest News
        </h3>
        <button onClick={onViewAll} className="text-xs text-[#00C8FF] hover:text-[#00E0FF] hover:underline">
          View all
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-text-muted py-4 text-center">Loading...</p>
      ) : latest.length === 0 ? (
        <div className="text-center py-6">
          <DocumentTextIcon className="h-6 w-6 text-border mx-auto mb-2" />
          <p className="text-xs text-text-muted">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {latest.map((a) => (
            <button
              key={a.id}
              onClick={onViewAll}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-glass transition text-left"
            >
              <Avatar src={a.created_by_avatar} name={a.created_by_username || undefined} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{a.title}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {formatRelativeTime(a.created_at)} • {a.created_by_role}
                </p>
              </div>
              {a.image_url && (
                <img
                  src={a.image_url}
                  alt=""
                  className="h-9 w-9 rounded-lg object-cover flex-shrink-0 border border-border"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
