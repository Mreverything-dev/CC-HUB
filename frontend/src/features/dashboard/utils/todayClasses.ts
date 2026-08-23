// frontend/src/features/dashboard/utils/todayClasses.ts
import { TeachingAssignment } from '@/types/section.types';

export type ClassStatus = 'upcoming' | 'starting-now' | 'in-progress' | 'finished';

export interface TodayClassEntry {
  id: string;
  subject: string;
  scheduleStart: string; // "HH:MM:SS"
  scheduleEnd: string;
  /** Student view: "Prof. Juan Dela Cruz". Professor view: section name. */
  primaryMeta: string;
  /** Student view: section name. Professor view: "28 Students". */
  secondaryMeta?: string;
  status: ClassStatus;
  statusLabel: string;
  startMinutes: number;
}

const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_MS = 24 * 60 * 60 * 1000;

function toMinutes(hms: string): number {
  const [h, m] = hms.split(':').map(Number);
  return h * 60 + m;
}

/** The viewer's own local day abbreviation ("Mon", "Tue", ...) - matches
 * the exact strings AddSubjectModal's day picker writes to schedule_days,
 * derived via the same browser Intl/Date approach every other date helper
 * in this app already uses (see lib/formatters.ts) - no separate timezone
 * handling introduced. */
export function todayAbbrev(now: Date = new Date()): string {
  return now.toLocaleDateString('en-US', { weekday: 'short' });
}

/** "3:30 PM" from a "HH:MM:SS" string, in the viewer's own locale/clock
 * format - reuses the same toLocaleTimeString approach as formatTime in
 * lib/formatters.ts, just fed a wall-clock time instead of a Date. */
export function formatClockTime(hms: string): string {
  const [h, m] = hms.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatClockTime(start)} – ${formatClockTime(end)}`;
}

function statusFor(startMinutes: number, endMinutes: number, nowMinutes: number): { status: ClassStatus; label: string } {
  if (nowMinutes < startMinutes) {
    const diff = startMinutes - nowMinutes;
    if (diff <= 1) return { status: 'starting-now', label: 'Starting now' };
    if (diff < 60) return { status: 'upcoming', label: `Starts in ${diff} minute${diff === 1 ? '' : 's'}` };
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return { status: 'upcoming', label: `Starts in ${hours}h${mins ? ` ${mins}m` : ''}` };
  }
  if (nowMinutes <= endMinutes) return { status: 'in-progress', label: 'In progress' };
  return { status: 'finished', label: 'Finished' };
}

/** Builds today's class list (active assignments scheduled for today's
 * weekday only - never tomorrow's/yesterday's) sorted by start time, each
 * with a live status computed against `now`. `metaFor` maps one assignment
 * to its display lines - the only bit that differs between the student
 * view (professor name + section) and the professor view (section +
 * student count), so that difference lives at the call site instead of
 * inside this shared computation. */
export function buildTodayClasses<T extends TeachingAssignment>(
  assignments: T[],
  metaFor: (assignment: T) => { primaryMeta: string; secondaryMeta?: string },
  now: Date = new Date()
): TodayClassEntry[] {
  const today = todayAbbrev(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return assignments
    .filter((a) => a.status === 'active' && a.schedule_days.includes(today) && a.schedule_start && a.schedule_end)
    .map((a) => {
      const startMinutes = toMinutes(a.schedule_start);
      const endMinutes = toMinutes(a.schedule_end);
      const { status, label } = statusFor(startMinutes, endMinutes, nowMinutes);
      const { primaryMeta, secondaryMeta } = metaFor(a);
      return {
        id: a.id,
        subject: a.subject,
        scheduleStart: a.schedule_start,
        scheduleEnd: a.schedule_end,
        primaryMeta,
        secondaryMeta,
        status,
        statusLabel: label,
        startMinutes,
      };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

export interface NextUpcomingClass {
  assignment: TeachingAssignment;
  dayLabel: string; // "Tomorrow" or a weekday name
}

/** Best-effort "next scheduled class" search across the rest of the week
 * (today's own remaining classes are already covered by buildTodayClasses -
 * this only looks at days AFTER today), for the empty-state hint. Purely a
 * client-side scan over data already fetched; no new API call. */
export function findNextUpcomingClass<T extends TeachingAssignment>(
  assignments: T[],
  now: Date = new Date()
): { assignment: T; dayLabel: string } | null {
  const todayIdx = now.getDay();
  let best: { assignment: T; daysAhead: number } | null = null;

  for (const a of assignments) {
    if (a.status !== 'active') continue;
    for (const day of a.schedule_days) {
      const idx = DAY_INDEX[day];
      if (idx === undefined) continue;
      const daysAhead = (idx - todayIdx + 7) % 7;
      if (daysAhead === 0) continue; // today is handled by buildTodayClasses
      if (!best || daysAhead < best.daysAhead) {
        best = { assignment: a, daysAhead };
      }
    }
  }

  if (!best) return null;
  const dayLabel =
    best.daysAhead === 1
      ? 'Tomorrow'
      : new Date(now.getTime() + best.daysAhead * DAY_MS).toLocaleDateString('en-US', { weekday: 'long' });
  return { assignment: best.assignment, dayLabel };
}

/** Single-session duration in hours (e.g. 14:30-17:30 -> 3) - used for the
 * Classes page's "Total Hours" stat, kept as a shared export (rather than
 * the private copy already living inside ProfessorTeachingHub.tsx) so both
 * pages agree on the same definition. */
export function subjectDurationHours(a: Pick<TeachingAssignment, 'schedule_start' | 'schedule_end'>): number {
  if (!a.schedule_start || !a.schedule_end) return 0;
  const diff = toMinutes(a.schedule_end) - toMinutes(a.schedule_start);
  return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;
}

export type OccurrenceStatus = 'now' | 'next' | 'upcoming' | 'completed';

export interface ClassOccurrence {
  id: string;
  assignmentId: string;
  subject: string;
  day: string;
  scheduleStart: string;
  scheduleEnd: string;
  primaryMeta: string;
  secondaryMeta?: string;
  status: OccurrenceStatus;
  statusLabel: string;
  isToday: boolean;
  /** The full underlying assignment (section_id, professor_id/avatar/name,
   * etc.) - carried through so a page can wire up actions (open section,
   * message professor) without re-deriving IDs from the display strings. */
  assignment: TeachingAssignment;
  /** Minutes along a Mon-first weekly timeline, relative to right now -
   * negative means earlier this week (already happened), used purely for
   * sorting/picking "next", never displayed. */
  sortKey: number;
}

/** Expands every active assignment into one entry per scheduled day across
 * the CURRENT week (not a rolling 7-day window) - a Mon/Wed/Fri subject
 * produces three separate occurrences, each independently marked now/next/
 * upcoming/completed. Exactly one occurrence system-wide is ever "next" -
 * the single soonest one that hasn't started yet. `metaFor` is the same
 * per-viewer mapping buildTodayClasses already uses (professor name +
 * section for students; section + student count for professors). */
export function buildWeekOccurrences<T extends TeachingAssignment>(
  assignments: T[],
  metaFor: (assignment: T) => { primaryMeta: string; secondaryMeta?: string },
  now: Date = new Date()
): ClassOccurrence[] {
  const todayIdx = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  interface Raw {
    id: string;
    assignmentId: string;
    subject: string;
    day: string;
    scheduleStart: string;
    scheduleEnd: string;
    primaryMeta: string;
    secondaryMeta?: string;
    assignment: TeachingAssignment;
    weekdayOffset: number;
    startMinutes: number;
    sortKey: number;
  }

  const raw: Raw[] = [];
  for (const a of assignments) {
    if (a.status !== 'active' || !a.schedule_start || !a.schedule_end) continue;
    const { primaryMeta, secondaryMeta } = metaFor(a);
    for (const day of a.schedule_days) {
      const dayIdx = DAY_INDEX[day];
      if (dayIdx === undefined) continue;
      const weekdayOffset = dayIdx - todayIdx; // -6..6, 0 = today
      const startMinutes = toMinutes(a.schedule_start);
      raw.push({
        id: `${a.id}-${day}`,
        assignmentId: a.id,
        subject: a.subject,
        day,
        scheduleStart: a.schedule_start,
        scheduleEnd: a.schedule_end,
        primaryMeta,
        secondaryMeta,
        assignment: a,
        weekdayOffset,
        startMinutes,
        sortKey: weekdayOffset * 1440 + startMinutes,
      });
    }
  }

  let nextCandidate: Raw | null = null;
  const withStatus = raw.map((occ) => {
    let status: OccurrenceStatus;
    let statusLabel: string;
    if (occ.weekdayOffset < 0) {
      status = 'completed';
      statusLabel = 'Completed';
    } else if (occ.weekdayOffset === 0) {
      const endMinutes = toMinutes(occ.scheduleEnd);
      if (nowMinutes < occ.startMinutes) {
        status = 'upcoming';
        const diff = occ.startMinutes - nowMinutes;
        statusLabel =
          diff <= 1
            ? 'Starting now'
            : diff < 60
            ? `Starts in ${diff}m`
            : `Starts in ${Math.floor(diff / 60)}h${diff % 60 ? ` ${diff % 60}m` : ''}`;
      } else if (nowMinutes <= endMinutes) {
        status = 'now';
        statusLabel = 'In progress';
      } else {
        status = 'completed';
        statusLabel = 'Completed';
      }
    } else {
      status = 'upcoming';
      statusLabel = occ.weekdayOffset === 1 ? 'Tomorrow' : occ.day;
    }
    if (status === 'upcoming' && (!nextCandidate || occ.sortKey < nextCandidate.sortKey)) {
      nextCandidate = occ;
    }
    return { ...occ, status, statusLabel, isToday: occ.weekdayOffset === 0 };
  });

  const nextId = (nextCandidate as Raw | null)?.id;
  return withStatus
    .map((occ) =>
      occ.id === nextId ? { ...occ, status: 'next' as const, statusLabel: 'Next Class' } : occ
    )
    .sort((a, b) => {
      const rank = (s: OccurrenceStatus) => (s === 'now' ? 0 : s === 'next' ? 0 : s === 'upcoming' ? 1 : 2);
      const ra = rank(a.status);
      const rb = rank(b.status);
      return ra !== rb ? ra - rb : a.sortKey - b.sortKey;
    });
}
