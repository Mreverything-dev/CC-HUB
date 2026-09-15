// frontend/src/features/announcements/components/AnnouncementReactions.tsx
import { useEffect, useState } from 'react';
import { HandThumbUpIcon } from '@heroicons/react/24/outline';
import { HandThumbUpIcon as HandThumbUpIconSolid } from '@heroicons/react/24/solid';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { AnnouncementReactionEntry } from '@/types/announcement.types';

const THUMBS_UP = '👍';

interface AnnouncementReactionsProps {
  announcementId: string;
  reactions: AnnouncementReactionEntry[];
  size?: 'sm' | 'md';
}

export function AnnouncementReactions({ announcementId, reactions, size = 'sm' }: AnnouncementReactionsProps) {
  const { user } = useAuthStore();
  const { reactToAnnouncement } = useAnnouncements();

  const [localReactions, setLocalReactions] = useState<AnnouncementReactionEntry[]>(reactions);

  useEffect(() => {
    setLocalReactions(reactions);
  }, [reactions]);

  // Count only thumbs-up reactions (ignore legacy emojis from old data)
  const count = localReactions.filter((r) => r.reaction === THUMBS_UP).length;
  const mine = localReactions.some((r) => r.user_id === user?.id && r.reaction === THUMBS_UP);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    setLocalReactions((prev) => {
      const existingIdx = prev.findIndex((r) => r.user_id === user.id);
      if (existingIdx !== -1) {
        // User already reacted — remove
        return prev.filter((r) => r.user_id !== user.id);
      }
      // Add thumbs-up
      return [...prev, { user_id: user.id, reaction: THUMBS_UP } as AnnouncementReactionEntry];
    });

    reactToAnnouncement({ id: announcementId, reaction: THUMBS_UP });
  };

  const chipClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm';
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <button
      onClick={handleToggle}
      title={mine ? 'Remove reaction' : 'React'}
      className={`flex items-center gap-1.5 rounded-full border transition ${chipClass} ${
        mine
          ? 'bg-text-primary/10 border-text-primary/40 text-text-primary'
          : 'bg-glass border-border text-text-secondary hover:text-text-primary hover:border-text-primary/30'
      }`}
    >
      {mine ? (
        <HandThumbUpIconSolid className={iconClass} />
      ) : (
        <HandThumbUpIcon className={iconClass} />
      )}
      <span className="font-medium">{count}</span>
    </button>
  );
}