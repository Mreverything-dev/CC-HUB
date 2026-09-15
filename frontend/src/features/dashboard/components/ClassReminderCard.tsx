// frontend/src/features/dashboard/components/ClassReminderCard.tsx
import { useEffect, useState } from 'react';
import {
  BookOpenIcon,
  ClockIcon,
  XMarkIcon,
  AcademicCapIcon,
  CalendarIcon,
  ChevronRightIcon,
  UserIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { TodayClassEntry, NextUpcomingClass, formatTimeRange, formatClockTime } from '../utils/todayClasses';

const TYPE_SPEED_MS = 32;
const LINE_PAUSE_MS = 220;

function useTypewriterSequence(lines: string[], speed: number = TYPE_SPEED_MS, linePause: number = LINE_PAUSE_MS) {
  const [displayed, setDisplayed] = useState<string[]>(() => lines.map(() => ''));
  const [activeIndex, setActiveIndex] = useState(0);
  const key = lines.join(' ');

  useEffect(() => {
    setDisplayed(lines.map(() => ''));
    setActiveIndex(0);

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const typeLine = (lineIndex: number) => {
      if (cancelled || lineIndex >= lines.length) return;
      const full = lines[lineIndex];
      let charIndex = 0;

      const step = () => {
        if (cancelled) return;
        charIndex += 1;
        setDisplayed((prev) => {
          const next = [...prev];
          next[lineIndex] = full.slice(0, charIndex);
          return next;
        });
        if (charIndex < full.length) {
          timeoutId = setTimeout(step, speed);
        } else {
          timeoutId = setTimeout(() => {
            if (cancelled) return;
            setActiveIndex(lineIndex + 1);
            typeLine(lineIndex + 1);
          }, linePause);
        }
      };

      step();
    };

    typeLine(0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { displayed, activeIndex };
}

function TypingCursor() {
  return (
    <span
      className="typing-cursor inline-block w-[2px] h-[0.85em] bg-text-primary ml-0.5 align-middle rounded-full"
      aria-hidden="true"
    />
  );
}

interface ClassReminderCardProps {
  scheduleLabel: string;
  entries: TodayClassEntry[];
  nextUpcoming: NextUpcomingClass | null;
  coverPhoto?: string;
}

export function ClassReminderCard({
  scheduleLabel,
  entries,
  nextUpcoming,
  coverPhoto
}: ClassReminderCardProps) {
  const [showSchedule, setShowSchedule] = useState(false);

  const activeEntries = entries.filter((e) => e.status !== 'finished');
  const highlighted = activeEntries[0] || null;
  const moreCount = Math.max(0, activeEntries.length - 1);
  const hasAnyToday = entries.length > 0;

  const typingLines = highlighted
    ? [
        activeEntries.length > 1 ? 'Your Next Class' : "Today's Class",
        highlighted.subject,
        highlighted.primaryMeta,
        highlighted.secondaryMeta || '',
        formatTimeRange(highlighted.scheduleStart, highlighted.scheduleEnd),
      ]
    : hasAnyToday
    ? [
        'No more classes today',
        "You're all clear — enjoy the rest of your day! 🎉",
        nextUpcoming
          ? `Next: ${nextUpcoming.assignment.subject}${
              nextUpcoming.assignment.subject_code ? ` (${nextUpcoming.assignment.subject_code})` : ''
            } · ${nextUpcoming.dayLabel} at ${formatClockTime(nextUpcoming.assignment.schedule_start)}`
          : '',
        nextUpcoming?.primaryMeta || '',
        nextUpcoming?.assignment.room || '',
      ]
    : [
        'No classes today',
        "You're all clear — enjoy your day! 🎉",
        nextUpcoming
          ? `Next: ${nextUpcoming.assignment.subject}${
              nextUpcoming.assignment.subject_code ? ` (${nextUpcoming.assignment.subject_code})` : ''
            } · ${nextUpcoming.dayLabel} at ${formatClockTime(nextUpcoming.assignment.schedule_start)}`
          : '',
        nextUpcoming?.primaryMeta || '',
        nextUpcoming?.assignment.room || '',
      ];
  const { displayed: typed, activeIndex: typingIndex } = useTypewriterSequence(typingLines);

  return (
    <>
      <div
        onClick={() => hasAnyToday && setShowSchedule(true)}
        className={`relative rounded-3xl border bg-glass backdrop-blur-xl transition-all duration-200 overflow-hidden ${
          highlighted
            ? 'border-text-primary/30 shadow-md'
            : 'border-border'
        } ${hasAnyToday ? 'cursor-pointer hover:border-text-primary/40' : ''}`}
      >
        {coverPhoto && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-right sm:bg-[85%_center] lg:bg-[70%_center]"
              style={{ backgroundImage: `url(${coverPhoto})` }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.75) 100%)',
              }}
              aria-hidden="true"
            />
          </>
        )}

        <div className="relative p-5 sm:p-6">
          {highlighted ? (
            <div>
              <div className="flex items-center justify-between gap-3 mb-3.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-glass px-3.5 py-1 text-[10px] font-bold uppercase tracking-widest text-text-primary">
                  <BookOpenIcon className="h-3.5 w-3.5" />
                  {typed[0]}
                  {typingIndex === 0 && <TypingCursor />}
                </span>
                {moreCount > 0 && (
                  <span className="text-[11px] font-medium text-text-secondary bg-glass border border-border rounded-full px-3.5 py-1 flex-shrink-0">
                    +{moreCount} more today
                  </span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div className="min-w-0">
                  <h2 className={`text-xl sm:text-2xl font-extrabold tracking-tight truncate ${coverPhoto ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]' : 'text-text-primary'}`}>
                    {typed[1]}
                    {typingIndex === 1 && <TypingCursor />}
                  </h2>
                  <p className={`text-sm font-medium mt-1 truncate ${coverPhoto ? 'text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]' : 'text-text-secondary'}`}>
                    {typed[2]}
                    {typingIndex === 2 && <TypingCursor />}
                  </p>
                  {highlighted.secondaryMeta && (
                    <p className="text-xs text-text-muted mt-0.5 truncate">
                      {typed[3]}
                      {typingIndex === 3 && <TypingCursor />}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-glass px-2.5 py-1 text-xs font-medium text-text-secondary">
                      <ClockIcon className="h-3.5 w-3.5 text-text-secondary" />
                      {typed[4]}
                      {typingIndex === 4 && <TypingCursor />}
                    </span>
                    {highlighted.status === 'in-progress' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        In progress
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold ${
                    highlighted.status === 'in-progress'
                      ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                      : highlighted.status === 'starting-now'
                      ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                      : 'bg-glass text-text-primary border border-border'
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
                <h2 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${coverPhoto ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]' : 'text-text-primary'}`}>
                  {typed[0]}
                  {typingIndex === 0 && <TypingCursor />}
                </h2>
                <p className={`text-sm mt-1 ${coverPhoto ? 'text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]' : 'text-text-secondary'}`}>
                  {typed[1]}
                  {typingIndex === 1 && <TypingCursor />}
                </p>
                {nextUpcoming && (
                  <div className={`mt-3 inline-flex flex-col items-start gap-1.5 rounded-xl border backdrop-blur-sm px-3.5 py-3 max-w-full ${coverPhoto ? 'border-white/20 bg-black/40' : 'border-border bg-glass'}`}>
                    <p className={`text-xs flex items-start gap-2 ${coverPhoto ? 'text-white/90' : 'text-text-secondary'}`}>
                      <CalendarIcon className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${coverPhoto ? 'text-white' : 'text-text-primary'}`} />
                      <span className="min-w-0">
                        Next: <span className={`font-semibold ${coverPhoto ? 'text-white' : 'text-text-primary'}`}>{typed[2]}</span>
                        {typingIndex === 2 && <TypingCursor />}
                      </span>
                    </p>
                    {nextUpcoming.primaryMeta && (
                      <p className={`text-xs flex items-center gap-2 ${coverPhoto ? 'text-white/80' : 'text-text-secondary'}`}>
                        <UserIcon className={`h-3.5 w-3.5 flex-shrink-0 ${coverPhoto ? 'text-white/70' : 'text-text-muted'}`} />
                        {typed[3]}
                        {typingIndex === 3 && <TypingCursor />}
                      </p>
                    )}
                    {nextUpcoming.assignment.room && (
                      <p className={`text-xs flex items-center gap-2 ${coverPhoto ? 'text-white/80' : 'text-text-muted'}`}>
                        <MapPinIcon className={`h-3.5 w-3.5 flex-shrink-0 ${coverPhoto ? 'text-white/70' : 'text-text-muted'}`} />
                        {typed[4]}
                        {typingIndex === 4 && <TypingCursor />}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {hasAnyToday && (
            <div className="mt-4 pt-3.5 border-t border-border/50 flex items-center justify-between">
              <span className="text-xs text-text-muted flex items-center gap-1.5">
                <AcademicCapIcon className="h-3.5 w-3.5" />
                {entries.length} class{entries.length > 1 ? 'es' : ''} today
              </span>
              <span className="text-xs font-medium text-text-primary hover:underline transition flex items-center gap-1">
                View full schedule
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </span>
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
            className="bg-bg w-full sm:max-w-md sm:rounded-2xl border border-border shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex-shrink-0">
              {coverPhoto && (
                <div
                  className="h-24 sm:h-32 bg-cover bg-right"
                  style={{ backgroundImage: `url(${coverPhoto})` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg" />
                </div>
              )}
              <div className={`flex items-center justify-between p-4 ${coverPhoto ? 'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent' : 'border-b border-border'}`}>
                <h3 className={`font-semibold ${coverPhoto ? 'text-white' : 'text-text-primary'}`}>{scheduleLabel}</h3>
                <button
                  onClick={() => setShowSchedule(false)}
                  className={`p-1.5 rounded-lg transition ${coverPhoto ? 'text-white hover:bg-white/10' : 'text-text-secondary hover:text-text-primary hover:bg-glass'}`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto themed-scrollbar p-3 space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-3 rounded-xl border ${
                    entry.status === 'finished'
                      ? 'border-border bg-glass opacity-70'
                      : entry.status === 'in-progress'
                      ? 'border-[#22C55E]/30 bg-[#22C55E]/5'
                      : 'border-border bg-glass'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-primary">{formatClockTime(entry.scheduleStart)}</p>
                      <p className="text-sm font-semibold text-text-primary truncate mt-0.5">{entry.subject}</p>
                      <p className="text-xs text-text-secondary truncate mt-0.5">{entry.primaryMeta}</p>
                      {entry.secondaryMeta && <p className="text-xs text-text-secondary truncate">{entry.secondaryMeta}</p>}
                    </div>
                    <span
                      className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                        entry.status === 'in-progress'
                          ? 'text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/25'
                          : entry.status === 'finished'
                          ? 'text-text-secondary bg-glass border border-border'
                          : 'text-text-primary bg-glass border border-border'
                      }`}
                    >
                      {entry.status === 'finished' ? 'Done' : entry.statusLabel}
                    </span>
                  </div>
                  {entry.status === 'in-progress' && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      In progress
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}