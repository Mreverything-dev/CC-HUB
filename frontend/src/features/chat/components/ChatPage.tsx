// frontend/src/features/chat/components/ChatPage.tsx
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import { useChat } from '../hooks/useChat';

export default function ChatPage() {
  const location = useLocation();
  const initialConversationId = (location.state as { conversationId?: string } | null)?.conversationId ?? null;
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
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* Sidebar - Chat List */}
      <div className="w-96 h-full border-r border-[#2a2a2a]">
        <ChatList
          onSelectConversation={handleSelectConversation}
          selectedId={selectedConversationId || undefined}
        />
      </div>

      {/* Main - Chat Window */}
      <div className="flex-1 h-full">
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