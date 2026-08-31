// frontend/src/features/friends/store/friend.store.ts
import { create } from 'zustand';
import { Friend, FriendRequest, Notification } from '@/types/friend.types';

interface FriendState {
  friends: Friend[];
  friendRequests: {
    sent: FriendRequest[];
    received: FriendRequest[];
  };
  notifications: Notification[];
  unreadNotifications: number;
  isLoading: boolean;
  setFriends: (friends: Friend[]) => void;
  setFriendRequests: (requests: { sent: FriendRequest[]; received: FriendRequest[] }) => void;
  addFriendRequest: (request: FriendRequest) => void;
  removeFriendRequest: (id: string) => void;
  updateFriendRequest: (id: string, status: 'pending' | 'accepted' | 'rejected' | 'cancelled') => void;
  addFriend: (friend: Friend) => void;
  removeFriend: (id: string) => void;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  setUnreadNotifications: (count: number) => void;
  setLoading: (loading: boolean) => void;
}

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  friendRequests: { sent: [], received: [] },
  notifications: [],
  unreadNotifications: 0,
  isLoading: false,

  setFriends: (friends) => set({ friends }),
  
  setFriendRequests: (friendRequests) => set({ friendRequests }),
  
  // ✅ Add a friend request to the received list
  addFriendRequest: (request) => set((state) => ({
    friendRequests: {
      ...state.friendRequests,
      received: [request, ...state.friendRequests.received]
    }
  })),
  
  // ✅ Remove a friend request by ID
  removeFriendRequest: (id) => set((state) => ({
    friendRequests: {
      sent: state.friendRequests.sent.filter((r) => r.id !== id),
      received: state.friendRequests.received.filter((r) => r.id !== id)
    }
  })),
  
  // ✅ Update friend request status
  updateFriendRequest: (id, status) => set((state) => ({
    friendRequests: {
      sent: state.friendRequests.sent.map((r) =>
        r.id === id ? { ...r, status } : r
      ),
      received: state.friendRequests.received.map((r) =>
        r.id === id ? { ...r, status } : r
      )
    }
  })),
  
  // ✅ Add a friend to the friends list
  addFriend: (friend) => set((state) => ({
    friends: [friend, ...state.friends]
  })),
  
  // ✅ Remove a friend by the OTHER user's id (what every caller actually passes -
  // friendApi.removeFriend/blockUser both take the target user's id, not this Friend row's own id)
  removeFriend: (userId) => set((state) => ({
    friends: state.friends.filter((f) => f.user_id !== userId)
  })),
  
  setNotifications: (notifications) => set({ notifications }),
  
  // ✅ Add a notification - de-duped by id, since useFriends() (and its
  // socket listener) is legitimately mounted by several components at once
  // (NotificationBell in every Topbar, plus FriendsPage/ProfilePage/
  // ChatWindow/ChatList), so the same server-pushed notification can arrive
  // through more than one of those listeners for the same event.
  addNotification: (notification) => set((state) => {
    if (state.notifications.some((n) => n.id === notification.id)) return state;
    return {
      notifications: [notification, ...state.notifications],
      unreadNotifications: state.unreadNotifications + 1
    };
  }),
  
  // ✅ Mark a notification as read
  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) =>
      n.id === id ? { ...n, is_read: true } : n
    ),
    unreadNotifications: Math.max(0, state.unreadNotifications - 1)
  })),
  
  // ✅ Set unread notifications count
  setUnreadNotifications: (unreadNotifications) => set({ unreadNotifications }),
  
  // ✅ Set loading state
  setLoading: (isLoading) => set({ isLoading }),
}));