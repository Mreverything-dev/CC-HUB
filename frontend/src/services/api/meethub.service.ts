// frontend/src/services/api/meethub.service.ts
import { api } from '@/lib/axios';
import { MeethubSession, MeethubSessionCreate, SpeakRequest, AttendanceRecord, AttendanceRosterEntry, AttendanceStatus } from '@/types/meethub.types';

export const meethubService = {
  createSession: (data: MeethubSessionCreate) =>
    api.post<MeethubSession>('/meethub/sessions', data),

  getMySessions: (status?: string) =>
    api.get<MeethubSession[]>(`/meethub/sessions?status=${status || ''}`),

  getSession: (sessionId: string) =>
    api.get<MeethubSession>(`/meethub/sessions/${sessionId}`),

  // Looked up from a plain livestream id - used by whatever mounts inside
  // /live/:streamId to find out whether it's rendering a Meethub session.
  getSessionByStream: (livestreamId: string) =>
    api.get<MeethubSession>(`/meethub/sessions/by-stream/${livestreamId}`),

  requestToSpeak: (sessionId: string) =>
    api.post<SpeakRequest>(`/meethub/sessions/${sessionId}/speak-requests`),

  cancelMySpeakRequest: (sessionId: string) =>
    api.delete(`/meethub/sessions/${sessionId}/speak-requests/me`),

  listSpeakRequests: (sessionId: string, status: string = 'pending') =>
    api.get<SpeakRequest[]>(`/meethub/sessions/${sessionId}/speak-requests?status=${status}`),

  approveSpeakRequest: (sessionId: string, requestId: string) =>
    api.post<SpeakRequest>(`/meethub/sessions/${sessionId}/speak-requests/${requestId}/approve`),

  denySpeakRequest: (sessionId: string, requestId: string) =>
    api.post<SpeakRequest>(`/meethub/sessions/${sessionId}/speak-requests/${requestId}/deny`),

  getAttendance: (sessionId: string) =>
    api.get<AttendanceRosterEntry[]>(`/meethub/sessions/${sessionId}/attendance`),

  getMyAttendance: (sessionId: string) =>
    api.get<AttendanceRecord | null>(`/meethub/sessions/${sessionId}/attendance/me`),

  markAttendance: (sessionId: string, userId: string, status: AttendanceStatus, notes?: string) =>
    api.put<AttendanceRecord>(`/meethub/sessions/${sessionId}/attendance`, { user_id: userId, status, notes }),
};
