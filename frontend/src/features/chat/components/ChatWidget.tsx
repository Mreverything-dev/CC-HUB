// frontend/src/features/chat/components/ChatWidget.tsx
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChat } from '../hooks/useChat';
import { useChatStore } from '../store/chat.store';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import { ChatHeadStack } from './ChatHeadStack';

const PANEL_WIDTH = 340;
const PANEL_HEIGHT = 460;
const HEAD_SIZE = 56;
const EDGE_MARGIN = 16;
const GAP = 12;

export function ChatWidget() {
  const { isAuthenticated } = useAuthStore();
  const {
    isWidgetOpen,
    openWidget,
    closeWidget,
    conversations,
    currentConversation,
    setCurrentConversation,
  } = useChat();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  if (!isAuthenticated) return null;

  const handleSelectConversation = (conversationId: string) => {
    // ✅ Kung may nakabukas nang ibang conversation, i-minimize muna
    //    bago mag-open ng bago — para hindi mawala yung chat head.
    if (selectedConversationId && selectedConversationId !== conversationId) {
      useChatStore.getState().minimizeConversation(selectedConversationId);
    }

    setSelectedConversationId(conversationId);
    const conversation = conversations.find((c) => c.id === conversationId);
    if (conversation) {
      setCurrentConversation(conversation);
    }
    openWidget();
    // ❌ Hindi na natin inaalis sa minimized stack — para manatili yung chat head
    // useChatStore.getState().restoreConversation(conversationId);
  };

  const handleMinimize = () => {
    // I-minimize yung current conversation (may chat head)
    if (selectedConversationId) {
      useChatStore.getState().minimizeConversation(selectedConversationId);
    }
    closeWidget();
    setSelectedConversationId(null);
    setCurrentConversation(null);
  };

  const handleClose = () => {
    // I-close nang tuluyan (walang chat head)
    if (selectedConversationId) {
      useChatStore.getState().restoreConversation(selectedConversationId);
    }
    closeWidget();
    setSelectedConversationId(null);
    setCurrentConversation(null);
  };

  const handleBack = () => {
    // I-minimize yung current conversation (para may chat head)
    if (selectedConversationId) {
      useChatStore.getState().minimizeConversation(selectedConversationId);
    }
    setSelectedConversationId(null);
  };

  return (
    <>
      {/* Floating chat heads — stack of minimized conversations */}
      <ChatHeadStack onOpen={handleSelectConversation} />

      {/* Widget panel — positioned to the LEFT of the chat heads */}
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
              onMinimize={handleMinimize}
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