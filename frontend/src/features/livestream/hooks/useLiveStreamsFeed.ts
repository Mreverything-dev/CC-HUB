// frontend/src/features/livestream/hooks/useLiveStreamsFeed.ts
import { useEffect, useState } from 'react';
import { livestreamService } from '@/services/api/livestream.service';
import { Livestream } from '@/types/livestream.types';
import { socketService } from '@/lib/socket';
import { useChatStore } from '@/features/chat/store/chat.store';

/**
 * Dashboard-facing "active livestreams" feed: fetches once on mount, then
 * stays live via the app's existing Socket.IO connection - a stream
 * starting/ending broadcasts stream:started/stream:ended app-wide (see
 * backend app/api/v1/endpoints/livestream.py), so every dashboard reflects
 * it immediately instead of only on the next full page load.
 */
export function useLiveStreamsFeed(includeUpcoming = false) {
  const isSocketConnected = useChatStore((s) => s.isConnected);
  const [liveStreams, setLiveStreams] = useState<Livestream[]>([]);
  const [upcomingStreams, setUpcomingStreams] = useState<Livestream[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      livestreamService.getStreams('live'),
      includeUpcoming ? livestreamService.getStreams('scheduled') : Promise.resolve({ data: [] as Livestream[] }),
    ])
      .then(([liveRes, upcomingRes]) => {
        if (cancelled) return;
        setLiveStreams(liveRes.data);
        setUpcomingStreams(upcomingRes.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [includeUpcoming]);

  useEffect(() => {
    if (!isSocketConnected) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleStarted = (stream: Livestream) => {
      setLiveStreams((prev) => (prev.some((s) => s.id === stream.id) ? prev : [stream, ...prev]));
      setUpcomingStreams((prev) => prev.filter((s) => s.id !== stream.id));
    };

    const handleEnded = (data: { stream_id: string }) => {
      setLiveStreams((prev) => prev.filter((s) => s.id !== data.stream_id));
    };

    socket.on('stream:started', handleStarted);
    socket.on('stream:ended', handleEnded);
    return () => {
      socket.off('stream:started', handleStarted);
      socket.off('stream:ended', handleEnded);
    };
  }, [isSocketConnected]);

  return { liveStreams, upcomingStreams, isLoading };
}
