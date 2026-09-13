// frontend/src/features/dashboard/components/EventCard.tsx
import { useEffect, useState } from 'react';
import { SparklesIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useMinimumLoading } from '@/features/dashboard/hooks/useMinimumLoading';

export interface DashboardEvent {
  id: string;
  month: string;
  day: string;
  title: string;
  dateLabel: string;
  location: string;
}

// No events backend exists yet - sample data until that feature is built.
export const SAMPLE_EVENTS: DashboardEvent[] = [
  {
    id: '1',
    month: 'SEP',
    day: '12',
    title: 'CCS Hackathon 2025',
    dateLabel: 'Sep 13-14, 2025 • 9:00 AM',
    location: 'CCS Lab 3',
  },
  {
    id: '2',
    month: 'SEP',
    day: '20',
    title: 'Web Dev Workshop',
    dateLabel: 'Sep 2025 • TBD',
    location: 'TBD',
  },
];

interface EventCardListProps {
  events?: DashboardEvent[];
}

export function EventCardList({ events = SAMPLE_EVENTS }: EventCardListProps) {
  // ✅ Simulate a loading state for the first 3 seconds so the widget
  // shows a skeleton instead of instantly popping in.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const showSkeleton = useMinimumLoading(isLoading, 3000);

  return (
    <div className="rounded-2xl border border-border bg-glass backdrop-blur-xl p-4 sm:p-5 transition hover:border-[#00C8FF]/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <SparklesIcon className="h-4 w-4 text-[#00C8FF]" />
          Upcoming Events
        </h3>
        <button className="text-xs text-[#00C8FF] hover:text-[#00E0FF] hover:underline">View all</button>
      </div>

      {showSkeleton ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={`event-skeleton-${i}`} className="flex items-center gap-3 px-2 py-2 animate-pulse">
              <div className="flex-shrink-0 w-11 h-11 rounded-xl border border-border bg-bg" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-border" />
                <div className="h-2 w-1/2 rounded bg-border" />
                <div className="h-2 w-2/3 rounded bg-border" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-text-muted py-4 text-center">No upcoming events.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-glass transition"
            >
              <div className="flex-shrink-0 w-11 h-11 rounded-xl border border-border bg-bg flex flex-col items-center justify-center">
                <span className="text-[9px] font-semibold text-[#00C8FF] leading-none">{event.month}</span>
                <span className="text-sm font-bold text-text-primary leading-none mt-0.5">{event.day}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-primary font-medium truncate">{event.title}</p>
                <p className="text-xs text-text-muted mt-0.5 truncate">{event.dateLabel}</p>
                <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                  <MapPinIcon className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{event.location}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}