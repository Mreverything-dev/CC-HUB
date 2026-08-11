// frontend/src/types/chat.types.ts
export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  created_at: string;
  updated_at: string;
  last_message?: Message | null;
  unread_count: number;
  participants: User[];
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'file';
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageCreate {
  conversation_id: string;
  content: string;
  type?: string;
}

export interface ConversationCreate {
  type: string;
  name?: string;
  participant_ids: string[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
}