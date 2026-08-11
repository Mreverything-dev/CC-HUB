// frontend/src/services/api/profile.service.ts
import { api } from '@/lib/axios';
import {
  StudentProfile,
  ProfessorProfile,
  AdminProfile,
  UserProfileResponse,
  StudentProfileCreate,
  StudentProfileUpdate,
  ProfessorProfileCreate,
  ProfessorProfileUpdate,
  AdminProfileCreate,
  AdminProfileUpdate
} from '@/types/profile.types';

export const profileService = {
  // Get current user's profile
  getMyProfile: () => 
    api.get<UserProfileResponse>('/profiles/me'),
  
  // Get any user's profile
  getUserProfile: (userId: string) => 
    api.get<UserProfileResponse>(`/profiles/${userId}`),
  
  // Student Profile
  createStudentProfile: (data: StudentProfileCreate) => 
    api.post<StudentProfile>('/profiles/student', data),
  
  getMyStudentProfile: () => 
    api.get<StudentProfile>('/profiles/student/me'),
  
  updateStudentProfile: (data: StudentProfileUpdate) => 
    api.put<StudentProfile>('/profiles/student', data),
  
  // Professor Profile
  createProfessorProfile: (data: ProfessorProfileCreate) => 
    api.post<ProfessorProfile>('/profiles/professor', data),
  
  getMyProfessorProfile: () => 
    api.get<ProfessorProfile>('/profiles/professor/me'),
  
  updateProfessorProfile: (data: ProfessorProfileUpdate) => 
    api.put<ProfessorProfile>('/profiles/professor', data),
  
  // Admin Profile
  createAdminProfile: (data: AdminProfileCreate) => 
    api.post<AdminProfile>('/profiles/admin', data),
  
  getMyAdminProfile: () => 
    api.get<AdminProfile>('/profiles/admin/me'),
  
  updateAdminProfile: (data: AdminProfileUpdate) => 
    api.put<AdminProfile>('/profiles/admin', data),
};