// frontend/src/features/dashboard/pages/AdminDashboard.tsx
import { useState, useEffect, useMemo } from 'react';
import {
  UsersIcon,
  AcademicCapIcon,
  UserGroupIcon,
  DocumentTextIcon,
  FlagIcon,
  SignalIcon,
  CalendarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { CreateAnnouncement } from '@/features/announcements/components/CreateAnnouncement';
import { useAnnouncements } from '@/features/announcements/hooks/useAnnouncements';
import { useSections } from '@/features/sections/hooks/useSections';
import CreateSectionModal from '@/features/sections/components/CreateSectionModal';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { profileService } from '@/services/api/profile.service';
import { useFeed } from '@/features/posts/hooks/useFeed';
import PostDetailModal from '@/features/posts/components/PostDetailModal';
import { useLiveStreamsFeed } from '@/features/livestream/hooks/useLiveStreamsFeed';
import { Topbar } from '@/features/dashboard/components/Topbar';
import { useAdminStats } from '../hooks/useAdminStats';
import { useAdminReports } from '../hooks/useAdminReports';
import UserManagementPage from './admin/UserManagementPage';
import AdminPostsPage from './admin/AdminPostsPage';
import AdminAnnouncementsPage from './admin/AdminAnnouncementsPage';
import AdminSectionsPage from './admin/AdminSectionsPage';
import AdminLivestreamsPage from './admin/AdminLivestreamsPage';
import AdminMeethubPage from './admin/AdminMeethubPage';
import AdminReportsPage from './admin/AdminReportsPage';
import AdminActivityPage from './admin/AdminActivityPage';
import AdminSettingsPage from './admin/AdminSettingsPage';
import { AdminSidebar, AdminSection } from '../components/admin/AdminSidebar';
import { StatCard } from '../components/admin/StatCard';
import { UserGrowthChart } from '../components/admin/UserGrowthChart';
import { RecentActivityWidget } from '../components/admin/RecentActivityWidget';
import { SectionsOverviewWidget } from '../components/admin/SectionsOverviewWidget';
import { EngagementOverviewWidget } from '../components/admin/EngagementOverviewWidget';
import { LiveStreamsWidget } from '../components/admin/LiveStreamsWidget';
import { QuickActionsWidget } from '../components/admin/QuickActionsWidget';

function getCurrentWeekRangeLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

export default function AdminDashboard() {
  const { user } = useAuthStore();
  // Admin's own nav model (AdminSection), deliberately separate from the
  // Student/Professor SidebarSection type - this is a genuinely different
  // set of surfaces, not the same tabs reused.
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(false);
  // Global search deep-links - reuse the exact same PostDetailModal the
  // rest of the app already uses.
  const [searchOpenPostId, setSearchOpenPostId] = useState<string | null>(null);
  const { liveStreams, upcomingStreams, isLoading: streamsLoading } = useLiveStreamsFeed(true);

  // Admin dashboard stats (real counts from the DB via /admin/dashboard-stats)
  const { stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats, isFetching: statsRefetching } =
    useAdminStats();

  // Recent posts, for the Overview's Recent Activity widget and a post
  // opened via global search - deletePost/editPost are only used for that
  // search-opened post.
  const { posts = [], isLoading: postsLoading, deletePost, editPost } = useFeed();

  // Announcements (Overview widget + global search)
  const {
    announcements = [],
    isLoading: announcementsLoading,
    refetch: refetchAnnouncements,
  } = useAnnouncements();

  // Sections (Overview widget, global search, and the admin-wide list
  // AdminSectionsPage renders - see section_service.get_sections, which
  // already returns every section for an admin caller)
  const { sections = [], isLoading: sectionsLoading } = useSections();

  const { data: reportsData } = useAdminReports({ page: 1, limit: 1 });

  useEffect(() => {
    refetchAnnouncements();
  }, []);

  useEffect(() => {
    profileService
      .getMyProfile()
      .then((res) => setAvatarUrl((res.data.profile as any)?.avatar_url || null))
      .catch(() => setAvatarUrl(null));
  }, []);

  const postList = Array.isArray(posts) ? posts : [];
  const announcementList = Array.isArray(announcements) ? announcements : [];
  const sectionList = Array.isArray(sections) ? sections : [];
  const weekRangeLabel = useMemo(getCurrentWeekRangeLabel, []);

  return (
    <div className="min-h-screen bg-[#07050F] text-[#F1F5F9] flex">
      {/* Subtle grid background - violet-tinted, distinct from the cyan
          grid every Student/Professor page uses. */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(139,92,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.06) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <AdminSidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        reportsCount={reportsData?.total}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          avatarUrl={avatarUrl}
          onNavigateHome={() => setActiveSection('overview')}
          onOpenMenu={() => setIsMobileNavOpen(true)}
          searchPosts={postList}
          searchAnnouncements={announcementList}
          searchSections={sectionList}
          onOpenPost={setSearchOpenPostId}
          onOpenSection={() => setActiveSection('sections')}
        />

        <main className="relative flex-1 max-w-7xl w-full mx-auto px-4 py-6 lg:px-8">
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold text-[#F1F5F9]">
                    System Overview
                  </h1>
                  <p className="text-sm text-[#94A3B8] mt-1">
                    Monitoring CCS HUB as <span className="text-[#8B5CF6] font-medium">{user?.username || 'Admin'}</span>.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    title="Custom date range filtering is coming soon"
                    onClick={() => {}}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-sm text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#8B5CF6]/30 transition"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {weekRangeLabel}
                  </button>
                  <button
                    onClick={() => refetchStats()}
                    disabled={statsRefetching}
                    title="Refresh dashboard"
                    className="p-2 rounded-xl border border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-[#94A3B8] hover:text-[#8B5CF6] hover:border-[#8B5CF6]/30 transition disabled:opacity-50"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${statsRefetching ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Statistics cards */}
              {statsError ? (
                <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] p-8 text-center">
                  <p className="text-sm text-[#94A3B8]">Unable to load dashboard data</p>
                  <button
                    onClick={() => refetchStats()}
                    className="mt-3 flex items-center gap-1.5 mx-auto px-3.5 py-1.5 text-sm font-medium text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-lg transition"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    Retry
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                  <StatCard
                    icon={UsersIcon}
                    label="Total Users"
                    value={stats?.total_users.value}
                    trendPercent={stats?.total_users.trend_percent}
                    isLoading={statsLoading}
                    accent="#00C8FF"
                    onClick={() => setActiveSection('users')}
                  />
                  <StatCard
                    icon={AcademicCapIcon}
                    label="Students"
                    value={stats?.students.value}
                    trendPercent={stats?.students.trend_percent}
                    isLoading={statsLoading}
                    accent="#1685FF"
                  />
                  <StatCard
                    icon={UserGroupIcon}
                    label="Professors"
                    value={stats?.professors.value}
                    trendPercent={stats?.professors.trend_percent}
                    isLoading={statsLoading}
                    accent="#8B5CF6"
                  />
                  <StatCard
                    icon={SignalIcon}
                    label="Online"
                    value={stats?.online_users_now}
                    isLoading={statsLoading}
                    accent="#22C55E"
                    onClick={() => setActiveSection('users')}
                  />
                  <StatCard
                    icon={DocumentTextIcon}
                    label="Posts"
                    value={stats?.posts.value}
                    trendPercent={stats?.posts.trend_percent}
                    isLoading={statsLoading}
                    accent="#F59E0B"
                    onClick={() => setActiveSection('posts')}
                  />
                  <StatCard
                    icon={FlagIcon}
                    label="Reports"
                    value={stats?.reports.value}
                    trendPercent={stats?.reports.trend_percent}
                    isLoading={statsLoading}
                    accent="#EF4444"
                    onClick={() => setActiveSection('reports')}
                  />
                </div>
              )}

              {/* Chart + Recent Activity */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2">
                  <UserGrowthChart />
                </div>
                <RecentActivityWidget
                  posts={postList}
                  announcements={announcementList}
                  liveStreams={liveStreams}
                  upcomingStreams={upcomingStreams}
                  isLoading={postsLoading || announcementsLoading || streamsLoading}
                />
              </div>

              {/* Sections + Engagement + Live Streams */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <SectionsOverviewWidget
                  sections={sectionList}
                  isLoading={sectionsLoading}
                  onViewAll={() => setActiveSection('sections')}
                />
                <EngagementOverviewWidget stats={stats} isLoading={statsLoading} isError={statsError} onRetry={refetchStats} />
                <LiveStreamsWidget liveStreams={liveStreams} upcomingStreams={upcomingStreams} isLoading={streamsLoading} />
              </div>

              {/* Quick Actions */}
              <QuickActionsWidget
                onCreateAnnouncement={() => setShowCreateAnnouncement(true)}
                onCreateSection={() => setShowCreateSection(true)}
              />
            </div>
          )}

          {activeSection === 'users' && <UserManagementPage />}
          {activeSection === 'sections' && <AdminSectionsPage />}
          {activeSection === 'posts' && <AdminPostsPage />}
          {activeSection === 'announcements' && <AdminAnnouncementsPage />}
          {activeSection === 'livestreams' && <AdminLivestreamsPage />}
          {activeSection === 'meethub' && <AdminMeethubPage />}
          {activeSection === 'reports' && <AdminReportsPage />}
          {activeSection === 'activity' && <AdminActivityPage onNavigate={setActiveSection} />}
          {activeSection === 'settings' && <AdminSettingsPage onNavigate={setActiveSection} />}
        </main>
      </div>

      {/* Create Announcement Modal */}
      {showCreateAnnouncement && (
        <CreateAnnouncement onClose={() => setShowCreateAnnouncement(false)} />
      )}

      {/* Create Section Modal */}
      {showCreateSection && (
        <CreateSectionModal onClose={() => setShowCreateSection(false)} />
      )}

      {searchOpenPostId && (
        <PostDetailModal
          postId={searchOpenPostId}
          onClose={() => setSearchOpenPostId(null)}
          onDelete={deletePost}
          onEdit={editPost}
        />
      )}
    </div>
  );
}
