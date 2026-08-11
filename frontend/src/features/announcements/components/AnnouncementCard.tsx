// frontend/src/features/announcements/components/AnnouncementCard.tsx
import { Announcement } from '@/types/announcement.types';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { formatDate } from '@/lib/formatters';
import { CATEGORY_META } from '../constants';

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

  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl p-5 hover:border-[#00d4ff]/30 transition-all">
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center border ${meta.border} ${meta.bg}`}>
          <Icon className={`h-5 w-5 ${meta.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-white truncate">
                  {announcement.title}
                </h3>
                {!announcement.is_published && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a0a0a0] bg-white/5 border border-[#2a2a2a] rounded-full px-2 py-0.5">
                    Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6b6b6b] mt-0.5">
                {formatDate(announcement.created_at)} · {authorName}
              </p>
            </div>

            <span
              className={`flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border ${badge.color} ${badge.bg} ${badge.border}`}
            >
              {badge.label}
            </span>
          </div>

          <p className="text-sm text-[#d0d0d0] whitespace-pre-wrap mt-2">
            {announcement.content}
          </p>

          {(isOwner || announcement.expires_at) && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#2a2a2a]">
              <span className="text-xs text-[#6b6b6b]">
                {announcement.expires_at ? `Expires ${formatDate(announcement.expires_at)}` : ''}
              </span>

              {isOwner && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onTogglePublish?.(announcement.id, !announcement.is_published)}
                    className={`text-xs font-medium px-3 py-1 rounded-lg transition ${
                      announcement.is_published
                        ? 'text-amber-400 hover:bg-amber-500/10'
                        : 'text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    {announcement.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  {onEdit && (
                    <button
                      onClick={() => onEdit(announcement.id)}
                      className="text-xs font-medium px-3 py-1 rounded-lg text-[#00d4ff] hover:bg-[#00d4ff]/10 transition"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => onDelete?.(announcement.id)}
                    className="text-xs font-medium px-3 py-1 rounded-lg text-red-400 hover:bg-red-500/10 transition"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
