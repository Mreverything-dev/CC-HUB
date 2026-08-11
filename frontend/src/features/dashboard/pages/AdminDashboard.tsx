// frontend/src/features/dashboard/pages/AdminDashboard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreatePost } from '@/features/posts/components/CreatePost';
import { PostCard } from '@/features/posts/components/PostCard';
import { useFeed } from '@/features/posts/hooks/useFeed';
import { Card } from '@/components/ui/Card/Card';
import { AnnouncementCard } from '@/features/announcements/components/AnnouncementCard';
import { CreateAnnouncement } from '@/features/announcements/components/CreateAnnouncement';
import { useAnnouncements } from '@/features/announcements/hooks/useAnnouncements';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChat } from '@/features/chat/hooks/useChat';
import ProfileAvatar from '@/features/profile/components/ProfileAvatar';
import NotificationBell from '@/features/friends/components/NotificationBell';
import { MegaphoneIcon, PlusIcon, DocumentTextIcon, UserGroupIcon, ChatBubbleLeftIcon, UsersIcon } from '@heroicons/react/24/outline';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { unreadCount, toggleWidget } = useChat();
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'announcements' | 'users'>('posts');
  
  // Posts
  const {
    posts = [], // ✅ Default to empty array
    isLoading: postsLoading,
    isPosting,
    createPost,
    toggleLike,
    deletePost,
    editPost,
  } = useFeed();

  // Announcements
  const {
    announcements = [], // ✅ Default to empty array
    isLoading: announcementsLoading,
    deleteAnnouncement,
    togglePublish,
  } = useAnnouncements();

  const canCreateAnnouncement = user?.role === 'admin';

  // ✅ Ensure arrays
  const postList = Array.isArray(posts) ? posts : [];
  const announcementList = Array.isArray(announcements) ? announcements : [];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Welcome Section with Profile Avatar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-600">Manage the entire platform</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/friends')}
            className="p-2 text-gray-600 hover:text-blue-600 transition rounded-full hover:bg-blue-50"
            title="Friends"
          >
            <UsersIcon className="h-6 w-6" />
          </button>
          <button
            onClick={toggleWidget}
            className="relative p-2 text-gray-600 hover:text-blue-600 transition rounded-full hover:bg-blue-50"
            title="Messages"
          >
            <ChatBubbleLeftIcon className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <NotificationBell />
          <ProfileAvatar />
        </div>
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
          <p className="text-sm text-gray-500">Users</p>
          <p className="text-2xl font-bold text-gray-800">0</p>
        </Card>
        <Card variant="glass" className="text-center p-4">
          <p className="text-sm text-gray-500">Sections</p>
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
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'users'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserGroupIcon className="h-5 w-5 inline mr-2" />
          Users
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
                <p className="text-gray-500">No posts yet.</p>
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

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">User Management</h3>
          <p className="text-gray-500">User management features coming soon...</p>
        </div>
      )}

      {/* Create Announcement Modal */}
      {showCreateAnnouncement && (
        <CreateAnnouncement onClose={() => setShowCreateAnnouncement(false)} />
      )}
    </div>
  );
}