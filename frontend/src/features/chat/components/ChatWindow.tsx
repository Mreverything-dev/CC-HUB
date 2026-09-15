// frontend/src/features/chat/components/ChatWindow.tsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useFriends } from '@/features/friends/hooks/useFriends';
import { formatChatTime } from '@/lib/formatters';
import { useTick } from '@/hooks/useTick';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { ConversationAvatar } from './ConversationAvatar';
import { GroupMembersModal } from './GroupMembersModal';
import { ChangeGroupLogoModal } from './ChangeGroupLogoModal';
import { mediaService } from '@/services/api/media.service';
import { chatApi } from '@/services/api/chat.service';
import { MessageReactions } from './MessageReactions';
import { EmojiPicker } from '@/features/posts/components/EmojiPicker';
import { GifPickerModal } from '@/features/posts/components/GifPickerModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { extractYouTubeId } from '@/lib/youtube';
import { YouTubeEmbed } from '@/components/ui/YouTubeEmbed';
import { extractGiphyGifUrl } from '@/lib/giphy';
import toast from 'react-hot-toast';
import {
  PaperAirplaneIcon,
  PhotoIcon,
  XMarkIcon,
  MinusIcon,
  DocumentIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  EllipsisVerticalIcon,
  UserIcon,
  CameraIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const ALLOWED_ATTACHMENT_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'image/bmp', 'image/tiff', 'image/heic', 'image/heif', 'image/avif',
  // Videos (all common types)
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/x-ms-wmv', 'video/x-flv', 'video/mpeg',
  'video/mp2t', 'video/3gpp', 'video/3gpp2', 'video/ogg', 'video/x-m4v',
  'video/x-ms-asf', 'video/x-msvideo',
  // Documents
  'application/pdf', 'application/msword', 'text/plain', 'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

function attachmentTypeOf(file: File): 'image' | 'video' | 'file' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
}

interface ChatWindowProps {
  conversationId: string;
  onBack?: () => void;
  onMinimize?: () => void;
  onClose?: () => void;
}

export function ChatWindow({ conversationId, onBack, onMinimize, onClose }: ChatWindowProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentConversation,
    messages,
    getMessages,
    sendMessage,
    handleTyping,
    isLoading,
    typingByConversation,
    updateConversation,
    deleteConversation,
    unsendMessage,
    removeMessageForMe,
  } = useChat();
  const { friends } = useFriends();
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const gifButtonRef = useRef<HTMLButtonElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [canEditLogo, setCanEditLogo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [messageMenuFor, setMessageMenuFor] = useState<string | null>(null);
  const [messageMenuPos, setMessageMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [unsendTarget, setUnsendTarget] = useState<string | null>(null);
  const [isUnsending, setIsUnsending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const messageMenuRef = useRef<HTMLDivElement>(null);
  const messageMenuTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Backread / infinite-scroll state
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showMoreMenu]);

  useEffect(() => {
    if (!messageMenuFor) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        messageMenuRef.current?.contains(target) ||
        messageMenuTriggerRef.current?.contains(target)
      ) {
        return;
      }
      setMessageMenuFor(null);
      setMessageMenuPos(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [messageMenuFor]);

  useTick(30000);

  const typingUserIds = (typingByConversation[conversationId] || []).filter((id) => id !== user?.id);
  const typingNames = typingUserIds
    .map((id) => currentConversation?.participants?.find((p: any) => p.id === id)?.username)
    .filter(Boolean) as string[];

  useEffect(() => {
    if (conversationId) {
      getMessages(conversationId);
    }
  }, [conversationId, getMessages]);

  useEffect(() => {
    if (currentConversation?.type !== 'group') {
      setCanEditLogo(false);
      return;
    }
    let cancelled = false;
    chatApi
      .getGroupLogoPermission(currentConversation.id)
      .then((res) => {
        if (!cancelled) setCanEditLogo(res.data.can_edit_logo);
      })
      .catch(() => {
        if (!cancelled) setCanEditLogo(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentConversation?.type, currentConversation?.id]);

  const hasScrolledRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (messages.length === 0) return;
    const isFirstScrollForConversation = hasScrolledRef.current !== conversationId;
    hasScrolledRef.current = conversationId;
    scrollToBottom(isFirstScrollForConversation ? 'auto' : 'smooth');
  }, [messages, typingUserIds.length, conversationId, isLoading]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Reset backread state when switching conversations
  useEffect(() => {
    setHasMore(true);
    setIsLoadingMore(false);
  }, [conversationId]);

  // Auto-load older messages when the user scrolls to the top
  const handleScrollBackread = async (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop > 40) return;
    if (!hasMore || isLoadingMore || isLoading || messages.length === 0) return;

    const oldest = messages[0];
    if (!oldest?.created_at) return;

    setIsLoadingMore(true);
    const prevScrollHeight = el.scrollHeight;
    const prevScrollTop = el.scrollTop;

    try {
      const loaded = await getMessages(conversationId, {
        limit: 50,
        before: oldest.created_at,
        append: true,
      });
      if (!loaded || loaded.length < 50) setHasMore(false);

      // Preserve scroll position so the view doesn't jump
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          const newScrollHeight = messagesContainerRef.current.scrollHeight;
          messagesContainerRef.current.scrollTop =
            newScrollHeight - prevScrollHeight + prevScrollTop;
        }
      });
    } catch {
      // toast is already shown by getMessages
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    return () => {
      if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    };
  }, [attachmentPreview]);

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large. Maximum ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      return;
    }

    // Check MIME type — but also allow if the file extension is a known
    // video/image type, in case the browser sends an empty or non-standard
    // MIME type (common for screen recordings and some Android phones).
    const isKnownMime = ALLOWED_ATTACHMENT_TYPES.includes(file.type);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const videoExts = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'wmv', 'flv', 'mpeg', 'mpg', '3gp', 'm4v', 'ogv'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'heic', 'heif', 'avif'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'zip', 'xls', 'xlsx', 'ppt', 'pptx'];
    const isKnownExt = [...videoExts, ...imageExts, ...docExts].includes(ext);

    if (!isKnownMime && !isKnownExt) {
      toast.error('Unsupported file type');
      return;
    }

    setAttachmentFile(file);
    setAttachmentPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file.type.startsWith('image/') || file.type.startsWith('video/') || videoExts.includes(ext) || imageExts.includes(ext)
        ? URL.createObjectURL(file)
        : null;
    });
  };

  const removeAttachment = () => {
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    setAttachmentFile(null);
    setAttachmentPreview(null);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !attachmentFile) return;

    if (attachmentFile) {
      setIsUploadingAttachment(true);
      try {
        // Rename the file to a safe name (no spaces / colons / special chars)
        // before uploading — screen recordings and files with spaces often
        // fail MinIO's upload because the object name can't contain them.
        const ext = attachmentFile.name.split('.').pop() || 'bin';
        const safeName = `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const safeFile = new File([attachmentFile], safeName, { type: attachmentFile.type });

        const uploaded = await mediaService.uploadFiles([safeFile]);
        sendMessage(conversationId, newMessage.trim() || '​', {
          type: attachmentTypeOf(safeFile),
          mediaUrl: uploaded.urls[0],
          mediaName: attachmentFile.name, // keep the original name for display
        });
      } catch (err: any) {
        toast.error(err.response?.data?.detail || 'Failed to upload attachment');
        setIsUploadingAttachment(false);
        return;
      }
      setIsUploadingAttachment(false);
      removeAttachment();
    } else {
      sendMessage(conversationId, newMessage);
    }

    setNewMessage('');
    setIsTyping(false);
    handleTyping(conversationId, false);
  };

  const handleTypingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (value.trim()) {
      if (!isTyping) {
        setIsTyping(true);
        handleTyping(conversationId, true);
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        handleTyping(conversationId, false);
      }, 1000);
    } else {
      setIsTyping(false);
      handleTyping(conversationId, false);
    }
  };

  const otherParticipant = currentConversation?.type === 'direct'
    ? currentConversation.participants?.find((p: any) => p.id !== user?.id)
    : null;

  const getConversationName = () => {
    if (!currentConversation) return 'Chat';
    if (currentConversation.type === 'group') {
      return currentConversation.name || 'Group Chat';
    }
    return otherParticipant?.username || 'User';
  };

  const otherFriendRecord = otherParticipant
    ? friends.find((f) => f.user_id === otherParticipant.id)
    : undefined;
  const isOtherOnline = otherFriendRecord ? otherFriendRecord.is_online : null;

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
  };

  const handleGifSelect = (gifUrl: string) => {
    sendMessage(conversationId, gifUrl);
  };

  const handleDeleteChat = async () => {
    if (!currentConversation) return;
    setIsDeletingChat(true);
    try {
      await deleteConversation(currentConversation.id);
      setShowDeleteConfirm(false);
      onBack?.();
    } finally {
      setIsDeletingChat(false);
    }
  };

  const handleConfirmUnsend = async () => {
    if (!unsendTarget) return;
    setIsUnsending(true);
    try {
      unsendMessage(unsendTarget);
      setUnsendTarget(null);
    } finally {
      setIsUnsending(false);
    }
  };

  const handleRemoveForMe = async (messageId: string) => {
    setMessageMenuFor(null);
    setMessageMenuPos(null);
    await removeMessageForMe(messageId);
  };

  const openMessageMenu = (e: React.MouseEvent<HTMLButtonElement>, messageId: string) => {
    e.stopPropagation();
    if (messageMenuFor === messageId) {
      setMessageMenuFor(null);
      setMessageMenuPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const MENU_WIDTH = 160;
    const MENU_HEIGHT = 80;
    let left = rect.left - MENU_WIDTH - 4;
    let top = rect.top;

    if (left < 8) left = rect.right + 4;

    if (top + MENU_HEIGHT > window.innerHeight - 8) {
      top = window.innerHeight - MENU_HEIGHT - 8;
    }
    if (top < 8) top = 8;

    messageMenuTriggerRef.current = e.currentTarget;
    setMessageMenuPos({ top, left });
    setMessageMenuFor(messageId);
  };

  if (!currentConversation) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-bg">
        <div className="text-center text-text-muted">
          <p className="text-2xl">💬</p>
          <p className="mt-2 text-text-secondary">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-bg">
      {/* Header */}
      <div className="px-2.5 py-2 border-b border-border flex items-center gap-2 flex-shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            title="Back to conversations"
            className="p-1.5 -ml-0.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-glass-hover transition flex-shrink-0"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
        )}
        <ConversationAvatar conversation={currentConversation} currentUserId={user?.id} size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text-primary truncate leading-tight">{getConversationName()}</h3>
          <p className="text-[11px] text-text-muted flex items-center gap-1.5 leading-tight">
            {currentConversation.type === 'group' ? (
              <button
                type="button"
                onClick={() => setShowMembersModal(true)}
                className="hover:text-[#00C8FF] hover:underline transition"
              >
                {currentConversation.participants?.length || 0} members
              </button>
            ) : isOtherOnline !== null ? (
              <>
                <span className={`h-1.5 w-1.5 rounded-full ${isOtherOnline ? 'bg-[#22C55E]' : 'bg-text-muted'}`} />
                {isOtherOnline ? 'Online' : 'Offline'}
              </>
            ) : (
              'Direct message'
            )}
          </p>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              title="More"
              aria-haspopup="menu"
              aria-expanded={showMoreMenu}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-glass-hover transition"
            >
              <EllipsisVerticalIcon className="h-4 w-4" />
            </button>
            {showMoreMenu && (
              <div role="menu" className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-bg shadow-xl py-1 z-20">
                {otherParticipant && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMoreMenu(false);
                      navigate(`/profile/${otherParticipant.id}`);
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-glass-hover hover:text-text-primary transition"
                  >
                    <UserIcon className="h-4 w-4" />
                    View Profile
                  </button>
                )}
                {currentConversation.type === 'group' && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowMembersModal(true);
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-glass-hover hover:text-text-primary transition"
                  >
                    <UserIcon className="h-4 w-4" />
                    View Members
                  </button>
                )}
                {currentConversation.type === 'group' && canEditLogo && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowLogoModal(true);
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-glass-hover hover:text-text-primary transition"
                  >
                    <CameraIcon className="h-4 w-4" />
                    Change Group Logo
                  </button>
                )}
                <div className="my-1 border-t border-border" />
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete Chat
                </button>
              </div>
            )}
          </div>
          {onMinimize && (
            <button
              onClick={onMinimize}
              title="Minimize"
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-glass-hover transition"
            >
              <MinusIcon className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-glass-hover transition"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScrollBackread}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scrollbar-hide"
      >
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#00C8FF]" />
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF]"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwn = message.sender_id === user?.id;
            const prevMessage = messages[index - 1];
            const showAvatar = !prevMessage || prevMessage.sender_id !== message.sender_id;
            const hasReactions = message.reactions && message.reactions.length > 0;
            const isLastMessage = index === messages.length - 1;
            const isLastOwnMessage =
              isOwn && !messages.slice(index + 1).some((m) => m.sender_id === user?.id);

            // Detect YouTube or Giphy link in this message (text messages only)
            const youtubeId =
              message.type === 'text' ? extractYouTubeId(message.content) : null;
            const giphyGifUrl =
              message.type === 'text' && !youtubeId
                ? (extractGiphyGifUrl(message.content) ??
                   (message.content.match(/https?:\/\/media\d?\.giphy\.com\/\S+\.gif/gi)?.[0] ?? null))
                : null;

            // Text to show in a bubble. For YouTube/Giphy messages we strip
            // the URL out (the embed/gif already represents it).
            const bubbleText = youtubeId || giphyGifUrl
              ? message.content.replace(/https?:\/\/\S+/g, '').replace(/[​\u200B]/g, '').trim()
              : message.content.replace(/[​\u200B]/g, '').trim();

            const showTextBubble = bubbleText.length > 0;

            // Status label: only "Sent" / "Seen" (no backend "delivered" flag yet)
            let statusLabel: string | null = null;
            if (isLastOwnMessage) {
              statusLabel = message.is_read ? 'Seen' : 'Sent';
            }

            return (
              <div
                key={message.id}
                className={`group flex items-start gap-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {!isOwn && (
                  <div className="w-7 flex-shrink-0">
                    {showAvatar ? (
                      <Avatar src={message.sender_avatar} name={message.sender_username} size="xs" />
                    ) : null}
                  </div>
                )}

                {isOwn && !message.is_deleted && (
                  <div className="relative self-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => openMessageMenu(e, message.id)}
                      title="Message options"
                      aria-haspopup="menu"
                      className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-glass-hover transition"
                    >
                      <EllipsisVerticalIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className={`flex flex-col min-w-0 ${isOwn ? 'items-end' : 'items-start'} ${
                  youtubeId || giphyGifUrl
                    ? 'max-w-[95%] sm:max-w-[90%]'
                    : 'max-w-[78%] sm:max-w-[72%]'
                }`}>
                  {message.is_deleted ? (
                    <div className="px-3 py-2 rounded-2xl bg-glass border border-border">
                      <p className="italic text-sm text-text-muted">
                        {isOwn ? 'You unsent this message' : 'This message was unsent'}
                      </p>
                    </div>
                  ) : (
                    <div className="relative min-w-0 max-w-full">
                      {message.type === 'image' && message.media_url && (
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(message.media_url!)}
                          className="block rounded-2xl overflow-hidden max-w-full"
                        >
                          <img
                            src={message.media_url}
                            alt=""
                            className="max-w-full max-h-72 rounded-2xl object-cover cursor-pointer hover:brightness-90 transition"
                          />
                        </button>
                      )}
                      {message.type === 'video' && message.media_url && (
                        <video src={message.media_url} controls className="rounded-2xl max-w-full max-h-72" />
                      )}
                      {message.type === 'file' && message.media_url && (
                        <a
                          href={message.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-glass border border-border hover:bg-glass-hover transition max-w-full"
                        >
                          <DocumentIcon className="h-5 w-5 flex-shrink-0 text-text-secondary" />
                          <span className="text-sm text-text-primary truncate">{message.media_name || 'File'}</span>
                          <ArrowDownTrayIcon className="h-4 w-4 flex-shrink-0 text-text-muted" />
                        </a>
                      )}

                      {/* YouTube embed — only when a valid video ID was found. */}
                      {youtubeId && (
                        <div className="w-[280px] max-w-full">
                          <YouTubeEmbed videoId={youtubeId} className="w-full" />
                        </div>
                      )}

                      {/* Giphy GIF — only when a Giphy link was found. */}
                      {giphyGifUrl && (
                        <img
                          src={giphyGifUrl}
                          alt="GIF"
                          className="rounded-2xl max-w-full max-h-72 object-contain"
                          loading="lazy"
                        />
                      )}

                      {/* Text bubble — only when there's actual text to show. */}
                      {showTextBubble && (
                        <div
                          className={`inline-block px-3.5 py-2 rounded-2xl min-w-0 max-w-full ${
                            isOwn
                              ? 'bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] text-[#060B12] shadow-[0_0_16px_rgba(0,200,255,0.15)]'
                              : 'bg-glass text-text-primary border border-border'
                          } ${(message.type !== 'text' || youtubeId || giphyGifUrl) ? 'mt-1.5' : ''}`}
                        >
                          <p className="whitespace-pre-wrap break-all text-sm">{bubbleText}</p>
                        </div>
                      )}

                      {/* Reaction pill — small, hover-only, tucked at TOP-inner corner */}
                      <div
                        className={`absolute -top-2 ${
                          isOwn ? 'left-1' : 'right-1'
                        } ${
                          hasReactions
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                        } transition pointer-events-none`}
                      >
                        <div className="pointer-events-auto">
                          <MessageReactions
                            messageId={message.id}
                            reactions={message.reactions}
                            align={isOwn ? 'right' : 'left'}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {isLastMessage && (
                    <span className="text-[10px] text-text-muted px-1 mt-1">
                      {isLastOwnMessage && statusLabel ? `${statusLabel} · ` : ''}
                      {formatChatTime(message.created_at)}
                    </span>
                  )}
                </div>

                {isOwn && (
                  <div className="w-7 flex-shrink-0">
                    {showAvatar ? (
                      <Avatar src={message.sender_avatar} name={message.sender_username} size="xs" />
                    ) : null}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Typing indicator — small bubble with 3 animated dots only. */}
        {typingNames.length > 0 && (
          <div className="flex items-start gap-1.5 justify-start">
            <div className="w-7 flex-shrink-0" />
            <div className="px-3 py-2 rounded-2xl bg-glass border border-border flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="px-3 py-2.5 border-t border-border flex-shrink-0">
        {attachmentFile && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl border border-border bg-glass">
            {attachmentPreview ? (
              attachmentFile.type.startsWith('video/') ? (
                <video src={attachmentPreview} className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <img src={attachmentPreview} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
              )
            ) : (
              <DocumentIcon className="h-6 w-6 text-text-muted flex-shrink-0" />
            )}
            <span className="text-sm text-text-primary truncate flex-1">{attachmentFile.name}</span>
            <button
              type="button"
              onClick={removeAttachment}
              disabled={isUploadingAttachment}
              className="p-1 text-text-muted hover:text-text-primary rounded-full hover:bg-glass-hover transition disabled:opacity-50"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_ATTACHMENT_TYPES.join(',')}
            onChange={handleAttachmentSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAttachment}
            title="Attach a file, image, or video"
            className="p-1.5 text-text-muted hover:text-[#00C8FF] hover:bg-glass-hover rounded-lg transition disabled:opacity-50 flex-shrink-0"
          >
            <PhotoIcon className="h-5 w-5" />
          </button>
          <div className="relative flex-shrink-0">
            <button
              ref={gifButtonRef}
              type="button"
              onClick={() => setShowGifPicker((v) => !v)}
              disabled={isUploadingAttachment}
              title="Send a GIF"
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-glass transition disabled:opacity-50"
            >
              <span className="text-[10px] font-bold border border-current rounded px-1">GIF</span>
            </button>
            {showGifPicker && (
              <GifPickerModal
                anchorRef={gifButtonRef}
                onClose={() => setShowGifPicker(false)}
                onSelect={handleGifSelect}
              />
            )}
          </div>
          <EmojiPicker onSelect={handleEmojiSelect} align="left" />
          <input
            type="text"
            value={newMessage}
            onChange={handleTypingChange}
            placeholder={attachmentFile ? 'Add a caption (optional)...' : 'Type a message...'}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-border bg-glass text-sm text-text-primary placeholder-text-muted focus:ring-1 focus:ring-border focus:border-border focus:outline-none transition"
          />
          <button
            type="submit"
            disabled={(!newMessage.trim() && !attachmentFile) || isUploadingAttachment}
            className="p-2 bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] text-[#060B12] rounded-lg hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
      </form>

      {/* Message options menu — rendered in a portal so it can never be
          clipped by the chat container's overflow. */}
      {messageMenuFor && messageMenuPos &&
        createPortal(
          <div
            ref={messageMenuRef}
            role="menu"
            className="fixed z-[9999] w-40 rounded-xl border border-border bg-bg shadow-xl py-1"
            style={{
              top: messageMenuPos.top,
              left: messageMenuPos.left,
            }}
          >
            <button
              role="menuitem"
              onClick={() => handleRemoveForMe(messageMenuFor)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary hover:bg-glass-hover hover:text-text-primary transition"
            >
              Remove for Me
            </button>
            <button
              role="menuitem"
              onClick={() => {
                const id = messageMenuFor;
                setMessageMenuFor(null);
                setMessageMenuPos(null);
                setUnsendTarget(id);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Unsend
            </button>
          </div>,
          document.body
        )}

      {/* Fullscreen image lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            title="Close"
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full rounded-xl object-contain"
          />
        </div>
      )}

      {showMembersModal && currentConversation.type === 'group' && (
        <GroupMembersModal conversationId={currentConversation.id} onClose={() => setShowMembersModal(false)} />
      )}

      {showLogoModal && currentConversation.type === 'group' && (
        <ChangeGroupLogoModal
          conversation={currentConversation}
          onClose={() => setShowLogoModal(false)}
          onUpdated={(updated) => updateConversation(updated.id, updated)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete this chat?"
          message={
            currentConversation.type === 'group'
              ? `"${getConversationName()}" will be removed from your chat list. The group and its messages stay intact for everyone else, and it will reappear here if there's new activity or you reopen it.`
              : `This conversation will be removed from your chat list. It stays intact for ${getConversationName()}, and will reappear here if they message you again.`
          }
          confirmLabel="Delete Chat"
          loadingLabel="Deleting..."
          isLoading={isDeletingChat}
          danger
          onConfirm={handleDeleteChat}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {unsendTarget && (
        <ConfirmDialog
          title="Unsend this message?"
          message="This message will be removed for everyone in this conversation. This can't be undone."
          confirmLabel="Unsend"
          loadingLabel="Unsending..."
          isLoading={isUnsending}
          danger
          onConfirm={handleConfirmUnsend}
          onCancel={() => setUnsendTarget(null)}
        />
      )}

    </div>
  );
}