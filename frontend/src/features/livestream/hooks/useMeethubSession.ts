// frontend/src/features/livestream/hooks/useMeethubSession.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { socketService } from '@/lib/socket';
import { meethubService } from '@/services/api/meethub.service';
import { MeethubSession, SpeakRequest, AttendanceRosterEntry, AttendanceStatus } from '@/types/meethub.types';

interface SpeakRequestedPayload {
  session_id: string;
  user_id: string;
  username: string;
  request_id: string;
}

interface SpeakRequestResolvedPayload {
  session_id: string;
  request_id: string;
  status: string;
}

interface AttendanceUpdatedPayload {
  session_id: string;
  user_id: string;
  status: AttendanceStatus;
}

/**
 * Meethub session data + the "Request to Speak" / attendance side of the
 * feature - used by MeethubRoom.tsx. This is purely a classroom
 * notification/attendance layer: approving or denying a raised hand has no
 * effect on anyone's camera or microphone (see useMeethubMeshSignaling for
 * that) - every participant controls their own media independently.
 */
export function useMeethubSession(sessionId: string | null, isSocketConnected: boolean) {
  const [session, setSession] = useState<MeethubSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSpeakRequests, setPendingSpeakRequests] = useState<SpeakRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRosterEntry[]>([]);
  const sessionIdRef = useRef<string | null>(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setSession(null);
    setPendingSpeakRequests([]);
    setAttendance([]);
    if (!sessionId) {
      setIsLoading(false);
      return;
    }
    meethubService
      .getSession(sessionId)
      .then((res) => {
        if (cancelled) return;
        setSession(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const refreshPendingRequests = useCallback(() => {
    if (!sessionIdRef.current) return;
    meethubService
      .listSpeakRequests(sessionIdRef.current, 'pending')
      .then((res) => setPendingSpeakRequests(res.data))
      .catch(() => {});
  }, []);

  const refreshAttendance = useCallback(() => {
    if (!sessionIdRef.current) return;
    meethubService
      .getAttendance(sessionIdRef.current)
      .then((res) => setAttendance(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    if (session.is_organizer) refreshPendingRequests();
    if (session.is_official) refreshAttendance();
  }, [session?.id, session?.is_organizer, session?.is_official, refreshPendingRequests, refreshAttendance]);

  useEffect(() => {
    if (!isSocketConnected || !session) return;
    const sid = session.id;
    const isOrganizer = session.is_organizer;

    const handleSpeakRequested = (data: SpeakRequestedPayload) => {
      if (data.session_id !== sid || !isOrganizer) return;
      refreshPendingRequests();
    };

    const handleSpeakRequestResolved = (data: SpeakRequestResolvedPayload) => {
      if (data.session_id !== sid) return;
      setPendingSpeakRequests((prev) => prev.filter((r) => r.id !== data.request_id));
    };

    const handleAttendanceUpdated = (data: AttendanceUpdatedPayload) => {
      if (data.session_id !== sid) return;
      refreshAttendance();
    };

    socketService.on('meeting:speak_requested', handleSpeakRequested);
    socketService.on('meeting:speak_request_resolved', handleSpeakRequestResolved);
    socketService.on('meeting:attendance_updated', handleAttendanceUpdated);
    return () => {
      socketService.off('meeting:speak_requested', handleSpeakRequested);
      socketService.off('meeting:speak_request_resolved', handleSpeakRequestResolved);
      socketService.off('meeting:attendance_updated', handleAttendanceUpdated);
    };
  }, [isSocketConnected, session, refreshPendingRequests, refreshAttendance]);

  const requestToSpeak = useCallback(async () => {
    if (!sessionIdRef.current) return;
    await meethubService.requestToSpeak(sessionIdRef.current);
  }, []);

  const cancelMyRequest = useCallback(async () => {
    if (!sessionIdRef.current) return;
    await meethubService.cancelMySpeakRequest(sessionIdRef.current);
  }, []);

  const approve = useCallback(async (requestId: string) => {
    if (!sessionIdRef.current) return;
    await meethubService.approveSpeakRequest(sessionIdRef.current, requestId);
    setPendingSpeakRequests((prev) => prev.filter((r) => r.id !== requestId));
  }, []);

  const deny = useCallback(async (requestId: string) => {
    if (!sessionIdRef.current) return;
    await meethubService.denySpeakRequest(sessionIdRef.current, requestId);
    setPendingSpeakRequests((prev) => prev.filter((r) => r.id !== requestId));
  }, []);

  const markAttendance = useCallback(
    async (userId: string, status: AttendanceStatus) => {
      if (!sessionIdRef.current) return;
      await meethubService.markAttendance(sessionIdRef.current, userId, status);
      refreshAttendance();
    },
    [refreshAttendance]
  );

  return {
    session,
    isLoading,
    pendingSpeakRequests,
    attendance,
    requestToSpeak,
    cancelMyRequest,
    approve,
    deny,
    markAttendance,
  };
}
