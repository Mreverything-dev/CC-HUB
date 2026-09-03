// frontend/src/features/dashboard/pages/admin/AdminReportsPage.tsx
import { useEffect, useState } from 'react';
import { ArrowPathIcon, FlagIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatRelativeTime } from '@/lib/formatters';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { useAdminReports } from '../../hooks/useAdminReports';
import { useDebouncedValue } from '../../hooks/useAdminUsers';
import { Pagination } from '../../components/admin/users/Pagination';
import { ReportDetailModal } from '../../components/admin/reports/ReportDetailModal';
import { REPORT_CATEGORIES, REPORT_STATUSES, getReportCategoryMeta, getReportStatusMeta } from '../../constants/reportCategories';
import type { AdminReportListItem } from '@/services/api/admin.service';

const LIMIT = 15;

export default function AdminReportsPage() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 350);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminReportListItem | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useAdminReports({
    page,
    limit: LIMIT,
    category: category || undefined,
    status: status || undefined,
    search: search.trim() || undefined,
  });

  useEffect(() => {
    setPage(1);
  }, [search, category, status]);

  const items = data?.items || [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Reports</h1>
          <p className="text-[#94A3B8] mt-1 text-sm">Review reported posts and take moderation action.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh"
          className="p-2 rounded-xl border border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-[#94A3B8] hover:text-[#00C8FF] hover:border-[#00C8FF]/30 transition disabled:opacity-50 flex-shrink-0"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative">
        <MagnifyingGlassIcon className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by reported user, post content, or category..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setStatus(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
            !status ? 'border-[#00C8FF]/40 bg-[#00C8FF]/10 text-[#00C8FF]' : 'border-[#1E3447] text-[#94A3B8] hover:bg-white/5'
          }`}
        >
          All Statuses
        </button>
        {REPORT_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${
              status === s.value ? s.colorClass : 'border-[#1E3447] text-[#94A3B8] hover:bg-white/5'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setCategory(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
            !category ? 'border-[#00C8FF]/40 bg-[#00C8FF]/10 text-[#00C8FF]' : 'border-[#1E3447] text-[#94A3B8] hover:bg-white/5'
          }`}
        >
          All Categories
        </button>
        {REPORT_CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
              category === c.value ? c.colorClass : 'border-[#1E3447] text-[#94A3B8] hover:bg-white/5'
            }`}
          >
            <span>{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-4 py-3.5 border-b border-[#1E3447] last:border-0 animate-pulse space-y-1.5">
              <div className="h-3 w-56 rounded bg-[#1E3447]" />
              <div className="h-2.5 w-32 rounded bg-[#1E3447]" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] p-10 text-center">
          <p className="text-sm text-[#94A3B8]">Unable to load reports</p>
          <button onClick={() => refetch()} className="mt-3 flex items-center gap-1.5 mx-auto px-3.5 py-1.5 text-sm font-medium text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-lg transition">
            <ArrowPathIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] p-10 text-center">
          <FlagIcon className="h-10 w-10 mx-auto text-[#1E3447]" />
          <p className="text-[#94A3B8] mt-3">No reports match these filters.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] divide-y divide-[#1E3447]">
            {items.map((report) => {
              const cat = getReportCategoryMeta(report.category, report.category_label);
              const stat = getReportStatusMeta(report.status);
              return (
                <button
                  key={report.id}
                  onClick={() => setSelected(report)}
                  className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-white/[0.03] transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 border ${cat.colorClass}`}>
                        <span>{cat.emoji}</span>
                        {cat.label}
                      </span>
                      <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 border ${stat.colorClass}`}>
                        {stat.label}
                      </span>
                      {report.warning_issued && (
                        <span className="text-xs font-medium rounded-full px-2 py-0.5 border border-amber-500/25 text-amber-400 bg-amber-500/10">Warned</span>
                      )}
                      {report.restriction && (
                        <span className="text-xs font-medium rounded-full px-2 py-0.5 border border-[#EF4444]/25 text-[#EF4444] bg-[#EF4444]/10">Restricted</span>
                      )}
                      {report.post_removed && (
                        <span className="text-xs font-medium rounded-full px-2 py-0.5 border border-[#1E3447] text-[#64748B] bg-white/5">Post Removed</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Avatar
                        src={report.reported_user.avatar_url}
                        name={report.reported_user.full_name || report.reported_user.username}
                        size="xs"
                      />
                      <span className="text-sm font-medium text-[#F1F5F9] truncate">
                        {report.reported_user.full_name || report.reported_user.username}
                      </span>
                    </div>

                    {report.reported_post?.content && (
                      <p className="text-sm text-[#94A3B8] mt-1.5 line-clamp-2 [overflow-wrap:anywhere]">{report.reported_post.content}</p>
                    )}
                    {report.details && (
                      <p className="text-xs text-[#64748B] mt-1 line-clamp-1 [overflow-wrap:anywhere]">"{report.details}"</p>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] flex-shrink-0 whitespace-nowrap">{formatRelativeTime(report.created_at)}</p>
                </button>
              );
            })}
          </div>

          {data && (
            <Pagination page={data.page} totalPages={data.total_pages} total={data.total} limit={data.limit} onChange={setPage} itemLabel="reports" />
          )}
        </>
      )}

      {selected && <ReportDetailModal report={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
