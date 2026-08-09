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
}

export interface SectionCreate {
  name: string;
  course?: string;
  year_level?: number;
  academic_year?: string;
  description?: string;
}

export interface SectionUpdate {
  name: string;
  course?: string;
  year_level?: number;
  academic_year?: string;
  description?: string;
}
