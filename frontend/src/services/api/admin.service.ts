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
  online_users_now: number;
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
  /** Filter to members of one section - reuses the same section_members
   * data GET /admin/users already joins for the display-only section_name
   * column. */
  section?: string;
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

export interface AdminUpdateUserRequest {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface AdminSetPasswordRequest {
  new_password: string;
  confirm_password: string;
}

export type ProfessorCodeValidity = '1h' | '1d' | '1w';

export interface ProfessorCodeResponse {
  code: string;
  role: string;
  expires_at: string;
  created_at: string;
}

export interface AdminPostListItem {
  id: string;
  content: string | null;
  type: string;
  visibility: string;
  media_urls: string[];
  author_id: string;
  author_username: string;
  author_full_name: string | null;
  author_avatar_url: string | null;
  author_role: AdminUserRole;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
}

export interface AdminPostListResponse {
  items: AdminPostListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface BulkDeletePostsResponse {
  deleted_count: number;
  deleted_ids: string[];
  not_found_ids: string[];
}

export interface AdminAnnouncementListItem {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  created_by_role: string;
  author_id: string;
  author_username: string;
  author_full_name: string | null;
  author_avatar_url: string | null;
  is_published: boolean;
  audience: string;
  target_section_names: string[];
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface AdminAnnouncementListResponse {
  items: AdminAnnouncementListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export type AdminLivestreamContext = 'stream' | 'meeting';
export type AdminLivestreamStatusFilter = 'live' | 'ended' | 'scheduled';

export interface AdminLivestreamListItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  visibility: string;
  host_id: string;
  host_username: string;
  host_full_name: string | null;
  host_avatar_url: string | null;
  viewer_count: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  is_meethub: boolean;
  section_name: string | null;
  subject: string | null;
}

export interface AdminLivestreamListResponse {
  items: AdminLivestreamListItem[];
  total: number;
}

export interface AdminStreamViewerItem {
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  joined_at: string;
  is_active: boolean;
}

export type AdminReportCategory =
  | 'bullying'
  | 'harassment'
  | 'abuse'
  | 'violent_content'
  | 'adult_content'
  | 'false_information'
  | 'suicide_self_harm';

export type AdminReportStatus = 'pending' | 'valid' | 'dismissed';

export type AdminRestrictionDuration = '1d' | '1w' | '1m';

// Deliberately no reporter_id/reporter_username anywhere in this shape -
// reporter identity is never returned by the backend, by design.
export interface AdminReportedUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

export interface AdminReportedPost {
  id: string | null;
  content: string | null;
  media_urls: string[];
  exists: boolean;
  created_at: string | null;
  removed_by_moderation: boolean;
}

export interface AdminReportRestriction {
  reason: string;
  restricted_at: string;
  restricted_until: string;
}

export interface AdminReportListItem {
  id: string;
  category: AdminReportCategory | string;
  category_label: string;
  priority: 'high' | 'normal';
  details: string | null;
  status: AdminReportStatus;
  reported_user: AdminReportedUser;
  reported_post: AdminReportedPost | null;
  created_at: string;
  moderated_at: string | null;
  warning_issued: boolean;
  post_removed: boolean;
  restriction: AdminReportRestriction | null;
  admin_message: string | null;
}

export interface AdminReportListResponse {
  items: AdminReportListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ModerationActionResponse {
  id: string;
  status: AdminReportStatus;
  warning_issued: boolean;
  post_removed: boolean;
  message: string;
}

export const adminService = {
  getDashboardStats: () => api.get<AdminDashboardStats>('/admin/dashboard-stats'),
  getUserGrowth: (range: UserGrowthRange = 'week') =>
    api.get<UserGrowthResponse>(`/admin/user-growth?range=${range}`),
  getUsers: (params: AdminUserListParams = {}) =>
    api.get<AdminUserListResponse>('/admin/users', { params }),
  getUser: (userId: string) => api.get<AdminUserListItem>(`/admin/users/${userId}`),
  updateUserStatus: (userId: string, isActive: boolean) =>
    api.patch<AdminUserListItem>(`/admin/users/${userId}/status`, { is_active: isActive }),
  updateUserRole: (userId: string, role: AdminUserRole) =>
    api.patch<AdminUserListItem>(`/admin/users/${userId}/role`, { role }),
  createUser: (data: AdminCreateUserRequest) =>
    api.post<AdminCreateUserResponse>('/admin/users', data),
  updateUser: (userId: string, data: AdminUpdateUserRequest) =>
    api.put<AdminUserListItem>(`/admin/users/${userId}`, data),
  setUserPassword: (userId: string, data: AdminSetPasswordRequest) =>
    api.patch<{ message: string }>(`/admin/users/${userId}/password`, data),
  deleteUser: (userId: string) =>
    api.delete<{ message: string }>(`/admin/users/${userId}`),
  generateProfessorCode: (validity: ProfessorCodeValidity) =>
    api.post<ProfessorCodeResponse>('/admin/professor-codes', { validity }),
  getProfessorCodes: () => api.get<ProfessorCodeResponse[]>('/admin/professor-codes'),
  deleteProfessorCode: (code: string) => api.delete(`/admin/professor-codes/${code}`),

  getPosts: (params: { page?: number; limit?: number; search?: string } = {}) =>
    api.get<AdminPostListResponse>('/admin/posts', { params }),
  bulkDeletePosts: (postIds: string[]) =>
    api.post<BulkDeletePostsResponse>('/admin/posts/bulk-delete', { post_ids: postIds }),

  getAnnouncements: (params: { page?: number; limit?: number; search?: string } = {}) =>
    api.get<AdminAnnouncementListResponse>('/admin/announcements', { params }),

  getLivestreams: (params: { context?: AdminLivestreamContext; status?: AdminLivestreamStatusFilter } = {}) =>
    api.get<AdminLivestreamListResponse>('/admin/livestreams', { params }),
  endLivestream: (streamId: string) =>
    api.post<AdminLivestreamListItem>(`/admin/livestreams/${streamId}/end`),
  getLivestreamViewers: (streamId: string) =>
    api.get<AdminStreamViewerItem[]>(`/admin/livestreams/${streamId}/viewers`),

  getReports: (params: { page?: number; limit?: number; category?: string; status?: string; search?: string } = {}) =>
    api.get<AdminReportListResponse>('/admin/reports', { params }),
  dismissReport: (reportId: string) =>
    api.post<ModerationActionResponse>(`/admin/reports/${reportId}/dismiss`),
  validateReport: (reportId: string) =>
    api.post<ModerationActionResponse>(`/admin/reports/${reportId}/validate`),
  warnReportedUser: (reportId: string) =>
    api.post<ModerationActionResponse>(`/admin/reports/${reportId}/warn`),
  confirmViolation: (reportId: string, message: string) =>
    api.post<ModerationActionResponse>(`/admin/reports/${reportId}/confirm-violation`, { message }),
  restrictReportedUser: (reportId: string, duration: AdminRestrictionDuration) =>
    api.post<ModerationActionResponse>(`/admin/reports/${reportId}/restrict`, { duration }),
  removeReportedPost: (reportId: string) =>
    api.post<ModerationActionResponse>(`/admin/reports/${reportId}/remove-post`),
};
