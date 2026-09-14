// frontend/src/features/posts/components/PostCard.tsx
import { useState, useRef, useEffect } from 'react';
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
  GlobeAltIcon,
  UsersIcon,
  AcademicCapIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { postService } from '@/services/api/post.service';
import type { PostReportCategory } from '@/services/api/post.service';
import toast from 'react-hot-toast';
import PostDetailModal from './PostDetailModal';
import { ReportPostDialog } from './ReportPostDialog';
import { PostReactions } from './PostReactions';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { ProfileHoverCard } from '@/features/profile/components/ProfileHoverCard';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { ImageGrid, isVideoUrl } from './ImageGrid';
import { extractYouTubeId, stripYouTubeUrl } from '@/lib/youtube';
import { YouTubeEmbed } from '@/components/ui/YouTubeEmbed';
import { extractGiphyGifUrl, stripGiphyUrl } from '@/lib/giphy';

interface PostCardProps {
  id: string;
  user_id: string;
  username: string;
  user_role: string;
  avatar_url?: string | null;
  content: string;
  type: string;
  visibility: string;
  media_urls?: string[];
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  is_liked_by_current_user: boolean;
  is_shared_by_current_user: boolean;
  is_owned_by_current_user: boolean;
  reactions_count?: number;
  reaction_breakdown?: Record<string, number>;
  my_reaction?: string | null;
  is_shared?: boolean;
  shared_by_user_id?: string | null;
  shared_by_username?: string | null;
  shared_by_avatar_url?: string | null;
  shared_by_role?: string | null;
  shared_at?: string | null;
  onLike: (postId: string) => void;
  onReact?: (postId: string, reaction: string) => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string, content: string) => void;
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
  media_urls = [],
  likes_count,
  comments_count,
  shares_count,
  created_at,
  is_liked_by_current_user,
  is_shared_by_current_user,
  is_owned_by_current_user,
  reactions_count,
  reaction_breakdown = {},
  my_reaction = null,
  is_shared = false,
  shared_by_username,
  shared_by_avatar_url,
  shared_at,
  onLike,
  onReact,
  onDelete,
  onEdit,
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [heartPosition, setHeartPosition] = useState<{ x: number; y: number } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  const cardClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardLastTapRef = useRef<number>(0);

  const { user } = useAuthStore();
  const navigate = useNavigate();

  const goToAuthorProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${user_id}`);
  };

  const visibilityLabels: Record<string, string> = {
    public: 'Public',
    friends: 'Friends',
    section: 'Section',
    private: 'Private',
  };

  const visibilityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    public: GlobeAltIcon,
    friends: UsersIcon,
    section: AcademicCapIcon,
    private: LockClosedIcon,
  };

  const handleLike = async (forceLike?: boolean) => {
    try {
      if (onReact) {
        const newReaction = my_reaction === '❤️' ? null : '❤️';
        if (newReaction) {
          onReact(id, newReaction);
        }
        return;
      }

      const shouldLike = forceLike ? true : !isLiked;
      if (forceLike && isLiked) return;

      await onLike(id);
      setIsLiked(shouldLike);
      setLikeCount((prev) => {
        if (shouldLike && !isLiked) return prev + 1;
        if (!shouldLike && isLiked) return prev - 1;
        return prev;
      });
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const triggerHeartBurst = (clientX: number, clientY: number) => {
    const cardEl = cardRef.current;
    if (!cardEl) return;

    const rect = cardEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setHeartPosition({ x, y });
    setShowHeartBurst(true);
    setTimeout(() => {
      setShowHeartBurst(false);
      setHeartPosition(null);
    }, 800);

    if (onReact) {
      if (my_reaction !== '❤️') {
        onReact(id, '❤️');
      }
    } else {
      handleLike(true);
    }
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditing) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select')) return;

    const now = Date.now();
    const timeSinceLastTap = now - cardLastTapRef.current;

    if (timeSinceLastTap < 300) {
      if (cardClickTimerRef.current) {
        clearTimeout(cardClickTimerRef.current);
        cardClickTimerRef.current = null;
      }
      triggerHeartBurst(e.clientX, e.clientY);
      cardLastTapRef.current = 0;
    } else {
      cardLastTapRef.current = now;
      cardClickTimerRef.current = setTimeout(() => {
        setShowDetail(true);
        cardClickTimerRef.current = null;
      }, 300);
    }
  };

  useEffect(() => {
    return () => {
      if (cardClickTimerRef.current) clearTimeout(cardClickTimerRef.current);
    };
  }, []);

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

  const handleReportSubmit = async (reason: PostReportCategory, details: string) => {
    setIsReporting(true);
    try {
      await postService.reportPost(id, { reason, details: details.trim() || undefined });
      toast.success("Report submitted. Our team will review it.");
      setShowReportDialog(false);
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Failed to submit report';
      toast.error(message);
    } finally {
      setIsReporting(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    await onDelete(id);
    setShowDetail(false);
  };

  const handleEdit = async () => {
    if (editContent.trim() && editContent !== content) {
      await onEdit(id, editContent);
      setIsEditing(false);
      setShowDetail(false);
    }
  };

  const instanceKey = `post-${id}`;

  const youtubeId = extractYouTubeId(content);
  const giphyGifUrl = extractGiphyGifUrl(content);
  const displayContent = youtubeId
    ? stripYouTubeUrl(content)
    : giphyGifUrl
    ? stripGiphyUrl(content)
    : content;

  const VisibilityIcon = visibilityIcons[visibility] || GlobeAltIcon;

  return (
    <div key={instanceKey}>
      {is_shared && (
        <div className="flex items-center gap-2 mb-2 text-sm text-text-secondary">
          <ArrowUpTrayIcon className="h-4 w-4 flex-shrink-0" />
          <Avatar src={shared_by_avatar_url} name={shared_by_username || undefined} size="xs" />
          <span>
            <span className="font-medium text-text-primary">{shared_by_username}</span>{' '}
            shared a post
            {shared_at && <span className="text-text-muted"> · {formatRelativeTime(shared_at)}</span>}
          </span>
        </div>
      )}
      <div
        ref={cardRef}
        className="relative cursor-pointer select-none"
        onClick={handleCardClick}
      >
        {showHeartBurst && heartPosition && (
          <div
            className="absolute z-30 pointer-events-none"
            style={{
              left: heartPosition.x,
              top: heartPosition.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <HeartIconSolid
              className="h-24 w-24 text-[#EF4444] drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]"
              style={{
                animation: 'heartBurst 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
              }}
            />
          </div>
        )}

        <div className="rounded-2xl bg-glass backdrop-blur-xl p-3 sm:p-4 shadow-md shadow-black/5 transition-all duration-200">
          {/* Header */}
          <div className="flex items-start justify-between mb-3 gap-2">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <ProfileHoverCard userId={user_id}>
                <div
                  onClick={goToAuthorProfile}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition cursor-pointer overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#00C8FF] to-[#3B82F6]"
                >
                  {avatar_url ? (
                    <img src={avatar_url} alt={username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-semibold text-[#060B12]">
                      {username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
              </ProfileHoverCard>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <ProfileHoverCard userId={user_id}>
                    <p
                      onClick={goToAuthorProfile}
                      className="font-medium hover:underline cursor-pointer truncate text-text-primary"
                    >
                      {username}
                    </p>
                  </ProfileHoverCard>
                </div>
                <div className="flex items-center space-x-2 text-xs truncate text-text-muted">
                  <span>{formatRelativeTime(created_at)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <VisibilityIcon className="h-3.5 w-3.5" />
                    {visibilityLabels[visibility] || 'Public'}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-xl transition text-text-muted hover:text-text-primary hover:bg-glass"
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg py-1 z-10 bg-bg border border-border">
                  {is_owned_by_current_user && (
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setShowMenu(false);
                      }}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm transition text-text-secondary hover:bg-glass hover:text-text-primary"
                    >
                      <span className="w-4 text-center leading-none">✎</span>
                      <span>Edit</span>
                    </button>
                  )}
                  {(is_owned_by_current_user || user?.role === 'admin') && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm transition text-[#EF4444] hover:bg-[#EF4444]/10"
                    >
                      <span className="w-4 text-center leading-none">🗑</span>
                      <span>Delete</span>
                    </button>
                  )}
                  {!is_owned_by_current_user && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowReportDialog(true);
                      }}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm transition text-text-secondary hover:bg-glass hover:text-text-primary"
                    >
                      <span className="w-4 text-center leading-none">⚑</span>
                      <span>Report Post</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-3 rounded-xl border border-border bg-bg text-text-primary focus:ring-1 focus:ring-border focus:border-border focus:outline-none transition"
                rows={3}
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleEdit}
                  className="px-3 py-1.5 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] text-[#060B12] rounded-xl hover:opacity-90 transition"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-glass rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {displayContent && (
                <PostContentBody content={displayContent} compact className="text-text-primary" />
              )}
              {displayContent.length > 150 && (
                <p className="text-sm mt-1 text-[#00C8FF] hover:text-[#00E0FF]">
                  Click to read more →
                </p>
              )}
            </>
          )}

          {/* YouTube embed */}
          {!isEditing && youtubeId && (
            <div
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="mt-3"
            >
              <YouTubeEmbed videoId={youtubeId} />
            </div>
          )}

          {/* Giphy GIF */}
          {!isEditing && !youtubeId && giphyGifUrl && (
            <div
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="mt-3"
            >
              <img
                src={giphyGifUrl}
                alt="GIF"
                className="rounded-2xl max-w-full max-h-72 object-contain"
                loading="lazy"
              />
            </div>
          )}

          {/* Media Display */}
          {!isEditing && media_urls && media_urls.length > 0 && (
            <ImageGrid
              images={media_urls}
              onImageClick={(index) => {
                setLightboxIndex(index);
              }}
              onDoubleTap={(clientX, clientY) => {
                triggerHeartBurst(clientX, clientY);
              }}
            />
          )}

          {/* Reaction summary — overlapping emoji icons + counts */}
          {(reactions_count ?? 0) > 0 || comments_count > 0 ? (
            <div
              className="flex items-center justify-between mt-4 pt-3"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left: overlapping emoji icons + reaction count */}
              {(reactions_count ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-2">
                    {Object.entries(reaction_breakdown)
                      .filter(([, count]) => count > 0)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 3)
                      .map(([emoji], i) => (
                        <span
                          key={`summary-${emoji}`}
                          className="flex items-center justify-center h-7 w-7"
                          style={{ zIndex: 3 - i }}
                        >
                          <span className="text-[18px]">{emoji}</span>
                        </span>
                      ))}
                  </div>
                  <span className="text-sm text-text-secondary font-medium">
                    {reactions_count}
                  </span>
                </div>
              )}

              {/* Right: comments count */}
              {comments_count > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDetail(true)}
                  className="text-sm text-text-secondary hover:text-text-primary hover:underline transition"
                >
                  {comments_count} {comments_count === 1 ? 'Comment' : 'Comments'}
                </button>
              )}
            </div>
          ) : null}

          {/* Actions */}
          <div
            className="flex items-center justify-between mt-3 pt-3 border-t border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-1">
              {my_reaction ? (
                <button
                  type="button"
                  onClick={() => onReact?.(id, my_reaction)}
                  title="Your reaction"
                  className="flex items-center justify-center px-2.5 py-1.5 rounded-xl transition hover:bg-glass"
                >
                  <span className="text-[18px]">{my_reaction}</span>
                </button>
              ) : (
                <PostReactions
                  breakdown={reaction_breakdown}
                  myReaction={my_reaction}
                  onReact={(reaction) => onReact?.(id, reaction)}
                  size="md"
                />
              )}
              <button
                onClick={() => setShowDetail(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-glass transition"
              >
                <ChatBubbleLeftIcon className="h-[18px] w-[18px]" />
                <span className="text-sm font-medium">Comment</span>
              </button>
              <button
                onClick={handleShare}
                disabled={isSharing}
                title={isShared ? 'You already shared this post' : 'Share'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition disabled:opacity-50 ${
                  isShared ? 'text-[#10B981]' : 'text-text-secondary hover:text-[#10B981] hover:bg-glass'
                }`}
              >
                <ShareIcon className="h-[18px] w-[18px]" />
                <span className="text-sm font-medium">Share</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toast('Saving posts is coming soon');
                }}
                title="Save"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-text-secondary hover:text-[#00C8FF] hover:bg-glass transition"
              >
                <BookmarkIcon className="h-[18px] w-[18px]" />
                <span className="text-sm font-medium">Save</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && media_urls[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxIndex(null);
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(null);
            }}
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

          {isVideoUrl(media_urls[lightboxIndex]) ? (
            <video
              src={media_urls[lightboxIndex]}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={media_urls[lightboxIndex]}
              alt={`Post media ${lightboxIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {media_urls.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
              {lightboxIndex + 1} / {media_urls.length}
            </span>
          )}
        </div>
      )}

      {/* Modals */}
      {showDetail && (
        <PostDetailModal
          postId={id}
          onClose={() => setShowDetail(false)}
          onDelete={handleDelete}
          onEdit={onEdit}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Post"
          message="Are you sure you want to delete this post? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showReportDialog && (
        <ReportPostDialog
          isLoading={isReporting}
          onSubmit={handleReportSubmit}
          onCancel={() => setShowReportDialog(false)}
        />
      )}
    </div>
  );
}