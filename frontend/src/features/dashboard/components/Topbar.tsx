// frontend/src/features/dashboard/components/Topbar.tsx
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  ChatBubbleLeftIcon,
  UserGroupIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChat } from '@/features/chat/hooks/useChat';
import NotificationBell from '@/features/friends/components/NotificationBell';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';

interface TopbarProps {
  avatarUrl: string | null;
  onOpenFriends?: () => void;
}

export function Topbar({ avatarUrl, onOpenFriends }: TopbarProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { unreadCount, toggleWidget } = useChat();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-[#2a2a2a] bg-[#0a0a0a]/90 backdrop-blur-xl px-4 py-3 lg:px-8">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6b6b]" />
        <input
          type="text"
          placeholder="Search posts, people, sections..."
          className="w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] py-2 pl-9 pr-4 text-sm text-white placeholder-[#6b6b6b] transition focus:border-[#00d4ff] focus:outline-none focus:ring-1 focus:ring-[#00d4ff]"
        />
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => (onOpenFriends ? onOpenFriends() : navigate('/friends'))}
          title="Friends"
          className="p-2 text-[#a0a0a0] hover:text-[#00d4ff] transition rounded-xl hover:bg-white/5"
        >
          <UserGroupIcon className="h-5 w-5" />
        </button>

        <button
          onClick={toggleWidget}
          title="Messages"
          className="relative p-2 text-[#a0a0a0] hover:text-[#00d4ff] transition rounded-xl hover:bg-white/5"
        >
          <ChatBubbleLeftIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-[#00d4ff] text-[#0a0a0a] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <NotificationBell onNavigateFriends={onOpenFriends} />

        <div className="w-px h-6 bg-[#2a2a2a] mx-1" />

        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-white/5 transition"
        >
          <Avatar src={avatarUrl} name={user?.username} size="sm" />
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-white leading-tight">{user?.username || 'User'}</p>
            <RoleBadge role={user?.role || 'student'} className="mt-0.5" />
          </div>
          <ChevronDownIcon className="h-4 w-4 text-[#6b6b6b] hidden md:block" />
        </button>
      </div>
    </header>
  );
}
