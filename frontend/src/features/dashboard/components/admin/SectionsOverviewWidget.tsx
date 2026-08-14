// frontend/src/features/dashboard/components/admin/SectionsOverviewWidget.tsx
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { Section } from '@/types/section.types';

interface SectionsOverviewWidgetProps {
  sections: Section[];
  isLoading?: boolean;
  onViewAll: () => void;
}

/**
 * Reference calls this "Top Active Sections" with per-section activity counts
 * and trend arrows - no such tracking exists in the backend, so this shows
 * the real metric that does exist (enrollment) instead of inventing one.
 */
export function SectionsOverviewWidget({ sections, isLoading, onViewAll }: SectionsOverviewWidgetProps) {
  const ranked = [...sections].sort((a, b) => (b.member_count || 0) - (a.member_count || 0)).slice(0, 4);

  return (
    <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] backdrop-blur-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#F1F5F9]">Sections Overview</h3>
        <span className="text-[10px] text-[#64748B] uppercase tracking-wide">By enrollment</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-9 w-9 rounded-xl bg-[#1E3447] flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-24 rounded bg-[#1E3447]" />
                <div className="h-2 w-16 rounded bg-[#1E3447]" />
              </div>
            </div>
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <p className="text-sm text-[#64748B] py-6 text-center">No sections yet</p>
      ) : (
        <div className="space-y-1">
          {ranked.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-1.5 py-2 rounded-xl hover:bg-white/5 transition">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00C8FF]/10 text-[#00C8FF] flex-shrink-0">
                <UserGroupIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#F1F5F9] font-medium truncate">{s.name}</p>
                <p className="text-xs text-[#64748B] truncate">{s.member_count} member{s.member_count === 1 ? '' : 's'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onViewAll}
        className="w-full mt-3 pt-3 border-t border-[#1E3447] text-sm font-medium text-[#00C8FF] hover:text-[#00E0FF] transition"
      >
        View all
      </button>
    </div>
  );
}
