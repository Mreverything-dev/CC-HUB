// frontend/src/features/chat/components/ChatList.tsx
import { useState } from 'react';
import { useChat } from '../hooks/useChat';
import { useFriends } from '@/features/friends/hooks/useFriends';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { formatRelativeTime } from '@/lib/formatters';
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ConversationAvatar } from './ConversationAvatar';

interface ChatListProps {
  onSelectConversation: (conversationId: string) => void;
  selectedId?: string;
}

export function ChatList({ onSelectConversation, selectedId }: ChatListProps) {
  const { conversations, isLoading, unreadCount, createDirectConversation } = useChat();
  const { friends } = useFriends();
  const { user } = useAuthStore();
  const [showNewChat, setShowNewChat] = useState(false);
  const [startingChatWith, setStartingChatWith] = useState<string | null>(null);

  const getOtherParticipant = (conv: any) =>
    conv.participants?.find((p: any) => p.id !== user?.id) || null;

  const getConversationName = (conv: any) => {
    if (conv.type === 'group') {
      return conv.name || 'Group Chat';
    }
    return getOtherParticipant(conv)?.username || 'Unknown User';
  };

  const handleStartChat = async (friendUserId: string) => {
    setStartingChatWith(friendUserId);
    try {
      const response = await createDirectConversation(friendUserId);
      setShowNewChat(false);
      onSelectConversation(response.data.id);
    } catch (error) {
      console.error('Error starting chat:', error);
    } finally {
      setStartingChatWith(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF]"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header - just "Messages" + new chat icon */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <h2 className="text-base font-bold text-text-primary">Messages</h2>
        <button
          onClick={() => setShowNewChat(true)}
          title="New message"
          className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-glass-hover rounded-xl transition"
        >
          <PencilSquareIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto themed-scrollbar">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted p-4">
            <p className="text-center text-text-secondary">No conversations yet</p>
            <p className="text-sm mt-1">Start a new chat with someone</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = conv.id === selectedId;
            const unread = conv.unread_count || 0;

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`relative w-full flex items-center gap-3 px-4 py-3 hover:bg-glass transition border-b border-border ${
                  isSelected ? 'bg-glass' : ''
                }`}
              >
                <ConversationAvatar conversation={conv} currentUserId={user?.id} size="md" />

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-text-primary truncate">
                      {getConversationName(conv)}
                    </p>
                    <span className="text-[11px] text-text-muted flex-shrink-0">
                      {conv.last_message?.created_at
                        ? formatRelativeTime(conv.last_message.created_at)
                        : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 gap-2">
                    <p className={`text-xs truncate ${unread > 0 ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                      {conv.last_message?.content || 'No messages yet'}
                    </p>
                    {unread > 0 && (
                      <span className="bg-[#00C8FF] text-[#060B12] text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex-shrink-0">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Unread Badge in Footer */}
      {unreadCount > 0 && (
        <div className="px-4 py-2 bg-glass border-t border-border text-center flex-shrink-0">
          <span className="text-xs text-text-secondary">
            {unreadCount} unread message{unreadCount > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* New Message - Friend Picker */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="rounded-2xl border border-border bg-bg max-w-sm w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-text-primary">New Message</h3>
              <button
                onClick={() => setShowNewChat(false)}
                className="text-text-muted hover:text-text-primary transition"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto themed-scrollbar">
              {friends.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8 px-4">
                  You don't have any friends yet. Add friends from their profile to start chatting.
                </p>
              ) : (
                friends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => handleStartChat(friend.user_id)}
                    disabled={startingChatWith === friend.user_id}
                    className="w-full flex items-center gap-3 p-3 hover:bg-glass transition disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt={friend.username} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[#060B12] font-semibold">
                          {friend.username?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-text-primary">
                      {startingChatWith === friend.user_id ? 'Starting chat...' : friend.username}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}