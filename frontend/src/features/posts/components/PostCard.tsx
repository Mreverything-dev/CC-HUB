// frontend/src/features/posts/components/PostCard.tsx
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { useAuthStore } from '@/features/auth/store/auth.store';

interface PostCardProps {
  id: string;
  user_id: string;
  username: string;
  user_role: string;
  content: string;
  type: string;
  visibility: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  is_liked_by_current_user: boolean;
  is_owned_by_current_user: boolean;
  onLike: (postId: string) => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string, content: string) => void;
}

export function PostCard({
  id,
  username,
  user_role,
  content,
  visibility,
  likes_count,
  comments_count,
  shares_count,
  created_at,
  is_liked_by_current_user,
  is_owned_by_current_user,
  onLike,
  onDelete,
  onEdit,
}: PostCardProps) {
  const [isLiked, setIsLiked] = useState(is_liked_by_current_user);
  const [likeCount, setLikeCount] = useState(likes_count);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const { user } = useAuthStore();

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

  const handleLike = async () => {
    try {
      await onLike(id);
      setIsLiked(!isLiked);
      setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this post?')) {
      await onDelete(id);
    }
  };

  const handleEdit = async () => {
    if (editContent.trim() && editContent !== content) {
      await onEdit(id, editContent);
      setIsEditing(false);
    }
  };

  return (
    <Card variant="glass" className="hover:border-cyan-500/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-600 font-semibold">
              {username?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <p className="font-medium text-gray-800">{username}</p>
              <Badge size="sm" className={roleColors[user_role as keyof typeof roleColors]}>
                {user_role?.charAt(0).toUpperCase() + user_role?.slice(1)}
              </Badge>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <span>{formatDistanceToNow(new Date(created_at), { addSuffix: true })}</span>
              <span>•</span>
              <span>{visibilityLabels[visibility as keyof typeof visibilityLabels]}</span>
            </div>
          </div>
        </div>

        {/* Menu */}
        {(is_owned_by_current_user || user?.role === 'admin') && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded-full transition"
            >
              <span className="block w-5 text-center text-gray-400 leading-none">⋮</span>
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                {is_owned_by_current_user && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span className="w-4 text-center leading-none">✎</span>
                    <span>Edit</span>
                  </button>
                )}
                {(is_owned_by_current_user || user?.role === 'admin') && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    <span className="w-4 text-center leading-none">🗑</span>
                    <span>Delete</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            rows={3}
          />
          <div className="flex space-x-2">
            <Button size="sm" onClick={handleEdit}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <p className="text-gray-700 whitespace-pre-wrap">{content}</p>
      )}

      {/* Media (if any) */}
      {/* TODO: Add media display when implemented */}

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100/50">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={`flex items-center space-x-1 ${
              isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
            }`}
          >
            <span className={`w-4 text-center leading-none ${isLiked ? 'text-red-500' : ''}`}>
              {isLiked ? '♥' : '♡'}
            </span>
            <span>{likeCount}</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex items-center space-x-1 text-gray-500">
            <span className="w-4 text-center leading-none">◌</span>
            <span>{comments_count}</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex items-center space-x-1 text-gray-500">
            <span className="w-4 text-center leading-none">↗</span>
            <span>{shares_count}</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
