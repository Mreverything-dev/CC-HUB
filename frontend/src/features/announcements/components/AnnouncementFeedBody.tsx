// frontend/src/features/announcements/components/AnnouncementFeedBody.tsx
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlusIcon, MegaphoneIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSections } from '@/features/sections/hooks/useSections';
import { AnnouncementCard } from './AnnouncementCard';
import { CreateAnnouncement } from './CreateAnnouncement';
import { AnnouncementFilterBar } from './AnnouncementFilterBar';
import { AnnouncementCategorySidebar, AnnouncementSidebarFilter } from './AnnouncementCategorySidebar';
import { AnnouncementCategory, matchesAnnouncementFilters } from '../constants';
import { Announcement } from '@/types/announcement.types';

function matchesSidebarFilter(a: Announcement, search: string, filter: AnnouncementSidebarFilter): boolean {
  if (filter === 'important' && a.priority !== 'urgent') return false;
  const category = filter === 'important' ? 'all' : (filter as 'all' | AnnouncementCategory);
  return matchesAnnouncementFilters(a, search, category);
}

// The backend already only ever returns announcements a student's own
// sections (plus public/CCS-wide ones) can see - this narrows that
// already-correctly-scoped list further, to just one specific section, for
// the Section page's "View Announcements" quick action. Reuses the existing
// target_sections field already on each announcement; no new API call.
function matchesSection(a: Announcement, sectionId: string | null): boolean {
  if (!sectionId) return true;
  const isGlobal = !a.target_sections || a.target_sections.length === 0;
  return isGlobal || (a.target_sections?.includes(sectionId) ?? false);
}

/**
 * The full Announcements experience (header, search/filter, card feed,
 * category/popular/notify sidebar) - shared by the standalone /announcements
 * route (AnnouncementFeed) and the dashboards' embedded "Announcements" tab,
 * so both surfaces stay a single consistent implementation.
 */
export default function AnnouncementFeedBody() {
  const { announcements, isLoading, error, deleteAnnouncement, togglePublish } = useAnnouncements();
  const { user } = useAuthStore();
  const { sections } = useSections();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AnnouncementSidebarFilter>('all');
  const [searchParams, setSearchParams] = useSearchParams();

  // Set via the Section page's "View Announcements" quick action
  // (?section=<id>) - narrows the feed to just that section (plus
  // public/CCS-wide announcements) instead of every section the user can see.
  const sectionFilterId = searchParams.get('section');
  const sectionFilterName = sectionFilterId ? sections.find((s) => s.id === sectionFilterId)?.name : null;
  const clearSectionFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('section');
    setSearchParams(next, { replace: true });
  };

  // Section mayors/officers can also create announcements (matches
  // CreateAnnouncement's own internal permission check) - not just
  // professors/admins.
  const isOfficer =
    user?.role === 'student' &&
    sections.some((s) => s.members?.some((m) => m.user_id === user?.id && (m.is_mayor || m.is_officer)));
  const canCreate = user?.role === 'professor' || user?.role === 'admin' || isOfficer;

  const announcementList = Array.isArray(announcements) ? announcements : [];

  const filteredAnnouncements = useMemo(
    () =>
      announcementList.filter(
        (a) => matchesSidebarFilter(a, search, filter) && matchesSection(a, sectionFilterId)
      ),
    [announcementList, search, filter, sectionFilterId]
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Announcements</h1>
          <p className="text-[#94A3B8] mt-1 text-sm">
            Stay informed about important updates and news.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition flex-shrink-0"
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
        {sectionFilterId && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#00C8FF] bg-[#00C8FF]/10 border border-[#00C8FF]/30 rounded-full pl-3 pr-1.5 py-1">
              Filtered by section: {sectionFilterName || sectionFilterId}
              <button
                onClick={clearSectionFilter}
                title="Clear section filter"
                className="p-0.5 rounded-full hover:bg-[#00C8FF]/20 transition"
              >
                <XCircleIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
        {/* Main feed */}
        <div className="space-y-4 min-w-0">
          {isLoading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-40 rounded-2xl border border-[#1E3447] bg-[#0D1722]/60 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-8 text-center">
              <ExclamationTriangleIcon className="h-8 w-8 mx-auto text-[#EF4444] mb-2" />
              <p className="text-sm text-[#F1F5F9]">Failed to load announcements. Please try again.</p>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-[#1E3447] bg-[#0D1722]/60 backdrop-blur-xl">
              <MegaphoneIcon className="h-10 w-10 mx-auto text-[#1E3447]" />
              <p className="text-[#94A3B8] mt-3">
                {announcementList.length === 0 ? 'No announcements yet' : 'No announcements match your filters'}
              </p>
              {canCreate && announcementList.length === 0 && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 text-sm text-[#00C8FF] hover:underline font-medium"
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

        {/* Right sidebar - hidden on mobile/small tablet, stacks below the
            feed at lg, becomes a true side column at xl. */}
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
