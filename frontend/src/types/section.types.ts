// frontend/src/types/section.types.ts
export interface SectionMember {
  id: string;
  section_id: string;
  user_id: string;
  role: string;
  is_officer: boolean;
  is_mayor: boolean;
  joined_at: string;
  user_email?: string | null;
  user_username?: string | null;
  user_avatar?: string | null;
  user_first_name?: string | null;
  user_last_name?: string | null;
}

export interface TeachingAssignment {
  id: string;
  section_id: string;
  professor_id: string;
  subject: string;
  schedule_days: string[];
  schedule_start: string; // "HH:MM:SS"
  schedule_end: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  professor_username?: string | null;
  professor_first_name?: string | null;
  professor_last_name?: string | null;
  professor_avatar?: string | null;
  section_name?: string | null;
}

export interface TeachingAssignmentCreate {
  subject: string;
  schedule_days: string[];
  schedule_start: string;
  schedule_end: string;
  professor_id?: string;
}

export interface TeachingAssignmentUpdate {
  subject?: string;
  schedule_days?: string[];
  schedule_start?: string;
  schedule_end?: string;
  status?: 'active' | 'inactive';
}

export interface SectionBrowseItem {
  id: string;
  name: string;
  course: string | null;
  year_level: number | null;
  academic_year: string | null;
  member_count: number;
  professor_count: number;
  already_teaching: boolean;
}

export interface Section {
  id: string;
  name: string;
  course: string | null;
  year_level: number | null;
  academic_year: string | null;
  advisor_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  members?: SectionMember[] | null;
  teaching_assignments?: TeachingAssignment[] | null;
}

export interface SectionCreate {
  name: string;
  course?: string;
  year_level?: number;
  academic_year?: string;
  description?: string;
  subject?: string;
  schedule_days?: string[];
  schedule_start?: string;
  schedule_end?: string;
}

export interface SectionUpdate {
  name: string;
  course?: string;
  year_level?: number;
  academic_year?: string;
  description?: string;
}
