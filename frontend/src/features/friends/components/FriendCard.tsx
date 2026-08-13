// frontend/src/features/friends/components/FriendCard.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '@/lib/formatters';
import { ChatBubbleLeftIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { Friend } from '@/types/friend.types';
import { FriendAvatar } from './FriendAvatar';

interface FriendCardProps {
  friend: Friend;
  onMessage: (userId: string) => void;
  onRemove: (friend: Friend) => void;
  onBlock: (friend: Friend) => void;
  onReport: (friend: Friend) => void;
}

export function FriendCard({ friend, onMessage, onRemove, onBlock, onReport }: FriendCardProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  const statusText = friend.is_online
    ? 'Online'
    : friend.last_seen
    ? `Last seen ${formatRelativeTime(friend.last_seen)}`
    : 'Offline';

  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-[#1E3447] bg-[#0D1722] hover:bg-[#111E2B] hover:border-[#00C8FF]/30 transition-all p-3.5">
      <button
        onClick={() => navigate(`/profile/${friend.user_id}`)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF]/60"
      >
        <FriendAvatar avatar={friend.avatar} name={friend.username} isOnline={friend.is_online} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#F1F5F9] group-hover:text-[#00C8FF] transition-colors truncate">
            {friend.username}
          </p>
          <p className={`text-xs mt-0.5 truncate ${friend.is_online ? 'text-[#22C55E]' : 'text-[#64748B]'}`}>
            {statusText}
          </p>
          <p className="text-xs text-[#64748B] truncate">{friend.email}</p>
          {friend.mutual_friends_count > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex -space-x-1.5">
                {friend.mutual_friend_avatars.slice(0, 3).map((a, i) => (
                  <div
                    key={i}
                    className="h-4 w-4 rounded-full border border-[#0D1722] bg-[#111E2B] overflow-hidden"
                  >
                    {a && <img src={a} alt="" className="w-full h-full object-cover" />}
                  </div>
                ))}
              </div>
              <span className="text-[11px] text-[#64748B]">
                {friend.mutual_friends_count} mutual friend{friend.mutual_friends_count !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </button>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onMessage(friend.user_id)}
          title="Message"
          className="p-2 text-[#94A3B8] hover:text-[#00C8FF] hover:bg-white/5 rounded-xl transition"
        >
          <ChatBubbleLeftIcon className="h-[18px] w-[18px]" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            title="More options"
            className="p-2 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
          >
            <EllipsisHorizontalIcon className="h-[18px] w-[18px]" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl z-20 overflow-hidden">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate(`/profile/${friend.user_id}`);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-[#F1F5F9] hover:bg-white/5 transition"
              >
                View Profile
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onRemove(friend);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-[#F59E0B] hover:bg-[#F59E0B]/10 transition"
              >
                Remove Friend
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onBlock(friend);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/10 transition"
              >
                Block
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onReport(friend);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/10 transition"
              >
                Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
