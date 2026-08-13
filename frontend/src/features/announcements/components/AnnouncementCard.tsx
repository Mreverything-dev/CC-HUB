// frontend/src/features/announcements/components/AnnouncementCard.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EllipsisVerticalIcon, BookmarkIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { Announcement } from '@/types/announcement.types';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { formatDate } from '@/lib/formatters';
import { CATEGORY_META } from '../constants';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { AnnouncementReactions } from './AnnouncementReactions';
import { AnnouncementShareMenu } from './AnnouncementShareMenu';

interface AnnouncementCardProps {
  announcement: Announcement;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onTogglePublish?: (id: string, isPublished: boolean) => void;
}

export function AnnouncementCard({
  announcement,
  onEdit,
  onDelete,
  onTogglePublish
}: AnnouncementCardProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { toggleBookmark } = useAnnouncements();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  const isOwner = user?.id === announcement.user_id || user?.role === 'admin';

  const meta = CATEGORY_META[announcement.type] ?? CATEGORY_META.general;
  const Icon = meta.icon;
  const isImportant = announcement.priority === 'urgent';

  const badge = isImportant
    ? { label: 'Important', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' }
    : { label: meta.label, color: meta.color, bg: meta.bg, border: meta.border };

  const authorName =
    announcement.created_by_username ||
    (announcement.created_by_role === 'admin' ? 'Admin' : 'Professor');

  const goToDetail = () => navigate(`/announcements/${announcement.id}`);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToDetail();
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBookmarking(true);
    try {
      await toggleBookmark(announcement.id);
    } finally {
      setIsBookmarking(false);
    }
  };

  return (
    <div
      onClick={goToDetail}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View announcement: ${announcement.title}`}
      className="group rounded-2xl border border-[#1E3447] bg-[#0D1722] hover:bg-[#111E2B] hover:border-[#00C8FF]/40 hover:shadow-[0_0_24px_rgba(0,200,255,0.06)] transition-all cursor-pointer p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF]/60"
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center border ${meta.border} ${meta.bg}`}>
          <Icon className={`h-5 w-5 ${meta.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-[#F1F5F9] group-hover:text-[#00C8FF] transition-colors truncate">
                  {announcement.title}
                </h3>
                {!announcement.is_published && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8] bg-white/5 border border-[#1E3447] rounded-full px-2 py-0.5">
                    Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                {formatDate(announcement.created_at)} · {authorName} · {announcement.audience}
              </p>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <span
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${badge.color} ${badge.bg} ${badge.border}`}
              >
                {badge.label}
              </span>

              {isOwner && (
                <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    title="More options"
                    className="p-1 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-lg transition"
                  >
                    <EllipsisVerticalIcon className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl z-20 overflow-hidden">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onTogglePublish?.(announcement.id, !announcement.is_published);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium transition ${
                          announcement.is_published
                            ? 'text-amber-400 hover:bg-amber-500/10'
                            : 'text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {announcement.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      {onEdit && (
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            onEdit(announcement.id);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-[#00C8FF] hover:bg-[#00C8FF]/10 transition"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete?.(announcement.id);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-[#94A3B8] mt-2 line-clamp-2 break-words">
            {announcement.content}
          </p>

          {announcement.image_url && (
            <div className="mt-3 rounded-xl overflow-hidden border border-[#1E3447]">
              <img
                src={announcement.image_url}
                alt=""
                className="w-full max-h-56 object-cover"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[#1E3447] flex-wrap">
            <AnnouncementReactions announcementId={announcement.id} reactions={announcement.reactions} size="sm" />

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handleBookmark}
                disabled={isBookmarking}
                title={announcement.is_bookmarked ? 'Remove from saved' : 'Save'}
                className={`p-1.5 rounded-lg transition disabled:opacity-50 ${
                  announcement.is_bookmarked
                    ? 'text-[#00C8FF] bg-[#00C8FF]/10'
                    : 'text-[#64748B] hover:text-[#00C8FF] hover:bg-white/5'
                }`}
              >
                {announcement.is_bookmarked ? (
                  <BookmarkSolidIcon className="h-4 w-4" />
                ) : (
                  <BookmarkIcon className="h-4 w-4" />
                )}
              </button>
              <AnnouncementShareMenu announcementId={announcement.id} title={announcement.title} />
            </div>
          </div>

          {announcement.expires_at && (
            <p className="text-xs text-[#64748B] mt-2">
              Expires {formatDate(announcement.expires_at)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
