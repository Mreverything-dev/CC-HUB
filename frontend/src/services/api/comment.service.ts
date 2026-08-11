// frontend/src/services/api/comment.service.ts
import { api } from '@/lib/axios';
import { Comment, CommentCreate, CommentUpdate, CommentListResponse } from '@/types/comment.types';

export const commentService = {
  // Get comments for a post
  getComments: (postId: string, page: number = 1, limit: number = 50) =>
    api.get<CommentListResponse>(`/comments/post/${postId}?page=${page}&limit=${limit}`),

  // Add a comment to a post
  createComment: (postId: string, data: CommentCreate) =>
    api.post<Comment>(`/comments/post/${postId}`, data),

  // Edit a comment (owner only)
  updateComment: (commentId: string, data: CommentUpdate) =>
    api.put<Comment>(`/comments/${commentId}`, data),

  // Delete a comment (owner or admin)
  deleteComment: (commentId: string) =>
    api.delete(`/comments/${commentId}`),

  // Toggle like on a comment
  likeComment: (commentId: string) =>
    api.post<{ liked: boolean; likes_count: number }>(`/comments/${commentId}/like`),
};
