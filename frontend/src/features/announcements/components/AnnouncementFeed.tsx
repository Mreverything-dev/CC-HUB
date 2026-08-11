// frontend/src/features/announcements/components/AnnouncementFeed.tsx
import { useMemo, useState } from 'react';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { AnnouncementCard } from './AnnouncementCard';
import { CreateAnnouncement } from './CreateAnnouncement';
import { AnnouncementFilterBar } from './AnnouncementFilterBar';
import { AnnouncementCategory, matchesAnnouncementFilters } from '../constants';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function AnnouncementFeed() {
  const { announcements, isLoading, deleteAnnouncement, togglePublish } = useAnnouncements();
  const { user } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | AnnouncementCategory>('all');

  const canCreate = user?.role === 'professor' || user?.role === 'admin';

  // ✅ Ensure announcements is an array
  const announcementList = Array.isArray(announcements) ? announcements : [];

  const filteredAnnouncements = useMemo(
    () => announcementList.filter((a) => matchesAnnouncementFilters(a, search, category)),
    [announcementList, search, category]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d4ff]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <div className="relative max-w-4xl mx-auto p-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Announcements</h2>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gradient-to-br from-[#00d4ff] to-[#0099cc] text-[#0a0a0a] rounded-xl hover:opacity-90 transition"
            >
              <PlusIcon className="h-4 w-4" />
              Create Announcement
            </button>
          )}
        </div>

        <div className="mb-6">
          <AnnouncementFilterBar
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
          />
        </div>

        {/* Announcements List */}
        {filteredAnnouncements.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl">
            <p className="text-[#a0a0a0]">
              {announcementList.length === 0 ? 'No announcements yet' : 'No announcements match your filters'}
            </p>
            {canCreate && announcementList.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-sm text-[#00d4ff] hover:underline font-medium"
              >
                Create the first announcement
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnnouncements.map((announcement) => (
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
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateAnnouncement onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
