// frontend/src/features/announcements/components/AnnouncementDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, BookmarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { announcementApi } from '@/services/api/announcement.service';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { Announcement } from '@/types/announcement.types';
import { CATEGORY_META } from '../constants';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { PostReactions } from '@/features/posts/components/PostReactions';
import { AnnouncementShareMenu } from './AnnouncementShareMenu';
import { formatDate } from '@/lib/formatters';

export default function AnnouncementDetailPage() {
  const { announcementId } = useParams();
  const navigate = useNavigate();
  const { toggleBookmark, reactToAnnouncement } = useAnnouncements();
  const { user } = useAuthStore();

  const dashboardPath =
    user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'professor' ? '/professor/dashboard' : '/student/dashboard';
  const goBack = () => navigate(-1);

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [localReactions, setLocalReactions] = useState<Announcement['reactions']>([]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    announcementApi
      .getAnnouncement(announcementId!)
      .then((res) => {
        if (!cancelled) {
          setAnnouncement(res.data);
          setLocalReactions(res.data.reactions);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err.response?.status;
        setError({
          status: status || 500,
          message:
            status === 403
              ? "You don't have permission to view this announcement."
              : status === 404
              ? 'This announcement could not be found.'
              : 'Failed to load this announcement.',
        });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [announcementId]);

  const handleBookmark = async () => {
    if (!announcement) return;
    setIsBookmarking(true);
    try {
      const res = await toggleBookmark(announcement.id);
      setAnnouncement((prev) => (prev ? { ...prev, is_bookmarked: res.is_bookmarked } : prev));
    } finally {
      setIsBookmarking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg px-4">
        <div className="text-center max-w-sm">
          <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-[#EF4444] mb-3" />
          <h2 className="text-lg font-semibold text-text-primary">
            {error?.status === 403 ? 'Access denied' : 'Announcement unavailable'}
          </h2>
          <p className="text-sm text-text-secondary mt-1">{error?.message}</p>
          <button
            onClick={goBack}
            className="mt-5 px-4 py-2 text-sm font-semibold border border-border bg-glass text-text-primary rounded-xl hover:bg-glass-hover transition"
          >
            Back to Announcements
          </button>
        </div>
      </div>
    );
  }

  const meta = CATEGORY_META[announcement.type] ?? CATEGORY_META.general;
  const Icon = meta.icon;
  const isImportant = announcement.priority === 'urgent';
  const authorName =
    announcement.created_by_username ||
    (announcement.created_by_role === 'admin' ? 'Admin' : 'Professor');

  // Convert reactions array to breakdown + myReaction (PostReactions format)
  const reactionBreakdown = localReactions.reduce<Record<string, number>>((acc, r) => {
    if (r.reaction) acc[r.reaction] = (acc[r.reaction] || 0) + 1;
    return acc;
  }, {});
  const myReaction = localReactions.find((r) => r.user_id === user?.id)?.reaction ?? null;
  const reactionsCount = localReactions.length;

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition mb-5"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>

        <div className="rounded-2xl border border-border bg-glass backdrop-blur-xl p-5 sm:p-6">
          {/* Category badge */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <div className={`flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center border ${meta.border} ${meta.bg}`}>
              <Icon className={`h-[18px] w-[18px] ${meta.color}`} />
            </div>
            <span
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                isImportant
                  ? 'text-red-400 bg-red-500/10 border-red-500/30'
                  : 'text-text-secondary bg-glass border-border'
              }`}
            >
              {isImportant ? 'Important' : meta.label}
            </span>
            {!announcement.is_published && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary bg-glass border border-border rounded-full px-2 py-0.5">
                Draft
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-text-primary break-words">{announcement.title}</h1>

          {/* Author */}
          <div className="flex items-center gap-3 mt-4">
            <Avatar src={announcement.created_by_avatar} name={authorName} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text-primary">{authorName}</p>
                <RoleBadge role={announcement.created_by_role} />
              </div>
              <p className="text-xs text-text-muted mt-0.5">{formatDate(announcement.published_at || announcement.created_at)}</p>
            </div>
          </div>

          {/* Content */}
          <p className="mt-6 text-sm text-text-primary whitespace-pre-wrap break-words leading-relaxed">
            {announcement.content}
          </p>

          {/* Image */}
          {announcement.image_url && (
            <div className="mt-4 rounded-xl overflow-hidden border border-border">
              <img src={announcement.image_url} alt="" className="w-full max-h-[480px] object-cover" />
            </div>
          )}

          {/* Reaction summary — katulad ng AnnouncementCard */}
          {reactionsCount > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4">
              <div className="flex items-center -space-x-1.5">
                {Object.entries(reactionBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([emoji], i) => (
                    <span
                      key={`summary-${emoji}`}
                      className="flex items-center justify-center h-7 w-7"
                      style={{ zIndex: 3 - i }}
                    >
                      <span className="text-[18px]">{emoji}</span>
                    </span>
                  ))}
              </div>
              <span className="text-sm text-text-secondary font-medium">{reactionsCount}</span>
            </div>
          )}

          {/* Actions: Reactions + Bookmark + Share */}
          <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-border flex-wrap">
            <PostReactions
              breakdown={reactionBreakdown}
              myReaction={myReaction}
              onReact={(reaction) => {
                if (!user) return;

                // Optimistic update
                setLocalReactions((prev) => {
                  const existingIdx = prev.findIndex((r) => r.user_id === user.id);
                  if (existingIdx !== -1) {
                    if (prev[existingIdx].reaction === reaction) {
                      return prev.filter((r) => r.user_id !== user.id);
                    }
                    const updated = [...prev];
                    updated[existingIdx] = { ...updated[existingIdx], reaction };
                    return updated;
                  }
                  return [...prev, { user_id: user.id, reaction }];
                });

                reactToAnnouncement({ id: announcement.id, reaction });
              }}
              size="md"
              label="Like"
              alwaysShowLike
            />

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handleBookmark}
                disabled={isBookmarking}
                title={announcement.is_bookmarked ? 'Remove from saved' : 'Save'}
                className={`p-2 rounded-lg transition disabled:opacity-50 ${
                  announcement.is_bookmarked
                    ? 'text-text-primary bg-text-primary/10'
                    : 'text-text-muted hover:text-text-primary hover:bg-glass'
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
        </div>

        {/* Details — nasa ilalim na, hindi sidebar */}
        <div className="mt-4 rounded-2xl border border-border bg-glass backdrop-blur-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Details</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-text-muted">Audience</dt>
              <dd className="text-text-primary text-right">{announcement.audience}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-muted">Type</dt>
              <dd className="text-text-primary">{meta.label}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-muted">Priority</dt>
              <dd className="text-text-primary capitalize">{announcement.priority}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-muted">Published</dt>
              <dd className="text-text-primary text-right">{formatDate(announcement.published_at || announcement.created_at)}</dd>
            </div>
            {announcement.expires_at && (
              <div className="flex items-center justify-between">
                <dt className="text-text-muted">Expires</dt>
                <dd className="text-text-primary text-right">{formatDate(announcement.expires_at)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}