// frontend/src/features/dashboard/components/admin/users/Pagination.tsx
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

function getPageNumbers(page: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1]);
  const sorted = Array.from(pages).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: (number | '...')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) result.push('...');
    result.push(p);
  });
  return result;
}

export function Pagination({ page, totalPages, total, limit, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
      <p className="text-xs text-[#64748B]">
        Showing {start} to {end} of {total} users
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-[#1E3447] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#00C8FF]/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        {getPageNumbers(page, totalPages).map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-sm text-[#64748B]">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`min-w-[2rem] px-2.5 py-1.5 rounded-lg text-sm font-medium transition ${
                p === page
                  ? 'bg-[#00C8FF] text-[#060B12]'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-[#1E3447] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#00C8FF]/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
