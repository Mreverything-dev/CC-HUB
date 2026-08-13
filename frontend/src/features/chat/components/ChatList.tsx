// frontend/src/features/chat/components/ChatList.tsx
import { useState, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { useFriends } from '@/features/friends/hooks/useFriends';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { formatRelativeTime } from '@/lib/formatters';
import { MagnifyingGlassIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ConversationAvatar } from './ConversationAvatar';

interface ChatListProps {
  onSelectConversation: (conversationId: string) => void;
  selectedId?: string;
}

type ListTab = 'all' | 'unread' | 'groups';

export function ChatList({ onSelectConversation, selectedId }: ChatListProps) {
  const { conversations, isLoading, unreadCount, createDirectConversation } = useChat();
  const { friends } = useFriends();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<ListTab>('all');
  const [filteredConversations, setFilteredConversations] = useState(conversations);
  const [showNewChat, setShowNewChat] = useState(false);
  const [startingChatWith, setStartingChatWith] = useState<string | null>(null);

  const unreadConversationCount = conversations.filter((c) => (c.unread_count || 0) > 0).length;

  useEffect(() => {
    let list = conversations;
    if (activeTab === 'unread') {
      list = list.filter((c) => (c.unread_count || 0) > 0);
    } else if (activeTab === 'groups') {
      list = list.filter((c) => c.type === 'group');
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((conv) =>
        conv.name?.toLowerCase().includes(q) ||
        conv.participants.some((p) => p.username.toLowerCase().includes(q))
      );
    }
    setFilteredConversations(list);
  }, [searchTerm, conversations, activeTab]);

  const getOtherParticipant = (conv: any) =>
    conv.participants?.find((p: any) => p.id !== user?.id) || null;

  const getConversationName = (conv: any) => {
    if (conv.type === 'group') {
      return conv.name || 'Group Chat';
    }
    // For direct messages, show the other participant's name
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

  const TABS: { id: ListTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread', count: unreadConversationCount },
    { id: 'groups', label: 'Groups' },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0D1722]">
      {/* Header */}
      <div className="p-4 border-b border-[#1E3447]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-[#F1F5F9]">Messages</h2>
          <button
            onClick={() => setShowNewChat(true)}
            title="New message"
            className="p-2 text-[#94A3B8] hover:text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-xl transition"
          >
            <PencilSquareIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition"
          />
          <MagnifyingGlassIcon className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-[#00C8FF]/10 text-[#00C8FF]'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
              }`}
            >
              {tab.label}
              {!!tab.count && (
                <span
                  className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[16px] text-center ${
                    activeTab === tab.id ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#94A3B8]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto themed-scrollbar">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#64748B] p-4">
            <p className="text-center text-[#94A3B8]">
              {searchTerm
                ? 'No conversations found'
                : activeTab === 'unread'
                ? 'No unread conversations'
                : activeTab === 'groups'
                ? 'No group chats yet'
                : 'No conversations yet'}
            </p>
            {activeTab === 'all' && !searchTerm && <p className="text-sm mt-1">Start a new chat with someone</p>}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === selectedId;
            const unread = conv.unread_count || 0;

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`relative w-full flex items-center gap-3 p-4 hover:bg-white/5 transition border-b border-[#101D2A] ${
                  isSelected ? 'bg-[#00C8FF]/10' : ''
                }`}
              >
                {isSelected && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#00C8FF]" />}
                <ConversationAvatar conversation={conv} currentUserId={user?.id} size="md" />

                {/* Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-semibold truncate ${isSelected ? 'text-[#00C8FF]' : 'text-[#F1F5F9]'}`}>
                      {getConversationName(conv)}
                    </p>
                    <span className="text-xs text-[#64748B] flex-shrink-0">
                      {conv.last_message?.created_at
                        ? formatRelativeTime(conv.last_message.created_at)
                        : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <p className={`text-sm truncate ${unread > 0 ? 'text-[#CBD5E1] font-medium' : 'text-[#64748B]'}`}>
                      {conv.last_message?.content || 'No messages yet'}
                    </p>
                    {unread > 0 && (
                      <span className="bg-[#00C8FF] text-[#060B12] text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center flex-shrink-0">
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
        <div className="p-2 bg-[#00C8FF]/10 border-t border-[#1E3447] text-center">
          <span className="text-sm text-[#00C8FF]">
            {unreadCount} unread message{unreadCount > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* New Message - Friend Picker */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="rounded-2xl border border-[#1E3447] bg-[#111E2B] max-w-sm w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#1E3447]">
              <h3 className="font-semibold text-[#F1F5F9]">New Message</h3>
              <button
                onClick={() => setShowNewChat(false)}
                className="text-[#64748B] hover:text-[#F1F5F9] transition"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto themed-scrollbar">
              {friends.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-8 px-4">
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
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt={friend.username} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[#060B12] font-semibold">
                          {friend.username?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-[#F1F5F9]">
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