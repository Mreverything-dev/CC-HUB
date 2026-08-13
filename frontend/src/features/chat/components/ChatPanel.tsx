// frontend/src/features/chat/components/ChatPanel.tsx
import { useState } from 'react';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import { useChat } from '../hooks/useChat';

interface ChatPanelProps {
  initialConversationId?: string | null;
  /** Fills the viewport height (used by the standalone /chat route). Pass
   * false when embedded inside a dashboard's own scrollable <main>. */
  fullHeight?: boolean;
}

/**
 * Conversation list + window layout, extracted so it can be reused both by
 * the standalone /chat route (ChatPage) and embedded directly inside a
 * dashboard's Sidebar-driven "chat" section without navigating away from it.
 */
export default function ChatPanel({ initialConversationId = null, fullHeight = true }: ChatPanelProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId);
  const { setCurrentConversation, conversations } = useChat();

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    const conversation = conversations.find((c) => c.id === conversationId);
    if (conversation) {
      setCurrentConversation(conversation);
    }
  };

  return (
    <div className={`flex ${fullHeight ? 'h-screen' : 'h-[calc(100vh-8.5rem)]'} bg-[#0a0a0a] rounded-2xl overflow-hidden border border-[#2a2a2a]`}>
      {/* Conversation list */}
      <div className="w-full sm:w-96 h-full border-r border-[#2a2a2a] flex-shrink-0">
        <ChatList
          onSelectConversation={handleSelectConversation}
          selectedId={selectedConversationId || undefined}
        />
      </div>

      {/* Active conversation */}
      <div className="flex-1 h-full hidden sm:block">
        {selectedConversationId ? (
          <ChatWindow conversationId={selectedConversationId} />
        ) : (
          <div className="flex items-center justify-center h-full text-[#6b6b6b] bg-[#141414]/70 backdrop-blur-xl">
            <div className="text-center">
              <p className="text-4xl">💬</p>
              <p className="mt-2 text-lg">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
