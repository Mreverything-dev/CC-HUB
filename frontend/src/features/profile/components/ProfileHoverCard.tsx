// frontend/src/features/profile/components/ProfileHoverCard.tsx
import { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChatBubbleLeftIcon, UserIcon } from '@heroicons/react/24/outline';
import { profileService } from '@/services/api/profile.service';
import { useChat } from '@/features/chat/hooks/useChat';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';

interface ProfileHoverCardProps {
  userId: string;
  children: ReactNode;
}

export function ProfileHoverCard({ userId, children }: ProfileHoverCardProps) {
  const navigate = useNavigate();
  const { createDirectConversation, openWidget } = useChat();
  const [profile, setProfile] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });

  const fetchProfile = async () => {
    if (profile) return;
    setIsLoading(true);
    try {
      const res = await profileService.getUserProfile(userId);
      setProfile(res.data);
    } catch (err) {
      console.error('Error fetching profile for hover card:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    hoverTimerRef.current = setTimeout(async () => {
      await fetchProfile();

      const cardWidth = 260;
      const cardHeight = 180;
      const mouseX = mousePosRef.current.x;
      const mouseY = mousePosRef.current.y;

      // Card sa ibaba ng cursor, may 12px gap
      // Yung cursor ay nasa taas ng card
      let left = mouseX - 30;
      let top = mouseY + 12;

      // Smart positioning
      if (left + cardWidth > window.innerWidth - 16) {
        left = window.innerWidth - cardWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }
      if (top + cardHeight > window.innerHeight - 16) {
        // Kung lumalabas sa bottom, ilipat sa taas ng cursor
        top = mouseY - cardHeight - 12;
      }

      setPosition({ top, left });
      setIsVisible(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    closeTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 200);
  };

  const handleCardEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleCardLeave = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleMessage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsStartingChat(true);
    try {
      await createDirectConversation(userId);
      openWidget();
      setIsVisible(false);
    } catch (err) {
      console.error('Error starting chat:', err);
    } finally {
      setIsStartingChat(false);
    }
  };

  const handleViewProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigate(`/profile/${userId}`);
    setIsVisible(false);
  };

  const fullName =
    profile?.profile?.first_name && profile?.profile?.last_name
      ? `${profile.profile.first_name} ${profile.profile.last_name}`
      : profile?.username || 'User';

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>

      {isVisible && createPortal(
        <div
          ref={cardRef}
          onMouseEnter={handleCardEnter}
          onMouseLeave={handleCardLeave}
          className="fixed z-[9999] w-64 rounded-2xl border border-border bg-bg shadow-2xl p-4"
          style={{ top: position.top, left: position.left }}
        >
          {isLoading || !profile ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin h-5 w-5 rounded-full border-2 border-border border-t-[#00C8FF]" />
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-2">
                <RoleBadge role={profile.role || 'student'} />
              </div>

              <div className="flex items-center gap-3">
                <Avatar
                  src={profile.profile?.avatar_url || null}
                  name={profile.username}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {fullName}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    @{profile.username}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={handleMessage}
                  disabled={isStartingChat}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-transparent bg-[#00C8FF] text-[#060B12] hover:opacity-90 transition disabled:opacity-50"
                >
                  <ChatBubbleLeftIcon className="h-3.5 w-3.5" />
                  {isStartingChat ? 'Opening...' : 'Message'}
                </button>
                <button
                  onClick={handleViewProfile}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border text-text-secondary hover:bg-glass hover:text-text-primary transition"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  View Profile
                </button>
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}