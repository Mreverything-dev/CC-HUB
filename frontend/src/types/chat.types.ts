// frontend/src/types/chat.types.ts
export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  last_message?: Message | null;
  unread_count: number;
  participants: User[];
}

export interface GroupMember {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string | null;
  role: 'student' | 'professor' | 'admin';
  is_professor: boolean;
  is_mayor: boolean;
  is_officer: boolean;
}

export interface MessageReactionEntry {
  user_id: string;
  reaction: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'file';
  media_url?: string | null;
  media_name?: string | null;
  reactions: MessageReactionEntry[];
  is_read: boolean;
  is_deleted?: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageCreate {
  conversation_id: string;
  content: string;
  type?: string;
  media_url?: string | null;
  media_name?: string | null;
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