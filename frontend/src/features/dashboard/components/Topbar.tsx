// frontend/src/features/dashboard/components/Topbar.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoIcon } from '@/components/ui/Logo/Logo';
import {
  MagnifyingGlassIcon,
  ChatBubbleLeftIcon,
  UserGroupIcon,
  ChevronDownIcon,
  Bars3Icon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChat } from '@/features/chat/hooks/useChat';
import NotificationBell from '@/features/friends/components/NotificationBell';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';
import { GlobalSearchDropdown } from './GlobalSearchDropdown';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { ThemeToggle } from '@/components/ui/ThemeToggle/ThemeToggle';
import { Post } from '@/services/api/post.service';
import { Announcement } from '@/types/announcement.types';
import { Section } from '@/types/section.types';

interface TopbarProps {
  avatarUrl: string | null;
  onOpenFriends?: () => void;
  onOpenMenu?: () => void;
  searchPosts?: Post[];
  searchAnnouncements?: Announcement[];
  searchSections?: Section[];
  onOpenPost?: (postId: string) => void;
  onOpenSection?: (sectionId: string) => void;
  onNavigateHome?: () => void;
}

export function Topbar({
  avatarUrl,
  onOpenFriends,
  onOpenMenu,
  searchPosts = [],
  searchAnnouncements = [],
  searchSections = [],
  onOpenPost,
  onOpenSection,
  onNavigateHome,
}: TopbarProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { unreadCount, toggleWidget } = useChat();

  // On mobile / tablet (< 1024px), the messages button takes the user to
  // the full-page /chat route (Messenger-style) instead of toggling the
  // small floating widget, which is too cramped for a phone screen.
  const handleMessagesClick = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    if (isMobile) {
      navigate('/chat');
    } else {
      toggleWidget();
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchResults = useGlobalSearch(searchQuery, {
    posts: searchPosts,
    announcements: searchAnnouncements,
    sections: searchSections,
  });

  useEffect(() => {
    if (!searchOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchQuery('');
    setSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 sm:gap-4 border-b border-border bg-bg/95 backdrop-blur-xl px-3 py-3.5 sm:px-4 lg:px-8">
      {onOpenMenu && (
        <button
          onClick={onOpenMenu}
          title="Open menu"
          aria-label="Open menu"
          className="lg:hidden flex-shrink-0 p-2 -ml-1 text-text-secondary hover:text-text-primary hover:bg-glass rounded-xl transition"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
      )}
      {onNavigateHome ? (
        <button
          type="button"
          onClick={onNavigateHome}
          title="Go to Feed"
          className="lg:hidden flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-glass hover:bg-glass-hover transition-colors"
        >
          <LogoIcon size="xs" background="dark" />
        </button>
      ) : (
        <div className="lg:hidden flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-glass">
          <LogoIcon size="xs" background="dark" />
        </div>
      )}

      <div
        className={`relative flex-1 max-w-md hidden sm:block transition-all duration-300 ease-out ${
          searchOpen ? 'scale-105' : 'scale-100'
        }`}
        ref={searchRef}
      >
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Search posts, people, sections..."
          className="w-full rounded-xl border border-border bg-glass py-2 pl-9 pr-8 text-sm text-text-primary placeholder-text-muted transition focus:border-border focus:outline-none focus:ring-1 focus:ring-border"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            title="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition"
          >
            <XCircleIcon className="h-4 w-4" />
          </button>
        )}

        {searchOpen && searchResults.hasQuery && (
          <GlobalSearchDropdown
            results={searchResults}
            onSelectPerson={(userId) => {
              closeSearch();
              navigate(`/profile/${userId}`);
            }}
            onSelectPost={(postId) => {
              closeSearch();
              onOpenPost?.(postId);
            }}
            onSelectAnnouncement={(announcementId) => {
              closeSearch();
              navigate(`/announcements/${announcementId}`);
            }}
            onSelectSection={(sectionId) => {
              closeSearch();
              onOpenSection?.(sectionId);
            }}
          />
        )}
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-0.5 sm:gap-2 flex-shrink-0">
        <button
          onClick={() => (onOpenFriends ? onOpenFriends() : navigate('/friends'))}
          title="Friends"
          className="p-2 text-text-secondary hover:text-text-primary transition rounded-xl hover:bg-glass"
        >
          <UserGroupIcon className="h-5 w-5" />
        </button>

        <ThemeToggle />

        <button
          onClick={handleMessagesClick}
          title="Messages"
          className="relative p-2 text-text-secondary hover:text-text-primary transition rounded-xl hover:bg-glass"
        >
          <ChatBubbleLeftIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-[#00C8FF] text-[#060B12] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <NotificationBell onNavigateFriends={onOpenFriends} />

        <div className="w-px h-6 bg-border mx-1" />

        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-glass transition"
        >
          <Avatar src={avatarUrl} name={user?.username} size="sm" />
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-text-primary leading-tight">{user?.username || 'User'}</p>
            <RoleBadge role={user?.role || 'student'} className="mt-0.5" />
          </div>
          <ChevronDownIcon className="h-4 w-4 text-text-muted hidden md:block" />
        </button>
      </div>
    </header>
  );
}