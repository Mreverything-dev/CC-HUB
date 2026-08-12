// frontend/src/features/friends/hooks/useFriends.ts
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { friendApi } from '@/services/api/friend.service';
import { useFriendStore } from '../store/friend.store';
import { socketService } from '@/lib/socket';
import { FriendRequestCreate, FriendRequestUpdate, UserReportCreate } from '@/types/friend.types';
import toast from 'react-hot-toast';

export function useFriends() {
  const queryClient = useQueryClient();
  const {
    friends,
    friendRequests,
    notifications,
    unreadNotifications,
    setFriends,
    setFriendRequests,
    updateFriendRequest,
    removeFriendRequest,
    removeFriend,
    setNotifications,
    addNotification,
    markNotificationRead,
    setUnreadNotifications,
  } = useFriendStore();

  // Get friends
  const { isLoading: isLoadingFriends, isError: isFriendsError, refetch: refetchFriends } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const response = await friendApi.getFriends();
      setFriends(response.data.friends);
      return response.data;
    },
  });

  // Get friend requests
  const { refetch: refetchRequests } = useQuery({
    queryKey: ['friendRequests'],
    queryFn: async () => {
      const response = await friendApi.getFriendRequests();
      setFriendRequests(response.data);
      return response.data;
    },
  });

  // Get notifications
  const { refetch: refetchNotifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await friendApi.getNotifications();
      setNotifications(response.data.notifications);
      setUnreadNotifications(response.data.unread_count);
      return response.data;
    },
  });

  // Get friend suggestions
  const {
    data: suggestions = [],
    isLoading: isLoadingSuggestions,
    isError: isSuggestionsError,
    refetch: refetchSuggestions,
  } = useQuery({
    queryKey: ['friendSuggestions'],
    queryFn: async () => {
      const response = await friendApi.getSuggestions();
      return response.data;
    },
  });

  // Get blocked users
  const {
    data: blockedUsers = [],
    isLoading: isLoadingBlocked,
    isError: isBlockedError,
    refetch: refetchBlocked,
  } = useQuery({
    queryKey: ['blockedUsers'],
    queryFn: async () => {
      const response = await friendApi.getBlockedUsers();
      return response.data.blocked;
    },
  });

  // Send friend request
  const sendFriendRequest = useMutation({
    mutationFn: (data: FriendRequestCreate) => friendApi.sendFriendRequest(data),
    onSuccess: () => {
      toast.success('Friend request sent!');
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to send friend request');
    },
  });

  // Respond to friend request
  const respondToFriendRequest = useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data: FriendRequestUpdate }) =>
      friendApi.respondToFriendRequest(requestId, data),
    onSuccess: (_response, variables) => {
      const status = variables.data.status;
      toast.success(status === 'accepted' ? 'Friend request accepted!' : 'Friend request rejected');
      updateFriendRequest(variables.requestId, status);
      if (status === 'accepted') {
        queryClient.invalidateQueries({ queryKey: ['friends'] });
      }
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to respond to friend request');
    },
  });

  // Cancel a sent friend request
  const cancelFriendRequest = useMutation({
    mutationFn: (requestId: string) => friendApi.cancelFriendRequest(requestId),
    onSuccess: (_, requestId) => {
      removeFriendRequest(requestId);
      toast.success('Friend request cancelled');
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to cancel friend request');
    },
  });

  // Remove friend
  const removeFriendMutation = useMutation({
    mutationFn: (friendId: string) => friendApi.removeFriend(friendId),
    onSuccess: (_, friendId) => {
      removeFriend(friendId);
      toast.success('Friend removed');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to remove friend');
    },
  });

  // Block a user
  const blockUser = useMutation({
    mutationFn: (userId: string) => friendApi.blockUser(userId),
    onSuccess: (_, userId) => {
      removeFriend(userId);
      toast.success('User blocked');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['friendSuggestions'] });
      queryClient.invalidateQueries({ queryKey: ['blockedUsers'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to block user');
    },
  });

  // Unblock a user
  const unblockUser = useMutation({
    mutationFn: (userId: string) => friendApi.unblockUser(userId),
    onSuccess: () => {
      toast.success('User unblocked');
      queryClient.invalidateQueries({ queryKey: ['blockedUsers'] });
      queryClient.invalidateQueries({ queryKey: ['friendSuggestions'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to unblock user');
    },
  });

  // Report a user
  const reportUser = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UserReportCreate }) =>
      friendApi.reportUser(userId, data),
    onSuccess: () => {
      toast.success('Report submitted. Our team will review it.');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit report');
    },
  });

  // Mark notification as read
  const markRead = useMutation({
    mutationFn: (notificationId: string) => friendApi.markNotificationRead(notificationId),
    onSuccess: (_, notificationId) => {
      markNotificationRead(notificationId);
    },
    onError: (error: any) => {
      console.error('Failed to mark notification as read:', error);
    },
  });

  // Mark all notifications as read
  const markAllRead = useMutation({
    mutationFn: () => friendApi.markAllNotificationsRead(),
    onSuccess: () => {
      notifications.forEach((n) => {
        if (!n.is_read) markNotificationRead(n.id);
      });
      setUnreadNotifications(0);
      toast.success('All notifications marked as read');
    },
    onError: () => {
      toast.error('Failed to mark all as read');
    },
  });

  // Setup WebSocket listeners for real-time notifications
  useEffect(() => {
    socketService.on('new_notification', (data) => {
      console.log('🔔 New notification:', data);
      addNotification(data);
      toast.success(data.title);
    });

    return () => {
      socketService.off('new_notification');
    };
  }, []);

  return {
    friends,
    friendRequests,
    notifications,
    unreadNotifications,
    suggestions,
    blockedUsers,
    isLoading: isLoadingFriends,
    isFriendsError,
    isLoadingSuggestions,
    isSuggestionsError,
    isLoadingBlocked,
    isBlockedError,
    sendFriendRequest: sendFriendRequest.mutateAsync,
    respondToFriendRequest: respondToFriendRequest.mutateAsync,
    cancelFriendRequest: cancelFriendRequest.mutateAsync,
    removeFriend: removeFriendMutation.mutateAsync,
    blockUser: blockUser.mutateAsync,
    unblockUser: unblockUser.mutateAsync,
    reportUser: reportUser.mutateAsync,
    markNotificationRead: markRead.mutateAsync,
    markAllNotificationsRead: markAllRead.mutateAsync,
    refetchFriends,
    refetchRequests,
    refetchNotifications,
    refetchSuggestions,
    refetchBlocked,
  };
}