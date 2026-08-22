// frontend/src/features/posts/hooks/usePostRoom.ts
import { useEffect } from 'react';
import { socketService } from '@/lib/socket';

export interface PostReactionUpdatedPayload {
  post_id: string;
  user_id: string;
  reaction: string | null;
  reactions_count: number;
  reaction_breakdown: Record<string, number>;
}

export interface PostCommentAddedPayload {
  post_id: string;
  comments_count: number;
  comment: {
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
    reactions_count: number;
    reaction_breakdown: Record<string, number>;
  };
}

export interface PostCommentDeletedPayload {
  post_id: string;
  comment_id: string;
  comments_count: number;
}

export interface PostCommentReactionUpdatedPayload {
  post_id: string;
  comment_id: string;
  user_id: string;
  reaction: string | null;
  reactions_count: number;
  reaction_breakdown: Record<string, number>;
}

export interface PostShareUpdatedPayload {
  post_id: string;
  shares_count: number;
  shared_by_user_id: string;
}

interface UsePostRoomOptions {
  onReactionUpdated?: (data: PostReactionUpdatedPayload) => void;
  onCommentAdded?: (data: PostCommentAddedPayload) => void;
  onCommentDeleted?: (data: PostCommentDeletedPayload) => void;
  onCommentReactionUpdated?: (data: PostCommentReactionUpdatedPayload) => void;
  onShareUpdated?: (data: PostShareUpdatedPayload) => void;
}

/**
 * Joins `post_{postId}`'s socket room for as long as the caller is mounted
 * (a post detail view, or a single PostCard visible on a feed) and wires up
 * the real-time events broadcast from post_service.py/comment_service.py -
 * reuses the server's existing generic join_room/leave_room mechanism
 * (see manager.py), no new socket infrastructure. Each event only fires the
 * callback if provided, and every callback already filters/updates by the
 * relevant post_id itself where it matters (this hook doesn't assume only
 * one post's events will ever arrive while mounted).
 */
export function usePostRoom(postId: string | null | undefined, options: UsePostRoomOptions) {
  const { onReactionUpdated, onCommentAdded, onCommentDeleted, onCommentReactionUpdated, onShareUpdated } = options;

  useEffect(() => {
    if (!postId) return;

    socketService.joinPostRoom(postId);

    const handleReaction = (data: PostReactionUpdatedPayload) => onReactionUpdated?.(data);
    const handleCommentAdded = (data: PostCommentAddedPayload) => onCommentAdded?.(data);
    const handleCommentDeleted = (data: PostCommentDeletedPayload) => onCommentDeleted?.(data);
    const handleCommentReaction = (data: PostCommentReactionUpdatedPayload) => onCommentReactionUpdated?.(data);
    const handleShare = (data: PostShareUpdatedPayload) => onShareUpdated?.(data);

    socketService.on('post:reaction_updated', handleReaction);
    socketService.on('post:comment_added', handleCommentAdded);
    socketService.on('post:comment_deleted', handleCommentDeleted);
    socketService.on('post:comment_reaction_updated', handleCommentReaction);
    socketService.on('post:share_updated', handleShare);

    return () => {
      socketService.leavePostRoom(postId);
      // Pass the exact same callback reference each was registered with -
      // a PostDetailModal can be open on top of the still-mounted dashboard
      // feed behind it, both listening for the same event names, so
      // removing "all" listeners here would also kill the feed's.
      socketService.off('post:reaction_updated', handleReaction);
      socketService.off('post:comment_added', handleCommentAdded);
      socketService.off('post:comment_deleted', handleCommentDeleted);
      socketService.off('post:comment_reaction_updated', handleCommentReaction);
      socketService.off('post:share_updated', handleShare);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);
}
