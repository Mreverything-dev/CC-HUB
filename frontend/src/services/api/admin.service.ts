// frontend/src/services/api/admin.service.ts
import { api } from '@/lib/axios';

export interface StatMetric {
  value: number;
  trend_percent: number | null;
}

export interface EngagementTotals {
  comments: number;
  reactions: number;
  shares: number;
}

export interface AdminDashboardStats {
  total_users: StatMetric;
  students: StatMetric;
  professors: StatMetric;
  posts: StatMetric;
  reports: StatMetric;
  live_streams_now: number;
  engagement: EngagementTotals;
}

export type UserGrowthRange = 'today' | 'week' | 'month' | 'year';

export interface UserGrowthPoint {
  date: string;
  count: number;
}

export interface UserGrowthResponse {
  range: UserGrowthRange;
  bucket_unit: 'hour' | 'day' | 'month';
  points: UserGrowthPoint[];
}

export type AdminUserRole = 'student' | 'professor' | 'admin';
export type AdminUserStatusFilter = 'active' | 'suspended';
export type AdminUserOnlineFilter = 'online' | 'offline';

export interface AdminUserListItem {
  id: string;
  username: string;
  email: string;
  role: AdminUserRole;
  full_name: string | null;
  avatar_url: string | null;
  section_name: string | null;
  is_active: boolean;
  is_online: boolean;
  created_at: string;
}

export interface AdminUserCounts {
  all: number;
  students: number;
  professors: number;
  admins: number;
  suspended: number;
}

export interface AdminUserListResponse {
  items: AdminUserListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  counts: AdminUserCounts;
}

export interface AdminUserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: AdminUserRole;
  status?: AdminUserStatusFilter;
  online?: AdminUserOnlineFilter;
}

export interface AdminCreateUserRequest {
  full_name?: string;
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  role: AdminUserRole;
}

export interface AdminCreateUserResponse {
  id: string;
  username: string;
  email: string;
  role: AdminUserRole;
  full_name: string | null;
}

export type ProfessorCodeValidity = '1h' | '1d' | '1w';

export interface ProfessorCodeResponse {
  code: string;
  role: string;
  expires_at: string;
  created_at: string;
}

export const adminService = {
  getDashboardStats: () => api.get<AdminDashboardStats>('/admin/dashboard-stats'),
  getUserGrowth: (range: UserGrowthRange = 'week') =>
    api.get<UserGrowthResponse>(`/admin/user-growth?range=${range}`),
  getUsers: (params: AdminUserListParams = {}) =>
    api.get<AdminUserListResponse>('/admin/users', { params }),
  updateUserStatus: (userId: string, isActive: boolean) =>
    api.patch<AdminUserListItem>(`/admin/users/${userId}/status`, { is_active: isActive }),
  createUser: (data: AdminCreateUserRequest) =>
    api.post<AdminCreateUserResponse>('/admin/users', data),
  generateProfessorCode: (validity: ProfessorCodeValidity) =>
    api.post<ProfessorCodeResponse>('/admin/professor-codes', { validity }),
  getProfessorCodes: () => api.get<ProfessorCodeResponse[]>('/admin/professor-codes'),
  deleteProfessorCode: (code: string) => api.delete(`/admin/professor-codes/${code}`),
};
