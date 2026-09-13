// frontend/src/features/chat/components/ChatWidget.tsx
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChat } from '../hooks/useChat';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import { ChatHead } from './ChatHead';

const PANEL_WIDTH = 340;
const PANEL_HEIGHT = 460;
const HEAD_SIZE = 56;
const EDGE_MARGIN = 16;
const GAP = 12;

export function ChatWidget() {
  const { isAuthenticated } = useAuthStore();
  const { isWidgetOpen, closeWidget, conversations, currentConversation, setCurrentConversation } = useChat();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (isWidgetOpen && currentConversation) {
      setSelectedConversationId(currentConversation.id);
    }
  }, [isWidgetOpen, currentConversation]);

  if (!isAuthenticated) return null;

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    const conversation = conversations.find((c) => c.id === conversationId);
    if (conversation) {
      setCurrentConversation(conversation);
    }
  };

  const handleClose = () => {
    closeWidget();
    setSelectedConversationId(null);
  };

  const handleBack = () => {
    setSelectedConversationId(null);
  };

  return (
    <>
      {/* Floating chat head — always visible when logged in */}
      <ChatHead />

      {/* Widget panel — positioned to the LEFT of the chat head. */}
      {isWidgetOpen && (
        <div
          className="fixed z-50 rounded-2xl border border-border shadow-[0_8px_40px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col bg-bg"
          style={{
            right: EDGE_MARGIN + HEAD_SIZE + GAP,
            bottom: EDGE_MARGIN,
            width: PANEL_WIDTH,
            height: PANEL_HEIGHT,
            maxHeight: `calc(100vh - ${EDGE_MARGIN * 2}px)`,
          }}
        >
          {selectedConversationId ? (
            <ChatWindow
              conversationId={selectedConversationId}
              onBack={handleBack}
              onClose={handleClose}
            />
          ) : (
            <ChatList
              onSelectConversation={handleSelectConversation}
              selectedId={selectedConversationId || undefined}
            />
          )}
        </div>
      )}
    </>
  );
}