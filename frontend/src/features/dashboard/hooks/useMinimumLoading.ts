// frontend/src/features/dashboard/hooks/useMinimumLoading.ts
import { useEffect, useState } from 'react';

/**
 * Returns `true` for at least `minimumMs` milliseconds after the component
 * mounts, even if `isLoading` becomes false sooner. Useful for showing a
 * skeleton for a guaranteed minimum amount of time so the UI doesn't flash
 * content in and out too quickly.
 */
export function useMinimumLoading(isLoading: boolean, minimumMs: number = 5000): boolean {
  const [hasMetMinimum, setHasMetMinimum] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHasMetMinimum(true), minimumMs);
    return () => clearTimeout(timer);
  }, [minimumMs]);

  return isLoading || !hasMetMinimum;
}