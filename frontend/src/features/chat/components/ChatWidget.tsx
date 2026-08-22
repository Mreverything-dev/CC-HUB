// frontend/src/features/chat/components/ChatWidget.tsx
import { useState, useEffect } from 'react';
import { ArrowLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChat } from '../hooks/useChat';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';

/**
 * Global chat popup, mounted once at the app root. Opens/closes via the
 * shared chat store so any "Chat" button anywhere (dashboard topbars,
 * profile "Message" buttons, etc.) can toggle the same widget instead of
 * navigating to a full page.
 */
export function ChatWidget() {
  const { isAuthenticated } = useAuthStore();
  const { isWidgetOpen, closeWidget, conversations, currentConversation, setCurrentConversation } = useChat();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  // Jump straight to whatever conversation was set as "current" elsewhere
  // (e.g. a "Message Professor" button) instead of the list. Depending only
  // on isWidgetOpen missed this whenever the widget was already open (e.g.
  // left open on the conversation list, or on a different conversation) -
  // openWidget() is a no-op state change in that case, so the effect never
  // re-ran and the widget silently kept showing the wrong thing. Depending
  // on currentConversation too means picking a new "Message" target always
  // jumps to it, regardless of whether the widget was already open.
  useEffect(() => {
    if (isWidgetOpen && currentConversation) {
      setSelectedConversationId(currentConversation.id);
    }
  }, [isWidgetOpen, currentConversation]);

  if (!isAuthenticated || !isWidgetOpen) return null;

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

  return (
    // left-4/right-4 (both) on mobile makes this a full-width-minus-margins
    // sheet instead of a fixed 22rem box docked to the corner - at 320-375px
    // wide, w-[22rem] (352px) anchored only via right-6 ran off the left
    // edge of the screen. sm: and up restores the original docked corner.
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 sm:w-96 h-[32rem] max-h-[calc(100vh-3rem)] rounded-2xl border border-[#2a2a2a] shadow-[0_8px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
      {/* Widget chrome - back (when viewing a conversation) + close */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#2a2a2a] bg-[#141414]/70 backdrop-blur-xl flex-shrink-0">
        {selectedConversationId ? (
          <button
            onClick={() => setSelectedConversationId(null)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-[#a0a0a0] hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={handleClose}
          title="Close"
          className="p-1.5 text-[#a0a0a0] hover:text-white rounded-full hover:bg-white/10 transition"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {selectedConversationId ? (
          <ChatWindow conversationId={selectedConversationId} />
        ) : (
          <ChatList onSelectConversation={handleSelectConversation} selectedId={selectedConversationId || undefined} />
        )}
      </div>
    </div>
  );
}
