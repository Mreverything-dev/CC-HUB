// frontend/src/types/meethub.types.ts
import { StreamStatus, StreamVisibility } from './livestream.types';

export interface MeethubSession {
  id: string;
  livestream_id: string;
  organizer_id: string;
  organizer_username: string;
  organizer_avatar?: string | null;
  organizer_role: 'student' | 'professor' | 'admin';
  teaching_assignment_id?: string | null;
  is_official: boolean;
  title: string;
  description?: string;
  visibility: StreamVisibility;
  target_section_ids: string[];
  thumbnail_url?: string | null;
  status: StreamStatus;
  viewer_count: number;
  allow_participant_camera: boolean;
  allow_participant_mic: boolean;
  entry_start?: string | null;
  entry_deadline?: string | null;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
  is_organizer: boolean;
}

export interface MeethubSessionCreate {
  title: string;
  description?: string;
  visibility: StreamVisibility;
  target_section_ids?: string[];
  thumbnail_url?: string | null;
  teaching_assignment_id?: string | null;
  allow_participant_camera?: boolean;
  allow_participant_mic?: boolean;
  entry_start?: string | null;
  entry_deadline?: string | null;
}

export type SpeakRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled' | 'completed';

export interface SpeakRequest {
  id: string;
  meethub_session_id: string;
  user_id: string;
  username: string;
  avatar?: string | null;
  status: SpeakRequestStatus;
  requested_at: string;
  resolved_at?: string | null;
}

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export interface AttendanceRecord {
  user_id: string;
  username: string;
  avatar?: string | null;
  status: AttendanceStatus;
  first_joined_at?: string | null;
  marked_at?: string | null;
  notes?: string | null;
}

/** One section student, merged with any attendance record for this specific
 * Meethub session. `status` is null when the student simply hasn't been
 * marked yet - that is NOT the same thing as 'absent'. */
export interface AttendanceRosterEntry {
  user_id: string;
  username: string;
  avatar?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role: string;
  is_officer: boolean;
  is_mayor: boolean;
  is_online: boolean;
  status: AttendanceStatus | null;
  first_joined_at?: string | null;
  marked_at?: string | null;
  notes?: string | null;
}
