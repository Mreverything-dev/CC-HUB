// frontend/src/features/dashboard/components/Topbar.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CodeXml } from 'lucide-react';
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
import { Post } from '@/services/api/post.service';
import { Announcement } from '@/types/announcement.types';
import { Section } from '@/types/section.types';

interface TopbarProps {
  avatarUrl: string | null;
  onOpenFriends?: () => void;
  /** Opens the mobile Sidebar drawer. Omitted on any page that doesn't wire
   * up the drawer, in which case the hamburger simply isn't rendered. */
  onOpenMenu?: () => void;
  /** Data the parent dashboard already fetched (useFeed/useAnnouncements/
   * useSections) - global search filters over these rather than issuing any
   * new requests of its own for posts/announcements/sections. Omit any of
   * them to simply exclude that bucket from results (e.g. a page that
   * doesn't load posts). */
  searchPosts?: Post[];
  searchAnnouncements?: Announcement[];
  searchSections?: Section[];
  /** Opens a specific post's detail (the dashboard mounts its own
   * PostDetailModal, reusing its existing deletePost/editPost from useFeed). */
  onOpenPost?: (postId: string) => void;
  /** Switches to the Sections view for one specific section (each dashboard
   * already supports this via SectionDashboard's initialSectionId). */
  onOpenSection?: (sectionId: string) => void;
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
}: TopbarProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { unreadCount, toggleWidget } = useChat();

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
    <header className="sticky top-0 z-30 flex items-center gap-2 sm:gap-4 border-b border-[rgba(0,200,245,0.1)] bg-[#070D13]/90 backdrop-blur-xl px-3 py-3 sm:px-4 lg:px-8">
      {/* Mobile-only: hamburger (opens the Sidebar drawer) + compact brand
          mark, since the full Sidebar - and its logo - is hidden below lg:. */}
      {onOpenMenu && (
        <button
          onClick={onOpenMenu}
          title="Open menu"
          aria-label="Open menu"
          className="lg:hidden flex-shrink-0 p-2 -ml-1 text-[#94A3B8] hover:text-[#00C8FF] hover:bg-white/5 rounded-xl transition"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
      )}
      <div className="lg:hidden flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#00C8FF]/40 bg-[#00C8FF]/10">
        <CodeXml className="h-4 w-4 text-[#00C8FF]" />
      </div>

      {/* Search - hidden below sm: to keep the hamburger/brand/actions from
          overflowing on the narrowest phone widths. */}
      <div className="relative flex-1 max-w-md hidden sm:block" ref={searchRef}>
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Search posts, people, sections..."
          className="w-full rounded-xl border border-[#1E3447] bg-[rgba(15,28,40,0.75)] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] placeholder-[#64748B] transition focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:shadow-[0_0_12px_rgba(0,200,245,0.25)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            title="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F1F5F9] transition"
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
          className="p-2 text-[#94A3B8] hover:text-[#00C8FF] transition rounded-xl hover:bg-white/5"
        >
          <UserGroupIcon className="h-5 w-5" />
        </button>

        <button
          onClick={toggleWidget}
          title="Messages"
          className="relative p-2 text-[#94A3B8] hover:text-[#00C8FF] transition rounded-xl hover:bg-white/5"
        >
          <ChatBubbleLeftIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-[#00C8FF] text-[#060B12] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <NotificationBell onNavigateFriends={onOpenFriends} />

        <div className="w-px h-6 bg-[#1E3447] mx-1" />

        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-white/5 transition"
        >
          <Avatar src={avatarUrl} name={user?.username} size="sm" />
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-[#F1F5F9] leading-tight">{user?.username || 'User'}</p>
            <RoleBadge role={user?.role || 'student'} className="mt-0.5" />
          </div>
          <ChevronDownIcon className="h-4 w-4 text-[#64748B] hidden md:block" />
        </button>
      </div>
    </header>
  );
}
