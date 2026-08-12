// frontend/src/types/announcement.types.ts
export interface AnnouncementReactionEntry {
  user_id: string;
  reaction: string;
}

export interface Announcement {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: 'general' | 'academic' | 'event' | 'emergency';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_by_role: 'professor' | 'admin';
  created_by_username?: string | null;
  created_by_avatar?: string | null;
  is_published: boolean;
  published_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  target_sections: string[] | null;
  target_section_names: string[];
  audience: string;
  reactions: AnnouncementReactionEntry[];
  is_bookmarked: boolean;
}

export interface AnnouncementCreate {
  title: string;
  content: string;
  type?: 'general' | 'academic' | 'event' | 'emergency';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  is_published?: boolean;
  expires_at?: string | null;
  target_sections?: string[] | null;
}

export interface AnnouncementUpdate {
  title?: string;
  content?: string;
  type?: 'general' | 'academic' | 'event' | 'emergency';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  is_published?: boolean;
  expires_at?: string | null;
}

export interface AnnouncementListResponse {
  total: number;
  items: Announcement[];
}