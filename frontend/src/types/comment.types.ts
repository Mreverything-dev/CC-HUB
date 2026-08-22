// frontend/src/types/comment.types.ts
export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  user_role: string;
  avatar_url?: string | null;
  parent_id: string | null;
  content: string;
  image_url?: string | null;
  likes_count: number;
  created_at: string;
  updated_at: string;
  is_liked_by_current_user: boolean;
  is_owned_by_current_user: boolean;
  reactions_count: number;
  reaction_breakdown: Record<string, number>;
  my_reaction: string | null;
}

export interface CommentCreate {
  content: string;
  image_url?: string | null;
  parent_id?: string | null;
}

export interface CommentUpdate {
  content: string;
}

export interface CommentListResponse {
  total: number;
  items: Comment[];
}
