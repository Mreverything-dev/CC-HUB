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
    <div
      className={`flex ${fullHeight ? 'h-screen' : 'h-[calc(100vh-8.5rem)]'} bg-[#0D1722] rounded-2xl overflow-hidden border border-[#1E3447] shadow-[0_0_40px_rgba(0,200,255,0.05)]`}
    >
      {/* Conversation list - on mobile, hidden once a conversation is picked
          (ChatWindow takes the full width with its own back button instead). */}
      <div
        className={`w-full sm:w-80 lg:w-96 h-full border-r border-[#1E3447] flex-shrink-0 flex-col ${
          selectedConversationId ? 'hidden sm:flex' : 'flex'
        }`}
      >
        <ChatList
          onSelectConversation={handleSelectConversation}
          selectedId={selectedConversationId || undefined}
        />
      </div>

      {/* Active conversation - on mobile, only shown once a conversation is selected. */}
      <div className={`flex-1 h-full min-w-0 ${selectedConversationId ? 'flex' : 'hidden sm:flex'}`}>
        {selectedConversationId ? (
          <ChatWindow
            conversationId={selectedConversationId}
            onBack={() => setSelectedConversationId(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full w-full text-[#64748B] bg-[#0A111A]">
            <div className="text-center px-4">
              <p className="text-4xl">💬</p>
              <p className="mt-2 text-lg text-[#94A3B8]">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
