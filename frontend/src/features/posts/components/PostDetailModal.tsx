// frontend/src/features/posts/components/PostDetailModal.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { XMarkIcon } from '@heroicons/react/24/outline';

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
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const { data: post, isLoading, refetch } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const response = await api.get(`/posts/${postId}`);
      const data = response.data;
      setIsLiked(data.is_liked_by_current_user);
      setLikeCount(data.likes_count);
      setEditContent(data.content);
      return data;
    },
  });

  const handleLike = async () => {
    try {
      await onLike(postId);
      setIsLiked(!isLiked);
      setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    } catch (error) {
      console.error('Error toggling like:', error);
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
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-600 font-semibold">
                {post.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <p className="font-medium text-gray-800">{post.username}</p>
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
            <button className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-blue-500 transition">
              <span className="text-lg">◌</span>
              <span>{post.comments_count}</span>
            </button>
            <button className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-green-500 transition">
              <span className="text-lg">↗</span>
              <span>{post.shares_count}</span>
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
        </div>
      </div>
    </div>
  );
}