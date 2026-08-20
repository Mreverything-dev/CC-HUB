// frontend/src/features/dashboard/pages/StudentDashboard.tsx
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CodeXml } from 'lucide-react';
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
import { FeedTabs, FeedFilter } from '@/features/dashboard/components/FeedTabs';
import { AnnouncementWidget } from '@/features/dashboard/components/AnnouncementWidget';
import { SectionWidget } from '@/features/dashboard/components/SectionWidget';
import { EventCardList } from '@/features/dashboard/components/EventCard';
import FriendsPage from '@/features/friends/components/FriendsPage';
import ChatPanel from '@/features/chat/components/ChatPanel';

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const location = useLocation();
  // Allows other pages (e.g. Profile) to deep-link back into a specific
  // dashboard section via navigate(path, { state: { section } }).
  const [activeSection, setActiveSection] = useState<SidebarSection>(
    (location.state as { section?: SidebarSection } | null)?.section || 'feed'
  );
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Posts
  const {
    posts = [],
    isLoading: postsLoading,
    isPosting,
    createPost,
    toggleLike,
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

  const emptyFeedMessage: Record<FeedFilter, string> = {
    all: '',
    following: "You're not following anyone yet.",
    section: mySection ? 'Section-specific feeds are coming soon.' : 'Join a section to see section posts.',
    saved: "You haven't saved any posts yet.",
  };

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

        <main className="relative flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8">
          {activeSection === 'feed' && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
              {/* Center - Feed */}
              <div className="space-y-6 min-w-0">
                {/* Greeting */}
                <div className="rounded-2xl border border-[rgba(0,200,245,0.18)] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold text-[#F1F5F9] break-words">
                      Welcome to CCS HUB, <span className="text-[#00C8FF]">{user?.username || 'Student'}</span>! 👋
                    </h1>
                    <p className="text-sm text-[#94A3B8] mt-1">
                      Stay informed, connected, and up to date with the College of Computer Studies.
                    </p>
                  </div>
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#00C8FF]/30 bg-[#00C8FF]/10 shadow-[0_0_16px_rgba(0,200,245,0.12)]">
                    <CodeXml className="h-5 w-5 text-[#00C8FF]" />
                  </div>
                </div>

                <FeedTabs active={feedFilter} onChange={setFeedFilter} />

                <CreatePost onCreatePost={handleCreatePost} isLoading={isPosting} dark avatarUrl={avatarUrl} />

                <div className="space-y-4">
                  {feedFilter !== 'all' ? (
                    <div className="rounded-2xl border border-[rgba(0,200,245,0.18)] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl p-10 text-center">
                      <p className="text-sm text-[#94A3B8]">{emptyFeedMessage[feedFilter]}</p>
                    </div>
                  ) : postsLoading && postList.length === 0 ? (
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
                <EventCardList />
              </div>
            </div>
          )}

          {activeSection === 'announcements' && <AnnouncementFeedBody />}

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
