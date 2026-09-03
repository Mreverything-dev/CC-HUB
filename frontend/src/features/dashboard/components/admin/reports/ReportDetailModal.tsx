// frontend/src/features/dashboard/components/admin/reports/ReportDetailModal.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon, CheckCircleIcon, NoSymbolIcon, ShieldExclamationIcon, ClockIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatAbsoluteTime } from '@/lib/formatters';
import type { AdminReportListItem, AdminRestrictionDuration } from '@/services/api/admin.service';
import { useAdminReportActions } from '../../../hooks/useAdminReports';
import { getReportCategoryMeta, getReportStatusMeta, RESTRICTION_DURATIONS } from '../../../constants/reportCategories';

interface ReportDetailModalProps {
  report: AdminReportListItem;
  onClose: () => void;
}

type PendingAction =
  | { type: 'dismiss' }
  | { type: 'validate' }
  | { type: 'warn' }
  | { type: 'restrict'; duration: AdminRestrictionDuration; label: string; days: number }
  | { type: 'remove-post' }
  | { type: 'confirm-violation' }
  | null;

export function ReportDetailModal({ report, onClose }: ReportDetailModalProps) {
  const navigate = useNavigate();
  const { dismiss, validate, warn, restrict, removePost, confirmViolation } = useAdminReportActions();
  const [pending, setPending] = useState<PendingAction>(null);
  const [violationMessage, setViolationMessage] = useState('');

  const category = getReportCategoryMeta(report.category, report.category_label);
  const status = getReportStatusMeta(report.status);
  const isDismissed = report.status === 'dismissed';
  const isBusy = dismiss.isPending || validate.isPending || warn.isPending || restrict.isPending || removePost.isPending || confirmViolation.isPending;

  const runAction = async () => {
    if (!pending) return;
    try {
      if (pending.type === 'dismiss') {
        await dismiss.mutateAsync(report.id);
        toast.success('Report dismissed.');
      } else if (pending.type === 'validate') {
        await validate.mutateAsync(report.id);
        toast.success('Report marked as valid.');
      } else if (pending.type === 'warn') {
        await warn.mutateAsync(report.id);
        toast.success('Warning sent to the reported user.');
      } else if (pending.type === 'restrict') {
        await restrict.mutateAsync({ reportId: report.id, duration: pending.duration });
        toast.success('User restricted.');
      } else if (pending.type === 'remove-post') {
        await removePost.mutateAsync(report.id);
        toast.success('Post removed.');
      } else if (pending.type === 'confirm-violation') {
        if (!violationMessage.trim()) {
          toast.error('Write a message explaining the violation before sending.');
          return;
        }
        await confirmViolation.mutateAsync({ reportId: report.id, message: violationMessage.trim() });
        toast.success('Violation notice sent to the reported user.');
        setViolationMessage('');
      }
      setPending(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Action failed');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E3447]">
          <h3 className="font-semibold text-[#F1F5F9]">Report Details</h3>
          <button onClick={onClose} className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] rounded-full hover:bg-white/5 transition">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Category + Status */}
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1">Report Category</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${category.colorClass}`}>
                <span>{category.emoji}</span>
                {category.label}
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1">Status</p>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${status.colorClass}`}>
                {status.label}
              </span>
            </div>
          </div>

          {/* Reported Post */}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1.5">Reported Post</p>
            {report.reported_post ? (
              report.reported_post.exists ? (
                <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3.5">
                  {report.reported_post.content && (
                    <p className="text-sm text-[#F1F5F9] [overflow-wrap:anywhere]">{report.reported_post.content}</p>
                  )}
                  {report.reported_post.media_urls.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      {report.reported_post.media_urls.slice(0, 6).map((url, i) => (
                        <img key={i} src={url} alt="" className="w-full h-16 object-cover rounded-lg" />
                      ))}
                    </div>
                  )}
                  {report.reported_post.created_at && (
                    <p className="text-xs text-[#64748B] mt-2">Posted {formatAbsoluteTime(report.reported_post.created_at)}</p>
                  )}
                </div>
              ) : report.reported_post.removed_by_moderation && (report.reported_post.content || report.reported_post.media_urls.length > 0) ? (
                <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3.5">
                  <p className="text-[11px] text-[#64748B] italic mb-2">Removed by a moderator - preserved snapshot for review</p>
                  {report.reported_post.content && (
                    <p className="text-sm text-[#F1F5F9] [overflow-wrap:anywhere]">{report.reported_post.content}</p>
                  )}
                  {report.reported_post.media_urls.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      {report.reported_post.media_urls.slice(0, 6).map((url, i) => (
                        <img key={i} src={url} alt="" className="w-full h-16 object-cover rounded-lg" />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3.5 text-sm text-[#64748B]">
                  This post no longer exists.
                </div>
              )
            ) : report.post_removed ? (
              <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3.5 text-sm text-[#64748B]">
                This post was removed as a result of admin moderation action.
              </div>
            ) : (
              <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3.5 text-sm text-[#64748B]">
                This report was filed against a user, not a specific post.
              </div>
            )}
          </div>

          {/* Reported User */}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1.5">Reported User</p>
            <button
              onClick={() => navigate(`/profile/${report.reported_user.id}`)}
              className="flex items-center gap-2.5 hover:opacity-80 transition"
            >
              <Avatar src={report.reported_user.avatar_url} name={report.reported_user.full_name || report.reported_user.username} size="sm" />
              <div className="text-left min-w-0">
                <p className="text-sm font-medium text-[#F1F5F9] truncate">{report.reported_user.full_name || report.reported_user.username}</p>
                <RoleBadge role={report.reported_user.role} />
              </div>
            </button>
          </div>

          {/* Report Details */}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1.5">Report Details</p>
            <p className="text-sm text-[#94A3B8] [overflow-wrap:anywhere]">
              {report.details || 'No additional details were provided.'}
            </p>
            <p className="text-xs text-[#64748B] mt-1.5">Submitted {formatAbsoluteTime(report.created_at)}</p>
          </div>

          {/* Moderation history */}
          {(report.moderated_at || report.warning_issued || report.post_removed || report.restriction || report.admin_message) && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1.5">Moderation History</p>
              <ul className="space-y-1 text-sm text-[#94A3B8]">
                {report.moderated_at && <li>Reviewed {formatAbsoluteTime(report.moderated_at)}</li>}
                {report.warning_issued && <li>⚠️ Warning issued to the reported user</li>}
                {report.post_removed && <li>🗑 Post removed</li>}
                {report.restriction && (
                  <li>
                    ⛔ Restricted until {formatAbsoluteTime(report.restriction.restricted_until)} ({report.restriction.reason})
                  </li>
                )}
                {report.admin_message && <li>📨 Violation notice sent to the reported user</li>}
              </ul>
              {report.admin_message && (
                <div className="mt-2 rounded-xl border border-[#1E3447] bg-[#0A111A] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1">Admin Message</p>
                  <p className="text-sm text-[#F1F5F9] [overflow-wrap:anywhere]">"{report.admin_message}"</p>
                </div>
              )}
            </div>
          )}

          {/* Admin Moderation Actions */}
          <div className="border-t border-[#1E3447] pt-4">
            <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-2.5">Admin Moderation Actions</p>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={isDismissed}
                onClick={() => setPending({ type: 'validate' })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 text-[#22C55E] text-sm font-medium hover:bg-[#22C55E]/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Mark Report as Valid
              </button>
              <button
                disabled={isDismissed}
                onClick={() => setPending({ type: 'dismiss' })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#1E3447] bg-white/5 text-[#94A3B8] text-sm font-medium hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <NoSymbolIcon className="h-4 w-4" />
                Dismiss Report
              </button>
              <button
                disabled={isDismissed}
                onClick={() => setPending({ type: 'warn' })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShieldExclamationIcon className="h-4 w-4" />
                Send Warning
              </button>
              {report.reported_post?.exists && (
                <button
                  disabled={isDismissed}
                  onClick={() => setPending({ type: 'remove-post' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] text-sm font-medium hover:bg-[#EF4444]/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <TrashIcon className="h-4 w-4" />
                  Remove Post
                </button>
              )}
              {report.reported_post && (
                <button
                  disabled={isDismissed}
                  onClick={() => {
                    setViolationMessage(report.admin_message || '');
                    setPending({ type: 'confirm-violation' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 text-[#8B5CF6] text-sm font-medium hover:bg-[#8B5CF6]/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  {report.admin_message ? 'Resend Violation Notice' : 'Send Violation Notice'}
                </button>
              )}
            </div>

            <p className="text-[10px] uppercase tracking-wide text-[#64748B] mt-3 mb-2">Restrict User</p>
            <div className="flex flex-wrap gap-2">
              {RESTRICTION_DURATIONS.map((d) => (
                <button
                  key={d.value}
                  disabled={isDismissed}
                  onClick={() => setPending({ type: 'restrict', duration: d.value, label: d.label, days: d.days })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] text-sm font-medium hover:bg-[#EF4444]/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ClockIcon className="h-4 w-4" />
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {pending?.type === 'validate' && (
        <ConfirmDialog
          title="Mark Report as Valid"
          message="Mark this report as a confirmed violation? You can then send a warning, restrict the user, or remove the post."
          confirmLabel="Mark as Valid"
          danger={false}
          isLoading={isBusy}
          onConfirm={runAction}
          onCancel={() => setPending(null)}
        />
      )}
      {pending?.type === 'dismiss' && (
        <ConfirmDialog
          title="Dismiss Report"
          message="Dismiss this report as invalid? No action will be taken against the user, and this report's history is preserved."
          confirmLabel="Dismiss Report"
          isLoading={isBusy}
          onConfirm={runAction}
          onCancel={() => setPending(null)}
        />
      )}
      {pending?.type === 'warn' && (
        <ConfirmDialog
          title="Send Warning"
          message="Send this user a moderation warning? They will be notified that their content was found to violate CCS HUB guidelines. The reporter's identity is never revealed."
          confirmLabel="Send Warning"
          isLoading={isBusy}
          onConfirm={runAction}
          onCancel={() => setPending(null)}
        />
      )}
      {pending?.type === 'remove-post' && (
        <ConfirmDialog
          title="Remove Post"
          message="Permanently remove this post? This action cannot be undone."
          confirmLabel="Remove Post"
          isLoading={isBusy}
          onConfirm={runAction}
          onCancel={() => setPending(null)}
        />
      )}
      {pending?.type === 'confirm-violation' && (
        <ConfirmDialog
          title="Send Violation Notice"
          message={
            <div className="text-left">
              <p className="mb-2.5">
                Notify the reported user that this post was found to violate CCS HUB guidelines. Your message is
                shown to them along with the reported post - the reporter's identity is never revealed.
              </p>
              <textarea
                autoFocus
                value={violationMessage}
                onChange={(e) => setViolationMessage(e.target.value)}
                placeholder="Explain the violation (shown to the reported user)..."
                rows={3}
                maxLength={2000}
                className="w-full rounded-xl border border-[#1E3447] bg-[#0A111A] px-3 py-2 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] resize-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          }
          confirmLabel="Send Notice"
          danger={false}
          isLoading={isBusy}
          onConfirm={runAction}
          onCancel={() => setPending(null)}
        />
      )}
      {pending?.type === 'restrict' && (
        <ConfirmDialog
          title="Restrict User"
          message={`Restrict this user for ${pending.days === 1 ? '1 day' : `${pending.days} days`}? They will be unable to post, comment, chat, like/react, and comment on livestreams during the restriction period. They can still view content and participate in livestreams and meetings.`}
          confirmLabel={`Restrict for ${pending.label}`}
          isLoading={isBusy}
          onConfirm={runAction}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
