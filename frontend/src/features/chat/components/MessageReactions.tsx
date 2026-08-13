// frontend/src/features/chat/components/MessageReactions.tsx
import { useEffect, useRef, useState } from 'react';
import { FaceSmileIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChat } from '../hooks/useChat';
import { MessageReactionEntry } from '@/types/chat.types';

export const MESSAGE_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🚀'];

interface MessageReactionsProps {
  messageId: string;
  reactions: MessageReactionEntry[];
  /** Which side the bubble sits on - pills/picker line up with it. */
  align?: 'left' | 'right';
}

export function MessageReactions({ messageId, reactions, align = 'left' }: MessageReactionsProps) {
  const { user } = useAuthStore();
  const { reactToMessage } = useChat();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Local optimistic state so a reaction feels instant instead of waiting on
  // the socket round-trip back through message:reaction.
  const [localReactions, setLocalReactions] = useState<MessageReactionEntry[]>(reactions);

  useEffect(() => {
    setLocalReactions(reactions);
  }, [reactions]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [pickerOpen]);

  const myReaction = localReactions.find((r) => r.user_id === user?.id)?.reaction;

  const counts = new Map<string, number>();
  localReactions.forEach((r) => counts.set(r.reaction, (counts.get(r.reaction) || 0) + 1));
  const groups = Array.from(counts.entries());

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

  return (
    <div
      className={`flex items-center gap-1 flex-wrap mt-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {groups.map(([emoji, count]) => (
        <button
          key={emoji}
          onClick={(e) => handleReact(e, emoji)}
          className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition ${
            myReaction === emoji
              ? 'bg-[#00C8FF]/15 border-[#00C8FF]/50 text-[#00C8FF]'
              : 'bg-[#101D2A] border-[#1E3447] text-[#94A3B8] hover:border-[#00C8FF]/30'
          }`}
        >
          <span>{emoji}</span>
          <span>{count}</span>
        </button>
      ))}

      <div className="relative" ref={pickerRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen((v) => !v);
          }}
          title="React"
          className={`flex items-center rounded-full border border-[#1E3447] bg-[#101D2A] text-[#64748B] hover:text-[#00C8FF] hover:border-[#00C8FF]/30 transition p-1 ${
            groups.length === 0
              ? 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
              : ''
          }`}
        >
          <FaceSmileIcon className="h-3.5 w-3.5" />
        </button>
        {pickerOpen && (
          <div
            className={`absolute bottom-full mb-1 flex items-center gap-1 px-2 py-1.5 rounded-full border border-[#1E3447] bg-[#111E2B] shadow-lg z-20 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
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
        )}
      </div>
    </div>
  );
}
