// frontend/src/services/api/friend.service.ts
import { api } from '@/lib/axios';
import { Friend, FriendRequest, Notification, FriendRequestCreate, FriendRequestUpdate } from '@/types/friend.types';

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
  
  // Notifications
  getNotifications: () =>
    api.get<{ notifications: Notification[]; unread_count: number }>('/friends/notifications'),
  
  markNotificationRead: (notificationId: string) =>
    api.post(`/friends/notifications/${notificationId}/read`),
  
  markAllNotificationsRead: () =>
    api.post('/friends/notifications/read-all'),
};