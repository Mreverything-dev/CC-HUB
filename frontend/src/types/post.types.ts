// frontend/src/types/post.types.ts
export interface Post {
  id: string;
  user_id: string;
  username: string;
  user_role: string;
  content: string;
  type: string;
  visibility: string;
  media_urls: string[];  // ✅ Make sure this exists
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  updated_at: string;
  is_liked_by_current_user: boolean;
  is_owned_by_current_user: boolean;
}

export interface PostCreate {
  content: string;
  media_urls?: string[];
  type?: string;
  visibility?: string;
}