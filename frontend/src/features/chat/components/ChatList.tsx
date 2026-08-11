// frontend/src/features/chat/components/ChatList.tsx
import { useState, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { useFriends } from '@/features/friends/hooks/useFriends';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { formatDistanceToNow } from 'date-fns';
import { MagnifyingGlassIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ChatListProps {
  onSelectConversation: (conversationId: string) => void;
  selectedId?: string;
}

export function ChatList({ onSelectConversation, selectedId }: ChatListProps) {
  const { conversations, isLoading, unreadCount, createDirectConversation } = useChat();
  const { friends } = useFriends();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredConversations, setFilteredConversations] = useState(conversations);
  const [showNewChat, setShowNewChat] = useState(false);
  const [startingChatWith, setStartingChatWith] = useState<string | null>(null);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = conversations.filter((conv) =>
        conv.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.participants.some((p) =>
          p.username.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      setFilteredConversations(filtered);
    } else {
      setFilteredConversations(conversations);
    }
  }, [searchTerm, conversations]);

  const getConversationName = (conv: any) => {
    if (conv.type === 'group') {
      return conv.name || 'Group Chat';
    }
    // For direct messages, show the other participant's name
    const otherUser = conv.participants?.find((p: any) => p.id !== user?.id);
    return otherUser?.username || 'Unknown User';
  };

  const getConversationAvatar = (conv: any) => {
    if (conv.type === 'group') {
      return '👥';
    }
    const otherUser = conv.participants?.find((p: any) => p.id !== user?.id);
    return otherUser?.username?.charAt(0).toUpperCase() || 'U';
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d4ff]"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#141414]/70 backdrop-blur-xl">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white">Messages</h2>
          <button
            onClick={() => setShowNewChat(true)}
            title="New message"
            className="p-2 text-[#a0a0a0] hover:text-[#00d4ff] hover:bg-[#00d4ff]/10 rounded-full transition"
          >
            <PencilSquareIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] text-sm text-white placeholder-[#6b6b6b] focus:ring-1 focus:ring-[#00d4ff] focus:border-[#00d4ff] focus:outline-none"
          />
          <MagnifyingGlassIcon className="h-4 w-4 text-[#6b6b6b] absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#6b6b6b] p-4">
            <p className="text-center">
              {searchTerm ? 'No conversations found' : 'No conversations yet'}
            </p>
            <p className="text-sm mt-1">Start a new chat with someone</p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === selectedId;
            const unread = conv.unread_count || 0;

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full flex items-center gap-3 p-4 hover:bg-white/5 transition border-b border-[#1f1f1f] ${
                  isSelected ? 'bg-[#00d4ff]/10' : ''
                }`}
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-[#0a0a0a] font-bold text-lg flex-shrink-0">
                  {getConversationAvatar(conv)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white truncate">
                      {getConversationName(conv)}
                    </p>
                    <span className="text-xs text-[#6b6b6b]">
                      {conv.last_message?.created_at
                        ? formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: true })
                        : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-[#a0a0a0] truncate">
                      {conv.last_message?.content || 'No messages yet'}
                    </p>
                    {unread > 0 && (
                      <span className="bg-[#00d4ff] text-[#0a0a0a] text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
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

      {/* Unread Badge in Header */}
      {unreadCount > 0 && (
        <div className="p-2 bg-[#00d4ff]/10 border-t border-[#2a2a2a] text-center">
          <span className="text-sm text-[#00d4ff]">
            {unreadCount} unread message{unreadCount > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* New Message - Friend Picker */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] max-w-sm w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
              <h3 className="font-semibold text-white">New Message</h3>
              <button
                onClick={() => setShowNewChat(false)}
                className="text-[#6b6b6b] hover:text-white transition"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {friends.length === 0 ? (
                <p className="text-sm text-[#6b6b6b] text-center py-8 px-4">
                  You don't have any friends yet. Add friends from their profile to start chatting.
                </p>
              ) : (
                friends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => handleStartChat(friend.user_id)}
                    disabled={startingChatWith === friend.user_id}
                    className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt={friend.username} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[#0a0a0a] font-semibold">
                          {friend.username?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-white">
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