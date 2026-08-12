// frontend/src/services/api/friend.service.ts
import { api } from '@/lib/axios';
import {
  Friend,
  FriendRequest,
  Notification,
  FriendRequestCreate,
  FriendRequestUpdate,
  Suggestion,
  BlockedUser,
  UserReportCreate,
} from '@/types/friend.types';

export const friendApi = {
  // Friend Requests
  sendFriendRequest: (data: FriendRequestCreate) =>
    api.post<FriendRequest>('/friends/requests', data),

  respondToFriendRequest: (requestId: string, data: FriendRequestUpdate) =>
    api.put<FriendRequest>(`/friends/requests/${requestId}`, data),

  cancelFriendRequest: (requestId: string) =>
    api.delete(`/friends/requests/${requestId}`),

  getFriendRequests: () =>
    api.get<{ sent: FriendRequest[]; received: FriendRequest[] }>('/friends/requests'),

  // Friends
  getFriends: () =>
    api.get<{ friends: Friend[]; total: number }>('/friends/'),

  removeFriend: (friendId: string) =>
    api.delete(`/friends/${friendId}`),

  // Suggestions
  getSuggestions: (limit = 20) =>
    api.get<Suggestion[]>('/friends/suggestions', { params: { limit } }),

  // Blocking
  getBlockedUsers: () =>
    api.get<{ blocked: BlockedUser[]; total: number }>('/friends/blocked'),

  blockUser: (userId: string) =>
    api.post(`/friends/block/${userId}`),

  unblockUser: (userId: string) =>
    api.delete(`/friends/block/${userId}`),

  // Reporting
  reportUser: (userId: string, data: UserReportCreate) =>
    api.post(`/friends/report/${userId}`, data),

  // Notifications
  getNotifications: () =>
    api.get<{ notifications: Notification[]; unread_count: number }>('/friends/notifications'),

  markNotificationRead: (notificationId: string) =>
    api.post(`/friends/notifications/${notificationId}/read`),

  markAllNotificationsRead: () =>
    api.post('/friends/notifications/read-all'),
};
