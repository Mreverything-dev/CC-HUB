// frontend/src/features/dashboard/pages/ProfessorDashboard.tsx
import { useState, useEffect } from 'react';
import { CodeXml } from 'lucide-react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { CreatePost } from '@/features/posts/components/CreatePost';
import { PostCard } from '@/features/posts/components/PostCard';
import { useFeed } from '@/features/posts/hooks/useFeed';
import { AnnouncementCard } from '@/features/announcements/components/AnnouncementCard';
import { CreateAnnouncement } from '@/features/announcements/components/CreateAnnouncement';
import { AnnouncementFilterBar } from '@/features/announcements/components/AnnouncementFilterBar';
import { AnnouncementCategory, matchesAnnouncementFilters } from '@/features/announcements/constants';
import { useAnnouncements } from '@/features/announcements/hooks/useAnnouncements';
import { useSections } from '@/features/sections/hooks/useSections';
import SectionManager from '@/features/sections/components/SectionManager';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { profileService } from '@/services/api/profile.service';
import { Sidebar, SidebarSection } from '@/features/dashboard/components/Sidebar';
import { Topbar } from '@/features/dashboard/components/Topbar';
import { FeedTabs, FeedFilter } from '@/features/dashboard/components/FeedTabs';
import { AnnouncementWidget } from '@/features/dashboard/components/AnnouncementWidget';
import { SectionWidget } from '@/features/dashboard/components/SectionWidget';
import { EventCardList } from '@/features/dashboard/components/EventCard';

export default function ProfessorDashboard() {
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState<SidebarSection>('feed');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [announcementCategory, setAnnouncementCategory] = useState<'all' | AnnouncementCategory>('all');

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
    deleteAnnouncement,
    togglePublish,
    refetch: refetchAnnouncements,
  } = useAnnouncements();

  // Sections (for the right-rail widget; SectionManager handles the full Sections view itself)
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

  const canCreateAnnouncement = user?.role === 'professor' || user?.role === 'admin';
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
    section: mySection ? 'Section-specific feeds are coming soon.' : 'You are not advising any sections yet.',
    saved: "You haven't saved any posts yet.",
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
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
        <Topbar avatarUrl={avatarUrl} />

        <main className="relative flex-1 max-w-6xl w-full mx-auto px-4 py-6 lg:px-8">
          {activeSection === 'feed' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Center - Feed */}
              <div className="xl:col-span-2 space-y-6 min-w-0">
                {/* Greeting */}
                <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl p-6 flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-semibold text-white">
                      Good morning, <span className="text-[#00d4ff]">{user?.username || 'Professor'}</span>! 👋
                    </h1>
                    <p className="text-sm text-[#a0a0a0] mt-1">
                      Manage your classes, posts, and announcements.
                    </p>
                  </div>
                  <div className="hidden sm:flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#00d4ff]/30 bg-[#00d4ff]/10">
                    <CodeXml className="h-5 w-5 text-[#00d4ff]" />
                  </div>
                </div>

                <FeedTabs active={feedFilter} onChange={setFeedFilter} />

                <CreatePost onCreatePost={handleCreatePost} isLoading={isPosting} dark />

                <div className="space-y-4">
                  {feedFilter !== 'all' ? (
                    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl p-10 text-center">
                      <p className="text-sm text-[#6b6b6b]">{emptyFeedMessage[feedFilter]}</p>
                    </div>
                  ) : postsLoading && postList.length === 0 ? (
                    <div className="space-y-4">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/40 p-6 animate-pulse"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-[#2a2a2a]" />
                            <div className="space-y-2">
                              <div className="h-3 w-32 rounded bg-[#2a2a2a]" />
                              <div className="h-2 w-20 rounded bg-[#2a2a2a]" />
                            </div>
                          </div>
                          <div className="h-3 w-full rounded bg-[#2a2a2a] mb-2" />
                          <div className="h-3 w-2/3 rounded bg-[#2a2a2a]" />
                        </div>
                      ))}
                    </div>
                  ) : postList.length === 0 ? (
                    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl p-10 text-center">
                      <p className="text-[#a0a0a0]">No posts yet. Share something with your students!</p>
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

          {activeSection === 'announcements' && (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-white">Announcements</h2>
                {canCreateAnnouncement && (
                  <button
                    onClick={() => setShowCreateAnnouncement(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00d4ff]/10 text-[#00d4ff] hover:bg-[#00d4ff]/20 transition font-medium text-sm"
                  >
                    <PlusIcon className="h-4 w-4" />
                    New Announcement
                  </button>
                )}
              </div>

              <AnnouncementFilterBar
                search={announcementSearch}
                onSearchChange={setAnnouncementSearch}
                category={announcementCategory}
                onCategoryChange={setAnnouncementCategory}
              />

              {announcementsLoading ? (
                <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 p-8 text-center text-[#6b6b6b]">
                  Loading announcements...
                </div>
              ) : announcementList.length === 0 ? (
                <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 p-8 text-center">
                  <p className="text-[#6b6b6b]">No announcements yet.</p>
                  {canCreateAnnouncement && (
                    <button
                      onClick={() => setShowCreateAnnouncement(true)}
                      className="mt-3 text-sm text-[#00d4ff] hover:underline font-medium"
                    >
                      Create your first announcement
                    </button>
                  )}
                </div>
              ) : (
                (() => {
                  const filtered = announcementList.filter((a) =>
                    matchesAnnouncementFilters(a, announcementSearch, announcementCategory)
                  );
                  return filtered.length === 0 ? (
                    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 p-8 text-center text-[#6b6b6b]">
                      No announcements match your filters.
                    </div>
                  ) : (
                    filtered.map((announcement) => (
                      <AnnouncementCard
                        key={announcement.id}
                        announcement={announcement}
                        onDelete={() => deleteAnnouncement(announcement.id)}
                        onTogglePublish={(id, isPublished) => togglePublish({ id, isPublished })}
                      />
                    ))
                  );
                })()
              )}
            </div>
          )}

          {activeSection === 'sections' && <SectionManager />}
        </main>
      </div>

      {/* Create Announcement Modal */}
      {showCreateAnnouncement && (
        <CreateAnnouncement onClose={() => setShowCreateAnnouncement(false)} />
      )}
    </div>
  );
}
