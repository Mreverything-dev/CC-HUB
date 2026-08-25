import { formatDistanceToNowStrict } from 'date-fns';

/**
 * Single entry point for turning a server timestamp into a Date. The
 * backend always sends an explicit UTC offset now (see
 * backend/app/core/db_types.py), but this stays defensive: a timestamp
 * string with no offset is parsed as if it were local time by the browser's
 * own `Date` constructor, which is exactly the "8 hours ago" bug for a
 * Manila (UTC+8) user - so a string with no recognizable offset is always
 * treated as UTC here instead of trusting the platform default.
 */
export function parseServerDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  const hasOffset = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(input.trim());
  return hasOffset ? new Date(input) : new Date(`${input}Z`);
}

/**
 * "just now" / "1 minute ago" / "2 hours ago" - the relative-time
 * formatter every feature (posts, comments, chat, announcements,
 * livestreams, notifications) should use so wording and parsing never
 * drift apart between pages.
 */
export function formatRelativeTime(input: Date | string): string {
  const date = parseServerDate(input);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

/**
 * Full local date/time, e.g. "Aug 13, 2026, 6:56 PM" - always the viewer's
 * own timezone via the browser's Intl/Date support, never a manual offset.
 */
export function formatAbsoluteTime(input: Date | string): string {
  return parseServerDate(input).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const formatDate = (date: Date | string) => {
  return parseServerDate(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatTime = (date: Date | string) => {
  return parseServerDate(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Chat-style relative time: "Just now", "2 mins ago", "1hr ago", "3d ago", then a short date.
export const formatChatTime = (date: Date | string) => {
  const target = parseServerDate(date).getTime();
  const seconds = Math.floor((Date.now() - target) / 1000);

  if (seconds < 45) return 'Just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}hr${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return parseServerDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Convert a <input type="datetime-local"> value (naive - meaning whatever
 * the viewer's own local wall-clock time is) into a proper UTC ISO string
 * with an explicit offset, so a Manila user scheduling "5:00 PM" sends a
 * timestamp that actually means 5:00 PM Manila time, not 5:00 PM UTC.
 */
export function localInputToUtcIso(localDateTimeValue: string): string {
  return new Date(localDateTimeValue).toISOString();
}

/** Today's date in the viewer's own local timezone, as YYYY-MM-DD (for a
 * date input's `min`) - not the UTC date, which can be a day off depending
 * on the time of day. */
export function todayLocalIso(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** "00:03:42" style elapsed-time clock, e.g. for a live stream's running
 * duration - always zero-padded HH:MM:SS regardless of how long it's been. */
export function formatDurationClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
