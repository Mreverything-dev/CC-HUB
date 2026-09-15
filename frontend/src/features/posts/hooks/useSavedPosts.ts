// frontend/src/features/posts/hooks/useSavedPosts.ts
import { useSyncExternalStore, useCallback } from 'react';

const STORAGE_KEY = 'ccs-hub-saved-posts';

export interface SavedPost {
  id: string;
  user_id: string;
  username: string;
  user_role: string;
  avatar_url?: string | null;
  content: string;
  type: string;
  visibility: string;
  media_urls?: string[];
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  is_liked_by_current_user: boolean;
  is_shared_by_current_user: boolean;
  is_owned_by_current_user: boolean;
  reactions_count?: number;
  reaction_breakdown?: Record<string, number>;
  my_reaction?: string | null;
}

let listeners: Array<() => void> = [];
let cachedRaw: string | null = null;
let cachedPosts: SavedPost[] = [];

function getSnapshot(): SavedPost[] {
  const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (raw === cachedRaw) return cachedPosts;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    // Filter out invalid entries (missing critical fields)
    cachedPosts = Array.isArray(parsed)
      ? parsed.filter((p) => p && typeof p.id === 'string' && typeof p.created_at === 'string')
      : [];
  } catch {
    cachedPosts = [];
  }
  return cachedPosts;
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notify() {
  listeners.forEach((l) => l());
}

function writeSaved(posts: SavedPost[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  cachedRaw = null;
  notify();
}

export function useSavedPosts() {
  const savedPosts = useSyncExternalStore(subscribe, getSnapshot, () => []);

  const isSaved = useCallback(
    (postId: string) => savedPosts.some((p) => p.id === postId),
    [savedPosts]
  );

  const toggleSave = useCallback((post: SavedPost) => {
    const current = getSnapshot();
    const exists = current.some((p) => p.id === post.id);
    const next = exists
      ? current.filter((p) => p.id !== post.id)
      : [...current, post];
    writeSaved(next);
  }, []);

  return { savedPosts, isSaved, toggleSave };
}