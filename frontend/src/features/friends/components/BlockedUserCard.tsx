// frontend/src/features/friends/components/BlockedUserCard.tsx
import { formatRelativeTime } from '@/lib/formatters';
import { BlockedUser } from '@/types/friend.types';
import { FriendAvatar } from './FriendAvatar';

interface BlockedUserCardProps {
  blocked: BlockedUser;
  isUnblocking: boolean;
  onUnblock: (userId: string) => void;
}

export function BlockedUserCard({ blocked, isUnblocking, onUnblock }: BlockedUserCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#1E3447] bg-[#0D1722] p-3.5">
      <FriendAvatar avatar={blocked.avatar} name={blocked.username} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#F1F5F9] truncate">{blocked.username}</p>
        <p className="text-xs text-[#64748B] truncate">
          Blocked {formatRelativeTime(blocked.blocked_at)}
        </p>
      </div>
      <button
        onClick={() => onUnblock(blocked.user_id)}
        disabled={isUnblocking}
        className="px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#00C8FF] border border-[#1E3447] hover:border-[#00C8FF]/40 rounded-xl transition disabled:opacity-50 flex-shrink-0"
      >
        {isUnblocking ? 'Unblocking...' : 'Unblock'}
      </button>
    </div>
  );
}
