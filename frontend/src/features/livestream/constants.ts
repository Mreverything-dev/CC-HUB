// frontend/src/features/livestream/constants.ts

// Streams have no dedicated category column on the backend (and we're not
// adding one - see GoLiveModal/LivestreamsPage). Instead, GoLiveModal tags a
// chosen category onto the stream's description as a hidden "#id" token, and
// LivestreamsPage's filter recognizes that tag first before falling back to
// a best-effort keyword match over the title/description text. Single source
// of truth for both sides so they can never drift out of sync.
export interface StreamCategoryOption {
  id: string;
  label: string;
}

export const STREAM_CATEGORIES: StreamCategoryOption[] = [
  { id: 'academic', label: 'Academic' },
  { id: 'technology', label: 'Technology' },
  { id: 'programming', label: 'Programming' },
  { id: 'events', label: 'Events' },
  { id: 'qna', label: 'Q&A' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'design', label: 'Design' },
  { id: 'other', label: 'Other' },
];

export const STREAM_CATEGORY_FILTER_OPTIONS: StreamCategoryOption[] = [
  { id: 'all', label: 'All' },
  ...STREAM_CATEGORIES,
];

export const STREAM_CATEGORY_KEYWORDS: Record<string, string[]> = {
  academic: ['academic', 'lecture', 'class', 'course', 'lesson', 'study', 'exam', 'thesis', 'review'],
  technology: ['tech', 'software', 'ai', 'data', 'cyber', 'it '],
  programming: ['programming', 'coding', 'code', 'developer', 'web dev', 'app dev'],
  events: ['event', 'seminar', 'workshop', 'conference', 'meetup', 'orientation', 'ceremony', 'webinar'],
  qna: ['q&a', 'q & a', 'question', 'ask me', 'ama'],
  gaming: ['game', 'gaming', 'esports', 'play'],
  design: ['design', 'ui', 'ux', 'figma', 'creative', 'art'],
};

/** Hidden hashtag appended to a stream's description when a category is chosen. */
export function categoryTag(categoryId: string): string {
  return `#${categoryId}`;
}

export function matchesStreamCategory(title: string, description: string | undefined, categoryId: string): boolean {
  if (categoryId === 'all') return true;
  const text = `${title} ${description || ''}`.toLowerCase();

  // An explicit tag from GoLiveModal always wins over guessing from keywords.
  const explicitTag = STREAM_CATEGORIES.find((c) => text.includes(categoryTag(c.id)));
  if (explicitTag) return explicitTag.id === categoryId;

  const anyKeywordMatch = Object.values(STREAM_CATEGORY_KEYWORDS).some((keywords) => keywords.some((k) => text.includes(k)));
  if (categoryId === 'other') return !anyKeywordMatch;
  return (STREAM_CATEGORY_KEYWORDS[categoryId] || []).some((k) => text.includes(k));
}
