// frontend/src/features/friends/components/FriendRequestCard.tsx
import { useNavigate } from 'react-router-dom';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { FriendRequest } from '@/types/friend.types';
import { FriendAvatar } from './FriendAvatar';

interface FriendRequestCardProps {
  request: FriendRequest;
  variant: 'received' | 'sent';
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onCancel?: (id: string) => void;
  isBusy?: boolean;
}

export function FriendRequestCard({ request, variant, onAccept, onDecline, onCancel, isBusy }: FriendRequestCardProps) {
  const navigate = useNavigate();
  const isReceived = variant === 'received';
  const userId = isReceived ? request.sender_id : request.receiver_id;
  const username = isReceived ? request.sender_username : request.receiver_username;
  const avatar = isReceived ? request.sender_avatar : request.receiver_avatar;
  const isOnline = isReceived ? request.sender_online : request.receiver_online;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#1E3447] bg-[#0D1722] p-3.5">
      <button
        onClick={() => navigate(`/profile/${userId}`)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF]/60"
      >
        <FriendAvatar avatar={avatar} name={username} isOnline={isOnline} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#F1F5F9] hover:text-[#00C8FF] transition-colors truncate">
            {username}
          </p>
          {request.message && <p className="text-xs text-[#94A3B8] mt-0.5 truncate">{request.message}</p>}
        </div>
      </button>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isReceived ? (
          <>
            <button
              onClick={() => onAccept?.(request.id)}
              disabled={isBusy}
              title="Accept"
              className="p-2 bg-[#22C55E]/10 text-[#22C55E] rounded-xl hover:bg-[#22C55E]/20 transition disabled:opacity-50"
            >
              <CheckIcon className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => onDecline?.(request.id)}
              disabled={isBusy}
              title="Decline"
              className="p-2 bg-[#EF4444]/10 text-[#EF4444] rounded-xl hover:bg-[#EF4444]/20 transition disabled:opacity-50"
            >
              <XMarkIcon className="h-[18px] w-[18px]" />
            </button>
          </>
        ) : (
          <button
            onClick={() => onCancel?.(request.id)}
            disabled={isBusy}
            className="px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#EF4444] border border-[#1E3447] hover:border-[#EF4444]/40 rounded-xl transition disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
