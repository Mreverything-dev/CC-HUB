// frontend/src/features/profile/components/ProfileHoverCard.tsx
import { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChatBubbleLeftIcon, UserIcon } from '@heroicons/react/24/outline';
import { profileService } from '@/services/api/profile.service';
import { postService, Post } from '@/services/api/post.service';
import { extractYouTubeId, stripYouTubeUrl } from '@/lib/youtube';
import { PostContentBody } from '@/features/posts/components/PostContentBody';
import { useChat } from '@/features/chat/hooks/useChat';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';

interface ProfileHoverCardProps {
  userId: string;
  children: ReactNode;
}

export function ProfileHoverCard({ userId, children }: ProfileHoverCardProps) {
  const navigate = useNavigate();
  const { createDirectConversation, openWidget } = useChat();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
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
      const [res, postsRes] = await Promise.all([
        profileService.getUserProfile(userId),
        postService.getUserPosts(userId, 1, 6).catch(() => null),
      ]);
      setProfile(res.data);
      if (postsRes) setPosts(postsRes.data.items);
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

      const cardWidth = 340;
      const cardHeight = 420;
      const mouseX = mousePosRef.current.x;
      const mouseY = mousePosRef.current.y;

      let left = mouseX - 30;
      let top = mouseY + 12;

      if (left + cardWidth > window.innerWidth - 16) {
        left = window.innerWidth - cardWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }
      if (top + cardHeight > window.innerHeight - 16) {
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

  const coverUrl = profile?.profile?.cover_url || null;
  const avatarUrl = profile?.profile?.avatar_url || null;
  const programLabel =
    profile?.profile?.course ||
    profile?.profile?.department ||
    profile?.profile?.position ||
    null;

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
          className="fixed z-[9999] w-[340px] rounded-2xl border border-border bg-bg shadow-2xl overflow-hidden"
          style={{ top: position.top, left: position.left }}
        >
          {isLoading || !profile ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-5 w-5 rounded-full border-2 border-border border-t-text-primary" />
            </div>
          ) : (
            <>
              {/* Cover */}
              <div className="relative h-[110px]">
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#00C8FF]/25 via-bg to-[#3B82F6]/25" />
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
              </div>

              {/* Avatar overlap */}
              <div className="relative px-4 pb-4">
                <div className="flex items-end gap-3">
                  <div className="relative -mt-10 h-16 w-16 rounded-full ring-4 ring-bg bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] flex items-center justify-center text-lg font-bold text-[#060B12] overflow-hidden flex-shrink-0 z-10">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                    ) : (
                      profile.username?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {fullName}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      @{profile.username}
                    </p>
                  </div>
                  <div className="flex-shrink-0 pb-1">
                    <RoleBadge role={profile.role || 'student'} />
                  </div>
                </div>

                {programLabel && (
                  <p className="text-xs text-text-secondary mt-2 truncate">{programLabel}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleViewProfile}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border text-text-secondary hover:bg-glass hover:text-text-primary transition"
                  >
                    <UserIcon className="h-3.5 w-3.5" />
                    View Profile
                  </button>
                  <button
                    onClick={handleMessage}
                    disabled={isStartingChat}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-text-primary text-bg hover:opacity-90 transition disabled:opacity-50"
                  >
                    <ChatBubbleLeftIcon className="h-3.5 w-3.5" />
                    {isStartingChat ? 'Opening...' : 'Message'}
                  </button>
                </div>

                {/* Post grid */}
                {posts.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-1">
                    {posts.slice(0, 6).map((post) => {
                      const ytId = extractYouTubeId(post.content);
                      const thumb =
                        post.media_urls?.[0] ??
                        (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);
                      return (
                        <button
                          key={post.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            navigate(`/profile/${userId}`);
                            setIsVisible(false);
                          }}
                          className="relative aspect-square overflow-hidden bg-glass border border-border rounded-md"
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center p-1 overflow-hidden bg-glass">
                              <PostContentBody
                                content={stripYouTubeUrl(post.content) || 'No preview'}
                                className="text-[8px] leading-tight text-text-primary text-center line-clamp-5"
                              />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}