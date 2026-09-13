// frontend/src/features/chat/components/ChatHead.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChat } from '../hooks/useChat';

const CHAT_HEAD_SIZE = 56;
const EDGE_MARGIN = 16;

export function ChatHead() {
  const { isAuthenticated, user } = useAuthStore();
  const { isWidgetOpen, toggleWidget, unreadCount, currentConversation, conversations } = useChat();

  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: window.innerWidth - CHAT_HEAD_SIZE - EDGE_MARGIN,
    y: window.innerHeight - CHAT_HEAD_SIZE - EDGE_MARGIN - 32,
  }));

  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const didMoveRef = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => ({
        x: Math.min(prev.x, window.innerWidth - CHAT_HEAD_SIZE - EDGE_MARGIN),
        y: Math.min(prev.y, window.innerHeight - CHAT_HEAD_SIZE - EDGE_MARGIN),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      didMoveRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      dragOffsetRef.current = {
        x: e.clientX - pos.x,
        y: e.clientY - pos.y,
      };
      setIsDragging(true);
    },
    [pos.x, pos.y]
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: PointerEvent) => {
      const dx = Math.abs(e.clientX - dragStartRef.current.x);
      const dy = Math.abs(e.clientY - dragStartRef.current.y);
      if (dx > 3 || dy > 3) didMoveRef.current = true;

      const nextX = Math.max(
        EDGE_MARGIN,
        Math.min(window.innerWidth - CHAT_HEAD_SIZE - EDGE_MARGIN, e.clientX - dragOffsetRef.current.x)
      );
      const nextY = Math.max(
        EDGE_MARGIN,
        Math.min(window.innerHeight - CHAT_HEAD_SIZE - EDGE_MARGIN, e.clientY - dragOffsetRef.current.y)
      );
      setPos({ x: nextX, y: nextY });
    };
    const handleUp = () => setIsDragging(false);
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging]);

  const handleClick = () => {
    if (didMoveRef.current) return;
    toggleWidget();
  };

  // Determine which conversation to show on the chat head.
  // Prefer the explicitly-current one; fall back to the most recent
  // conversation (index 0), since `conversations` is sorted newest-first.
  const activeConversation =
    currentConversation || (conversations.length > 0 ? conversations[0] : null);

  // For a direct chat, use the OTHER participant's avatar; for a group,
  // use the group's own avatar_url (if any).
  const otherParticipant =
    activeConversation?.type === 'direct'
      ? activeConversation.participants?.find((p) => p.id !== user?.id) || null
      : null;

  const avatarUrl =
    activeConversation?.type === 'group'
      ? activeConversation.avatar_url || null
      : otherParticipant?.avatar_url || null;

  const displayName =
    activeConversation?.type === 'group'
      ? activeConversation.name || 'Group Chat'
      : otherParticipant?.username || user?.username || 'Chat';

  if (!isAuthenticated) return null;

  return (
    <div
      className="fixed z-[60] group"
      style={{
        left: pos.x,
        top: pos.y,
        width: CHAT_HEAD_SIZE,
        height: CHAT_HEAD_SIZE,
      }}
    >
      {/* Inner circular button (kept separate so the badge is never clipped). */}
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        title={displayName}
        aria-label="Open chat"
        className={`w-full h-full flex items-center justify-center rounded-full ring-2 shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-transform overflow-hidden ${
          isWidgetOpen
            ? 'ring-[#00C8FF] scale-105'
            : 'ring-white/90 dark:ring-black/60 cursor-grab hover:scale-105 active:scale-95'
        } ${isDragging ? 'cursor-grabbing scale-105' : ''}`}
        style={{
          touchAction: 'none',
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

      {/* Unread badge — rendered OUTSIDE the button so it can never be
          clipped by the button's overflow-hidden, and made slightly
          larger + with a stronger ring so it's easy to read on a phone. */}
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 z-10 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#EF4444] text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-black shadow-lg pointer-events-none"
        >
          {unreadCount > 99 ? '99+' : unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </div>
  );
}