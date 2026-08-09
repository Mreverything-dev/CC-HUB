// frontend/src/features/dashboard/pages/StudentDashboard.tsx
import { useState, useEffect } from 'react';

import { CreatePost } from '@/features/posts/components/CreatePost';
import { PostCard } from '@/features/posts/components/PostCard';
import { useFeed } from '@/features/posts/hooks/useFeed';
import { Card } from '@/components/ui/Card/Card';
import { AnnouncementCard } from '@/features/announcements/components/AnnouncementCard';
import { useAnnouncements } from '@/features/announcements/hooks/useAnnouncements';
import { useSections } from '@/features/sections/hooks/useSections';
import SectionCard from '@/features/sections/components/SectionCard';
import { MegaphoneIcon, DocumentTextIcon, UsersIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';

export default function StudentDashboard() {
  const { user } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'posts' | 'announcements' | 'sections'>('posts');
  
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

  // ✅ Fetch sections on mount
  useEffect(() => {
    refetchSections();
  }, []);

  const postList = Array.isArray(posts) ? posts : [];
  const announcementList = Array.isArray(announcements) ? announcements : [];
  const sectionList = Array.isArray(sections) ? sections : [];

  // ✅ Handle create post with media
  const handleCreatePost = async (data: { content: string; media_urls?: string[] }) => {
    await createPost(data);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Welcome Section */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome, {user?.username || 'Student'}! 👋
        </h1>
        <p className="text-gray-600">Stay updated with your classes and announcements</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 font-medium transition flex items-center gap-2 ${
            activeTab === 'posts'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <DocumentTextIcon className="h-5 w-5" />
          Feed
          {postList.length > 0 && (
            <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
              {postList.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={`px-4 py-2 font-medium transition flex items-center gap-2 ${
            activeTab === 'announcements'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MegaphoneIcon className="h-5 w-5" />
          Announcements
          {announcementList.length > 0 && (
            <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
              {announcementList.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sections')}
          className={`px-4 py-2 font-medium transition flex items-center gap-2 ${
            activeTab === 'sections'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <UsersIcon className="h-5 w-5" />
          Sections
          {sectionList.length > 0 && (
            <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs">
              {sectionList.length}
            </span>
          )}
        </button>
      </div>

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <>
          {/* ✅ Pass handleCreatePost instead of createPost directly */}
          <CreatePost onCreatePost={handleCreatePost} isLoading={isPosting} />

          <div className="space-y-4 mt-6">
            {postsLoading && postList.length === 0 ? (
              <Card variant="glass" className="text-center py-8">
                <p className="text-gray-500">Loading posts...</p>
              </Card>
            ) : postList.length === 0 ? (
              <Card variant="glass" className="text-center py-8">
                <p className="text-gray-500">No posts yet. Check back later!</p>
              </Card>
            ) : (
              postList.map((post) => (
                <PostCard
                  key={post.id}
                  {...post}
                  onLike={toggleLike}
                  onDelete={deletePost}
                  onEdit={editPost}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Announcements Tab */}
      {activeTab === 'announcements' && (
        <>
          <div className="space-y-4">
            {announcementsLoading ? (
              <Card variant="glass" className="text-center py-8">
                <p className="text-gray-500">Loading announcements...</p>
              </Card>
            ) : announcementList.length === 0 ? (
              <Card variant="glass" className="text-center py-8">
                <p className="text-gray-500">No announcements for your sections yet.</p>
              </Card>
            ) : (
              announcementList.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Sections Tab */}
      {activeTab === 'sections' && (
        <>
          <div className="space-y-4">
            {sectionsLoading ? (
              <Card variant="glass" className="text-center py-8">
                <p className="text-gray-500">Loading your sections...</p>
              </Card>
            ) : sectionList.length === 0 ? (
              <Card variant="glass" className="text-center py-8">
                <p className="text-gray-500">You are not enrolled in any sections yet.</p>
                <p className="text-sm text-gray-400 mt-2">Contact your professor to be added to a section.</p>
              </Card>
            ) : (
              sectionList.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  onRefresh={refetchSections}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}