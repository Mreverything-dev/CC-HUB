// frontend/src/features/livestream/utils/participantName.ts
interface NameFields {
  username: string;
  first_name?: string | null;
  last_name?: string | null;
}

/**
 * "Last Name, First Name" when both names are on record (from the person's
 * role-specific profile) - falls back to their username when either is
 * missing, same fallback every other "full name" surface in this app uses
 * for a user without a completed profile.
 */
export function formatParticipantName(entry: NameFields): string {
  if (entry.first_name && entry.last_name) {
    return `${entry.last_name}, ${entry.first_name}`;
  }
  return entry.username;
}

/**
 * Sort key for alphabetical-by-last-name ordering - falls back to username
 * for anyone without both names on record, so they still sort predictably
 * instead of clumping at one end of the list.
 */
export function participantSortKey(entry: NameFields): string {
  const key = entry.first_name && entry.last_name ? entry.last_name : entry.username;
  return key.toLowerCase();
}

/** Sorts a copy of `entries` alphabetically by participantSortKey. */
export function sortParticipants<T extends NameFields>(entries: T[]): T[] {
  return [...entries].sort((a, b) => participantSortKey(a).localeCompare(participantSortKey(b)));
}
