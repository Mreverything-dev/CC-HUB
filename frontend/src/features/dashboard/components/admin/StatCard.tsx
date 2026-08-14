// frontend/src/features/dashboard/components/admin/StatCard.tsx
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** null/undefined means there's genuinely no backend data for this metric yet. */
  value: number | null | undefined;
  trendPercent?: number | null;
  trendLabel?: string;
  accent?: string;
  isLoading?: boolean;
  onClick?: () => void;
  /** For metrics like "Active Now" with no numeric trend, e.g. an online dot + label. */
  statusLabel?: string;
  unavailableReason?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  trendPercent,
  trendLabel = 'from last week',
  accent = '#00C8FF',
  isLoading,
  onClick,
  statusLabel,
  unavailableReason,
}: StatCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[rgba(0,200,245,0.12)] bg-[rgba(10,20,30,0.75)] p-4 animate-pulse">
        <div className="h-8 w-8 rounded-lg bg-[#1E3447]" />
        <div className="h-3 w-20 rounded bg-[#1E3447] mt-3" />
        <div className="h-6 w-14 rounded bg-[#1E3447] mt-2" />
        <div className="h-2.5 w-24 rounded bg-[#1E3447] mt-2" />
      </div>
    );
  }

  const hasValue = value !== null && value !== undefined;
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`w-full text-left rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] backdrop-blur-xl p-4 transition-all duration-200 hover:border-[#00C8FF]/35 hover:-translate-y-0.5 ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}1A`, color: accent }}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>

      <p className="text-xs text-[#94A3B8] mt-3">{label}</p>

      {hasValue ? (
        <p className="text-2xl font-bold text-[#F1F5F9] mt-0.5">{value.toLocaleString()}</p>
      ) : (
        <p className="text-2xl font-bold text-[#3D4A5C] mt-0.5" title={unavailableReason}>
          N/A
        </p>
      )}

      {statusLabel ? (
        <p className="flex items-center gap-1.5 text-xs text-[#22C55E] mt-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
          {statusLabel}
        </p>
      ) : hasValue && trendPercent !== null && trendPercent !== undefined ? (
        <p
          className={`flex items-center gap-1 text-xs mt-1 ${
            trendPercent >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
          }`}
        >
          {trendPercent >= 0 ? (
            <ArrowUpIcon className="h-3 w-3" />
          ) : (
            <ArrowDownIcon className="h-3 w-3" />
          )}
          {Math.abs(trendPercent)}% <span className="text-[#64748B]">{trendLabel}</span>
        </p>
      ) : !hasValue ? (
        <p className="text-xs text-[#64748B] mt-1">{unavailableReason || 'No data'}</p>
      ) : (
        <p className="text-xs text-[#64748B] mt-1">&nbsp;</p>
      )}
    </Wrapper>
  );
}
