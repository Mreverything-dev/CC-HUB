// frontend/src/features/dashboard/hooks/useGlobalSearch.ts
import { useEffect, useMemo, useState } from 'react';
import { useUsers } from '@/features/users/hooks/useUsers';
import { Post } from '@/services/api/post.service';
import { Announcement } from '@/types/announcement.types';
import { Section } from '@/types/section.types';

const RESULT_LIMIT = 5;
const DEBOUNCE_MS = 300;

/**
 * Global search over people/posts/announcements/sections.
 *
 * - People: the existing GET /users/search endpoint (already reused by Find
 *   People and Add Student) - a real backend query, not client-filtered.
 * - Posts/announcements/sections: filtered client-side over data the parent
 *   dashboard already fetched via useFeed()/useAnnouncements()/useSections()
 *   - each of those endpoints already scopes results to what the current
 *   viewer is authorized to see (visibility/friends/section rules enforced
 *   server-side), so filtering over them is visibility-safe by construction
 *   without a new backend search endpoint. This mirrors the same pattern
 *   ProfessorTeachingHub's and SectionDashboard's own student search already
 *   use. Note this only searches whatever page of posts/announcements is
 *   already loaded, not the viewer's entire history.
 */
export function useGlobalSearch(
  query: string,
  data: { posts: Post[]; announcements: Announcement[]; sections: Section[] }
) {
  const { users, isLoading: peopleLoading, searchUsers } = useUsers();
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const hasQuery = debouncedQuery.length >= 2;

  useEffect(() => {
    if (hasQuery) searchUsers(debouncedQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, hasQuery]);

  const q = debouncedQuery.toLowerCase();

  const posts = useMemo(() => {
    if (!hasQuery) return [];
    return data.posts
      .filter((p) => p.content?.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))
      .slice(0, RESULT_LIMIT);
  }, [data.posts, q, hasQuery]);

  const announcements = useMemo(() => {
    if (!hasQuery) return [];
    return data.announcements
      .filter((a) => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q))
      .slice(0, RESULT_LIMIT);
  }, [data.announcements, q, hasQuery]);

  const sections = useMemo(() => {
    if (!hasQuery) return [];
    return data.sections
      .filter((s) => s.name.toLowerCase().includes(q) || (s.course || '').toLowerCase().includes(q))
      .slice(0, RESULT_LIMIT);
  }, [data.sections, q, hasQuery]);

  const people = hasQuery ? users.slice(0, RESULT_LIMIT) : [];

  const hasResults = people.length > 0 || posts.length > 0 || announcements.length > 0 || sections.length > 0;

  return {
    people,
    posts,
    announcements,
    sections,
    isLoading: hasQuery && peopleLoading,
    hasQuery,
    hasResults,
  };
}

export type GlobalSearchResults = ReturnType<typeof useGlobalSearch>;
