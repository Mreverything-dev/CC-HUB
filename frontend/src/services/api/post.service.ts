// frontend/src/services/api/post.service.ts
import { api } from '@/lib/axios';

export interface Post {
  id: string;
  user_id: string;
  username: string;
  user_role: string;
  avatar_url?: string | null;
  content: string;
  type: string;
  visibility: string;
  media_urls: string[];
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  updated_at: string;
  is_liked_by_current_user: boolean;
  is_shared_by_current_user: boolean;
  is_owned_by_current_user: boolean;
  // Multi-emoji reactions (separate from the legacy likes_count/
  // is_liked_by_current_user above, which stay untouched for backward compat).
  reactions_count: number;
  reaction_breakdown: Record<string, number>;
  my_reaction: string | null;
  // Set only on a feed/profile item that represents someone SHARING this
  // post - every other field above is always the ORIGINAL post's own
  // content/author/reactions, never a copy.
  is_shared: boolean;
  shared_by_user_id?: string | null;
  shared_by_username?: string | null;
  shared_by_avatar_url?: string | null;
  shared_by_role?: string | null;
  shared_at?: string | null;
}

export interface PostCreate {
  content: string;
  media_urls?: string[];
  type?: string;
  visibility?: string;
}

export interface FeedResponse {
  items: Post[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const postService = {
  // Get feed with pagination
  getFeed: (page: number = 1, limit: number = 20) =>
    api.get<FeedResponse>(`/posts/feed?page=${page}&limit=${limit}`),

  // Get another user's posts (for viewing their profile)
  getUserPosts: (userId: string, page: number = 1, limit: number = 20) =>
    api.get<FeedResponse>(`/posts/user/${userId}?page=${page}&limit=${limit}`),

  // Get single post
  getPost: (postId: string) =>
    api.get<Post>(`/posts/${postId}`),

  // ✅ Create post with media support
  createPost: (data: PostCreate) =>
    api.post<Post>('/posts/', data),

  // Update post
  updatePost: (postId: string, content: string) =>
    api.put<Post>(`/posts/${postId}`, { content }),

  // Delete post
  deletePost: (postId: string) =>
    api.delete(`/posts/${postId}`),

  // Toggle like - kept for backward compatibility; new UI uses reactToPost.
  likePost: (postId: string) =>
    api.post(`/posts/${postId}/like`),

  // Add/change/remove the caller's emoji reaction on a post.
  reactToPost: (postId: string, reaction: string) =>
    api.post<{ post_id: string; user_id: string; reaction: string | null; reactions_count: number; reaction_breakdown: Record<string, number> }>(
      `/posts/${postId}/react`,
      { reaction }
    ),

  // Record a share (one per user)
  sharePost: (postId: string) =>
    api.post<{ shares_count: number; already_shared: boolean }>(`/posts/${postId}/share`),

  // Posts a user has shared - for the profile "Shares" tab
  getUserShares: (userId: string, page: number = 1, limit: number = 20) =>
    api.get<FeedResponse>(`/posts/user/${userId}/shares?page=${page}&limit=${limit}`),
};