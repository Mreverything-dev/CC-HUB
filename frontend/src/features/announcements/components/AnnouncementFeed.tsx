// frontend/src/features/announcements/components/AnnouncementFeed.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { Sidebar, SidebarSection } from '@/features/dashboard/components/Sidebar';
import { Topbar } from '@/features/dashboard/components/Topbar';
import { profileService } from '@/services/api/profile.service';
import AnnouncementFeedBody from './AnnouncementFeedBody';

/**
 * Standalone /announcements route. Wraps the shared AnnouncementFeedBody
 * with the same Sidebar/Topbar shell every dashboard uses, so this page
 * feels like a natural part of CCS HUB rather than a separate mini-app.
 * Clicking any OTHER sidebar item hands off to that role's dashboard with
 * the target tab pre-selected - the same navigate(path, { state: { section } })
 * pattern ProfilePage already uses to deep-link back into a dashboard tab.
 */
export default function AnnouncementFeed() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    profileService
      .getMyProfile()
      .then((res) => setAvatarUrl((res.data.profile as any)?.avatar_url || null))
      .catch(() => setAvatarUrl(null));
  }, []);

  const dashboardPath =
    user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'professor' ? '/professor/dashboard' : '/student/dashboard';

  const handleNavigate = (section: SidebarSection) => {
    if (section === 'announcements') return;
    navigate(dashboardPath, { state: { section } });
  };

  return (
    <div className="min-h-screen bg-[#07111A] text-[#F1F5F9] flex">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <Sidebar activeSection="announcements" onNavigate={handleNavigate} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          avatarUrl={avatarUrl}
          onNavigateHome={() => handleNavigate('feed')}
          onOpenFriends={() => handleNavigate('friends')}
        />

        <main className="relative flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <AnnouncementFeedBody />
        </main>
      </div>
    </div>
  );
}
