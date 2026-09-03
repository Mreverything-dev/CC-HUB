// frontend/src/features/dashboard/pages/admin/AdminAnnouncementsPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  MegaphoneIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  GlobeAltIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/formatters';
import { AdminAnnouncementListItem } from '@/services/api/admin.service';
import { useAdminAnnouncements } from '../../hooks/useAdminAnnouncements';
import { useDebouncedValue } from '../../hooks/useAdminUsers';
import { Pagination } from '../../components/admin/users/Pagination';
import { EditAnnouncementModal } from '../../components/admin/announcements/EditAnnouncementModal';
import { CreateAnnouncement } from '@/features/announcements/components/CreateAnnouncement';

const LIMIT = 15;

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'text-red-400 bg-red-500/10 border-red-500/30',
  high: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  normal: 'text-[#00C8FF] bg-[#00C8FF]/10 border-[#00C8FF]/30',
  low: 'text-[#94A3B8] bg-white/5 border-[#1E3447]',
};

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal}`}>
      {priority}
    </span>
  );
}

function AudienceBadge({ item }: { item: AdminAnnouncementListItem }) {
  const isPublic = item.target_section_names.length === 0;
  const Icon = isPublic ? GlobeAltIcon : UserGroupIcon;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[#94A3B8]">
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate max-w-[10rem]">{item.audience}</span>
    </span>
  );
}

function AnnouncementActionsMenu({
  onView,
  onEdit,
  onDelete,
}: {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        title="Actions"
        className="p-1.5 rounded-lg text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 transition"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-44 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl py-1 z-20">
            <button onClick={() => { setIsOpen(false); onView(); }} className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition">
              <EyeIcon className="h-4 w-4" />
              View Details
            </button>
            <button onClick={() => { setIsOpen(false); onEdit(); }} className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#00C8FF] hover:bg-[#00C8FF]/10 transition">
              <PencilSquareIcon className="h-4 w-4" />
              Edit
            </button>
            <button onClick={() => { setIsOpen(false); onDelete(); }} className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition">
              <TrashIcon className="h-4 w-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminAnnouncementsPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 350);
  const [page, setPage] = useState(1);
  const [confirmTarget, setConfirmTarget] = useState<AdminAnnouncementListItem | null>(null);
  const [editTarget, setEditTarget] = useState<AdminAnnouncementListItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError, refetch, isFetching, deleteAnnouncement, isDeleting } = useAdminAnnouncements({
    page,
    limit: LIMIT,
    search: search.trim() || undefined,
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    await deleteAnnouncement(confirmTarget.id);
    setConfirmTarget(null);
  };

  const items = data?.items || [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Announcements</h1>
          <p className="text-[#94A3B8] mt-1 text-sm">Every announcement across CCS HUB, including unpublished drafts.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
            className="p-2 rounded-xl border border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-[#94A3B8] hover:text-[#00C8FF] hover:border-[#00C8FF]/30 transition disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] text-[#060B12] text-sm font-semibold hover:opacity-90 transition"
          >
            <PlusIcon className="h-4 w-4" />
            Create
          </button>
        </div>
      </div>

      <div className="relative">
        <MagnifyingGlassIcon className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search announcements by title or content..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
        />
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1E3447] last:border-0 animate-pulse">
              <div className="h-9 w-9 rounded-full bg-[#1E3447] flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 rounded bg-[#1E3447]" />
                <div className="h-2.5 w-24 rounded bg-[#1E3447]" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] p-10 text-center">
          <p className="text-sm text-[#94A3B8]">Unable to load announcements</p>
          <button onClick={() => refetch()} className="mt-3 flex items-center gap-1.5 mx-auto px-3.5 py-1.5 text-sm font-medium text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-lg transition">
            <ArrowPathIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] p-10 text-center">
          <MegaphoneIcon className="h-10 w-10 mx-auto text-[#1E3447]" />
          <p className="text-[#94A3B8] mt-3">{search ? `No announcements match "${search}"` : 'No announcements yet'}</p>
        </div>
      ) : (
        <>
          <div className="hidden sm:block rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#1E3447]">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Title</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Author</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Priority</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Audience</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[#1E3447] last:border-0 hover:bg-white/[0.03] transition">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-sm font-medium text-[#F1F5F9] truncate">{item.title}</p>
                      <span className="text-[10px] font-medium text-[#64748B] capitalize">{item.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar src={item.author_avatar_url} name={item.author_full_name || item.author_username} size="xs" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#F1F5F9] truncate">{item.author_full_name || item.author_username}</p>
                          <RoleBadge role={item.created_by_role as any} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <AudienceBadge item={item} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border ${
                          item.is_published
                            ? 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25'
                            : 'text-[#94A3B8] bg-white/5 border-[#1E3447]'
                        }`}
                      >
                        {item.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#94A3B8] whitespace-nowrap">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <AnnouncementActionsMenu
                        onView={() => navigate(`/announcements/${item.id}`)}
                        onEdit={() => setEditTarget(item)}
                        onDelete={() => setConfirmTarget(item)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F1F5F9] truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Avatar src={item.author_avatar_url} name={item.author_full_name || item.author_username} size="xs" />
                      <p className="text-xs text-[#94A3B8] truncate">{item.author_full_name || item.author_username}</p>
                    </div>
                  </div>
                  <AnnouncementActionsMenu
                    onView={() => navigate(`/announcements/${item.id}`)}
                    onEdit={() => setEditTarget(item)}
                    onDelete={() => setConfirmTarget(item)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <PriorityBadge priority={item.priority} />
                  <AudienceBadge item={item} />
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border ${
                      item.is_published ? 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25' : 'text-[#94A3B8] bg-white/5 border-[#1E3447]'
                    }`}
                  >
                    {item.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-2">{formatDate(item.created_at)}</p>
              </div>
            ))}
          </div>

          {data && (
            <Pagination page={data.page} totalPages={data.total_pages} total={data.total} limit={data.limit} onChange={setPage} itemLabel="announcements" />
          )}
        </>
      )}

      {confirmTarget && (
        <ConfirmDialog
          title="Delete this announcement?"
          message={`"${confirmTarget.title}" will be permanently deleted.`}
          confirmLabel="Delete"
          danger
          isLoading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {editTarget && (
        <EditAnnouncementModal announcement={editTarget} onClose={() => setEditTarget(null)} onSaved={() => refetch()} />
      )}

      {showCreate && <CreateAnnouncement onClose={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}
