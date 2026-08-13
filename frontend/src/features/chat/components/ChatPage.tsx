// frontend/src/features/chat/components/ChatPage.tsx
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ChatPanel from './ChatPanel';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { profileService } from '@/services/api/profile.service';
import { Sidebar, SidebarSection } from '@/features/dashboard/components/Sidebar';
import { Topbar } from '@/features/dashboard/components/Topbar';

const gridBg = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

/**
 * Standalone /chat route - renders the same ChatPanel used inside the
 * dashboard's embedded "chat" section, but wrapped in the same Sidebar/Topbar
 * shell so it isn't a bare fullscreen page when reached directly by URL.
 */
export default function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const initialConversationId = (location.state as { conversationId?: string } | null)?.conversationId ?? null;
  const [sidebarAvatarUrl, setSidebarAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    profileService
      .getMyProfile()
      .then((res) => setSidebarAvatarUrl((res.data.profile as any)?.avatar_url || null))
      .catch(() => setSidebarAvatarUrl(null));
  }, []);

  const dashboardPath =
    user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'professor' ? '/professor/dashboard' : '/student/dashboard';
  const handleSidebarNavigate = (section: SidebarSection) => navigate(dashboardPath, { state: { section } });

  return (
    <div className="min-h-screen bg-[#060B12] text-[#F1F5F9] flex">
      <div className="pointer-events-none fixed inset-0 opacity-[0.15]" style={gridBg} />

      <Sidebar activeSection="chat" onNavigate={handleSidebarNavigate} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar avatarUrl={sidebarAvatarUrl} onOpenFriends={() => handleSidebarNavigate('friends')} />

        <main className="relative flex-1 min-h-0 max-w-6xl w-full mx-auto px-4 py-6 lg:px-8">
          <ChatPanel initialConversationId={initialConversationId} fullHeight={false} />
        </main>
      </div>
    </div>
  );
}
