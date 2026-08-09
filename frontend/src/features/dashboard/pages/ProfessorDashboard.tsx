// frontend/src/features/dashboard/pages/ProfessorDashboard.tsx
import { useState, useEffect } from 'react';
import { CreatePost } from '@/features/posts/components/CreatePost';
import { PostCard } from '@/features/posts/components/PostCard';
import { useFeed } from '@/features/posts/hooks/useFeed';
import { Card } from '@/components/ui/Card/Card';
import { AnnouncementCard } from '@/features/announcements/components/AnnouncementCard';
import { CreateAnnouncement } from '@/features/announcements/components/CreateAnnouncement';
import { useAnnouncements } from '@/features/announcements/hooks/useAnnouncements';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { MegaphoneIcon, PlusIcon, DocumentTextIcon, UsersIcon } from '@heroicons/react/24/outline';
import SectionManager from '@/features/sections/components/SectionManager';

export default function ProfessorDashboard() {
  const { user } = useAuthStore();
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
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
    deleteAnnouncement,
    togglePublish,
    refetch: refetchAnnouncements,
  } = useAnnouncements();

  // ✅ Refetch announcements on mount
  useEffect(() => {
    refetchAnnouncements();
  }, []);

  const canCreateAnnouncement = user?.role === 'professor' || user?.role === 'admin';
  const announcementList = Array.isArray(announcements) ? announcements : [];
  const postList = Array.isArray(posts) ? posts : [];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Welcome Section */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Professor Dashboard</h1>
        <p className="text-gray-600">Manage your classes, posts, and announcements</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card variant="glass" className="text-center p-4">
          <p className="text-sm text-gray-500">Posts</p>
          <p className="text-2xl font-bold text-gray-800">{postList.length}</p>
        </Card>
        <Card variant="glass" className="text-center p-4">
          <p className="text-sm text-gray-500">Announcements</p>
          <p className="text-2xl font-bold text-gray-800">{announcementList.length}</p>
        </Card>
        <Card variant="glass" className="text-center p-4">
          <p className="text-sm text-gray-500">Sections</p>
          <p className="text-2xl font-bold text-gray-800">0</p>
        </Card>
        <Card variant="glass" className="text-center p-4">
          <p className="text-sm text-gray-500">Students</p>
          <p className="text-2xl font-bold text-gray-800">0</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'posts'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <DocumentTextIcon className="h-5 w-5 inline mr-2" />
          Posts
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'announcements'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MegaphoneIcon className="h-5 w-5 inline mr-2" />
          Announcements
          {announcementList.length > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
              {announcementList.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sections')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'sections'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <UsersIcon className="h-5 w-5 inline mr-2" />
          Sections
        </button>
      </div>

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <>
          <CreatePost onCreatePost={createPost} isLoading={isPosting} />

          <div className="space-y-4 mt-6">
            {postsLoading && postList.length === 0 ? (
              <Card variant="glass" className="text-center py-8">
                <p className="text-gray-500">Loading posts...</p>
              </Card>
            ) : postList.length === 0 ? (
              <Card variant="glass" className="text-center py-8">
                <p className="text-gray-500">No posts yet. Share something with your students!</p>
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
          {canCreateAnnouncement && (
            <div className="mb-4">
              <button
                onClick={() => setShowCreateAnnouncement(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                <PlusIcon className="h-5 w-5" />
                New Announcement
              </button>
            </div>
          )}

          <div className="space-y-4">
            {announcementsLoading ? (
              <Card variant="glass" className="text-center py-8">
                <p className="text-gray-500">Loading announcements...</p>
              </Card>
            ) : announcementList.length === 0 ? (
              <Card variant="glass" className="text-center py-8">
                <p className="text-gray-500">No announcements yet.</p>
                {canCreateAnnouncement && (
                  <button
                    onClick={() => setShowCreateAnnouncement(true)}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create your first announcement
                  </button>
                )}
              </Card>
            ) : (
              announcementList.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  onDelete={() => deleteAnnouncement(announcement.id)}
                  onTogglePublish={(id, isPublished) =>
                    togglePublish({ id, isPublished })
                  }
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Sections Tab */}
      {activeTab === 'sections' && (
        <SectionManager />
      )}

      {/* Create Announcement Modal */}
      {showCreateAnnouncement && (
        <CreateAnnouncement onClose={() => setShowCreateAnnouncement(false)} />
      )}
    </div>
  );
}