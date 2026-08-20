// frontend/src/features/announcements/components/AnnouncementCategorySidebar.tsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Squares2X2Icon,
  MegaphoneIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  AcademicCapIcon,
  FireIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';
import { Announcement } from '@/types/announcement.types';
import { formatDate } from '@/lib/formatters';
import { Avatar } from '@/features/dashboard/components/Avatar';
import toast from 'react-hot-toast';

// A superset of the sidebar's own 5 quick-filter buttons: 'emergency' has no
// dedicated sidebar button (the sidebar's "Important" maps to priority, not
// type) but is still selectable via the shared top AnnouncementFilterBar
// dropdown, so the state type has to cover it too.
export type AnnouncementSidebarFilter = 'all' | 'general' | 'important' | 'event' | 'academic' | 'emergency';

interface AnnouncementCategorySidebarProps {
  announcements: Announcement[];
  filter: AnnouncementSidebarFilter;
  onFilterChange: (filter: AnnouncementSidebarFilter) => void;
}

const CATEGORIES: { value: AnnouncementSidebarFilter; label: string; icon: typeof Squares2X2Icon }[] = [
  { value: 'all', label: 'All Announcements', icon: Squares2X2Icon },
  { value: 'general', label: 'General', icon: MegaphoneIcon },
  { value: 'important', label: 'Important', icon: ExclamationTriangleIcon },
  { value: 'event', label: 'Events', icon: CalendarDaysIcon },
  { value: 'academic', label: 'Academic', icon: AcademicCapIcon },
];

function countFor(announcements: Announcement[], value: AnnouncementSidebarFilter): number {
  if (value === 'all') return announcements.length;
  if (value === 'important') return announcements.filter((a) => a.priority === 'urgent').length;
  return announcements.filter((a) => a.type === value).length;
}

export function AnnouncementCategorySidebar({
  announcements,
  filter,
  onFilterChange,
}: AnnouncementCategorySidebarProps) {
  const navigate = useNavigate();

  // "Popular" is derived from real reaction counts already on each
  // announcement - not a fabricated metric - falling back to recency when
  // nothing has reactions yet.
  const popular = useMemo(() => {
    return [...announcements]
      .sort((a, b) => {
        const diff = (b.reactions?.length || 0) - (a.reactions?.length || 0);
        if (diff !== 0) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 4);
  }, [announcements]);

  return (
    <div className="space-y-4">
      {/* Categories */}
      <div className="rounded-2xl border border-[rgba(0,200,245,0.18)] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl p-4">
        <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">Categories</h3>
        <div className="space-y-1">
          {CATEGORIES.map(({ value, label, icon: Icon }) => {
            const isActive = filter === value;
            const count = countFor(announcements, value);
            return (
              <button
                key={value}
                onClick={() => onFilterChange(value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-[#00C8FF]/15 text-[#00C8FF]'
                    : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-[#00C8FF]' : ''}`} />
                <span className="flex-1 text-left truncate">{label}</span>
                <span
                  className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center flex-shrink-0 ${
                    isActive ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-white/5 text-[#64748B]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Popular Announcements */}
      <div className="rounded-2xl border border-[rgba(0,200,245,0.18)] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F1F5F9] mb-3">
          <FireIcon className="h-4 w-4 text-[#00C8FF]" />
          Popular Announcements
        </h3>
        {popular.length === 0 ? (
          <p className="text-xs text-[#64748B] py-4 text-center">No announcements yet.</p>
        ) : (
          <div className="space-y-1">
            {popular.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/announcements/${a.id}`)}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition text-left"
              >
                <Avatar
                  src={a.created_by_avatar}
                  name={a.created_by_username || undefined}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#F1F5F9] truncate">{a.title}</p>
                  <p className="text-xs text-[#64748B] mt-0.5">{formatDate(a.created_at)}</p>
                </div>
                {a.image_url && (
                  <img
                    src={a.image_url}
                    alt=""
                    className="h-9 w-9 rounded-lg object-cover flex-shrink-0 border border-[#1E3447]"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stay Updated */}
      <div className="rounded-2xl border border-[#00C8FF]/20 bg-[rgba(15,28,40,0.75)] backdrop-blur-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-xl bg-[#00C8FF]/10 border border-[#00C8FF]/25 flex items-center justify-center flex-shrink-0">
            <BellAlertIcon className="h-4 w-4 text-[#00C8FF]" />
          </div>
          <h3 className="text-sm font-semibold text-[#F1F5F9]">Stay Updated</h3>
        </div>
        <p className="text-xs text-[#94A3B8] mb-3">
          Turn on notifications so you never miss an important announcement.
        </p>
        <button
          onClick={() => toast('Announcement notifications are coming soon')}
          className="w-full py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition"
        >
          Turn On Notifications
        </button>
      </div>
    </div>
  );
}
