export interface Friend {
  id: string;
  user_id: string;
  username: string;
  email: string;
  avatar: string | null;
  role?: string | null;
  is_online: boolean;
  last_seen: string | null;
  mutual_friends_count: number;
  mutual_friend_avatars: string[];
  created_at: string;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar: string | null;
  sender_online: boolean;
  receiver_id: string;
  receiver_username: string;
  receiver_avatar: string | null;
  receiver_online: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Suggestion {
  user_id: string;
  username: string;
  email: string;
  avatar: string | null;
  role?: string | null;
  mutual_friends_count: number;
  mutual_friend_avatars: string[];
}

export interface BlockedUser {
  id: string;
  user_id: string;
  username: string;
  email: string;
  avatar: string | null;
  blocked_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'friend_request' | 'friend_accepted' | 'message' | 'announcement';
  title: string;
  content: string;
  is_read: boolean;
  data: any;
  created_at: string;
}

export interface FriendRequestCreate {
  receiver_id: string;
  message?: string;
}

export interface FriendRequestUpdate {
  status: 'accepted' | 'rejected';
}

export interface UserReportCreate {
  reason: string;
  details?: string;
}
