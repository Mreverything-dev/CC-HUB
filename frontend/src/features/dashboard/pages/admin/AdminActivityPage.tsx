// frontend/src/features/dashboard/pages/admin/AdminActivityPage.tsx
import { ArrowPathIcon, UserPlusIcon, DocumentTextIcon, MegaphoneIcon, SignalIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { formatRelativeTime } from '@/lib/formatters';
import { useAdminUsers } from '../../hooks/useAdminUsers';
import { useAdminPosts } from '../../hooks/useAdminPosts';
import { useAdminAnnouncements } from '../../hooks/useAdminAnnouncements';
import { useAdminLivestreams } from '../../hooks/useAdminLivestreams';
import { AdminSection } from '../../components/admin/AdminSidebar';

interface AdminActivityPageProps {
  onNavigate: (section: AdminSection) => void;
}

function Panel({
  title,
  icon: Icon,
  isLoading,
  isEmpty,
  emptyLabel,
  onViewAll,
  children,
}: {
  title: string;
  icon: typeof UserPlusIcon;
  isLoading: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  onViewAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-glass p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Icon className="h-4 w-4 text-[#8B5CF6]" />
          {title}
        </h3>
        <button onClick={onViewAll} className="text-xs text-[#8B5CF6] hover:underline">
          View all
        </button>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-xl bg-border/50 animate-pulse" />)}
        </div>
      ) : isEmpty ? (
        <p className="text-xs text-text-muted text-center py-6">{emptyLabel}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}

export default function AdminActivityPage({ onNavigate }: AdminActivityPageProps) {
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useAdminUsers({ page: 1, limit: 5 });
  const { data: postsData, isLoading: postsLoading, refetch: refetchPosts } = useAdminPosts({ page: 1, limit: 5 });
  const { data: annData, isLoading: annLoading, refetch: refetchAnn } = useAdminAnnouncements({ page: 1, limit: 5 });
  const { data: liveData, isLoading: liveLoading, refetch: refetchLive } = useAdminLivestreams('stream', undefined);
  const { data: meetData, isLoading: meetLoading, refetch: refetchMeet } = useAdminLivestreams('meeting', undefined);

  const refreshAll = () => {
    refetchUsers();
    refetchPosts();
    refetchAnn();
    refetchLive();
    refetchMeet();
  };

  const liveSessions = [...(liveData?.items || []), ...(meetData?.items || [])];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">System Activity</h1>
          <p className="text-text-secondary mt-1 text-sm">What's happening across CCS HUB right now.</p>
        </div>
        <button
          onClick={refreshAll}
          title="Refresh"
          className="p-2 rounded-xl border border-border bg-glass text-text-secondary hover:text-[#8B5CF6] hover:border-[#8B5CF6]/30 transition flex-shrink-0"
        >
          <ArrowPathIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Currently Live"
          icon={SignalIcon}
          isLoading={liveLoading || meetLoading}
          isEmpty={liveSessions.length === 0}
          emptyLabel="Nothing is live right now."
          onViewAll={() => onNavigate('livestreams')}
        >
          {liveSessions.map((s) => (
            <div key={s.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-glass transition">
              <Avatar src={s.host_avatar_url} name={s.host_full_name || s.host_username} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{s.title}</p>
                <p className="text-xs text-text-muted">{s.is_meethub ? 'Meethub' : 'Livestream'} &middot; {s.host_full_name || s.host_username} &middot; {s.viewer_count} viewer{s.viewer_count === 1 ? '' : 's'}</p>
              </div>
              <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            </div>
          ))}
        </Panel>

        <Panel
          title="Recently Registered"
          icon={UserPlusIcon}
          isLoading={usersLoading}
          isEmpty={(usersData?.items.length || 0) === 0}
          emptyLabel="No users yet."
          onViewAll={() => onNavigate('users')}
        >
          {usersData?.items.map((u) => (
            <div key={u.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-glass transition">
              <Avatar src={u.avatar_url} name={u.full_name || u.username} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{u.full_name || u.username}</p>
                <p className="text-xs text-text-muted">Joined {formatRelativeTime(u.created_at)}</p>
              </div>
              <RoleBadge role={u.role} />
            </div>
          ))}
        </Panel>

        <Panel
          title="Recent Posts"
          icon={DocumentTextIcon}
          isLoading={postsLoading}
          isEmpty={(postsData?.items.length || 0) === 0}
          emptyLabel="No posts yet."
          onViewAll={() => onNavigate('posts')}
        >
          {postsData?.items.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-glass transition">
              <Avatar src={p.author_avatar_url} name={p.author_full_name || p.author_username} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-primary truncate">{p.content || '(media only)'}</p>
                <p className="text-xs text-text-muted">{p.author_full_name || p.author_username} &middot; {formatRelativeTime(p.created_at)}</p>
              </div>
            </div>
          ))}
        </Panel>

        <Panel
          title="Recent Announcements"
          icon={MegaphoneIcon}
          isLoading={annLoading}
          isEmpty={(annData?.items.length || 0) === 0}
          emptyLabel="No announcements yet."
          onViewAll={() => onNavigate('announcements')}
        >
          {annData?.items.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-glass transition">
              <Avatar src={a.author_avatar_url} name={a.author_full_name || a.author_username} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{a.title}</p>
                <p className="text-xs text-text-muted">{a.author_full_name || a.author_username} &middot; {formatRelativeTime(a.created_at)}</p>
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}