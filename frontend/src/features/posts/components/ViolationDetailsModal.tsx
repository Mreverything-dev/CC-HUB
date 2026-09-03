// frontend/src/features/posts/components/ViolationDetailsModal.tsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { postService } from '@/services/api/post.service';
import type { ViolationDetail } from '@/services/api/post.service';
import { formatAbsoluteTime } from '@/lib/formatters';
import { PostContentBody } from './PostContentBody';

interface ViolationDetailsModalProps {
  reportId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  valid: 'Violation Confirmed',
  pending: 'Under Review',
  dismissed: 'Dismissed',
};

export function ViolationDetailsModal({ reportId, onClose }: ViolationDetailsModalProps) {
  const [detail, setDetail] = useState<ViolationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    postService
      .getViolationDetail(reportId)
      .then((res) => {
        if (!cancelled) setDetail(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail || 'Unable to load violation details');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E3447]">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-[#EF4444]" />
            <h3 className="font-semibold text-[#F1F5F9]">Violation Details</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] rounded-full hover:bg-white/5 transition">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-[#64748B]">Loading...</div>
        ) : error || !detail ? (
          <div className="p-8 text-center text-sm text-[#94A3B8]">{error || 'Unable to load violation details'}</div>
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1">Case</p>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]">
                  {detail.category_label}
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1">Status</p>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]">
                  {STATUS_LABELS[detail.status] || detail.status}
                </span>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1.5">Your Reported Post</p>
              {detail.reported_post.exists || detail.reported_post.content || detail.reported_post.media_urls.length > 0 ? (
                <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3.5">
                  {!detail.reported_post.exists && (
                    <p className="text-[11px] text-[#64748B] italic mb-2">This post is no longer available - showing a preserved copy</p>
                  )}
                  {detail.reported_post.content && (
                    <PostContentBody content={detail.reported_post.content} className="text-sm text-[#F1F5F9]" />
                  )}
                  {detail.reported_post.media_urls.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      {detail.reported_post.media_urls.slice(0, 6).map((url, i) => (
                        <img key={i} src={url} alt="" className="w-full h-16 object-cover rounded-lg" />
                      ))}
                    </div>
                  )}
                  {detail.reported_post.created_at && (
                    <p className="text-xs text-[#64748B] mt-2">Posted {formatAbsoluteTime(detail.reported_post.created_at)}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3.5 text-sm text-[#64748B]">
                  Post no longer available
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1.5">Reason</p>
              <p className="text-sm text-[#F1F5F9]">{detail.category_label}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1.5">Admin Message</p>
              <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3.5">
                <p className="text-sm text-[#F1F5F9] [overflow-wrap:anywhere]">"{detail.admin_message}"</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#64748B] mb-1.5">Moderation Action</p>
              {detail.moderation_actions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {detail.moderation_actions.map((action) => (
                    <span
                      key={action}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-amber-500/25 bg-amber-500/10 text-amber-400"
                    >
                      {action}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#94A3B8]">No further action taken</p>
              )}
            </div>

            {detail.restriction && (
              <div className="rounded-xl border border-[#EF4444]/25 bg-[#EF4444]/5 p-3.5 space-y-1.5">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[#64748B]">Restriction</p>
                  <p className="text-sm text-[#F1F5F9] font-medium">{detail.restriction.duration_label}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[#64748B]">Starts</p>
                  <p className="text-sm text-[#94A3B8]">{formatAbsoluteTime(detail.restriction.starts_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[#64748B]">Expires</p>
                  <p className="text-sm text-[#94A3B8]">{formatAbsoluteTime(detail.restriction.expires_at)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
