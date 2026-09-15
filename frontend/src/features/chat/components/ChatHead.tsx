// frontend/src/features/chat/components/ChatHead.tsx
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChat } from '../hooks/useChat';
import type { Conversation } from '@/types/chat.types';

const CHAT_HEAD_SIZE = 56;
const EDGE_MARGIN = 16;
const GAP = 8;

interface ChatHeadProps {
  conversation: Conversation;
  index: number;
  onOpen?: (conversationId: string) => void;
  onClose?: (conversationId: string) => void;
}

export function ChatHead({ conversation, index, onOpen, onClose }: ChatHeadProps) {
  const { isAuthenticated, user } = useAuthStore();

  // For a direct chat, use the OTHER participant's avatar; for a group,
  // use the group's own avatar_url (if any).
  const otherParticipant =
    conversation.type === 'direct'
      ? conversation.participants?.find((p) => p.id !== user?.id) || null
      : null;

  const avatarUrl =
    conversation.type === 'group'
      ? conversation.avatar_url || null
      : otherParticipant?.avatar_url || null;

  const displayName =
    conversation.type === 'group'
      ? conversation.name || 'Group Chat'
      : otherParticipant?.username || user?.username || 'Chat';

  const unread = conversation.unread_count || 0;

  if (!isAuthenticated) return null;

  return (
    <div
      className="fixed z-[60] group"
      style={{
        right: EDGE_MARGIN,
        bottom: EDGE_MARGIN + index * (CHAT_HEAD_SIZE + GAP),
        width: CHAT_HEAD_SIZE,
        height: CHAT_HEAD_SIZE,
      }}
    >
      {/* Close (minimize) button — appears on hover */}
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose(conversation.id);
          }}
          title="Close"
          className="absolute -top-1 -left-1 z-20 w-5 h-5 rounded-full bg-bg border border-border shadow-md flex items-center justify-center text-text-secondary hover:text-[#EF4444] hover:border-[#EF4444]/40 opacity-0 group-hover:opacity-100 transition"
        >
          <span className="text-[10px] leading-none">×</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => onOpen?.(conversation.id)}
        title={displayName}
        aria-label={`Open chat with ${displayName}`}
        className="w-full h-full flex items-center justify-center rounded-full ring-2 shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-transform overflow-hidden ring-white/90 dark:ring-black/60 cursor-pointer hover:scale-105 active:scale-95"
        style={{
          backgroundColor: 'rgb(var(--color-bg))',
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-full h-full object-cover pointer-events-none rounded-full"
          />
        ) : (
          <span className="flex items-center justify-center w-full h-full text-lg font-semibold text-text-primary pointer-events-none">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </button>

      {/* Unread badge */}
      {unread > 0 && (
        <span
          className="absolute -top-1 -right-1 z-10 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#EF4444] text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-black shadow-lg pointer-events-none"
        >
          {unread > 99 ? '99+' : unread > 9 ? '9+' : unread}
        </span>
      )}
    </div>
  );
}