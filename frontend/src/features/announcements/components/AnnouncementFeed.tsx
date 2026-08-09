// frontend/src/features/announcements/components/AnnouncementFeed.tsx
import { useState } from 'react';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { AnnouncementCard } from './AnnouncementCard';
import { CreateAnnouncement } from './CreateAnnouncement';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function AnnouncementFeed() {
  const { announcements, isLoading, deleteAnnouncement, togglePublish } = useAnnouncements();
  const { user } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const canCreate = user?.role === 'professor' || user?.role === 'admin';

  // ✅ Ensure announcements is an array
  const announcementList = Array.isArray(announcements) ? announcements : [];

  // ✅ Debug log
  console.log('📢 AnnouncementFeed - announcements:', announcementList);
  console.log('📢 AnnouncementFeed - isLoading:', isLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Announcements</h2>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            <PlusIcon className="h-5 w-5" />
            New Announcement
          </button>
        )}
      </div>

      {/* Announcements List */}
      {announcementList.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No announcements yet</p>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Create the first announcement
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {announcementList.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              onDelete={() => deleteAnnouncement(announcement.id)}
              onTogglePublish={(id, isPublished) => 
                togglePublish({ id, isPublished })
              }
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateAnnouncement onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}