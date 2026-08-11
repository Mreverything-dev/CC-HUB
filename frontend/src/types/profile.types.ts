// frontend/src/types/profile.types.ts
export interface StudentProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  student_id: string | null;
  course: string | null;
  year_level: number | null;
  section_id: string | null;
  avatar_url: string | null;
  bio: string | null;
  contact_number: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfessorProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  employee_id: string | null;
  department: string | null;
  title: string | null;
  avatar_url: string | null;
  bio: string | null;
  office: string | null;
  contact_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  avatar_url: string | null;
  contact_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfileResponse {
  user_id: string;
  email: string;
  username: string;
  role: 'student' | 'professor' | 'admin';
  profile: StudentProfile | ProfessorProfile | AdminProfile | null;
}

// ============================================
// STUDENT PROFILE TYPES
// ============================================

export interface StudentProfileCreate {
  user_id: string;
  first_name?: string;
  last_name?: string;
  student_id?: string;
  course?: string;
  year_level?: number;
  section_id?: string;
  avatar_url?: string;
  bio?: string;
  contact_number?: string;
  address?: string;
}

export interface StudentProfileUpdate {
  first_name?: string;
  last_name?: string;
  student_id?: string;
  course?: string;
  year_level?: number;
  section_id?: string;
  avatar_url?: string;
  bio?: string;
  contact_number?: string;
  address?: string;
}

// ============================================
// PROFESSOR PROFILE TYPES
// ============================================

export interface ProfessorProfileCreate {
  user_id: string;
  first_name?: string;
  last_name?: string;
  employee_id?: string;
  department?: string;
  title?: string;
  avatar_url?: string;
  bio?: string;
  office?: string;
  contact_number?: string;
}

export interface ProfessorProfileUpdate {
  first_name?: string;
  last_name?: string;
  employee_id?: string;
  department?: string;
  title?: string;
  avatar_url?: string;
  bio?: string;
  office?: string;
  contact_number?: string;
}

// ============================================
// ADMIN PROFILE TYPES
// ============================================

export interface AdminProfileCreate {
  user_id: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  avatar_url?: string;
  contact_number?: string;
}

export interface AdminProfileUpdate {
  first_name?: string;
  last_name?: string;
  position?: string;
  avatar_url?: string;
  contact_number?: string;
}