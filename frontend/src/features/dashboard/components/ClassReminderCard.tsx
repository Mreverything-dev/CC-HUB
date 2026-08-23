// frontend/src/features/dashboard/components/ClassReminderCard.tsx
import { useEffect, useState } from 'react';
import { BookOpenIcon, ClockIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { TodayClassEntry, NextUpcomingClass, formatTimeRange, formatClockTime } from '../utils/todayClasses';

interface ClassReminderCardProps {
  greetingTitle: string;
  greetingSubtitle: string;
  /** Heading used inside the "full schedule" expand modal - e.g. "Today's
   * Schedule" for students, "Today's Teaching" for professors. */
  scheduleLabel: string;
  /** Every one of today's classes (including already-finished ones), oldest
   * first - the same computed list drives both the compact reminder and the
   * expand modal, so there's exactly one source of truth. */
  entries: TodayClassEntry[];
  nextUpcoming: NextUpcomingClass | null;
}

const ROTATE_MS = 6000;
const FADE_MS = 300;

/**
 * Replaces the dashboard's static greeting card with one that automatically
 * alternates between a normal welcome message and a live "today's classes"
 * status (next class + countdown, or a no-classes empty state) - a subtle
 * cross-fade, not a jarring swap, and never auto-advances so fast it
 * becomes distracting. Clicking it (once there's at least one class today)
 * opens the full today's schedule in a lightweight modal, reusing this same
 * `entries` list rather than fetching or computing anything new.
 */
export function ClassReminderCard({ greetingTitle, greetingSubtitle, scheduleLabel, entries, nextUpcoming }: ClassReminderCardProps) {
  const [phase, setPhase] = useState<'greeting' | 'status'>('greeting');
  const [fading, setFading] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setPhase((p) => (p === 'greeting' ? 'status' : 'greeting'));
        setFading(false);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, []);

  const activeEntries = entries.filter((e) => e.status !== 'finished');
  const highlighted = activeEntries[0] || null;
  const moreCount = Math.max(0, activeEntries.length - 1);
  const hasAnyToday = entries.length > 0;

  return (
    <>
      <div
        onClick={() => hasAnyToday && setShowSchedule(true)}
        className={`rounded-2xl border backdrop-blur-xl p-6 transition-all duration-200 ${
          phase === 'status' && highlighted
            ? 'border-[#00C8FF]/40 bg-[rgba(15,28,40,0.85)] shadow-[0_0_30px_rgba(0,200,255,0.08)]'
            : 'border-[rgba(0,200,245,0.18)] bg-[rgba(15,28,40,0.75)]'
        } ${hasAnyToday ? 'cursor-pointer hover:border-[#00C8FF]/40' : ''}`}
      >
        <div
          className={`transition-opacity ease-in-out ${fading ? 'opacity-0' : 'opacity-100'}`}
          style={{ transitionDuration: `${FADE_MS}ms` }}
        >
          {phase === 'greeting' ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-[#F1F5F9] break-words">{greetingTitle}</h1>
                <p className="text-sm text-[#94A3B8] mt-1">{greetingSubtitle}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#00C8FF]/30 bg-[#00C8FF]/10 shadow-[0_0_16px_rgba(0,200,245,0.12)]">
                <SparklesIcon className="h-5 w-5 text-[#00C8FF]" />
              </div>
            </div>
          ) : highlighted ? (
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#00C8FF]">
                  <BookOpenIcon className="h-3.5 w-3.5" />
                  {activeEntries.length > 1 ? 'Your Next Class' : "Today's Class"}
                </span>
                {moreCount > 0 && (
                  <span className="text-[11px] font-medium text-[#94A3B8] bg-white/5 border border-[#1E3447] rounded-full px-2.5 py-1">
                    +{moreCount} more today
                  </span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-[#F1F5F9] truncate">{highlighted.subject}</p>
                  <p className="text-sm text-[#94A3B8] mt-0.5 truncate">{highlighted.primaryMeta}</p>
                  {highlighted.secondaryMeta && (
                    <p className="text-xs text-[#64748B] mt-0.5 truncate">{highlighted.secondaryMeta}</p>
                  )}
                  <p className="text-xs text-[#64748B] mt-1.5">{formatTimeRange(highlighted.scheduleStart, highlighted.scheduleEnd)}</p>
                </div>
                <div
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold ${
                    highlighted.status === 'in-progress'
                      ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                      : highlighted.status === 'starting-now'
                      ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                      : 'bg-[#00C8FF]/10 text-[#00C8FF] border border-[#00C8FF]/25'
                  }`}
                >
                  <ClockIcon className="h-4 w-4" />
                  {highlighted.statusLabel}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[#F1F5F9]">No classes today 🎉</h2>
                <p className="text-sm text-[#94A3B8] mt-1">You're all clear for today.</p>
                {nextUpcoming && (
                  <p className="text-xs text-[#64748B] mt-1.5">
                    Next class: {nextUpcoming.dayLabel} • {formatClockTime(nextUpcoming.assignment.schedule_start)} •{' '}
                    {nextUpcoming.assignment.subject}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10">
                <span className="text-lg leading-none">🎉</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showSchedule && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50"
          onClick={() => setShowSchedule(false)}
        >
          <div
            className="bg-[#0D1722] w-full sm:max-w-md sm:rounded-2xl border border-[#1E3447] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#1E3447] flex-shrink-0">
              <h3 className="font-semibold text-[#F1F5F9]">{scheduleLabel}</h3>
              <button
                onClick={() => setShowSchedule(false)}
                className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-lg transition"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto themed-scrollbar p-3 space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-3 rounded-xl border ${
                    entry.status === 'finished'
                      ? 'border-[#1E3447] bg-[#0A111A] opacity-50'
                      : 'border-[#1E3447] bg-[#0A111A]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#00C8FF]">{formatClockTime(entry.scheduleStart)}</p>
                      <p className="text-sm font-semibold text-[#F1F5F9] truncate mt-0.5">{entry.subject}</p>
                      <p className="text-xs text-[#94A3B8] truncate mt-0.5">{entry.primaryMeta}</p>
                      {entry.secondaryMeta && <p className="text-xs text-[#64748B] truncate">{entry.secondaryMeta}</p>}
                    </div>
                    <span
                      className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                        entry.status === 'in-progress'
                          ? 'text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/25'
                          : entry.status === 'finished'
                          ? 'text-[#64748B] bg-white/5 border border-[#1E3447]'
                          : 'text-[#00C8FF] bg-[#00C8FF]/10 border border-[#00C8FF]/25'
                      }`}
                    >
                      {entry.status === 'finished' ? 'Done' : entry.statusLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
