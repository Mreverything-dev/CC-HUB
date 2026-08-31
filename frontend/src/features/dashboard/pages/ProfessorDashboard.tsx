// frontend/src/features/dashboard/pages/ProfessorDashboard.tsx
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import coverPhoto from '@/assets/images/backgrounds/cover-photo.jpg';
import { CreatePost } from '@/features/posts/components/CreatePost';
import { PostCard } from '@/features/posts/components/PostCard';
import PostDetailModal from '@/features/posts/components/PostDetailModal';
import { useFeed } from '@/features/posts/hooks/useFeed';
import AnnouncementFeedBody from '@/features/announcements/components/AnnouncementFeedBody';
import { useAnnouncements } from '@/features/announcements/hooks/useAnnouncements';
import { useSections } from '@/features/sections/hooks/useSections';
import { useTeachingAssignments } from '@/features/sections/hooks/useTeachingAssignments';
import SectionDashboard from '@/features/sections/components/SectionDashboard';
import ProfessorTeachingHub from '@/features/sections/components/ProfessorTeachingHub';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
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
import { MeethubWidget } from '@/features/dashboard/components/admin/MeethubWidget';
import { useLiveStreamsFeed } from '@/features/livestream/hooks/useLiveStreamsFeed';
import FriendsPage from '@/features/friends/components/FriendsPage';
import ChatPanel from '@/features/chat/components/ChatPanel';
import { TeachingAssignment } from '@/types/section.types';

export default function ProfessorDashboard() {
  const location = useLocation();
  // Allows other pages (e.g. Profile) to deep-link back into a specific
  // dashboard section via navigate(path, { state: { section } }).
  const [activeSection, setActiveSection] = useState<SidebarSection>(
    (location.state as { section?: SidebarSection } | null)?.section || 'feed'
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  // Professors land on "My Teaching Assignments" first; the per-section
  // "Manage" button hands off to the existing SectionDashboard for that section.
  const [selectedTeachingSectionId, setSelectedTeachingSectionId] = useState<string | null>(null);
  // Global search deep-link - reuses the exact same PostDetailModal +
  // useFeed's own deletePost/editPost, no second post-detail implementation.
  const [searchOpenPostId, setSearchOpenPostId] = useState<string | null>(null);

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
    refetch: refetchAnnouncements,
  } = useAnnouncements();

  // Sections (for the right-rail widget; SectionManager handles the full Sections view itself)
  const { sections = [], isLoading: sectionsLoading } = useSections();

  // Today's Teaching Reminder - reuses the exact same data already powering
  // ProfessorTeachingHub (mine + sections' member_count), no new API call.
  const { mine: myAssignments = [] } = useTeachingAssignments();

  const { liveStreams, isLoading: liveStreamsLoading } = useLiveStreamsFeed();

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
  const mySection = sectionList[0] || null;

  const handleCreatePost = async (data: { content: string; media_urls?: string[] }) => {
    await createPost(data);
  };

  const classMetaFor = useMemo(
    () => (ta: TeachingAssignment) => {
      const section = sectionList.find((s) => s.id === ta.section_id);
      const memberCount = section?.member_count ?? 0;
      return {
        primaryMeta: ta.section_name || section?.name || 'Section',
        secondaryMeta: `${memberCount} ${memberCount === 1 ? 'Student' : 'Students'}`,
      };
    },
    [sectionList]
  );
  const todayEntries = useMemo(
    () => buildTodayClasses(myAssignments, classMetaFor),
    [myAssignments, classMetaFor]
  );
  const nextUpcomingClass = useMemo(
    () => findNextUpcomingClass(myAssignments, classMetaFor),
    [myAssignments, classMetaFor]
  );

  // Classes page - same assignments powering the reminder above, expanded
  // into one entry per scheduled day across the week (see buildWeekOccurrences).
  const classOccurrences = useMemo(
    () =>
      buildWeekOccurrences(myAssignments, (ta) => {
        const section = sectionList.find((s) => s.id === ta.section_id);
        const memberCount = section?.member_count ?? 0;
        return {
          primaryMeta: ta.section_name || section?.name || 'Section',
          secondaryMeta: `${memberCount} ${memberCount === 1 ? 'Student' : 'Students'}`,
        };
      }),
    [myAssignments, sectionList]
  );
  const classesSectionsCount = useMemo(
    () => new Set(myAssignments.map((ta) => ta.section_id)).size,
    [myAssignments]
  );
  const classesTotalHours = useMemo(
    () => Math.round(myAssignments.reduce((sum, ta) => sum + subjectDurationHours(ta), 0) * 10) / 10,
    [myAssignments]
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
          onNavigateHome={() => setActiveSection('feed')}
          onOpenFriends={() => setActiveSection('friends')}
          onOpenMenu={() => setIsMobileNavOpen(true)}
          searchPosts={postList}
          searchAnnouncements={announcementList}
          searchSections={sectionList}
          onOpenPost={setSearchOpenPostId}
          onOpenSection={(sectionId) => {
            setSelectedTeachingSectionId(sectionId);
            setActiveSection('sections');
          }}
        />

        <main className="relative flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8">
          {activeSection === 'feed' && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
              {/* Center - Feed */}
              <div className="space-y-6 min-w-0">
                {/* Today's Teaching Reminder */}
                <ClassReminderCard
                  scheduleLabel="Today's Teaching"
                  entries={todayEntries}
                  nextUpcoming={nextUpcomingClass}
                  coverPhoto={coverPhoto}
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
                      <p className="text-[#94A3B8]">No posts yet. Share something with your students!</p>
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
                <MeethubWidget />
                <EventCardList />
              </div>
            </div>
          )}

          {activeSection === 'announcements' && <AnnouncementFeedBody />}

          {activeSection === 'classes' && (
            <ClassesPage
              occurrences={classOccurrences}
              sectionsCount={classesSectionsCount}
              totalHours={classesTotalHours}
              isLoading={sectionsLoading}
              onOpenSection={(sectionId) => {
                setSelectedTeachingSectionId(sectionId);
                setActiveSection('sections');
              }}
            />
          )}

          {activeSection === 'sections' && (
            selectedTeachingSectionId ? (
              <div>
                <button
                  onClick={() => setSelectedTeachingSectionId(null)}
                  className="flex items-center gap-1.5 mb-4 text-sm font-medium text-[#94A3B8] hover:text-[#00C8FF] transition"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back to My Teaching Assignments
                </button>
                <SectionDashboard
                  key={selectedTeachingSectionId}
                  initialSectionId={selectedTeachingSectionId}
                />
              </div>
            ) : (
              <ProfessorTeachingHub onManageSection={setSelectedTeachingSectionId} />
            )
          )}

          {activeSection === 'friends' && <FriendsPage />}

          {activeSection === 'chat' && <ChatPanel fullHeight={false} />}
        </main>
      </div>

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
