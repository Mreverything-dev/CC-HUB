// frontend/src/features/posts/components/PostCard.tsx
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { useAuthStore } from '@/features/auth/store/auth.store';
import PostDetailModal from './PostDetailModal';

interface PostCardProps {
  id: string;
  user_id: string;
  username: string;
  user_role: string;
  content: string;
  type: string;
  visibility: string;
  media_urls?: string[];  // ✅ Added media_urls
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
  media_urls = [],  // ✅ Default empty array
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
  const [showDetail, setShowDetail] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
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
      setShowDetail(false);
    }
  };

  const handleEdit = async () => {
    if (editContent.trim() && editContent !== content) {
      await onEdit(id, editContent);
      setIsEditing(false);
      setShowDetail(false);
    }
  };

  const handleCardClick = () => {
    if (!isEditing) {
      setShowDetail(true);
    }
  };

  const handleImageError = (url: string) => {
    setImageErrors(prev => new Set(prev).add(url));
  };

  // ✅ Check if media is video
  const isVideo = (url: string) => {
    return url.match(/\.(mp4|webm|mov|avi|mkv)$/i) || url.includes('video');
  };

  // ✅ Get grid classes based on number of media items
  const getGridClasses = (count: number) => {
    if (count === 0) return '';
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-2';
    return 'grid-cols-2';
  };

  // ✅ Get item span for layout
  const getItemSpan = (index: number, total: number) => {
    if (total === 1) return 'col-span-1';
    if (total === 2) return 'col-span-1';
    if (total === 3 && index === 0) return 'col-span-2';
    return 'col-span-1';
  };

  return (
    <>
      <div 
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={handleCardClick}
      >
        <Card variant="glass" className="hover:border-cyan-500/30 transition-all">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
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

            {(is_owned_by_current_user || user?.role === 'admin') && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
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
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
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
            <>
              <p className="text-gray-700 whitespace-pre-wrap line-clamp-3">{content}</p>
              {content.length > 150 && (
                <p className="text-sm text-cyan-600 hover:text-cyan-700 mt-1">
                  Click to read more →
                </p>
              )}
            </>
          )}

          {/* ✅ Media Display */}
          {!isEditing && media_urls && media_urls.length > 0 && (
            <div className={`mt-3 grid gap-2 ${getGridClasses(media_urls.length)}`}>
              {media_urls.map((url, index) => {
                const isVideoFile = isVideo(url);
                const hasError = imageErrors.has(url);

                if (hasError) {
                  return (
                    <div key={index} className={`${getItemSpan(index, media_urls.length)} bg-gray-100 rounded-lg flex items-center justify-center p-8 text-gray-400 text-sm`}>
                      🖼️ Media unavailable
                    </div>
                  );
                }

                return (
                  <div 
                    key={index} 
                    className={`${getItemSpan(index, media_urls.length)} relative overflow-hidden rounded-lg bg-gray-100`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isVideoFile ? (
                      <video
                        src={url}
                        className="w-full max-h-[400px] object-cover"
                        controls
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={url}
                        alt={`Post media ${index + 1}`}
                        className="w-full max-h-[400px] object-cover"
                        loading="lazy"
                        onError={() => handleImageError(url)}
                      />
                    )}
                    {media_urls.length > 1 && (
                      <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                        {index + 1}/{media_urls.length}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div 
            className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100/50"
            onClick={(e) => e.stopPropagation()}
          >
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
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center space-x-1 text-gray-500"
                onClick={() => setShowDetail(true)}
              >
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
      </div>

      {showDetail && (
        <PostDetailModal
          postId={id}
          onClose={() => setShowDetail(false)}
          onLike={onLike}
          onDelete={handleDelete}
          onEdit={onEdit}
        />
      )}
    </>
  );
}