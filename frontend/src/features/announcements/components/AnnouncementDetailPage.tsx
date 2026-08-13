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
import { AnnouncementReactions } from './AnnouncementReactions';
import { AnnouncementShareMenu } from './AnnouncementShareMenu';
import { formatDate } from '@/lib/formatters';

export default function AnnouncementDetailPage() {
  const { announcementId } = useParams();
  const navigate = useNavigate();
  const { toggleBookmark } = useAnnouncements();
  const { user } = useAuthStore();

  const dashboardPath =
    user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'professor' ? '/professor/dashboard' : '/student/dashboard';
  const goBack = () => navigate(dashboardPath);

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [isBookmarking, setIsBookmarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    announcementApi
      .getAnnouncement(announcementId!)
      .then((res) => {
        if (!cancelled) setAnnouncement(res.data);
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
      <div className="flex items-center justify-center min-h-screen bg-[#060B12]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF]" />
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#060B12] px-4">
        <div className="text-center max-w-sm">
          <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-[#EF4444] mb-3" />
          <h2 className="text-lg font-semibold text-[#F1F5F9]">
            {error?.status === 403 ? 'Access denied' : 'Announcement unavailable'}
          </h2>
          <p className="text-sm text-[#94A3B8] mt-1">{error?.message}</p>
          <button
            onClick={goBack}
            className="mt-5 px-4 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition"
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

  return (
    <div className="min-h-screen bg-[#060B12] text-[#F1F5F9]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <button
  onClick={() => navigate(-1)}
  className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition mb-5"
>
  <ArrowLeftIcon className="h-4 w-4" />
  Back
</button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 rounded-2xl border border-[#1E3447] bg-[#0D1722] p-6">
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <div className={`flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center border ${meta.border} ${meta.bg}`}>
                <Icon className={`h-[18px] w-[18px] ${meta.color}`} />
              </div>
              <span
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                  isImportant
                    ? 'text-red-400 bg-red-500/10 border-red-500/30'
                    : `${meta.color} ${meta.bg} ${meta.border}`
                }`}
              >
                {isImportant ? 'Important' : meta.label}
              </span>
              {!announcement.is_published && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8] bg-white/5 border border-[#1E3447] rounded-full px-2 py-0.5">
                  Draft
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-[#F1F5F9] break-words">{announcement.title}</h1>

            <div className="flex items-center gap-3 mt-4">
              <Avatar src={announcement.created_by_avatar} name={authorName} size="md" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[#F1F5F9]">{authorName}</p>
                  <RoleBadge role={announcement.created_by_role} />
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">{formatDate(announcement.published_at || announcement.created_at)}</p>
              </div>
            </div>

            <p className="mt-6 text-sm text-[#E2E8F0] whitespace-pre-wrap break-words leading-relaxed">
              {announcement.content}
            </p>

            {announcement.image_url && (
              <div className="mt-4 rounded-xl overflow-hidden border border-[#1E3447]">
                <img src={announcement.image_url} alt="" className="w-full max-h-[480px] object-cover" />
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-[#1E3447] flex items-center justify-between gap-3 flex-wrap">
              <AnnouncementReactions announcementId={announcement.id} reactions={announcement.reactions} size="md" />

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={handleBookmark}
                  disabled={isBookmarking}
                  title={announcement.is_bookmarked ? 'Remove from saved' : 'Save'}
                  className={`p-2 rounded-lg transition disabled:opacity-50 ${
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
          </div>

          {/* Info panel */}
          <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-5 h-fit">
            <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">Details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-[#64748B]">Audience</dt>
                <dd className="text-[#F1F5F9] text-right">{announcement.audience}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#64748B]">Type</dt>
                <dd className="text-[#F1F5F9]">{meta.label}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#64748B]">Priority</dt>
                <dd className="text-[#F1F5F9] capitalize">{announcement.priority}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#64748B]">Published</dt>
                <dd className="text-[#F1F5F9] text-right">{formatDate(announcement.published_at || announcement.created_at)}</dd>
              </div>
              {announcement.expires_at && (
                <div className="flex items-center justify-between">
                  <dt className="text-[#64748B]">Expires</dt>
                  <dd className="text-[#F1F5F9] text-right">{formatDate(announcement.expires_at)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
