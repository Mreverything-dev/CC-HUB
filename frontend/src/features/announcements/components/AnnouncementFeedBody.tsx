// frontend/src/features/announcements/components/AnnouncementFeedBody.tsx
import { useMemo, useState } from 'react';
import { PlusIcon, MegaphoneIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSections } from '@/features/sections/hooks/useSections';
import { AnnouncementCard } from './AnnouncementCard';
import { CreateAnnouncement } from './CreateAnnouncement';
import { AnnouncementFilterBar } from './AnnouncementFilterBar';
import { AnnouncementCategorySidebar, AnnouncementSidebarFilter } from './AnnouncementCategorySidebar';
import { AnnouncementCategory, matchesAnnouncementFilters } from '../constants';
import { Announcement } from '@/types/announcement.types';
import { useMinimumLoading } from '@/features/dashboard/hooks/useMinimumLoading';

function matchesSidebarFilter(a: Announcement, search: string, filter: AnnouncementSidebarFilter): boolean {
  if (filter === 'important' && a.priority !== 'urgent') return false;
  const category = filter === 'important' ? 'all' : (filter as 'all' | AnnouncementCategory);
  return matchesAnnouncementFilters(a, search, category);
}


export default function AnnouncementFeedBody() {
  const { announcements, isLoading, error, deleteAnnouncement, togglePublish } = useAnnouncements();

  // ✅ Force a minimum 5-second skeleton so announcements don't flash in immediately
  const showAnnouncementsSkeleton = useMinimumLoading(isLoading, 5000);
  const { user } = useAuthStore();
  const { sections } = useSections();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AnnouncementSidebarFilter>('all');

  const isOfficer =
    user?.role === 'student' &&
    sections.some((s) => s.members?.some((m) => m.user_id === user?.id && (m.is_mayor || m.is_officer)));
  const canCreate = user?.role === 'professor' || user?.role === 'admin' || isOfficer;

  const announcementList = Array.isArray(announcements) ? announcements : [];

  const filteredAnnouncements = useMemo(
    () => announcementList.filter((a) => matchesSidebarFilter(a, search, filter)),
    [announcementList, search, filter]
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Announcements</h1>
          <p className="text-text-secondary mt-1 text-sm">
            Stay informed about important updates and news.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-border bg-glass text-text-primary rounded-xl hover:bg-glass-hover transition flex-shrink-0"
          >
            <PlusIcon className="h-4 w-4" />
            New Announcement
          </button>
        )}
      </div>

      <div className="mb-5 space-y-3">
        <AnnouncementFilterBar
          search={search}
          onSearchChange={setSearch}
          category={filter === 'important' ? 'all' : filter}
          onCategoryChange={(v) => setFilter(v)}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
        {/* Main feed */}
        <div className="space-y-4 min-w-0">
          {showAnnouncementsSkeleton ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-40 rounded-2xl border border-border bg-glass animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-8 text-center">
              <ExclamationTriangleIcon className="h-8 w-8 mx-auto text-[#EF4444] mb-2" />
              <p className="text-sm text-text-primary">Failed to load announcements. Please try again.</p>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-border bg-glass backdrop-blur-xl">
              <MegaphoneIcon className="h-10 w-10 mx-auto text-border" />
              <p className="text-text-secondary mt-3">
                {announcementList.length === 0 ? 'No announcements yet' : 'No announcements match your filters'}
              </p>
              {canCreate && announcementList.length === 0 && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 text-sm text-text-primary hover:underline font-medium"
                >
                  Create the first announcement
                </button>
              )}
            </div>
          ) : (
            filteredAnnouncements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                onDelete={() => deleteAnnouncement(announcement.id)}
                onTogglePublish={(id, isPublished) => togglePublish({ id, isPublished })}
              />
            ))
          )}
        </div>

        {/* Right sidebar */}
        <div className="hidden lg:block xl:sticky xl:top-24 xl:self-start">
          <AnnouncementCategorySidebar
            announcements={announcementList}
            filter={filter}
            onFilterChange={setFilter}
          />
        </div>
      </div>

      {showCreateModal && <CreateAnnouncement onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}