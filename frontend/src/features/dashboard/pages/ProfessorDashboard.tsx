// frontend/src/features/dashboard/pages/ProfessorDashboard.tsx
import { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
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
import { useMinimumLoading } from '@/features/dashboard/hooks/useMinimumLoading';
import { useFriendStore } from '@/features/friends/store/friend.store';
import { FeedTabs, FeedFilter } from '@/features/dashboard/components/FeedTabs';

const VIDEO_EXT_RE = /\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i;

export default function ProfessorDashboard() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial section from URL first, then location.state, then default
  const initialSection = useMemo<SidebarSection>(() => {
    const fromUrl = searchParams.get('section') as SidebarSection | null;
    const fromState = (location.state as { section?: SidebarSection } | null)?.section;
    return fromUrl || fromState || 'feed';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [activeSection, setActiveSection] = useState<SidebarSection>(initialSection);

  // Read initial feed filter from URL
  const initialFilter = useMemo<FeedFilter>(() => {
    const fromUrl = searchParams.get('filter') as FeedFilter | null;
    const valid: FeedFilter[] = ['all', 'friends', 'videos'];
    return fromUrl && valid.includes(fromUrl) ? fromUrl : 'all';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [feedFilter, setFeedFilter] = useState<FeedFilter>(initialFilter);

  // Wrapper that updates both state AND the URL query param (section)
  const handleSectionChange = (section: SidebarSection) => {
    setActiveSection(section);
    const next = new URLSearchParams(searchParams);
    next.set('section', section);
    setSearchParams(next, { replace: true });
  };

  // Wrapper that updates both state AND the URL query param (filter)
  const handleFilterChange = (filter: FeedFilter) => {
    setFeedFilter(filter);
    const next = new URLSearchParams(searchParams);
    if (filter === 'all') {
      next.delete('filter');
    } else {
      next.set('filter', filter);
    }
    setSearchParams(next, { replace: true });
  };

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [selectedTeachingSectionId, setSelectedTeachingSectionId] = useState<string | null>(null);
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

  // Sections
  const { sections = [], isLoading: sectionsLoading } = useSections();

  // Today's Teaching Reminder
  const { mine: myAssignments = [] } = useTeachingAssignments();

  const { liveStreams, isLoading: liveStreamsLoading } = useLiveStreamsFeed();

  // Friends list (from global store)
  const friends = useFriendStore((s) => s.friends);
  const friendIds = useMemo(() => new Set(friends.map((f) => f.user_id)), [friends]);

  // Minimum loading hooks
  const showPostsSkeleton = useMinimumLoading(postsLoading, 5000);
  const showAnnouncementsSkeleton = useMinimumLoading(announcementsLoading, 3000);
  const showSectionsSkeleton = useMinimumLoading(sectionsLoading, 3000);
  const showLiveStreamsSkeleton = useMinimumLoading(liveStreamsLoading, 3000);

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

  // Apply client-side filter to posts
  const filteredPosts = useMemo(() => {
    if (feedFilter === 'all') return postList;

    if (feedFilter === 'friends') {
      return postList.filter((p) => friendIds.has(p.user_id));
    }

    if (feedFilter === 'videos') {
      return postList.filter((p) =>
        Array.isArray(p.media_urls) && p.media_urls.some((url) => VIDEO_EXT_RE.test(url))
      );
    }

    return postList;
  }, [postList, feedFilter, friendIds]);

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
    <div className="min-h-screen bg-bg text-text-primary flex overflow-hidden">
      <Sidebar
        activeSection={activeSection}
        onNavigate={handleSectionChange}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto h-screen">
        <Topbar
          avatarUrl={avatarUrl}
          onNavigateHome={() => handleSectionChange('feed')}
          onOpenFriends={() => handleSectionChange('friends')}
          onOpenMenu={() => setIsMobileNavOpen(true)}
          searchPosts={postList}
          searchAnnouncements={announcementList}
          searchSections={sectionList}
          onOpenPost={setSearchOpenPostId}
          onOpenSection={(sectionId) => {
            setSelectedTeachingSectionId(sectionId);
            handleSectionChange('sections');
          }}
        />

        <main className="relative flex-1 w-full py-6 pl-4 sm:pl-6 lg:pl-8 pr-2">
          {activeSection === 'feed' && (
            <div className="flex flex-col xl:flex-row gap-6 items-start w-full">
              {/* Center - Feed */}
              <div className="w-full xl:flex-1 min-w-0">
                <div className="max-w-lg mx-auto space-y-5">
                  <ClassReminderCard
                    scheduleLabel="Today's Teaching"
                    entries={todayEntries}
                    nextUpcoming={nextUpcomingClass}
                    coverPhoto={coverPhoto}
                  />

                  {/* Feed filter tabs */}
                  <FeedTabs active={feedFilter} onChange={handleFilterChange} hideFriends />

                  <CreatePost onCreatePost={handleCreatePost} isLoading={isPosting} dark avatarUrl={avatarUrl} />

                  <div className="space-y-4">
                    {showPostsSkeleton ? (
                      <div className="space-y-4">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={`skeleton-${i}`}
                            className="rounded-2xl bg-glass p-6 animate-pulse shadow-md shadow-black/5"
                          >
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-full bg-border" />
                              <div className="space-y-2">
                                <div className="h-3 w-32 rounded bg-border" />
                                <div className="h-2 w-20 rounded bg-border" />
                              </div>
                            </div>
                            <div className="h-3 w-full rounded bg-border mb-2" />
                            <div className="h-3 w-2/3 rounded bg-border" />
                          </div>
                        ))}
                      </div>
                    ) : filteredPosts.length === 0 ? (
                      <div className="rounded-2xl bg-glass backdrop-blur-xl p-10 text-center shadow-md shadow-black/5">
                        <p className="text-text-secondary">
                          {feedFilter === 'all'
                            ? 'No posts yet. Share something with your students!'
                            : feedFilter === 'friends'
                            ? 'No posts from friends yet.'
                            : 'No video posts yet.'}
                        </p>
                      </div>
                    ) : (
                      filteredPosts.map((post) => (
                        <PostCard
                          key={`post-${post.id}`}
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
              </div>

              {/* Right sidebar */}
              <div className="w-full xl:w-[360px] xl:flex-shrink-0 space-y-5 xl:sticky xl:top-24 xl:self-start xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1 themed-scrollbar">
                <AnnouncementWidget
                  announcements={announcementList}
                  isLoading={showAnnouncementsSkeleton}
                  onViewAll={() => handleSectionChange('announcements')}
                />
                <SectionWidget
                  section={mySection}
                  isLoading={showSectionsSkeleton}
                  onGoToSection={() => handleSectionChange('sections')}
                />
                <LiveStreamsWidget liveStreams={liveStreams} upcomingStreams={[]} isLoading={showLiveStreamsSkeleton} />
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
              isLoading={showSectionsSkeleton}
              onOpenSection={(sectionId) => {
                setSelectedTeachingSectionId(sectionId);
                handleSectionChange('sections');
              }}
            />
          )}

          {activeSection === 'sections' && (
            selectedTeachingSectionId ? (
              <div>
                <button
                  onClick={() => setSelectedTeachingSectionId(null)}
                  className="flex items-center gap-1.5 mb-4 text-sm font-medium text-text-secondary hover:text-[#00C8FF] transition"
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
          key={`detail-${searchOpenPostId}`}
          postId={searchOpenPostId}
          onClose={() => setSearchOpenPostId(null)}
          onDelete={deletePost}
          onEdit={editPost}
        />
      )}
    </div>
  );
}