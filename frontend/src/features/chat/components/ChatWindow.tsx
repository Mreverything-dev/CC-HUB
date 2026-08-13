// frontend/src/features/chat/components/ChatWindow.tsx
import { useState, useEffect, useRef, } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { formatChatTime } from '@/lib/formatters';
import { useTick } from '@/hooks/useTick';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { ConversationAvatar } from './ConversationAvatar';
import { mediaService } from '@/services/api/media.service';
import { MessageReactions } from './MessageReactions';
import toast from 'react-hot-toast';
import { PaperAirplaneIcon, PhotoIcon, XMarkIcon, DocumentIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

// Keep in sync with backend ALLOWED_TYPES in app/api/v1/endpoints/media.py
const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
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
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { user } = useAuthStore();
  const { currentConversation, messages, getMessages, sendMessage, handleTyping, isLoading, typingByConversation } = useChat();
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-render periodically so "2 mins ago" style timestamps stay accurate.
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
    scrollToBottom();
  }, [messages, typingUserIds.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    return () => {
      if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    };
  }, [attachmentPreview]);

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      toast.error('Unsupported file type');
      return;
    }
    setAttachmentFile(file);
    setAttachmentPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file.type.startsWith('image/') || file.type.startsWith('video/')
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
        const uploaded = await mediaService.uploadFiles([attachmentFile]);
        // Backend requires non-empty content; use a zero-width placeholder
        // when there's no real caption so the filename never shows up as if
        // it were typed text (see the message render below, which hides it).
        sendMessage(conversationId, newMessage.trim() || '​', {
          type: attachmentTypeOf(attachmentFile),
          mediaUrl: uploaded.urls[0],
          mediaName: attachmentFile.name,
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

  if (!currentConversation) {
    return (
      <div className="flex items-center justify-center h-full bg-[#141414]/70 backdrop-blur-xl">
        <div className="text-center text-[#6b6b6b]">
          <p className="text-2xl">💬</p>
          <p className="mt-2">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#141414]/70 backdrop-blur-xl">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a] flex items-center gap-3 flex-shrink-0">
        <ConversationAvatar conversation={currentConversation} currentUserId={user?.id} size="sm" />
        <div>
          <h3 className="font-semibold text-white">{getConversationName()}</h3>
          <p className="text-xs text-[#6b6b6b]">
            {currentConversation.type === 'group'
              ? `${currentConversation.participants?.length || 0} members`
              : 'Direct message'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d4ff]"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6b6b6b]">
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwn = message.sender_id === user?.id;
            const prevMessage = messages[index - 1];
            const showAvatar = !prevMessage || prevMessage.sender_id !== message.sender_id;
            // The placeholder used when an attachment is sent without a real
            // caption (see handleSendMessage) is a zero-width space - strip
            // it so no empty bubble/filename-as-caption ever renders.
            const hasCaption = message.content.replace(/​/g, '').trim().length > 0;
            return (
              <div
                key={message.id}
                className={`group flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {!isOwn && (
                  <div className="w-7 flex-shrink-0">
                    {showAvatar && (
                      <Avatar src={message.sender_avatar} name={message.sender_username} size="xs" />
                    )}
                  </div>
                )}
                <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && showAvatar && (
                    <p className="text-xs font-semibold text-[#00d4ff] mb-1 px-1">
                      {message.sender_username}
                    </p>
                  )}

                  {/* Media renders on its own, without the colored/padded bubble around it */}
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
                      className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#1f1f1f] border border-[#2a2a2a] hover:bg-white/5 transition max-w-full"
                    >
                      <DocumentIcon className="h-5 w-5 flex-shrink-0 text-[#a0a0a0]" />
                      <span className="text-sm text-white truncate">{message.media_name || 'File'}</span>
                      <ArrowDownTrayIcon className="h-4 w-4 flex-shrink-0 text-[#6b6b6b]" />
                    </a>
                  )}

                  {/* Colored bubble only for plain text or a real caption */}
                  {(message.type === 'text' || hasCaption) && (
                    <div
                      className={`px-4 py-2 rounded-2xl ${message.type !== 'text' ? 'mt-1.5' : ''} ${
                        isOwn
                          ? 'bg-gradient-to-br from-[#00d4ff] to-[#0099cc] text-[#0a0a0a]'
                          : 'bg-[#1f1f1f] text-white border border-[#2a2a2a]'
                      }`}
                    >
                      <p className="break-words">{message.content}</p>
                    </div>
                  )}

                  <p className={`text-xs text-[#6b6b6b] mt-1 px-1`}>
                    {formatChatTime(message.created_at)}
                    {isOwn && message.is_read && ' ✓✓'}
                  </p>

                  <MessageReactions
                    messageId={message.id}
                    reactions={message.reactions}
                    align={isOwn ? 'right' : 'left'}
                  />
                </div>
                {isOwn && (
                  <div className="w-7 flex-shrink-0">
                    {showAvatar && (
                      <Avatar src={message.sender_avatar} name={message.sender_username} size="xs" />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        {typingNames.length > 0 && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-7 flex-shrink-0">
              <Avatar name={typingNames[0]} size="xs" />
            </div>
            <div className="px-4 py-2 rounded-2xl bg-[#1f1f1f] border border-[#2a2a2a] flex items-center gap-1.5">
              <span className="text-xs text-[#a0a0a0]">
                {typingNames.length === 1 ? `${typingNames[0]} is typing` : `${typingNames.join(', ')} are typing`}
              </span>
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-[#00d4ff] animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1 h-1 rounded-full bg-[#00d4ff] animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1 h-1 rounded-full bg-[#00d4ff] animate-bounce" />
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-[#2a2a2a] flex-shrink-0">
        {attachmentFile && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]">
            {attachmentPreview ? (
              attachmentFile.type.startsWith('video/') ? (
                <video src={attachmentPreview} className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <img src={attachmentPreview} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
              )
            ) : (
              <DocumentIcon className="h-6 w-6 text-[#6b6b6b] flex-shrink-0" />
            )}
            <span className="text-sm text-white truncate flex-1">{attachmentFile.name}</span>
            <button
              type="button"
              onClick={removeAttachment}
              disabled={isUploadingAttachment}
              className="p-1 text-[#6b6b6b] hover:text-white rounded-full hover:bg-white/5 transition disabled:opacity-50"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
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
            className="p-2 text-[#6b6b6b] hover:text-[#00d4ff] transition disabled:opacity-50"
          >
            <PhotoIcon className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={handleTypingChange}
            placeholder={attachmentFile ? 'Add a caption (optional)...' : 'Type a message...'}
            className="flex-1 px-4 py-2 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] text-sm text-white placeholder-[#6b6b6b] focus:ring-1 focus:ring-[#00d4ff] focus:border-[#00d4ff] focus:outline-none"
          />
          <button
            type="submit"
            disabled={(!newMessage.trim() && !attachmentFile) || isUploadingAttachment}
            className="p-2 bg-gradient-to-br from-[#00d4ff] to-[#0099cc] text-[#0a0a0a] rounded-lg hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
      </form>

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
    </div>
  );
}