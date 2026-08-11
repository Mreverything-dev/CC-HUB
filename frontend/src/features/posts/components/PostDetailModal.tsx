// frontend/src/features/posts/components/PostDetailModal.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { postService } from '@/services/api/post.service';
import { commentService } from '@/services/api/comment.service';
import { Comment } from '@/types/comment.types';
import toast from 'react-hot-toast';
import { XMarkIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface PostDetailModalProps {
  postId: string;
  onClose: () => void;
  onLike: (postId: string) => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string, content: string) => void;
}

export default function PostDetailModal({
  postId,
  onClose,
  onLike,
  onDelete,
  onEdit,
}: PostDetailModalProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const [isShared, setIsShared] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  const { data: post, isLoading, refetch } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const response = await api.get(`/posts/${postId}`);
      const data = response.data;
      setIsLiked(data.is_liked_by_current_user);
      setLikeCount(data.likes_count);
      setShareCount(data.shares_count);
      setIsShared(data.is_shared_by_current_user);
      setEditContent(data.content);
      return data;
    },
  });

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const response = await commentService.getComments(postId);
      setComments(response.data.items);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleLike = async () => {
    try {
      await onLike(postId);
      setIsLiked(!isLiked);
      setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleShare = async () => {
    if (isShared) {
      toast('You already shared this post');
      return;
    }
    setIsSharing(true);
    try {
      const response = await postService.sharePost(postId);
      setShareCount(response.data.shares_count);
      setIsShared(true);
      toast.success('Post shared!');
    } catch (error) {
      console.error('Error sharing post:', error);
      toast.error('Failed to share post');
    } finally {
      setIsSharing(false);
    }
  };

  const handleEdit = async () => {
    if (editContent.trim() && editContent !== post?.content) {
      await onEdit(postId, editContent);
      setIsEditing(false);
      refetch();
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this post?')) {
      await onDelete(postId);
      onClose();
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setIsPostingComment(true);
    try {
      const response = await commentService.createComment(postId, { content: newComment.trim() });
      setComments((prev) => [response.data, ...prev]);
      setNewComment('');
      refetch();
    } catch (error: any) {
      console.error('Error posting comment:', error);
      toast.error(error.response?.data?.detail || 'Failed to post comment');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      const response = await commentService.likeComment(commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, is_liked_by_current_user: response.data.liked, likes_count: response.data.likes_count }
            : c
        )
      );
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleStartEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentContent(comment.content);
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!editingCommentContent.trim()) return;
    try {
      const response = await commentService.updateComment(commentId, { content: editingCommentContent.trim() });
      setComments((prev) => prev.map((c) => (c.id === commentId ? response.data : c)));
      setEditingCommentId(null);
    } catch (error: any) {
      console.error('Error editing comment:', error);
      toast.error(error.response?.data?.detail || 'Failed to edit comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await commentService.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      refetch();
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete comment');
    }
  };

  const roleColors = {
    admin: 'bg-purple-500 text-white',
    professor: 'bg-cyan-500 text-white',
    student: 'bg-blue-500 text-white',
  };

  const visibilityLabels = {
    public: '🌍 Public',
    friends: '👥 Friends',
    section: '📚 Section',
    private: '🔒 Private',
  };

  if (isLoading || !post) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <p className="mt-4 text-gray-500">Loading post...</p>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === post.user_id || user?.role === 'admin';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div
              onClick={() => navigate(`/profile/${post.user_id}`)}
              className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:opacity-80 transition cursor-pointer overflow-hidden"
            >
              {post.avatar_url ? (
                <img src={post.avatar_url} alt={post.username} className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-600 font-semibold">
                  {post.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <p
                  onClick={() => navigate(`/profile/${post.user_id}`)}
                  className="font-medium text-gray-800 hover:underline cursor-pointer"
                >
                  {post.username}
                </p>
                <Badge size="sm" className={roleColors[post.user_role as keyof typeof roleColors]}>
                  {post.user_role?.charAt(0).toUpperCase() + post.user_role?.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-400">
                <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                <span>•</span>
                <span>{visibilityLabels[post.visibility as keyof typeof visibilityLabels]}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                rows={6}
              />
              <div className="flex space-x-2">
                <Button size="sm" onClick={handleEdit}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-6 pt-4 mt-4 border-t">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 text-sm font-medium transition ${
                isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
              }`}
            >
              <span className="text-lg">{isLiked ? '♥' : '♡'}</span>
              <span>{likeCount}</span>
            </button>
            <div className="flex items-center gap-1 text-sm font-medium text-gray-500">
              <span className="text-lg">◌</span>
              <span>{comments.length}</span>
            </div>
            <button
              onClick={handleShare}
              disabled={isSharing}
              title={isShared ? 'You already shared this post' : 'Share'}
              className={`flex items-center gap-1 text-sm font-medium transition disabled:opacity-50 ${
                isShared ? 'text-green-500' : 'text-gray-500 hover:text-green-500'
              }`}
            >
              <span className="text-lg">↗</span>
              <span>{shareCount}</span>
            </button>
          </div>

          {/* Owner Actions */}
          {isOwner && (
            <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-3">
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  Edit Post
                </button>
              )}
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
              >
                Delete Post
              </button>
            </div>
          )}

          {/* Comments */}
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Comments {comments.length > 0 && `(${comments.length})`}
            </h3>

            {/* Add Comment */}
            <div className="flex items-start gap-2 mb-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={2}
                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
              />
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={!newComment.trim() || isPostingComment}
              >
                {isPostingComment ? 'Posting...' : 'Post'}
              </Button>
            </div>

            {/* Comment List */}
            {commentsLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No comments yet. Be the first!</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <div
                      onClick={() => navigate(`/profile/${comment.user_id}`)}
                      className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition"
                    >
                      {comment.avatar_url ? (
                        <img src={comment.avatar_url} alt={comment.username} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-600 text-xs font-semibold">
                          {comment.username?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p
                          onClick={() => navigate(`/profile/${comment.user_id}`)}
                          className="text-sm font-medium text-gray-800 hover:underline cursor-pointer inline-block"
                        >
                          {comment.username}
                        </p>
                        {editingCommentId === comment.id ? (
                          <div className="mt-1 space-y-1">
                            <textarea
                              value={editingCommentContent}
                              onChange={(e) => setEditingCommentContent(e.target.value)}
                              rows={2}
                              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSaveEditComment(comment.id)}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingCommentId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 px-1 text-xs text-gray-400">
                        <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                        <button
                          onClick={() => handleLikeComment(comment.id)}
                          className={`flex items-center gap-1 hover:text-red-500 transition ${
                            comment.is_liked_by_current_user ? 'text-red-500' : ''
                          }`}
                        >
                          {comment.is_liked_by_current_user ? '♥' : '♡'} {comment.likes_count > 0 && comment.likes_count}
                        </button>
                        {comment.is_owned_by_current_user && editingCommentId !== comment.id && (
                          <>
                            <button
                              onClick={() => handleStartEditComment(comment)}
                              className="flex items-center gap-1 hover:text-blue-500 transition"
                            >
                              <PencilIcon className="h-3 w-3" /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="flex items-center gap-1 hover:text-red-500 transition"
                            >
                              <TrashIcon className="h-3 w-3" /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}