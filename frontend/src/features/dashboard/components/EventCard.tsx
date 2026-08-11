// frontend/src/features/dashboard/components/EventCard.tsx
import { SparklesIcon, MapPinIcon } from '@heroicons/react/24/outline';

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
  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <SparklesIcon className="h-4 w-4 text-[#00d4ff]" />
          Upcoming Events
        </h3>
        <button className="text-xs text-[#00d4ff] hover:underline">View all</button>
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-[#6b6b6b] py-4 text-center">No upcoming events.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition"
            >
              <div className="flex-shrink-0 w-11 h-11 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] flex flex-col items-center justify-center">
                <span className="text-[9px] font-semibold text-[#00d4ff] leading-none">{event.month}</span>
                <span className="text-sm font-bold text-white leading-none mt-0.5">{event.day}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white font-medium truncate">{event.title}</p>
                <p className="text-xs text-[#6b6b6b] mt-0.5">{event.dateLabel}</p>
                <p className="text-xs text-[#6b6b6b] flex items-center gap-1 mt-0.5">
                  <MapPinIcon className="h-3 w-3" />
                  {event.location}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
