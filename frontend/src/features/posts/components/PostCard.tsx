// frontend/src/features/posts/components/PostCard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '@/lib/formatters';
import { PostContentBody } from './PostContentBody';
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  ShareIcon,
  BookmarkIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { postService } from '@/services/api/post.service';
import toast from 'react-hot-toast';
import PostDetailModal from './PostDetailModal';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';

interface PostCardProps {
  id: string;
  user_id: string;
  username: string;
  user_role: string;
  avatar_url?: string | null;
  content: string;
  type: string;
  visibility: string;
  media_urls?: string[];  // ✅ Added media_urls
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  is_liked_by_current_user: boolean;
  is_shared_by_current_user: boolean;
  is_owned_by_current_user: boolean;
  onLike: (postId: string) => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string, content: string) => void;
  /** Charcoal/cyan theme for the redesigned dashboard. Defaults to the original light theme. */
  dark?: boolean;
}

export function PostCard({
  id,
  user_id,
  username,
  user_role,
  avatar_url,
  content,
  visibility,
  media_urls = [],  // ✅ Default empty array
  likes_count,
  comments_count,
  shares_count,
  created_at,
  is_liked_by_current_user,
  is_shared_by_current_user,
  is_owned_by_current_user,
  onLike,
  onDelete,
  onEdit,
  dark = false,
}: PostCardProps) {
  const [isLiked, setIsLiked] = useState(is_liked_by_current_user);
  const [likeCount, setLikeCount] = useState(likes_count);
  const [shareCount, setShareCount] = useState(shares_count);
  const [isShared, setIsShared] = useState(is_shared_by_current_user);
  const [isSharing, setIsSharing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [showDetail, setShowDetail] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const goToAuthorProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${user_id}`);
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

  const handleLike = async () => {
    try {
      await onLike(id);
      setIsLiked(!isLiked);
      setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isShared) {
      toast('You already shared this post');
      return;
    }
    setIsSharing(true);
    try {
      const response = await postService.sharePost(id);
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

  const cardClassName = dark
    ? 'rounded-2xl border border-[rgba(0,200,245,0.18)] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl p-4 sm:p-6 hover:border-[#00C8FF]/35 transition-all duration-200'
    : 'glass rounded-xl p-6 transition-all duration-200 hover:shadow-lg hover:border-cyan-500/30';

  return (
    <>
      <div
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={handleCardClick}
      >
        <div className={cardClassName}>
          {/* Header */}
          <div className="flex items-start justify-between mb-3 gap-2">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div
                onClick={goToAuthorProfile}
                className={`w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition cursor-pointer overflow-hidden flex-shrink-0 ${
                  dark ? 'bg-gradient-to-br from-[#00C8FF] to-[#3B82F6]' : 'bg-gray-200'
                }`}
              >
                {avatar_url ? (
                  <img src={avatar_url} alt={username} className="w-full h-full object-cover" />
                ) : (
                  <span className={`font-semibold ${dark ? 'text-[#060B12]' : 'text-gray-600'}`}>
                    {username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <p
                    onClick={goToAuthorProfile}
                    className={`font-medium hover:underline cursor-pointer truncate ${dark ? 'text-[#F1F5F9]' : 'text-gray-800'}`}
                  >
                    {username}
                  </p>
                  {dark ? (
                    <RoleBadge role={user_role} />
                  ) : (
                    <Badge size="sm" className={roleColors[user_role as keyof typeof roleColors]}>
                      {user_role?.charAt(0).toUpperCase() + user_role?.slice(1)}
                    </Badge>
                  )}
                </div>
                <div className={`flex items-center space-x-2 text-xs truncate ${dark ? 'text-[#64748B]' : 'text-gray-400'}`}>
                  <span>{formatRelativeTime(created_at)}</span>
                  <span>•</span>
                  <span>{visibilityLabels[visibility as keyof typeof visibilityLabels]}</span>
                </div>
              </div>
            </div>

            {(is_owned_by_current_user || user?.role === 'admin') && (
              <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className={`p-1.5 rounded-xl transition ${dark ? 'text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5' : 'hover:bg-gray-100'}`}
                >
                  {dark ? (
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  ) : (
                    <span className="block w-5 text-center leading-none text-gray-400">⋮</span>
                  )}
                </button>
                {showMenu && (
                  <div
                    className={`absolute right-0 mt-2 w-48 rounded-xl shadow-lg py-1 z-10 ${
                      dark ? 'bg-[#111E2B] border border-[#1E3447]' : 'bg-white border border-gray-100'
                    }`}
                  >
                    {is_owned_by_current_user && (
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setShowMenu(false);
                        }}
                        className={`flex items-center space-x-2 w-full px-4 py-2 text-sm transition ${
                          dark ? 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="w-4 text-center leading-none">✎</span>
                        <span>Edit</span>
                      </button>
                    )}
                    {(is_owned_by_current_user || user?.role === 'admin') && (
                      <button
                        onClick={handleDelete}
                        className={`flex items-center space-x-2 w-full px-4 py-2 text-sm transition ${
                          dark ? 'text-[#EF4444] hover:bg-[#EF4444]/10' : 'text-red-600 hover:bg-red-50'
                        }`}
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
                className={
                  dark
                    ? 'w-full p-3 rounded-xl border border-[#1E3447] bg-[#0A111A] text-[#F1F5F9] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition'
                    : 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent'
                }
                rows={3}
              />
              <div className="flex space-x-2">
                {dark ? (
                  <>
                    <button
                      onClick={handleEdit}
                      className="px-3 py-1.5 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] text-[#060B12] rounded-xl hover:opacity-90 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={handleEdit}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <PostContentBody content={content} compact className={dark ? 'text-[#CBD5E1]' : 'text-gray-700'} />
              {content.length > 150 && (
                <p className={`text-sm mt-1 ${dark ? 'text-[#00C8FF] hover:text-[#00E0FF]' : 'text-cyan-500 hover:text-cyan-400'}`}>
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
                    <div
                      key={index}
                      className={`${getItemSpan(index, media_urls.length)} rounded-xl flex items-center justify-center p-8 text-sm ${
                        dark ? 'bg-[#0A111A] text-[#64748B]' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      🖼️ Media unavailable
                    </div>
                  );
                }

                return (
                  <div
                    key={index}
                    className={`${getItemSpan(index, media_urls.length)} relative overflow-hidden rounded-xl ${dark ? 'bg-[#0A111A]' : 'bg-gray-100'}`}
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
                        className="w-full max-h-[400px] object-cover cursor-zoom-in"
                        loading="lazy"
                        onError={() => handleImageError(url)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxIndex(index);
                        }}
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
            className={`flex items-center justify-between mt-4 pt-4 border-t ${dark ? 'border-[#1E3447]' : 'border-gray-100/50'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-1">
              {dark ? (
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition ${
                    isLiked ? 'text-[#EF4444]' : 'text-[#94A3B8] hover:text-[#EF4444] hover:bg-white/5'
                  }`}
                >
                  {isLiked ? <HeartIconSolid className="h-[18px] w-[18px]" /> : <HeartIcon className="h-[18px] w-[18px]" />}
                  <span className="text-sm">{likeCount}</span>
                </button>
              ) : (
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
              )}
              {dark ? (
                <button
                  onClick={() => setShowDetail(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 transition"
                >
                  <ChatBubbleLeftIcon className="h-[18px] w-[18px]" />
                  <span className="text-sm">{comments_count}</span>
                </button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center space-x-1 text-gray-500"
                  onClick={() => setShowDetail(true)}
                >
                  <span className="w-4 text-center leading-none">◌</span>
                  <span>{comments_count}</span>
                </Button>
              )}
              {dark ? (
                <button
                  onClick={handleShare}
                  disabled={isSharing}
                  title={isShared ? 'You already shared this post' : 'Share'}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition disabled:opacity-50 ${
                    isShared ? 'text-[#10B981]' : 'text-[#94A3B8] hover:text-[#10B981] hover:bg-white/5'
                  }`}
                >
                  <ShareIcon className="h-[18px] w-[18px]" />
                  <span className="text-sm">{shareCount}</span>
                </button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  disabled={isSharing}
                  title={isShared ? 'You already shared this post' : 'Share'}
                  className={`flex items-center space-x-1 disabled:opacity-50 ${
                    isShared ? 'text-green-500' : 'text-gray-500 hover:text-green-500'
                  }`}
                >
                  <span className="w-4 text-center leading-none">↗</span>
                  <span>{shareCount}</span>
                </Button>
              )}
              {dark && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toast('Saving posts is coming soon');
                  }}
                  title="Save"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[#94A3B8] hover:text-[#00C8FF] hover:bg-white/5 transition"
                >
                  <BookmarkIcon className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {lightboxIndex !== null && media_urls[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            title="Close"
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>

          {media_urls.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => ((i ?? 0) - 1 + media_urls.length) % media_urls.length);
                }}
                title="Previous"
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition"
              >
                <ChevronLeftIcon className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => ((i ?? 0) + 1) % media_urls.length);
                }}
                title="Next"
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition"
              >
                <ChevronRightIcon className="h-6 w-6" />
              </button>
            </>
          )}

          <img
            src={media_urls[lightboxIndex]}
            alt={`Post media ${lightboxIndex + 1}`}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {media_urls.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
              {lightboxIndex + 1} / {media_urls.length}
            </span>
          )}
        </div>
      )}

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