// frontend/src/features/dashboard/components/Sidebar.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CodeXml } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  HomeIcon,
  MegaphoneIcon,
  UsersIcon,
  AcademicCapIcon,
  VideoCameraIcon,
  ChatBubbleLeftIcon,
  CalendarIcon,
  BookOpenIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { profileService } from '@/services/api/profile.service';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';

export type SidebarSection = 'feed' | 'announcements' | 'sections';

interface NavItem {
  id: string;
  label: string;
  icon: typeof HomeIcon;
  section?: SidebarSection;
  href?: string;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'feed', label: 'Feed', icon: HomeIcon, section: 'feed' },
  { id: 'announcements', label: 'Announcements', icon: MegaphoneIcon, section: 'announcements' },
  { id: 'sections', label: 'Sections', icon: UsersIcon, section: 'sections' },
  { id: 'classes', label: 'Classes', icon: AcademicCapIcon, comingSoon: true },
  { id: 'live', label: 'Live Streams', icon: VideoCameraIcon, href: '/livestreams' },
  { id: 'chat', label: 'Chat', icon: ChatBubbleLeftIcon, href: '/chat' },
  { id: 'events', label: 'Events', icon: CalendarIcon, comingSoon: true },
  { id: 'resources', label: 'Resources', icon: BookOpenIcon, comingSoon: true },
  { id: 'groups', label: 'Groups', icon: UserGroupIcon, comingSoon: true },
];

interface SidebarProps {
  activeSection: SidebarSection;
  onNavigate: (section: SidebarSection) => void;
}

export function Sidebar({ activeSection, onNavigate }: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    profileService
      .getMyProfile()
      .then((res) => setAvatarUrl((res.data.profile as any)?.avatar_url || null))
      .catch(() => setAvatarUrl(null));
  }, []);

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
    <aside className="hidden lg:flex lg:flex-col w-64 h-screen sticky top-0 border-r border-[#2a2a2a] bg-[#0f0f0f]/95 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#2a2a2a]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00d4ff]/40 bg-[#00d4ff]/10 shadow-[0_0_20px_rgba(0,212,255,0.15)]">
          <CodeXml className="h-5 w-5 text-[#00d4ff]" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white leading-tight">CCS HUB</h1>
          <p className="text-[10px] font-medium tracking-wider text-[#6b6b6b]">
            COLLEGE OF COMPUTER STUDIES
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 themed-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = item.section && item.section === activeSection;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              disabled={item.comingSoon}
              title={item.comingSoon ? 'Coming soon' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                isActive
                  ? 'border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#00d4ff] shadow-[0_0_12px_rgba(0,212,255,0.15)]'
                  : item.comingSoon
                  ? 'border-transparent text-[#4a4a4a] cursor-default'
                  : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.comingSoon && (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-[#4a4a4a] border border-[#2a2a2a] rounded px-1.5 py-0.5">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom - User profile / settings / help / logout */}
      <div className="border-t border-[#2a2a2a] p-3 space-y-3">
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-all duration-200"
        >
          <Avatar src={avatarUrl} name={user?.username} size="sm" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-white truncate">{user?.username || 'User'}</p>
            <div className="flex items-center gap-2 mt-1">
              <RoleBadge role={user?.role || 'student'} />
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Online
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => navigate('/profile')}
            title="Settings"
            className="p-2.5 rounded-xl text-[#a0a0a0] hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => toast('Help center coming soon')}
            title="Help"
            className="p-2.5 rounded-xl text-[#a0a0a0] hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <QuestionMarkCircleIcon className="h-5 w-5" />
          </button>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-2.5 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
