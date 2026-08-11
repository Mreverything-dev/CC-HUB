// frontend/src/types/friend.types.ts
export interface Friend {
  id: string;
  user_id: string;
  username: string;
  email: string;
  avatar: string | null;
  created_at: string;
}
 
export interface FriendRequest {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar: string | null;
  receiver_id: string;
  receiver_username: string;
  receiver_avatar: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'friend_request' | 'friend_accepted' | 'message';
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