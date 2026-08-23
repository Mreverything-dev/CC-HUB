// frontend/src/features/dashboard/pages/StudentDashboard.tsx
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { CreatePost } from '@/features/posts/components/CreatePost';
import { PostCard } from '@/features/posts/components/PostCard';
import { useFeed } from '@/features/posts/hooks/useFeed';
import AnnouncementFeedBody from '@/features/announcements/components/AnnouncementFeedBody';
import { useAnnouncements } from '@/features/announcements/hooks/useAnnouncements';
import { useSections } from '@/features/sections/hooks/useSections';
import SectionDashboard from '@/features/sections/components/SectionDashboard';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { profileService } from '@/services/api/profile.service';
import { Sidebar, SidebarSection } from '@/features/dashboard/components/Sidebar';
import { Topbar } from '@/features/dashboard/components/Topbar';
import { ClassReminderCard } from '@/features/dashboard/components/ClassReminderCard';
import ClassesPage from '@/features/dashboard/pages/ClassesPage';
import { buildTodayClasses, buildWeekOccurrences, findNextUpcomingClass, subjectDurationHours } from '@/features/dashboard/utils/todayClasses';
import { AnnouncementWidget } from '@/features/dashboard/components/AnnouncementWidget';
import { SectionWidget } from '@/features/dashboard/components/SectionWidget';
import { EventCardList } from '@/features/dashboard/components/EventCard';
import { LiveStreamsWidget } from '@/features/dashboard/components/admin/LiveStreamsWidget';
import { useLiveStreamsFeed } from '@/features/livestream/hooks/useLiveStreamsFeed';
import FriendsPage from '@/features/friends/components/FriendsPage';
import ChatPanel from '@/features/chat/components/ChatPanel';

function professorLabel(ta: { professor_first_name?: string | null; professor_last_name?: string | null; professor_username?: string | null }): string {
  const name = ta.professor_first_name ? `${ta.professor_first_name} ${ta.professor_last_name || ''}`.trim() : ta.professor_username;
  return name ? `Prof. ${name}` : 'Professor';
}

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const location = useLocation();
  // Allows other pages (e.g. Profile) to deep-link back into a specific
  // dashboard section via navigate(path, { state: { section } }).
  const [activeSection, setActiveSection] = useState<SidebarSection>(
    (location.state as { section?: SidebarSection } | null)?.section || 'feed'
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Posts
  const {
    posts = [],
    isLoading: postsLoading,
    isPosting,
    createPost,
    toggleLike,
    reactToPost,
    deletePost,
    editPost,
  } = useFeed();

  // Announcements
  const {
    announcements = [],
    isLoading: announcementsLoading,
  } = useAnnouncements();

  // Sections
  const {
    sections = [],
    isLoading: sectionsLoading,
    refetch: refetchSections,
  } = useSections();

  const { liveStreams, isLoading: liveStreamsLoading } = useLiveStreamsFeed();

  useEffect(() => {
    refetchSections();
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
  const mySection = sectionList[0] || null;

  const handleCreatePost = async (data: { content: string; media_urls?: string[] }) => {
    await createPost(data);
  };

  // Today's Class Reminder - derived entirely from the section's own
  // teaching_assignments (already embedded on the Section object returned
  // by useSections(), same data SectionWidget/SectionDashboard already
  // read), no new API call.
  const sectionAssignments = mySection?.teaching_assignments || [];
  const todayEntries = useMemo(
    () =>
      buildTodayClasses(sectionAssignments, (ta) => ({
        primaryMeta: professorLabel(ta),
        secondaryMeta: mySection?.name,
      })),
    [sectionAssignments, mySection?.name]
  );
  const nextUpcomingClass = useMemo(() => findNextUpcomingClass(sectionAssignments), [sectionAssignments]);

  // Classes page - same section assignments, expanded into one entry per
  // scheduled day across the week (see buildWeekOccurrences).
  const classOccurrences = useMemo(
    () =>
      buildWeekOccurrences(sectionAssignments, (ta) => ({
        primaryMeta: professorLabel(ta),
        secondaryMeta: mySection?.name,
      })),
    [sectionAssignments, mySection?.name]
  );
  const classesTotalHours = useMemo(
    () => Math.round(sectionAssignments.reduce((sum, ta) => sum + subjectDurationHours(ta), 0) * 10) / 10,
    [sectionAssignments]
  );

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

      <Sidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          avatarUrl={avatarUrl}
          onOpenFriends={() => setActiveSection('friends')}
          onOpenMenu={() => setIsMobileNavOpen(true)}
        />

        <main className="relative flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8">
          {activeSection === 'feed' && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
              {/* Center - Feed */}
              <div className="space-y-6 min-w-0">
                {/* Greeting / Today's Class Reminder */}
                <ClassReminderCard
                  greetingTitle={`Welcome back, ${user?.username || 'Student'}! 👋`}
                  greetingSubtitle="Stay informed, connected, and up to date with the College of Computer Studies."
                  scheduleLabel="Today's Schedule"
                  entries={todayEntries}
                  nextUpcoming={nextUpcomingClass}
                />

                <CreatePost onCreatePost={handleCreatePost} isLoading={isPosting} dark avatarUrl={avatarUrl} />

                <div className="space-y-4">
                  {postsLoading && postList.length === 0 ? (
                    <div className="space-y-4">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-[rgba(0,200,245,0.1)] bg-[rgba(15,28,40,0.4)] p-6 animate-pulse"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-[#1E3447]" />
                            <div className="space-y-2">
                              <div className="h-3 w-32 rounded bg-[#1E3447]" />
                              <div className="h-2 w-20 rounded bg-[#1E3447]" />
                            </div>
                          </div>
                          <div className="h-3 w-full rounded bg-[#1E3447] mb-2" />
                          <div className="h-3 w-2/3 rounded bg-[#1E3447]" />
                        </div>
                      ))}
                    </div>
                  ) : postList.length === 0 ? (
                    <div className="rounded-2xl border border-[rgba(0,200,245,0.18)] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl p-10 text-center">
                      <p className="text-[#94A3B8]">No posts yet. Check back later!</p>
                    </div>
                  ) : (
                    postList.map((post) => (
                      <PostCard
                        key={post.id}
                        {...post}
                        onLike={toggleLike}
                        onReact={reactToPost}
                        onDelete={deletePost}
                        onEdit={editPost}
                        dark
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Right sidebar */}
              <div className="space-y-6 xl:sticky xl:top-24 xl:self-start xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1 themed-scrollbar">
                <AnnouncementWidget
                  announcements={announcementList}
                  isLoading={announcementsLoading}
                  onViewAll={() => setActiveSection('announcements')}
                />
                <SectionWidget
                  section={mySection}
                  isLoading={sectionsLoading}
                  onGoToSection={() => setActiveSection('sections')}
                />
                <LiveStreamsWidget liveStreams={liveStreams} upcomingStreams={[]} isLoading={liveStreamsLoading} />
                <EventCardList />
              </div>
            </div>
          )}

          {activeSection === 'announcements' && <AnnouncementFeedBody />}

          {activeSection === 'classes' && (
            <ClassesPage
              occurrences={classOccurrences}
              sectionsCount={sectionList.length}
              totalHours={classesTotalHours}
              isLoading={sectionsLoading}
            />
          )}

          {activeSection === 'sections' && (
            <SectionDashboard
            />
          )}

          {activeSection === 'friends' && <FriendsPage />}

          {activeSection === 'chat' && <ChatPanel fullHeight={false} />}
        </main>
      </div>
    </div>
  );
}
