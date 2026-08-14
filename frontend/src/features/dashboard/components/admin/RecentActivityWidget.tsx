// frontend/src/features/dashboard/components/admin/RecentActivityWidget.tsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DocumentTextIcon,
  MegaphoneIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { formatRelativeTime } from '@/lib/formatters';
import { Post } from '@/services/api/post.service';
import { Announcement } from '@/types/announcement.types';
import { Livestream } from '@/types/livestream.types';

interface ActivityItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  subtitle: string;
  timestamp: string;
  onClick?: () => void;
}

interface RecentActivityWidgetProps {
  posts: Post[];
  announcements: Announcement[];
  liveStreams: Livestream[];
  upcomingStreams: Livestream[];
  isLoading?: boolean;
}

/**
 * Built entirely from real, already-fetched data (recent posts, announcements,
 * live/scheduled streams) merged and sorted by timestamp - there's no backend
 * activity/audit log, so event types with no accessible source (new user
 * registrations, report submissions) are intentionally left out rather than
 * invented.
 */
export function RecentActivityWidget({
  posts,
  announcements,
  liveStreams,
  upcomingStreams,
  isLoading,
}: RecentActivityWidgetProps) {
  const navigate = useNavigate();

  const items = useMemo<ActivityItem[]>(() => {
    const postItems: ActivityItem[] = posts.slice(0, 5).map((p) => ({
      id: `post-${p.id}`,
      icon: DocumentTextIcon,
      color: '#8B5CF6',
      title: `New post by ${p.username}`,
      subtitle: p.content?.slice(0, 60) || 'Shared media',
      timestamp: p.created_at,
      onClick: () => navigate(`/profile/${p.user_id}`),
    }));

    const announcementItems: ActivityItem[] = announcements.slice(0, 5).map((a) => ({
      id: `ann-${a.id}`,
      icon: MegaphoneIcon,
      color: '#00C8FF',
      title: 'Announcement published',
      subtitle: a.title,
      timestamp: a.created_at,
      onClick: () => navigate(`/announcements/${a.id}`),
    }));

    const liveItems: ActivityItem[] = liveStreams.map((s) => ({
      id: `live-${s.id}`,
      icon: VideoCameraIcon,
      color: '#EF4444',
      title: 'Live stream started',
      subtitle: `${s.title} • ${s.host_username}`,
      timestamp: s.started_at || s.created_at,
      onClick: () => navigate(`/live/${s.id}`),
    }));

    const scheduledItems: ActivityItem[] = upcomingStreams.slice(0, 3).map((s) => ({
      id: `sched-${s.id}`,
      icon: VideoCameraIcon,
      color: '#F59E0B',
      title: 'Live stream scheduled',
      subtitle: `${s.title} • ${s.host_username}`,
      timestamp: s.created_at,
      onClick: () => navigate('/livestreams'),
    }));

    return [...postItems, ...announcementItems, ...liveItems, ...scheduledItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [posts, announcements, liveStreams, upcomingStreams, navigate]);

  return (
    <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] backdrop-blur-xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">Recent Activity</h3>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-9 w-9 rounded-full bg-[#1E3447] flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-32 rounded bg-[#1E3447]" />
                <div className="h-2 w-20 rounded bg-[#1E3447]" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#64748B] py-6 text-center">No recent activity</p>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto themed-scrollbar pr-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              disabled={!item.onClick}
              className="w-full flex items-start gap-3 text-left px-1.5 py-2 rounded-xl hover:bg-white/5 transition disabled:cursor-default"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0"
                style={{ backgroundColor: `${item.color}1A`, color: item.color }}
              >
                <item.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#F1F5F9] font-medium truncate">{item.title}</p>
                <p className="text-xs text-[#64748B] truncate">{item.subtitle}</p>
              </div>
              <span className="text-[11px] text-[#64748B] flex-shrink-0 mt-0.5">
                {formatRelativeTime(item.timestamp)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
