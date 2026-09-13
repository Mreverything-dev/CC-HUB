// frontend/src/features/dashboard/components/admin/UserGrowthChart.tsx
import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ArrowPathIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useUserGrowth } from '../../hooks/useAdminStats';
import { UserGrowthRange } from '@/services/api/admin.service';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const RANGE_OPTIONS: { id: UserGrowthRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
];

function formatBucketLabel(iso: string, unit: 'hour' | 'day' | 'month') {
  const d = new Date(iso);
  if (unit === 'hour') return d.toLocaleTimeString([], { hour: 'numeric' });
  if (unit === 'month') return d.toLocaleDateString([], { month: 'short', year: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function UserGrowthChart() {
  const [range, setRange] = useState<UserGrowthRange>('week');
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const { growth, isLoading, isError, refetch } = useUserGrowth(range);

  const chartData = useMemo(() => {
    if (!growth || growth.points.length === 0) return null;
    return {
      labels: growth.points.map((p) => formatBucketLabel(p.date, growth.bucket_unit)),
      datasets: [
        {
          data: growth.points.map((p) => p.count),
          borderColor: '#00C8FF',
          backgroundColor: 'rgba(0,200,245,0.12)',
          tension: 0.35,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#00C8FF',
          pointHoverBorderColor: 'rgb(var(--color-bg))',
          borderWidth: 2,
        },
      ],
    };
  }, [growth]);

  const selectedLabel = RANGE_OPTIONS.find((r) => r.id === range)?.label;

  return (
    <div className="rounded-2xl border border-border bg-glass backdrop-blur-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">User Growth</h3>
        <div className="relative">
          <button
            onClick={() => setShowRangeMenu((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-bg text-xs font-medium text-text-secondary hover:text-text-primary hover:border-[#00C8FF]/30 transition"
          >
            {selectedLabel}
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showRangeMenu ? 'rotate-180' : ''}`} />
          </button>
          {showRangeMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowRangeMenu(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl border border-border bg-bg shadow-xl z-20 overflow-hidden">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setRange(opt.id);
                      setShowRangeMenu(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-sm transition ${
                      opt.id === range ? 'text-[#00C8FF] bg-[#00C8FF]/10' : 'text-text-primary hover:bg-glass'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl bg-bg animate-pulse" />
      ) : isError ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2 rounded-xl bg-bg text-center px-4">
          <p className="text-sm text-text-secondary">Unable to load dashboard data</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-lg transition"
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      ) : !chartData ? (
        <div className="h-64 flex items-center justify-center rounded-xl bg-bg">
          <p className="text-sm text-text-muted">No new users in this period</p>
        </div>
      ) : (
        <div className="h-64">
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                tooltip: {
                  backgroundColor: 'rgb(var(--color-bg))',
                  borderColor: 'rgb(var(--color-border))',
                  borderWidth: 1,
                  titleColor: 'rgb(var(--color-text-muted))',
                  bodyColor: 'rgb(var(--color-text-primary))',
                  padding: 10,
                  displayColors: false,
                  callbacks: {
                    label: (ctx) => `${ctx.parsed.y} new user${ctx.parsed.y === 1 ? '' : 's'}`,
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { color: 'rgb(var(--color-text-muted))', font: { size: 11 }, maxRotation: 0 },
                  border: { color: 'rgb(var(--color-border))' },
                },
                y: {
                  beginAtZero: true,
                  grid: { color: 'rgb(var(--color-border) / 0.5)' },
                  ticks: { color: 'rgb(var(--color-text-muted))', font: { size: 11 }, precision: 0 },
                  border: { display: false },
                },
              },
            }}
          />
        </div>
      )}
    </div>
  );
}