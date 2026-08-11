import { useEffect, useState } from 'react';

// Forces a re-render every `intervalMs` so relative-time labels (e.g. "2 mins ago")
// stay accurate without needing new data to arrive.
export function useTick(intervalMs: number = 30000) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
