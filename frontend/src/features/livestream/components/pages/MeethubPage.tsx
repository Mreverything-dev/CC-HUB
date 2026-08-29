// frontend/src/features/livestream/components/pages/MeethubPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { meethubService } from '@/services/api/meethub.service';
import { MeethubSession } from '@/types/meethub.types';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { profileService } from '@/services/api/profile.service';
import { Sidebar, SidebarSection } from '@/features/dashboard/components/Sidebar';
import { Topbar } from '@/features/dashboard/components/Topbar';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import CreateMeethubModal from '../CreateMeethubModal';
import toast from 'react-hot-toast';
import {
  VideoCameraIcon,
  AcademicCapIcon,
  UserIcon,
  EyeIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const gridBg = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#1E3447] bg-[#0A111A] overflow-hidden animate-pulse">
      <div className="aspect-video bg-[#162534]" />
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-[#162534]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-24 rounded bg-[#162534]" />
            <div className="h-2 w-14 rounded bg-[#162534]" />
          </div>
        </div>
        <div className="h-3 w-3/4 rounded bg-[#162534]" />
      </div>
    </div>
  );
}

function MeethubSessionCard({ session, onClick }: { session: MeethubSession; onClick: () => void }) {
  const navigate = useNavigate();
  const entryClosed = !!session.entry_deadline && new Date(session.entry_deadline).getTime() < Date.now();

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group rounded-2xl border border-[#1E3447] bg-[#0A111A] overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-[#00C8FF]/50 hover:shadow-[0_0_28px_rgba(0,200,255,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF]/60"
    >
      <div className="relative aspect-video bg-gradient-to-br from-[#0D1722] via-[#0A111A] to-[#162534] overflow-hidden">
        {session.thumbnail_url ? (
          <img src={session.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <VideoCameraIcon className="h-10 w-10 text-[#1E3447] group-hover:text-[#00C8FF]/30 transition-colors" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060B12]/70 via-transparent to-transparent" />

        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#00C8FF] text-[#060B12] text-[10px] font-bold uppercase tracking-wide">
            <AcademicCapIcon className="h-3 w-3" />
            Meethub
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[#F1F5F9] text-[10px] font-medium">
            <EyeIcon className="h-3 w-3" />
            {session.viewer_count}
          </span>
        </div>

        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] font-medium">
          {session.is_official ? (
            <span className="flex items-center gap-1 text-[#22C55E]">
              <AcademicCapIcon className="h-3 w-3" />
              Official Class
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#94A3B8]">
              <UserIcon className="h-3 w-3" />
              Open Meeting
            </span>
          )}
        </div>

        {entryClosed && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#EF4444] text-[10px] font-semibold">
            <ClockIcon className="h-3 w-3" />
            Entry Closed
          </div>
        )}
      </div>

      <div className="p-3.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/profile/${session.organizer_id}`);
          }}
          title={`View ${session.organizer_username}'s profile`}
          className="flex items-center gap-2.5 mb-2 text-left hover:opacity-80 transition"
        >
          <Avatar src={session.organizer_avatar} name={session.organizer_username} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#F1F5F9] truncate hover:text-[#00C8FF] hover:underline">
              {session.organizer_username}
            </p>
            <RoleBadge role={session.organizer_role} className="mt-0.5" />
          </div>
        </button>

        <h3 className="text-sm font-semibold text-[#F1F5F9] line-clamp-1 group-hover:text-[#00C8FF] transition-colors">
          {session.title}
        </h3>
      </div>
    </div>
  );
}

export default function MeethubPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<MeethubSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [sidebarAvatarUrl, setSidebarAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    profileService
      .getMyProfile()
      .then((res) => setSidebarAvatarUrl((res.data.profile as any)?.avatar_url || null))
      .catch(() => setSidebarAvatarUrl(null));
  }, []);

  const dashboardPath =
    user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'professor' ? '/professor/dashboard' : '/student/dashboard';
  const handleSidebarNavigate = (section: SidebarSection) => navigate(dashboardPath, { state: { section } });

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const res = await meethubService.getMySessions('live');
      setSessions(res.data);
    } catch (error) {
      console.error('Failed to fetch Meethub sessions:', error);
      toast.error('Failed to load Meethub meetings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060B12] text-[#F1F5F9] flex">
      <div className="pointer-events-none fixed inset-0 opacity-[0.15]" style={gridBg} />

      <Sidebar activeSection={null} onNavigate={handleSidebarNavigate} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          avatarUrl={sidebarAvatarUrl}
          onNavigateHome={() => handleSidebarNavigate('feed')}
          onOpenFriends={() => handleSidebarNavigate('friends')}
        />

        <main className="relative flex-1 max-w-7xl w-full mx-auto px-4 py-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F5F9] flex items-center gap-2">
                Meethub
                <AcademicCapIcon className="h-6 w-6 text-[#00C8FF]" />
              </h1>
              <p className="text-[#94A3B8] mt-1 text-sm">Academic live meetings for classes and study groups</p>
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-br from-[#00C8FF] to-[#0891B2] text-[#060B12] rounded-xl font-semibold text-sm shadow-[0_0_20px_rgba(0,200,255,0.25)] hover:opacity-90 active:scale-[0.98] transition flex-shrink-0"
            >
              <VideoCameraIcon className="h-5 w-5" />
              <span>Start Meeting</span>
            </button>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-[#EF4444] animate-pulse" />
              <h2 className="text-base font-semibold text-[#F1F5F9]">Live Now</h2>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-2xl border border-[#1E3447] bg-[#0A111A] py-14 text-center">
                <AcademicCapIcon className="h-12 w-12 mx-auto text-[#1E3447]" />
                <h3 className="text-base font-medium text-[#F1F5F9] mt-3">No Meethub Meetings Live</h3>
                <p className="text-[#94A3B8] text-sm mt-1">Start a meeting for your class or a study group.</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 px-4 py-2 bg-[#00C8FF] text-[#060B12] rounded-xl font-medium text-sm hover:bg-[#00C8FF]/80 transition"
                >
                  Start a Meeting
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sessions.map((session) => (
                  <MeethubSessionCard
                    key={session.id}
                    session={session}
                    onClick={() => navigate(`/meethub/${session.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {showCreate && (
        <CreateMeethubModal
          onClose={() => setShowCreate(false)}
          onSessionCreated={(sessionId) => navigate(`/meethub/${sessionId}`)}
        />
      )}
    </div>
  );
}
