// frontend/src/features/dashboard/pages/admin/AdminSectionsPage.tsx
import { useMemo, useState } from 'react';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  UserGroupIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  TrashIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/formatters';
import { Section } from '@/types/section.types';
import { useSections } from '@/features/sections/hooks/useSections';
import SectionDetailModal from '@/features/sections/components/SectionDetailModal';
import CreateSectionModal from '@/features/sections/components/CreateSectionModal';
import { useDebouncedValue } from '../../hooks/useAdminUsers';

function professorNames(section: Section): string[] {
  const active = (section.teaching_assignments || []).filter((ta) => ta.status === 'active');
  const seen = new Set<string>();
  const names: string[] = [];
  for (const ta of active) {
    const name = ta.professor_first_name
      ? `${ta.professor_first_name} ${ta.professor_last_name || ''}`.trim()
      : ta.professor_username || 'Professor';
    if (!seen.has(ta.professor_id)) {
      seen.add(ta.professor_id);
      names.push(name);
    }
  }
  return names;
}

function subjects(section: Section): string[] {
  return (section.teaching_assignments || []).filter((ta) => ta.status === 'active').map((ta) => ta.subject);
}

function SectionActionsMenu({ onView, onDelete }: { onView: () => void; onDelete: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        title="Actions"
        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-glass transition"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 rounded-xl border border-border bg-bg shadow-xl py-1 z-20">
            <button onClick={() => { setIsOpen(false); onView(); }} className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition">
              <EyeIcon className="h-4 w-4" />
              View / Manage
            </button>
            <button onClick={() => { setIsOpen(false); onDelete(); }} className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition">
              <TrashIcon className="h-4 w-4" />
              Remove Section
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminSectionsPage() {
  const { sections, isLoading, refetch, deleteSection } = useSections();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [viewTarget, setViewTarget] = useState<Section | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Section | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const list = Array.isArray(sections) ? sections : [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((s) => s.name.toLowerCase().includes(q) || (s.course || '').toLowerCase().includes(q));
  }, [sections, search]);

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setIsDeleting(true);
    try {
      await deleteSection(confirmTarget.id);
      setConfirmTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Sections</h1>
          <p className="text-text-secondary mt-1 text-sm">Every section on CCS HUB.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => refetch()}
            title="Refresh"
            className="p-2 rounded-xl border border-border bg-glass text-text-secondary hover:text-[#00C8FF] hover:border-[#00C8FF]/30 transition"
          >
            <ArrowPathIcon className="h-4 w-4" />
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
        <MagnifyingGlassIcon className="h-4 w-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search sections by name or program..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-glass text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
        />
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-glass overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-4 py-3.5 border-b border-border last:border-0 animate-pulse h-14" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-glass p-10 text-center">
          <UserGroupIcon className="h-10 w-10 mx-auto text-border" />
          <p className="text-text-secondary mt-3">{search ? `No sections match "${search}"` : 'No sections yet'}</p>
        </div>
      ) : (
        <>
          <div className="hidden sm:block rounded-2xl border border-border bg-glass overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Section</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Year</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Students</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Professors</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Subjects</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((section) => {
                  const profs = professorNames(section);
                  const subs = subjects(section);
                  return (
                    <tr key={section.id} className="border-b border-border last:border-0 hover:bg-glass transition">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-primary">{section.name}</p>
                        <p className="text-xs text-text-muted">{section.course || '—'} &middot; {section.academic_year || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{section.year_level ? `Year ${section.year_level}` : '—'}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{section.member_count ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary max-w-[10rem] truncate" title={profs.join(', ')}>
                        {profs.length > 0 ? profs.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary max-w-[10rem] truncate" title={subs.join(', ')}>
                        {subs.length > 0 ? subs.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border ${
                            profs.length > 0
                              ? 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25'
                              : 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                          }`}
                        >
                          {profs.length > 0 ? 'Active' : 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SectionActionsMenu onView={() => setViewTarget(section)} onDelete={() => setConfirmTarget(section)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-3">
            {filtered.map((section) => {
              const profs = professorNames(section);
              return (
                <div key={section.id} className="rounded-2xl border border-border bg-glass p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{section.name}</p>
                      <p className="text-xs text-text-muted">{section.course || '—'} &middot; {section.year_level ? `Year ${section.year_level}` : '—'}</p>
                    </div>
                    <SectionActionsMenu onView={() => setViewTarget(section)} onDelete={() => setConfirmTarget(section)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-text-secondary">
                    <span>{section.member_count ?? 0} students</span>
                    <span className="truncate max-w-[10rem]">{profs.length > 0 ? profs.join(', ') : 'No professor assigned'}</span>
                  </div>
                  <p className="text-xs text-text-muted mt-2">Created {formatDate(section.created_at)}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {viewTarget && (
        <SectionDetailModal section={viewTarget} onClose={() => setViewTarget(null)} onRefresh={refetch} />
      )}

      {confirmTarget && (
        <ConfirmDialog
          title="Remove this section?"
          message={`"${confirmTarget.name}" and its group chat/membership data will be permanently deleted. This cannot be undone.`}
          confirmLabel="Remove"
          danger
          isLoading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {showCreate && <CreateSectionModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}