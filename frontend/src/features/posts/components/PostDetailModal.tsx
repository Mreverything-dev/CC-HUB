// frontend/src/features/posts/components/PostDetailModal.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { formatRelativeTime } from '@/lib/formatters';

import { useAuthStore } from '@/features/auth/store/auth.store';
import { postService } from '@/services/api/post.service';
import { commentService } from '@/services/api/comment.service';
import { mediaService } from '@/services/api/media.service';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmojiPicker } from './EmojiPicker';
import { PostContentBody } from './PostContentBody';
import { PostReactions } from './PostReactions';
import { usePostRoom } from '../hooks/usePostRoom';
import { Comment } from '@/types/comment.types';
import toast from 'react-hot-toast';
import {
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  PhotoIcon,
  PaperAirplaneIcon,
  ChatBubbleLeftIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';

// Keep in sync with backend ALLOWED_TYPES (images only for comment attachments)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

// "Latest comments" preview size before the "View all comments" expander -
// top-level comments only; a visible comment's own replies are always shown
// in full underneath it, never separately truncated.
const INITIAL_VISIBLE_COMMENTS = 3;

interface PostDetailModalProps {
  postId: string;
  onClose: () => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string, content: string) => void;
}

export default function PostDetailModal({
  postId,
  onClose,
  onDelete,
  onEdit,
}: PostDetailModalProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [reactionBreakdown, setReactionBreakdown] = useState<Record<string, number>>({});
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [shareCount, setShareCount] = useState(0);
  const [isShared, setIsShared] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [showAllComments, setShowAllComments] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const [commentImageFile, setCommentImageFile] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const [isUploadingCommentImage, setIsUploadingCommentImage] = useState(false);

  const postMenuRef = useRef<HTMLDivElement>(null);
  const commentImageInputRef = useRef<HTMLInputElement>(null);

  const { data: post, isLoading, refetch } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const response = await api.get(`/posts/${postId}`);
      const data = response.data;
      setReactionBreakdown(data.reaction_breakdown || {});
      setMyReaction(data.my_reaction ?? null);
      setShareCount(data.shares_count);
      setIsShared(data.is_shared_by_current_user);
      setEditContent(data.content);
      return data;
    },
  });

  useEffect(() => {
    fetchComments();
  }, [postId]);

  // Real-time updates while this modal is open - joins post_{postId}'s room
  // (see usePostRoom) so reactions/comments/shares made by OTHER connected
  // users appear here without a manual refresh, and this user's own actions
  // in another tab/device stay in sync too.
  usePostRoom(postId, {
    onReactionUpdated: (data) => {
      setReactionBreakdown(data.reaction_breakdown);
      if (data.user_id === user?.id) setMyReaction(data.reaction);
    },
    onCommentAdded: (data) => {
      setComments((prev) => (prev.some((c) => c.id === data.comment.id) ? prev : [data.comment as unknown as Comment, ...prev]));
    },
    onCommentDeleted: (data) => {
      setComments((prev) => prev.filter((c) => c.id !== data.comment_id));
      setReplyingTo((prev) => (prev?.id === data.comment_id ? null : prev));
    },
    onCommentReactionUpdated: (data) => {
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== data.comment_id) return c;
          const next = { ...c, reaction_breakdown: data.reaction_breakdown, reactions_count: data.reactions_count };
          if (data.user_id === user?.id) next.my_reaction = data.reaction;
          return next;
        })
      );
    },
    onShareUpdated: (data) => setShareCount(data.shares_count),
  });

  useEffect(() => {
    if (!showPostMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (postMenuRef.current && !postMenuRef.current.contains(e.target as Node)) {
        setShowPostMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showPostMenu]);

  useEffect(() => {
    return () => {
      if (commentImagePreview) URL.revokeObjectURL(commentImagePreview);
    };
  }, [commentImagePreview]);

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

  const handleReact = async (reaction: string) => {
    const previousBreakdown = reactionBreakdown;
    const previousMyReaction = myReaction;
    const nextReaction = myReaction === reaction ? null : reaction;
    // Optimistic update, corrected by the server response below (and kept
    // in sync afterward by post:reaction_updated via usePostRoom).
    setReactionBreakdown((prev) => {
      const next = { ...prev };
      if (previousMyReaction) next[previousMyReaction] = Math.max(0, (next[previousMyReaction] || 1) - 1);
      if (nextReaction) next[nextReaction] = (next[nextReaction] || 0) + 1;
      return next;
    });
    setMyReaction(nextReaction);
    try {
      const response = await postService.reactToPost(postId, reaction);
      setReactionBreakdown(response.data.reaction_breakdown);
      setMyReaction(response.data.reaction);
    } catch (error) {
      console.error('Error reacting to post:', error);
      setReactionBreakdown(previousBreakdown);
      setMyReaction(previousMyReaction);
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
    } else {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    setShowDeletePostConfirm(false);
    await onDelete(postId);
    onClose();
  };

  const handleCommentImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Unsupported image type');
      return;
    }
    setCommentImageFile(file);
    setCommentImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const removeCommentImage = () => {
    if (commentImagePreview) URL.revokeObjectURL(commentImagePreview);
    setCommentImageFile(null);
    setCommentImagePreview(null);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() && !commentImageFile) return;
    setIsPostingComment(true);
    try {
      let uploadedImageUrl: string | undefined;
      if (commentImageFile) {
        setIsUploadingCommentImage(true);
        try {
          const uploaded = await mediaService.uploadFiles([commentImageFile]);
          uploadedImageUrl = uploaded.urls[0];
        } catch (uploadErr: any) {
          toast.error(uploadErr.response?.data?.detail || 'Failed to upload image');
          setIsUploadingCommentImage(false);
          setIsPostingComment(false);
          return;
        }
        setIsUploadingCommentImage(false);
      }

      const response = await commentService.createComment(postId, {
        content: newComment.trim(),
        image_url: uploadedImageUrl,
        parent_id: replyingTo?.id ?? null,
      });
      // Dedup by id - the post:comment_added broadcast (see usePostRoom
      // below) travels over a separate connection from this HTTP response
      // and can arrive at this same client first, since it's already
      // joined to this post's room while the modal is open. Without this
      // check, both paths would unconditionally prepend the same comment,
      // producing a real duplicate entry in the array (same id twice) -
      // that was the exact cause of the visual "double comment on Enter"
      // bug, self-correcting only because closing/reopening re-fetches the
      // true (single) list from the server.
      setComments((prev) => (prev.some((c) => c.id === response.data.id) ? prev : [response.data, ...prev]));
      setNewComment('');
      setReplyingTo(null);
      removeCommentImage();
      refetch();
    } catch (error: any) {
      console.error('Error posting comment:', error);
      toast.error(error.response?.data?.detail || 'Failed to post comment');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleReactComment = async (commentId: string, reaction: string) => {
    const previous = comments.find((c) => c.id === commentId);
    try {
      const response = await commentService.reactToComment(commentId, reaction);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, my_reaction: response.data.reaction, reaction_breakdown: response.data.reaction_breakdown, reactions_count: response.data.reactions_count }
            : c
        )
      );
    } catch (error) {
      console.error('Error reacting to comment:', error);
      if (previous) setComments((prev) => prev.map((c) => (c.id === commentId ? previous : c)));
    }
  };

  const handleReplyClick = (comment: Comment) => {
    setReplyingTo({ id: comment.id, username: comment.username });
    commentInputRef.current?.focus();
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
    try {
      await commentService.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setReplyingTo((prev) => (prev?.id === commentId ? null : prev));
      refetch();
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete comment');
    } finally {
      setDeleteCommentTarget(null);
    }
  };

  const topLevelComments = comments.filter((c) => !c.parent_id);
  const repliesByParent = new Map<string, Comment[]>();
  comments.forEach((c) => {
    if (!c.parent_id) return;
    const list = repliesByParent.get(c.parent_id) || [];
    list.push(c);
    repliesByParent.set(c.parent_id, list);
  });
  const visibleTopLevel = showAllComments ? topLevelComments : topLevelComments.slice(0, INITIAL_VISIBLE_COMMENTS);

  // Mirrors the nested-reply rendering already used for livestream chat
  // (LiveStreamStage.tsx's renderComment) - same ml-10 indentation for a
  // reply, and Reply is only offered on top-level comments (no reply-to-a-
  // reply threading, matching that existing pattern).
  const renderCommentNode = (comment: Comment, isReply: boolean) => (
    <div key={comment.id} className={`flex items-start gap-2 ${isReply ? 'ml-9 sm:ml-10 mt-2' : ''}`}>
      <button onClick={() => navigate(`/profile/${comment.user_id}`)} className="flex-shrink-0">
        <Avatar src={comment.avatar_url} name={comment.username} size="sm" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="bg-[#111E2B] border border-[#1E3447] rounded-2xl px-3 py-2">
          <button
            onClick={() => navigate(`/profile/${comment.user_id}`)}
            className="text-sm font-medium text-[#F1F5F9] hover:text-[#00C8FF] transition"
          >
            {comment.username}
          </button>
          {editingCommentId === comment.id ? (
            <div className="mt-1.5 space-y-1.5">
              <textarea
                value={editingCommentContent}
                onChange={(e) => setEditingCommentContent(e.target.value)}
                rows={2}
                className="w-full p-2 rounded-lg border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveEditComment(comment.id)}
                  className="px-3 py-1 text-xs font-semibold bg-[#00C8FF] text-[#060B12] rounded-lg hover:opacity-90 transition"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingCommentId(null)}
                  className="px-3 py-1 text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {comment.content && (
                <p className="text-sm text-[#CBD5E1] whitespace-pre-wrap break-words">{comment.content}</p>
              )}
              {comment.image_url && (
                <img src={comment.image_url} alt="" className="mt-1.5 rounded-xl max-w-full max-h-56 object-cover" />
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 px-1 text-xs text-[#64748B] flex-wrap">
          <span>{formatRelativeTime(comment.created_at)}</span>
          <PostReactions
            breakdown={comment.reaction_breakdown || {}}
            myReaction={comment.my_reaction ?? null}
            onReact={(reaction) => handleReactComment(comment.id, reaction)}
            size="sm"
          />
          {!isReply && (
            <button
              onClick={() => handleReplyClick(comment)}
              className="flex items-center gap-1 hover:text-[#00C8FF] transition font-medium"
            >
              Reply
            </button>
          )}
          {comment.is_owned_by_current_user && editingCommentId !== comment.id && (
            <>
              <button
                onClick={() => handleStartEditComment(comment)}
                className="flex items-center gap-1 hover:text-[#00C8FF] transition"
              >
                <PencilIcon className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={() => setDeleteCommentTarget(comment.id)}
                className="flex items-center gap-1 hover:text-[#EF4444] transition"
              >
                <TrashIcon className="h-3 w-3" /> Delete
              </button>
            </>
          )}
        </div>

        {!isReply &&
          (repliesByParent.get(comment.id) || [])
            .slice()
            .reverse() // comments arrive newest-first; a reply thread reads naturally oldest-first
            .map((reply) => renderCommentNode(reply, true))}
      </div>
    </div>
  );

  const visibilityLabels: Record<string, string> = {
    public: '🌍 Public',
    friends: '👥 Friends',
    section: '📚 Section',
    private: '🔒 Private',
  };

  if (isLoading || !post) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF]" />
      </div>
    );
  }

  const isOwner = user?.id === post.user_id || user?.role === 'admin';

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50"
      onClick={() => !isPostingComment && onClose()}
    >
      <div
        className="bg-[#0D1722] w-full sm:max-w-2xl sm:rounded-2xl border border-[#1E3447] shadow-2xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0D1722] border-b border-[#1E3447] p-4 flex items-start justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(`/profile/${post.user_id}`)} className="flex-shrink-0">
              <Avatar src={post.avatar_url} name={post.username} size="md" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => navigate(`/profile/${post.user_id}`)}
                  className="font-medium text-[#F1F5F9] hover:text-[#00C8FF] transition truncate"
                >
                  {post.username}
                </button>
                <RoleBadge role={post.user_role} />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#64748B] mt-0.5">
                <span>{formatRelativeTime(post.created_at)}</span>
                <span>•</span>
                <span>{visibilityLabels[post.visibility] || post.visibility}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {isOwner && (
              <div className="relative" ref={postMenuRef}>
                <button
                  onClick={() => setShowPostMenu((v) => !v)}
                  title="More options"
                  className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-lg transition"
                >
                  <EllipsisVerticalIcon className="h-5 w-5" />
                </button>
                {showPostMenu && (
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl z-20 overflow-hidden">
                    <button
                      onClick={() => {
                        setShowPostMenu(false);
                        setIsEditing(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[#00C8FF] hover:bg-[#00C8FF]/10 transition"
                    >
                      <PencilIcon className="h-4 w-4" />
                      Edit Post
                    </button>
                    <button
                      onClick={() => {
                        setShowPostMenu(false);
                        setShowDeletePostConfirm(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[#EF4444] hover:bg-[#EF4444]/10 transition"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete Post
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => !isPostingComment && onClose()}
              disabled={isPostingComment}
              title="Close"
              className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-lg transition disabled:opacity-40"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto themed-scrollbar">
          <div className="p-4 sm:p-5">
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition resize-none"
                  rows={6}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleEdit}
                    className="px-4 py-2 text-sm font-semibold bg-[#00C8FF] text-[#060B12] rounded-xl hover:opacity-90 transition"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(post.content);
                    }}
                    className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <PostContentBody content={post.content} className="text-[#E2E8F0]" />
            )}

            {/* Actions */}
            <div className="flex items-center gap-4 sm:gap-6 pt-4 mt-4 border-t border-[#1E3447] flex-wrap">
              <PostReactions breakdown={reactionBreakdown} myReaction={myReaction} onReact={handleReact} size="md" />
              <div className="flex items-center gap-1.5 text-sm font-medium text-[#94A3B8]">
                <ChatBubbleLeftIcon className="h-5 w-5" />
                <span>{comments.length}</span>
              </div>
              <button
                onClick={handleShare}
                disabled={isSharing}
                title={isShared ? 'You already shared this post' : 'Share'}
                className={`flex items-center gap-1.5 text-sm font-medium transition disabled:opacity-50 ${
                  isShared ? 'text-[#22C55E]' : 'text-[#94A3B8] hover:text-[#22C55E]'
                }`}
              >
                <ArrowUpTrayIcon className="h-5 w-5" />
                <span>{shareCount}</span>
              </button>
            </div>

            {/* Comments */}
            <div className="mt-4 pt-4 border-t border-[#1E3447]">
              <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">
                Comments {comments.length > 0 && `(${comments.length})`}
              </h3>

              {commentsLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#00C8FF]" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-4">No comments yet. Be the first!</p>
              ) : (
                <div className="space-y-3">
                  {!showAllComments && topLevelComments.length > INITIAL_VISIBLE_COMMENTS && (
                    <button
                      onClick={() => setShowAllComments(true)}
                      className="text-xs font-medium text-[#00C8FF] hover:text-[#00E0FF] transition"
                    >
                      View all {topLevelComments.length} comments
                    </button>
                  )}
                  {!showAllComments && topLevelComments.length <= INITIAL_VISIBLE_COMMENTS && topLevelComments.length > 0 && (
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">Latest comments</p>
                  )}
                  {visibleTopLevel.map((comment) => renderCommentNode(comment, false))}
                  {showAllComments && topLevelComments.length > INITIAL_VISIBLE_COMMENTS && (
                    <button
                      onClick={() => setShowAllComments(false)}
                      className="text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition"
                    >
                      Show less
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky comment composer */}
        <div className="flex-shrink-0 border-t border-[#1E3447] bg-[#0D1722] p-3 sm:p-4">
          {replyingTo && (
            <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-lg bg-[#0A111A] border border-[#1E3447] text-xs">
              <span className="text-[#94A3B8]">
                Replying to <span className="text-[#00C8FF] font-medium">@{replyingTo.username}</span>
              </span>
              <button
                onClick={() => setReplyingTo(null)}
                title="Cancel reply"
                className="p-0.5 text-[#64748B] hover:text-[#F1F5F9] rounded-full hover:bg-white/5 transition"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {commentImageFile && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl border border-[#1E3447] bg-[#0A111A]">
              <img src={commentImagePreview!} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
              <span className="text-sm text-[#F1F5F9] truncate flex-1">{commentImageFile.name}</span>
              <button
                onClick={removeCommentImage}
                disabled={isUploadingCommentImage}
                className="p-1 text-[#64748B] hover:text-[#F1F5F9] rounded-full hover:bg-white/5 transition disabled:opacity-50"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={commentImageInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(',')}
              onChange={handleCommentImageSelect}
              className="hidden"
            />
            <button
              onClick={() => commentImageInputRef.current?.click()}
              disabled={isUploadingCommentImage}
              title="Attach an image"
              className="p-1.5 text-[#64748B] hover:text-[#00C8FF] hover:bg-white/5 rounded-lg transition disabled:opacity-50 flex-shrink-0"
            >
              <PhotoIcon className="h-5 w-5" />
            </button>
            <EmojiPicker align="left" onSelect={(emoji) => setNewComment((prev) => prev + emoji)} />
            <textarea
              ref={commentInputRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
              placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Write a comment...'}
              rows={1}
              className="flex-1 px-3 py-2 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition resize-none max-h-24"
            />
            <button
              onClick={handleAddComment}
              disabled={(!newComment.trim() && !commentImageFile) || isPostingComment}
              className="p-2 bg-[#00C8FF] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {showDeletePostConfirm && (
        <ConfirmDialog
          title="Delete Post"
          message="Are you sure you want to delete this post? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeletePostConfirm(false)}
        />
      )}

      {deleteCommentTarget && (
        <ConfirmDialog
          title="Delete Comment"
          message="Are you sure you want to delete this comment?"
          confirmLabel="Delete"
          onConfirm={() => handleDeleteComment(deleteCommentTarget)}
          onCancel={() => setDeleteCommentTarget(null)}
        />
      )}
    </div>
  );
}
