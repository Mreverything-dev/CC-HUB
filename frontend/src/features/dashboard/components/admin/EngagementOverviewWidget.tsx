// frontend/src/features/dashboard/components/admin/EngagementOverviewWidget.tsx
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { AdminDashboardStats } from '@/services/api/admin.service';

ChartJS.register(ArcElement, Tooltip);

interface EngagementOverviewWidgetProps {
  stats?: AdminDashboardStats;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const SEGMENTS = [
  { key: 'posts', label: 'Posts', color: '#8B5CF6' },
  { key: 'comments', label: 'Comments', color: '#00C8FF' },
  { key: 'reactions', label: 'Reactions', color: '#F59E0B' },
  { key: 'shares', label: 'Shares', color: '#22C55E' },
] as const;

export function EngagementOverviewWidget({ stats, isLoading, isError, onRetry }: EngagementOverviewWidgetProps) {
  const values = stats
    ? {
        posts: stats.posts.value,
        comments: stats.engagement.comments,
        reactions: stats.engagement.reactions,
        shares: stats.engagement.shares,
      }
    : null;
  const total = values ? values.posts + values.comments + values.reactions + values.shares : 0;

  return (
    <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] backdrop-blur-xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-[#F1F5F9] mb-4">Engagement Overview</h3>

      {isLoading ? (
        <div className="h-48 rounded-xl bg-[#0A111A] animate-pulse" />
      ) : isError ? (
        <div className="h-48 flex flex-col items-center justify-center gap-2 text-center px-4">
          <p className="text-sm text-[#94A3B8]">Unable to load dashboard data</p>
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-lg transition"
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      ) : !values || total === 0 ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-[#64748B]">No engagement data yet</p>
        </div>
      ) : (
        <div className="flex items-center gap-5">
          <div className="relative h-32 w-32 flex-shrink-0">
            <Doughnut
              data={{
                labels: SEGMENTS.map((s) => s.label),
                datasets: [
                  {
                    data: SEGMENTS.map((s) => values[s.key]),
                    backgroundColor: SEGMENTS.map((s) => s.color),
                    borderColor: '#0A111A',
                    borderWidth: 2,
                    hoverOffset: 6,
                  },
                ],
              }}
              options={{
                cutout: '72%',
                plugins: {
                  tooltip: {
                    backgroundColor: '#111E2B',
                    borderColor: '#1E3447',
                    borderWidth: 1,
                    titleColor: '#94A3B8',
                    bodyColor: '#F1F5F9',
                    padding: 10,
                    callbacks: {
                      label: (ctx) => {
                        const v = ctx.parsed as number;
                        return ` ${ctx.label}: ${v.toLocaleString()} (${Math.round((v / total) * 100)}%)`;
                      },
                    },
                  },
                },
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-lg font-bold text-[#F1F5F9]">{total.toLocaleString()}</p>
              <p className="text-[10px] text-[#64748B]">Total</p>
            </div>
          </div>

          <div className="flex-1 space-y-2 min-w-0">
            {SEGMENTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-[#94A3B8] min-w-0">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="text-[#F1F5F9] font-medium flex-shrink-0">
                  {Math.round((values[s.key] / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
