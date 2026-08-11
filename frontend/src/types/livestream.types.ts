// frontend/src/types/livestream.types.ts
export type StreamStatus = 'scheduled' | 'live' | 'ended';
export type StreamVisibility = 'public' | 'friends' | 'section';

export interface Livestream {
  id: string;
  host_id: string;
  host_username: string;
  host_avatar?: string;
  host_role: 'student' | 'professor' | 'admin';
  title: string;
  description?: string;
  visibility: StreamVisibility;
  target_section_ids: string[];
  status: StreamStatus;
  viewer_count: number;
  stream_key?: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
  is_host: boolean;
  can_view: boolean;
}

export interface LivestreamCreate {
  title: string;
  description?: string;
  visibility: StreamVisibility;
  target_section_ids?: string[];
}

export interface LivestreamUpdate {
  title?: string;
  description?: string;
  visibility?: StreamVisibility;
  target_section_ids?: string[];
  status?: StreamStatus;
}

export interface StreamViewer {
  id: string;
  user_id: string;
  username: string;
  avatar?: string;
  joined_at: string;
}

export interface StreamChatMessage {
  stream_id: string;
  user_id: string;
  username: string;
  avatar?: string;
  message: string;
  timestamp: string;
}