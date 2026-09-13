// frontend/src/features/chat/components/ChatHeadStack.tsx
import { useChatStore } from '../store/chat.store';
import { ChatHead } from './ChatHead';

/**
 * Renders every minimized conversation as a floating chat head, stacked
 * vertically in the bottom-right corner (Messenger-style).
 */
export function ChatHeadStack() {
  const { conversations, minimizedConversationIds } = useChatStore();

  const minimized = minimizedConversationIds
    .map((id) => conversations.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  if (minimized.length === 0) return null;

  return (
    <>
      {minimized.map((conv, index) => (
        <ChatHead key={conv.id} conversation={conv} index={index} />
      ))}
    </>
  );
}