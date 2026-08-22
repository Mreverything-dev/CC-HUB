// frontend/src/features/livestream/components/pages/LivePage.tsx
import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { livestreamService } from '@/services/api/livestream.service';
import { useLiveSessionStore } from '../../store/liveSession.store';

/**
 * `/live/:streamId` is kept only as an entry point (deep links, and every
 * existing "Join Live"/"Go Live" call site that still navigates here) - the
 * actual player+chat is LiveStreamStage, mounted globally in App.tsx so it
 * survives navigation for minimize/PiP. This route just starts that shared
 * session and immediately hands control back to a real dashboard page, so
 * the Dashboard is always what's visible/interactive behind the stage.
 */
export default function LivePage() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const startSession = useLiveSessionStore((s) => s.startSession);
  const startedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!streamId || startedForRef.current === streamId) return;
    startedForRef.current = streamId;

    const dashboardPath =
      user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'professor' ? '/professor/dashboard' : '/student/dashboard';

    (async () => {
      try {
        const response = await livestreamService.getStream(streamId);
        startSession(streamId, response.data.is_host);
      } catch (error: any) {
        if (error.response?.status === 403) {
          toast.error("You don't have permission to view this stream");
        } else {
          toast.error('Failed to load stream');
        }
      } finally {
        navigate(dashboardPath, { replace: true });
      }
    })();
  }, [streamId]);

  return null;
}
