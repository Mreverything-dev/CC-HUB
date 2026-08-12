// frontend/src/features/announcements/components/AnnouncementReactions.tsx
import { useEffect, useRef, useState } from 'react';
import { FaceSmileIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { AnnouncementReactionEntry } from '@/types/announcement.types';

export const ANNOUNCEMENT_REACTIONS = ['❤️', '😂', '🔥', '👍', '😮', '😢', '🚀'];

interface AnnouncementReactionsProps {
  announcementId: string;
  reactions: AnnouncementReactionEntry[];
  size?: 'sm' | 'md';
}

export function AnnouncementReactions({ announcementId, reactions, size = 'sm' }: AnnouncementReactionsProps) {
  const { user } = useAuthStore();
  const { reactToAnnouncement } = useAnnouncements();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Local optimistic state for reactions
  const [localReactions, setLocalReactions] = useState<AnnouncementReactionEntry[]>(reactions);

  // Sync props to local state if the parent updates
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

  // Derived values from local state instead of props
  const myReaction = localReactions.find((r) => r.user_id === user?.id)?.reaction;

  const counts = new Map<string, number>();
  localReactions.forEach((r) => counts.set(r.reaction, (counts.get(r.reaction) || 0) + 1));
  const groups = Array.from(counts.entries());

  const handleReact = (e: React.MouseEvent, reaction: string) => {
    e.stopPropagation();
    setPickerOpen(false);

    if (!user) return;

    // Optimistically update local UI immediately
    setLocalReactions((prev) => {
      const existingIdx = prev.findIndex((r) => r.user_id === user.id);

      if (existingIdx !== -1) {
        // Toggling off the same emoji
        if (prev[existingIdx].reaction === reaction) {
          return prev.filter((r) => r.user_id !== user.id);
        }
        // Swapping to a different emoji
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], reaction };
        return updated;
      }

      // Adding a new reaction
      return [...prev, { user_id: user.id, reaction } as AnnouncementReactionEntry];
    });

    // Send API request in background
    reactToAnnouncement({ id: announcementId, reaction });
  };

  const chipClass = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {groups.map(([emoji, count]) => (
        <button
          key={emoji}
          onClick={(e) => handleReact(e, emoji)}
          className={`flex items-center gap-1 rounded-full border transition ${chipClass} ${
            myReaction === emoji
              ? 'bg-[#00C8FF]/15 border-[#00C8FF]/50 text-[#00C8FF]'
              : 'bg-[#0D1722] border-[#1E3447] text-[#94A3B8] hover:border-[#00C8FF]/30'
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
          className={`flex items-center gap-1 rounded-full border border-[#1E3447] bg-[#0D1722] text-[#64748B] hover:text-[#00C8FF] hover:border-[#00C8FF]/30 transition ${chipClass}`}
        >
          <FaceSmileIcon className={iconClass} />
        </button>
        {pickerOpen && (
          <div className="absolute bottom-full left-0 mb-1 flex items-center gap-1 px-2 py-1.5 rounded-full border border-[#1E3447] bg-[#111E2B] shadow-lg z-20">
            {ANNOUNCEMENT_REACTIONS.map((emoji) => (
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