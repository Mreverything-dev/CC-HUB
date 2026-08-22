// frontend/src/features/dashboard/pages/AdminDashboard.tsx
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
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
import AnnouncementFeedBody from '@/features/announcements/components/AnnouncementFeedBody';
import { CreateAnnouncement } from '@/features/announcements/components/CreateAnnouncement';
import { useAnnouncements } from '@/features/announcements/hooks/useAnnouncements';
import { useSections } from '@/features/sections/hooks/useSections';
import SectionDashboard from '@/features/sections/components/SectionDashboard';
import CreateSectionModal from '@/features/sections/components/CreateSectionModal';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { profileService } from '@/services/api/profile.service';
import { useFeed } from '@/features/posts/hooks/useFeed';
import { useLiveStreamsFeed } from '@/features/livestream/hooks/useLiveStreamsFeed';
import { Sidebar, SidebarSection } from '@/features/dashboard/components/Sidebar';
import { Topbar } from '@/features/dashboard/components/Topbar';
import FriendsPage from '@/features/friends/components/FriendsPage';
import ChatPanel from '@/features/chat/components/ChatPanel';
import { useAdminStats } from '../hooks/useAdminStats';
import UserManagementPage from './admin/UserManagementPage';
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
  const location = useLocation();
  // Allows other pages (e.g. Profile) to deep-link back into a specific
  // dashboard section via navigate(path, { state: { section } }).
  const [activeSection, setActiveSection] = useState<SidebarSection>(
    (location.state as { section?: SidebarSection } | null)?.section || 'feed'
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const { liveStreams, upcomingStreams, isLoading: streamsLoading } = useLiveStreamsFeed(true);

  // Admin dashboard stats (real counts from the DB via /admin/dashboard-stats)
  const { stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats, isFetching: statsRefetching } =
    useAdminStats();

  // Recent posts, for the Recent Activity feed only - the admin dashboard no
  // longer shows a post composer/feed (that stays on Student/Professor).
  const { posts = [], isLoading: postsLoading } = useFeed();

  // Announcements
  const {
    announcements = [],
    isLoading: announcementsLoading,
    refetch: refetchAnnouncements,
  } = useAnnouncements();

  // Sections
  const { sections = [], isLoading: sectionsLoading } = useSections();

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
    <div className="min-h-screen bg-[#07111A] text-[#F1F5F9] flex">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <Sidebar activeSection={activeSection} onNavigate={setActiveSection} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar avatarUrl={avatarUrl} onOpenFriends={() => setActiveSection('friends')} />

        <main className="relative flex-1 max-w-7xl w-full mx-auto px-4 py-6 lg:px-8">
          {activeSection === 'feed' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold text-[#F1F5F9]">
                    Welcome back, <span className="text-[#00C8FF]">{user?.username || 'Admin'}</span> 👋
                  </h1>
                  <p className="text-sm text-[#94A3B8] mt-1">
                    Here's what's happening in the College of Computer Studies.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    title="Custom date range filtering is coming soon"
                    onClick={() => {}}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-sm text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#00C8FF]/30 transition"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {weekRangeLabel}
                  </button>
                  <button
                    onClick={() => refetchStats()}
                    disabled={statsRefetching}
                    title="Refresh dashboard"
                    className="p-2 rounded-xl border border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-[#94A3B8] hover:text-[#00C8FF] hover:border-[#00C8FF]/30 transition disabled:opacity-50"
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
                    label="Active Now"
                    value={null}
                    unavailableReason="Presence tracking not available"
                    isLoading={statsLoading}
                    accent="#22C55E"
                  />
                  <StatCard
                    icon={DocumentTextIcon}
                    label="Posts"
                    value={stats?.posts.value}
                    trendPercent={stats?.posts.trend_percent}
                    isLoading={statsLoading}
                    accent="#F59E0B"
                    onClick={() => setActiveSection('feed')}
                  />
                  <StatCard
                    icon={FlagIcon}
                    label="Reports"
                    value={stats?.reports.value}
                    trendPercent={stats?.reports.trend_percent}
                    isLoading={statsLoading}
                    accent="#EF4444"
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

          {activeSection === 'announcements' && <AnnouncementFeedBody />}

          {activeSection === 'sections' && (
            <SectionDashboard
            />
          )}

          {activeSection === 'friends' && <FriendsPage />}

          {activeSection === 'chat' && <ChatPanel fullHeight={false} />}
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
    </div>
  );
}
