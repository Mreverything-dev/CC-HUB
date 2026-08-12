// frontend/src/features/friends/components/SuggestionCard.tsx
import { useNavigate } from 'react-router-dom';
import { UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Suggestion } from '@/types/friend.types';
import { FriendAvatar } from './FriendAvatar';

interface SuggestionCardProps {
  suggestion: Suggestion;
  isPending: boolean;
  isSending: boolean;
  onAdd: (userId: string) => void;
  onDismiss: (userId: string) => void;
}

export function SuggestionCard({ suggestion, isPending, isSending, onAdd, onDismiss }: SuggestionCardProps) {
  const navigate = useNavigate();

  return (
    <div className="relative rounded-2xl border border-[#1E3447] bg-[#0D1722] hover:bg-[#111E2B] transition-all p-4">
      <button
        onClick={() => onDismiss(suggestion.user_id)}
        title="Dismiss"
        className="absolute top-2 right-2 p-1 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-lg transition"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>

      <button
        onClick={() => navigate(`/profile/${suggestion.user_id}`)}
        className="flex flex-col items-center text-center w-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF]/60"
      >
        <FriendAvatar avatar={suggestion.avatar} name={suggestion.username} size="lg" />
        <p className="text-sm font-semibold text-[#F1F5F9] mt-2.5 truncate max-w-full">{suggestion.username}</p>
        {suggestion.mutual_friends_count > 0 ? (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex -space-x-1.5">
              {suggestion.mutual_friend_avatars.slice(0, 3).map((a, i) => (
                <div key={i} className="h-4 w-4 rounded-full border border-[#0D1722] bg-[#111E2B] overflow-hidden">
                  {a && <img src={a} alt="" className="w-full h-full object-cover" />}
                </div>
              ))}
            </div>
            <span className="text-[11px] text-[#64748B]">
              {suggestion.mutual_friends_count} mutual friend{suggestion.mutual_friends_count !== 1 ? 's' : ''}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-[#64748B] mt-1">Suggested for you</span>
        )}
      </button>

      <button
        onClick={() => onAdd(suggestion.user_id)}
        disabled={isPending || isSending}
        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition disabled:opacity-60 disabled:cursor-default bg-[#00C8FF]/10 text-[#00C8FF] hover:bg-[#00C8FF]/20 border border-[#00C8FF]/30"
      >
        <UserPlusIcon className="h-3.5 w-3.5" />
        {isPending ? 'Pending' : isSending ? 'Sending...' : 'Add Friend'}
      </button>
    </div>
  );
}
