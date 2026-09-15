// frontend/src/features/chat/components/ChatHeadStack.tsx
import { useChatStore } from '../store/chat.store';
import { ChatHead } from './ChatHead';

interface ChatHeadStackProps {
  onOpen: (conversationId: string) => void;
}

/**
 * Renders every minimized conversation as a floating chat head, stacked
 * vertically in the bottom-right corner (Messenger-style).
 * Newest minimized conversation is on top.
 */
export function ChatHeadStack({ onOpen }: ChatHeadStackProps) {
  const conversations = useChatStore((s) => s.conversations);
  const minimizedConversationIds = useChatStore((s) => s.minimizedConversationIds);
  const restoreConversation = useChatStore((s) => s.restoreConversation);

  const minimized = minimizedConversationIds
    .map((id) => conversations.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  if (minimized.length === 0) return null;

  return (
    <>
      {minimized.map((conv, index) => (
        <ChatHead
          key={conv.id}
          conversation={conv}
          index={index}
          onOpen={onOpen}
          onClose={(id) => restoreConversation(id)}
        />
      ))}
    </>
  );
}