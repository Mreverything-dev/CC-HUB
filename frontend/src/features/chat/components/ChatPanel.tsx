// frontend/src/features/chat/components/ChatPanel.tsx
import { useState } from 'react';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import { useChat } from '../hooks/useChat';

interface ChatPanelProps {
  initialConversationId?: string | null;
  fullHeight?: boolean;
}

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
      className={`flex ${fullHeight ? 'h-screen' : 'h-[calc(100vh-8.5rem)]'} bg-bg rounded-2xl overflow-hidden border border-border shadow-[0_0_40px_rgba(0,200,255,0.05)]`}
    >
      {/* Conversation list */}
      <div
        className={`w-full sm:w-80 lg:w-96 h-full border-r border-border flex-shrink-0 flex-col ${
          selectedConversationId ? 'hidden sm:flex' : 'flex'
        }`}
      >
        <ChatList
          onSelectConversation={handleSelectConversation}
          selectedId={selectedConversationId || undefined}
        />
      </div>

      {/* Active conversation */}
      <div className={`flex-1 h-full min-w-0 ${selectedConversationId ? 'flex' : 'hidden sm:flex'}`}>
        {selectedConversationId ? (
          <ChatWindow
            conversationId={selectedConversationId}
            onBack={() => setSelectedConversationId(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full w-full text-text-muted bg-bg">
            <div className="text-center px-4">
              <p className="text-4xl">💬</p>
              <p className="mt-2 text-lg text-text-secondary">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}