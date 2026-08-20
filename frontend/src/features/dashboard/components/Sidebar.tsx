// frontend/src/features/dashboard/components/Sidebar.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CodeXml } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  HomeIcon,
  MegaphoneIcon,
  UsersIcon,
  IdentificationIcon,
  AcademicCapIcon,
  VideoCameraIcon,
  ChatBubbleLeftIcon,
  CalendarIcon,
  BookOpenIcon,
  UserGroupIcon,
  UserPlusIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useFriendStore } from '@/features/friends/store/friend.store';
import { useChatStore } from '@/features/chat/store/chat.store';
import { profileService } from '@/services/api/profile.service';
import { livestreamService } from '@/services/api/livestream.service';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';

export type SidebarSection = 'feed' | 'announcements' | 'sections' | 'users' | 'friends' | 'chat';

interface NavItem {
  id: string;
  label: string;
  icon: typeof HomeIcon;
  section?: SidebarSection;
  href?: string;
  comingSoon?: boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'feed', label: 'Dashboard', icon: HomeIcon, section: 'feed' },
  { id: 'announcements', label: 'Announcements', icon: MegaphoneIcon, section: 'announcements' },
  { id: 'sections', label: 'Sections', icon: UsersIcon, section: 'sections' },
  { id: 'users', label: 'Users', icon: IdentificationIcon, section: 'users', adminOnly: true },
  { id: 'classes', label: 'Classes', icon: AcademicCapIcon, comingSoon: true },
  { id: 'live', label: 'Live Streams', icon: VideoCameraIcon, href: '/livestreams' },
  { id: 'chat', label: 'Chat', icon: ChatBubbleLeftIcon, section: 'chat' },
  { id: 'friends', label: 'Friends', icon: UserPlusIcon, section: 'friends' },
  { id: 'events', label: 'Events', icon: CalendarIcon, comingSoon: true },
  { id: 'resources', label: 'Resources', icon: BookOpenIcon, comingSoon: true },
  { id: 'groups', label: 'Groups', icon: UserGroupIcon, comingSoon: true },
];

interface SidebarProps {
  /** Pass null when the current page (e.g. Profile) isn't one of the in-dashboard sections. */
  activeSection: SidebarSection | null;
  onNavigate: (section: SidebarSection) => void;
}

export function Sidebar({ activeSection, onNavigate }: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(0);

  // ✅ Read from the already-populated shared stores rather than calling
  // useFriends()/useChat() again here - those hooks register their own
  // socket.io listeners, and socketService.off() removes ALL listeners for
  // an event name, so a second concurrent registration (Sidebar + Topbar's
  // NotificationBell both mounted at once) would double-fire notifications.
  const notifications = useFriendStore((state) => state.notifications);
  const chatUnreadCount = useChatStore((state) => state.unreadCount);

  const announcementUnreadCount = notifications.filter(
    (n) => n.type === 'announcement' && !n.is_read
  ).length;

  useEffect(() => {
    profileService
      .getMyProfile()
      .then((res) => setAvatarUrl((res.data.profile as any)?.avatar_url || null))
      .catch(() => setAvatarUrl(null));
  }, []);

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
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="hidden lg:flex lg:flex-col w-[280px] h-screen sticky top-0 border-r border-[rgba(0,200,245,0.1)] bg-[#070D13]/95 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[rgba(0,200,245,0.1)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00C8FF]/40 bg-[#00C8FF]/10 shadow-[0_0_20px_rgba(0,200,245,0.15)]">
          <CodeXml className="h-5 w-5 text-[#00C8FF]" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-[#F1F5F9] leading-tight">CCS HUB</h1>
          <p className="text-[10px] font-medium tracking-wider text-[#64748B]">
            COLLEGE OF COMPUTER STUDIES
          </p>
        </div>
      </div>

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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                isActive
                  ? 'border-[#00C8FF]/40 bg-[#00C8FF]/10 text-[#00C8FF] shadow-[0_0_12px_rgba(0,200,245,0.18)]'
                  : item.comingSoon
                  ? 'border-transparent text-[#3D4A5C] cursor-default'
                  : 'border-transparent text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
              }`}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-[#00C8FF]' : ''}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.comingSoon ? (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-[#3D4A5C] border border-[#1E3447] rounded px-1.5 py-0.5">
                  Soon
                </span>
              ) : count > 0 ? (
                <span
                  className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0 ${
                    isActive ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#00C8FF]/20 text-[#00C8FF]'
                  }`}
                >
                  {count > 9 ? '9+' : count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Bottom - User profile / settings / help / logout */}
      <div className="border-t border-[rgba(0,200,245,0.1)] p-3 space-y-3">
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-all duration-200"
        >
          <Avatar src={avatarUrl} name={user?.username} size="sm" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-[#F1F5F9] truncate">{user?.username || 'User'}</p>
            <div className="flex items-center gap-2 mt-1">
              <RoleBadge role={user?.role || 'student'} />
              <span className="flex items-center gap-1 text-[10px] font-medium text-[#10B981]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                Online
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => navigate('/profile')}
            title="Settings"
            className="p-2.5 rounded-xl text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 transition-all duration-200"
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => toast('Help center coming soon')}
            title="Help"
            className="p-2.5 rounded-xl text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 transition-all duration-200"
          >
            <QuestionMarkCircleIcon className="h-5 w-5" />
          </button>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-2.5 rounded-xl text-[#EF4444]/80 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all duration-200"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
