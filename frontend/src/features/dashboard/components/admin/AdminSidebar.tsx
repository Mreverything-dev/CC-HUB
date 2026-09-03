// frontend/src/features/dashboard/components/admin/AdminSidebar.tsx
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogoIcon } from '@/components/ui/Logo/Logo';
import {
  Squares2X2Icon,
  IdentificationIcon,
  UserGroupIcon,
  DocumentTextIcon,
  MegaphoneIcon,
  SignalIcon,
  VideoCameraIcon,
  FlagIcon,
  ClockIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { Avatar } from '../Avatar';

/**
 * Everything the Admin control panel can navigate to - deliberately its own
 * type/set, NOT SidebarSection (the Student/Professor dashboards' nav) -
 * this is a genuinely different structure (moderation/monitoring surfaces
 * a student or professor never sees), not the same tabs re-skinned.
 */
export type AdminSection =
  | 'overview'
  | 'users'
  | 'sections'
  | 'posts'
  | 'announcements'
  | 'livestreams'
  | 'meethub'
  | 'reports'
  | 'activity'
  | 'settings';

interface AdminNavItem {
  id: AdminSection;
  label: string;
  icon: typeof Squares2X2Icon;
  count?: number;
}

interface AdminSidebarProps {
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
  reportsCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function AdminSidebar({ activeSection, onNavigate, reportsCount = 0, isMobileOpen = false, onCloseMobile }: AdminSidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const NAV_ITEMS: AdminNavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: Squares2X2Icon },
    { id: 'users', label: 'Users', icon: IdentificationIcon },
    { id: 'sections', label: 'Sections', icon: UserGroupIcon },
    { id: 'posts', label: 'Posts', icon: DocumentTextIcon },
    { id: 'announcements', label: 'Announcements', icon: MegaphoneIcon },
    { id: 'livestreams', label: 'Livestreams', icon: SignalIcon },
    { id: 'meethub', label: 'Meethub', icon: VideoCameraIcon },
    { id: 'reports', label: 'Reports', icon: FlagIcon, count: reportsCount },
    { id: 'activity', label: 'System Activity', icon: ClockIcon },
    { id: 'settings', label: 'Settings', icon: Cog6ToothIcon },
  ];

  const handleItemClick = (item: AdminNavItem) => {
    onNavigate(item.id);
    onCloseMobile?.();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <>
      {/* Header - "ADMIN CONTROL" badge instead of the College subtitle
          every other dashboard shows, so this is unmistakably a different
          surface even before the nav items are read. */}
      <button
        type="button"
        onClick={() => onNavigate('overview')}
        className="flex items-center gap-3 px-5 py-5 border-b border-[rgba(139,92,246,0.15)] text-left hover:bg-white/5 transition-colors duration-200"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#8B5CF6]/40 bg-[#8B5CF6]/10 shadow-[0_0_20px_rgba(139,92,246,0.18)]">
          <LogoIcon size="sm" background="dark" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-[#F1F5F9] leading-tight">CCS HUB</h1>
          <p className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-[#8B5CF6]">
            <ShieldCheckIcon className="h-3 w-3" />
            ADMIN CONTROL PANEL
          </p>
        </div>
      </button>

      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 themed-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeSection;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                isActive
                  ? 'border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-[#8B5CF6] shadow-[0_0_12px_rgba(139,92,246,0.18)]'
                  : 'border-transparent text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
              }`}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-[#8B5CF6]' : ''}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {!!item.count && (
                <span
                  className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0 ${
                    isActive ? 'bg-[#8B5CF6] text-white' : 'bg-[#8B5CF6]/20 text-[#8B5CF6]'
                  }`}
                >
                  {item.count > 9 ? '9+' : item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[rgba(139,92,246,0.15)] p-3 space-y-3">
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-all duration-200"
        >
          <Avatar name={user?.username} size="sm" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-[#F1F5F9] truncate">{user?.username || 'Admin'}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wide text-[#8B5CF6] bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-2 py-0.5">
              <ShieldCheckIcon className="h-2.5 w-2.5" />
              Admin
            </span>
          </div>
        </button>

        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => navigate('/profile')}
            title="Account"
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
    </>
  );

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col w-[280px] h-screen sticky top-0 border-r border-[rgba(139,92,246,0.15)] bg-[#0A0714]/95 backdrop-blur-xl">
        {sidebarContent}
      </aside>

      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isMobileOpen}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCloseMobile} />
        <aside
          className={`absolute inset-y-0 left-0 w-[280px] max-w-[85vw] flex flex-col border-r border-[rgba(139,92,246,0.15)] bg-[#0A0714] shadow-2xl transition-transform duration-300 ease-out ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            onClick={onCloseMobile}
            title="Close menu"
            aria-label="Close menu"
            className="absolute top-4 right-3 p-2 rounded-xl text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 transition-all duration-200"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          {sidebarContent}
        </aside>
      </div>
    </>
  );
}
