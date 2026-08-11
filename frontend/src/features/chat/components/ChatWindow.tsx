// frontend/src/features/chat/components/ChatWindow.tsx
import { useState, useEffect, useRef, } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { formatChatTime } from '@/lib/formatters';
import { useTick } from '@/hooks/useTick';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { PaperAirplaneIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface ChatWindowProps {
  conversationId: string;
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { user } = useAuthStore();
  const { currentConversation, messages, getMessages, sendMessage, handleTyping, isLoading, typingByConversation } = useChat();
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await sendMessage(conversationId, newMessage);
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

  const getConversationName = () => {
    if (!currentConversation) return 'Chat';
    if (currentConversation.type === 'group') {
      return currentConversation.name || 'Group Chat';
    }
    const otherUser = currentConversation.participants?.find((p: any) => p.id !== user?.id);
    return otherUser?.username || 'User';
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
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-[#0a0a0a] font-bold">
          {getConversationName().charAt(0).toUpperCase()}
        </div>
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
            return (
              <div
                key={message.id}
                className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {!isOwn && (
                  <div className="w-7 flex-shrink-0">
                    {showAvatar && (
                      <Avatar src={message.sender_avatar} name={message.sender_username} size="xs" />
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                    isOwn
                      ? 'bg-gradient-to-br from-[#00d4ff] to-[#0099cc] text-[#0a0a0a]'
                      : 'bg-[#1f1f1f] text-white border border-[#2a2a2a]'
                  }`}
                >
                  {!isOwn && showAvatar && (
                    <p className="text-xs font-semibold text-[#00d4ff] mb-1">
                      {message.sender_username}
                    </p>
                  )}
                  <p className="break-words">{message.content}</p>
                  <p className={`text-xs mt-1 ${isOwn ? 'text-[#0a0a0a]/60' : 'text-[#6b6b6b]'}`}>
                    {formatChatTime(message.created_at)}
                    {isOwn && message.is_read && ' ✓✓'}
                  </p>
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 text-[#6b6b6b] hover:text-[#00d4ff] transition"
          >
            <PhotoIcon className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={handleTypingChange}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] text-sm text-white placeholder-[#6b6b6b] focus:ring-1 focus:ring-[#00d4ff] focus:border-[#00d4ff] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-2 bg-gradient-to-br from-[#00d4ff] to-[#0099cc] text-[#0a0a0a] rounded-lg hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
}