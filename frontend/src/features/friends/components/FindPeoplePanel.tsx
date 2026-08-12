// frontend/src/features/friends/components/FindPeoplePanel.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, UserPlusIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useUsers } from '@/features/users/hooks/useUsers';
import { FriendAvatar } from './FriendAvatar';

interface FindPeoplePanelProps {
  friendIds: Set<string>;
  pendingSentIds: Set<string>;
  sendingTo: string | null;
  onSendRequest: (userId: string) => void;
}

export function FindPeoplePanel({ friendIds, pendingSentIds, sendingTo, onSendRequest }: FindPeoplePanelProps) {
  const navigate = useNavigate();
  const { users, isLoading, searchUsers } = useUsers();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    searchUsers(value);
  };

  return (
    <div>
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by username or email..."
          className="w-full rounded-xl border border-[#1E3447] bg-[#0D1722] py-2.5 pl-10 pr-4 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#00C8FF]" />
        </div>
      ) : searchTerm.length < 2 ? (
        <p className="text-sm text-[#64748B] text-center py-10">Type at least 2 characters to search.</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-[#64748B] text-center py-10">No users found.</p>
      ) : (
        <div className="space-y-2.5">
          {users.map((user) => {
            const isFriend = friendIds.has(user.id);
            const isPending = pendingSentIds.has(user.id);
            return (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-2xl border border-[#1E3447] bg-[#0D1722] p-3.5"
              >
                <button
                  onClick={() => navigate(`/profile/${user.id}`)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF]/60"
                >
                  <FriendAvatar avatar={null} name={user.username} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F1F5F9] truncate">{user.username}</p>
                    <p className="text-xs text-[#64748B] truncate">{user.email}</p>
                  </div>
                </button>

                {isFriend ? (
                  <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#22C55E] bg-[#22C55E]/10 rounded-xl flex-shrink-0">
                    <CheckIcon className="h-3.5 w-3.5" />
                    Friends
                  </span>
                ) : isPending ? (
                  <span className="px-3 py-1.5 text-xs font-medium text-[#94A3B8] bg-white/5 rounded-xl flex-shrink-0">
                    Pending
                  </span>
                ) : (
                  <button
                    onClick={() => onSendRequest(user.id)}
                    disabled={sendingTo === user.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition disabled:opacity-60 bg-[#00C8FF]/10 text-[#00C8FF] hover:bg-[#00C8FF]/20 border border-[#00C8FF]/30 flex-shrink-0"
                  >
                    <UserPlusIcon className="h-3.5 w-3.5" />
                    {sendingTo === user.id ? 'Sending...' : 'Add'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
