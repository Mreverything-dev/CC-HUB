// frontend/src/services/api/post.service.ts
import { api } from '@/lib/axios';

export interface Post {
  id: string;
  user_id: string;
  username: string;
  user_role: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'link';
  visibility: 'public' | 'friends' | 'section' | 'private';
  media_urls: string[];
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  updated_at: string;
  is_liked_by_current_user: boolean;
  is_owned_by_current_user: boolean;
}

export interface FeedResponse {
  total: number;
  page: number;
  limit: number;
  items: Post[];
}

export const postService = {
  createPost: async (content: string, visibility: string = 'public') => {
    const response = await api.post('/posts', { content, visibility });
    return response.data;
  },

  getFeed: async (page: number = 1, limit: number = 20) => {
    const response = await api.get<FeedResponse>(`/posts/feed?page=${page}&limit=${limit}`);
    return response.data;
  },

  likePost: async (postId: string) => {
    const response = await api.post(`/posts/${postId}/like`);
    return response.data;
  },

  deletePost: async (postId: string) => {
    await api.delete(`/posts/${postId}`);
  },

  updatePost: async (postId: string, content: string) => {
    const response = await api.put(`/posts/${postId}`, { content });
    return response.data;
  },
};