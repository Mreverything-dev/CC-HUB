// frontend/src/features/chat/components/MessageReactions.tsx
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaceSmileIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChat } from '../hooks/useChat';
import { MessageReactionEntry } from '@/types/chat.types';

export const MESSAGE_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🚀'];

interface MessageReactionsProps {
  messageId: string;
  reactions: MessageReactionEntry[];
  align?: 'left' | 'right';
}

export function MessageReactions({ messageId, reactions }: MessageReactionsProps) {
  const { user } = useAuthStore();
  const { reactToMessage } = useChat();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [localReactions, setLocalReactions] = useState<MessageReactionEntry[]>(reactions);

  useEffect(() => {
    setLocalReactions(reactions);
  }, [reactions]);

  // Compute a fixed-position coordinate for the picker so it can render in a
  // portal at document.body - unaffected by the chat container's overflow.
  useEffect(() => {
    if (!pickerOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const PICKER_HEIGHT = 44;
    const spaceAbove = rect.top;
    const placeBelow = spaceAbove <= PICKER_HEIGHT + 8;
    setPickerPos({
      top: placeBelow ? rect.bottom + 8 : rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, [pickerOpen]);

  // Close on outside click - must check both the trigger AND the portaled picker.
  useEffect(() => {
    if (!pickerOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        pickerRef.current?.contains(target)
      ) {
        return;
      }
      setPickerOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [pickerOpen]);


  const counts = new Map<string, number>();
  localReactions.forEach((r) => counts.set(r.reaction, (counts.get(r.reaction) || 0) + 1));
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const totalCount = localReactions.length;
  const topEmojis = groups.slice(0, 3).map(([emoji]) => emoji);

  const handleReact = (e: React.MouseEvent, reaction: string) => {
    e.stopPropagation();
    setPickerOpen(false);
    if (!user) return;

    setLocalReactions((prev) => {
      const existingIdx = prev.findIndex((r) => r.user_id === user.id);
      if (existingIdx !== -1) {
        if (prev[existingIdx].reaction === reaction) {
          return prev.filter((r) => r.user_id !== user.id);
        }
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], reaction };
        return updated;
      }
      return [...prev, { user_id: user.id, reaction }];
    });

    reactToMessage(messageId, reaction);
  };

  // The picker JSX - rendered via createPortal below.
  const pickerJSX = pickerOpen && pickerPos ? (
    <div
      ref={pickerRef}
      className="fixed z-[9999] flex items-center gap-1 px-2 py-1.5 rounded-full border border-border bg-bg shadow-xl"
      style={{
        top: pickerPos.top,
        left: pickerPos.left,
        transform: 'translate(-50%, -100%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {MESSAGE_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={(e) => handleReact(e, emoji)}
          className="text-base hover:scale-125 transition-transform"
        >
          {emoji}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
      {groups.length > 0 ? (
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPickerOpen((v) => !v);
            }}
            title={groups.map(([emoji, count]) => `${emoji} ${count}`).join(', ')}
            className="flex items-center rounded-full px-1 py-0 shadow-sm transition bg-bg"
          >
            <span className="flex items-center -space-x-1">
              {topEmojis.map((emoji, i) => (
                <span
                  key={`top-${emoji}-${i}`}
                  className="flex items-center justify-center rounded-full bg-bg border border-bg shadow-sm h-[14px] w-[14px]"
                  style={{ zIndex: topEmojis.length - i }}
                >
                  <span className="text-[10px] leading-none">{emoji}</span>
                </span>
              ))}
            </span>
            {totalCount > 1 && (
              <span className="text-[9px] font-semibold text-text-secondary ml-0.5 leading-none">
                {totalCount}
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPickerOpen((v) => !v);
            }}
            title="React"
            className="flex items-center justify-center rounded-full border border-border bg-bg shadow-sm text-text-muted hover:text-[#00C8FF] hover:border-[#00C8FF]/30 transition h-5 w-5"
          >
            <FaceSmileIcon className="h-3 w-3" />
          </button>
        </div>
      )}

      {pickerJSX && createPortal(pickerJSX, document.body)}
    </div>
  );
}