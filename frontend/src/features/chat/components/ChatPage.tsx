// frontend/src/features/chat/components/ChatPage.tsx
import { useLocation } from 'react-router-dom';
import ChatPanel from './ChatPanel';

export default function ChatPage() {
  const location = useLocation();
  const initialConversationId = (location.state as { conversationId?: string } | null)?.conversationId ?? null;

  return <ChatPanel initialConversationId={initialConversationId} fullHeight />;
}
