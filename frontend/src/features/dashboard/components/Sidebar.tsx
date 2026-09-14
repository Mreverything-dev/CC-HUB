// frontend/src/features/dashboard/components/Sidebar.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoIcon } from '@/components/ui/Logo/Logo';
import {
  HomeIcon,
  MegaphoneIcon,
  UsersIcon,
  IdentificationIcon,
  AcademicCapIcon,
  ChatBubbleLeftIcon,
  CalendarIcon,
  BookOpenIcon,
  SignalIcon,
  UserGroupIcon,
  UserPlusIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useFriendStore } from '@/features/friends/store/friend.store';
import { useChatStore } from '@/features/chat/store/chat.store';
import { livestreamService } from '@/services/api/livestream.service';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export type SidebarSection = 'feed' | 'announcements' | 'sections' | 'classes' | 'users' | 'friends' | 'chat';

interface NavItem {
  id: string;
  label: string;
  icon: typeof HomeIcon;
  section?: SidebarSection;
  href?: string;
  comingSoon?: boolean;
  adminOnly?: boolean;
}

const PulsingSignalIcon = (props: React.ComponentProps<'svg'>) => (
  <SignalIcon {...props} className={`${props.className || ''} text-red-500 animate-pulse`} />
);

const NAV_ITEMS: NavItem[] = [
  { id: 'feed', label: 'Feed', icon: HomeIcon, section: 'feed' },
  { id: 'announcements', label: 'Campus News', icon: MegaphoneIcon, section: 'announcements' },
  { id: 'sections', label: 'Sections', icon: UsersIcon, section: 'sections' },
  { id: 'users', label: 'Users', icon: IdentificationIcon, section: 'users', adminOnly: true },
  { id: 'classes', label: 'Schedule', icon: AcademicCapIcon, section: 'classes' },
  { id: 'live', label: 'Live Now', icon: PulsingSignalIcon as typeof HomeIcon, href: '/livestreams' },
  { id: 'meethub', label: 'Meethub', icon: VideoCameraIcon, href: '/meethub' },
  { id: 'chat', label: 'Chat', icon: ChatBubbleLeftIcon, section: 'chat' },
  { id: 'friends', label: 'Friends', icon: UserPlusIcon, section: 'friends' },
  { id: 'events', label: 'Events', icon: CalendarIcon, comingSoon: true },
  { id: 'resources', label: 'Resources', icon: BookOpenIcon, comingSoon: true },
  { id: 'groups', label: 'Groups', icon: UserGroupIcon, comingSoon: true },
];

interface SidebarProps {
  activeSection: SidebarSection | null;
  onNavigate: (section: SidebarSection) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ activeSection, onNavigate, isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [liveCount, setLiveCount] = useState(0);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const notifications = useFriendStore((state) => state.notifications);
  const chatUnreadCount = useChatStore((state) => state.unreadCount);

  const announcementUnreadCount = notifications.filter(
    (n) => n.type === 'announcement' && !n.is_read
  ).length;

  useEffect(() => {
    const fetchLiveCount = () => {
      livestreamService
        .getStreams('live')
        .then((res) => setLiveCount(res.data.length))
        .catch(() => setLiveCount(0));
    };
    fetchLiveCount();
    const interval = setInterval(fetchLiveCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const NAV_COUNTS: Record<string, number> = {
    announcements: announcementUnreadCount,
    live: liveCount,
    chat: chatUnreadCount,
  };

  const handleItemClick = (item: NavItem) => {
    if (item.comingSoon) return;
    if (item.href) {
      navigate(item.href);
    } else if (item.section) {
      onNavigate(item.section);
    }
    onCloseMobile?.();
  };

  const handleSignOutClick = () => {
    setShowSignOutConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    setShowSignOutConfirm(false);
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <button
        type="button"
        onClick={() => onNavigate('feed')}
        className="group flex items-center gap-3 px-5 py-5 border-b border-border text-left hover:bg-glass transition-colors duration-200"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-glass transition-transform duration-200 ease-out group-hover:scale-110">
          <LogoIcon size="sm" background="dark" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-text-primary leading-tight">CCS HUB</h1>
          <p className="text-[10px] font-medium tracking-wider text-text-muted">
            COLLEGE OF COMPUTER STUDIES
          </p>
        </div>
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 themed-scrollbar">
        {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === 'admin').map((item) => {
          const isActive = item.section && item.section === activeSection;
          const Icon = item.icon;
          const count = NAV_COUNTS[item.id] || 0;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              disabled={item.comingSoon}
              title={item.comingSoon ? 'Coming soon' : undefined}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ease-out ${
                isActive
                  ? 'bg-glass text-text-primary'
                  : item.comingSoon
                  ? 'text-text-muted cursor-default'
                  : 'text-text-secondary hover:text-text-primary hover:bg-glass'
              }`}
            >
              <Icon
                className={`h-5 w-5 flex-shrink-0 transition-transform duration-200 ease-out group-hover:scale-110 ${
                  isActive ? 'text-text-primary' : ''
                }`}
              />
              <span className="relative flex-1 text-left transition-transform duration-200 ease-out group-hover:scale-105 origin-left">
                {item.label}
              </span>
              {item.comingSoon ? (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-text-muted border border-border rounded px-1.5 py-0.5">
                  Soon
                </span>
              ) : count > 0 ? (
                <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0 bg-glass text-text-secondary">
                  {count > 9 ? '9+' : count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Bottom - Sign out */}
      <div className="border-t border-border p-3">
        <button
          onClick={handleSignOutClick}
          title="Sign out"
          className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ease-out text-[#EF4444]/80 hover:text-[#EF4444] hover:bg-[#EF4444]/10"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 flex-shrink-0" />
          <span className="relative flex-1 text-left">Sign out</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex lg:flex-col w-[280px] h-screen sticky top-0 bg-bg/95 backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isMobileOpen}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCloseMobile} />
        <aside
          className={`absolute inset-y-0 left-0 w-[280px] max-w-[85vw] flex flex-col bg-bg shadow-2xl transition-transform duration-300 ease-out ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            onClick={onCloseMobile}
            title="Close menu"
            aria-label="Close menu"
            className="absolute top-4 right-3 p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-glass transition-all duration-200"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          {sidebarContent}
        </aside>
      </div>

      {/* Sign out confirmation dialog */}
      {showSignOutConfirm && (
        <ConfirmDialog
          title="Sign Out"
          message="Are you sure you want to sign out of CCS HUB?"
          confirmLabel="Sign Out"
          loadingLabel="Signing out..."
          danger
          onConfirm={handleConfirmSignOut}
          onCancel={() => setShowSignOutConfirm(false)}
        />
      )}
    </>
  );
}