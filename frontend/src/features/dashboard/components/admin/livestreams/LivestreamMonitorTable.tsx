// frontend/src/features/dashboard/components/admin/livestreams/LivestreamMonitorTable.tsx
import { useState } from 'react';
import {
  ArrowPathIcon,
  SignalIcon,
  UsersIcon,
  XCircleIcon,
  GlobeAltIcon,
  UserGroupIcon,
  UserIcon as FriendsIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatRelativeTime } from '@/lib/formatters';
import { AdminLivestreamListItem, AdminLivestreamContext, AdminLivestreamStatusFilter } from '@/services/api/admin.service';
import { useAdminLivestreams, useAdminStreamViewers } from '../../../hooks/useAdminLivestreams';

const VISIBILITY_ICON: Record<string, typeof GlobeAltIcon> = {
  public: GlobeAltIcon,
  section: UserGroupIcon,
  friends: FriendsIcon,
};

function ViewersModal({ stream, onClose }: { stream: AdminLivestreamListItem; onClose: () => void }) {
  const { data: viewers, isLoading } = useAdminStreamViewers(stream.id);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="w-full max-w-md max-h-[75vh] flex flex-col rounded-2xl border border-border bg-bg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h3 className="font-semibold text-text-primary">Participants</h3>
            <p className="text-xs text-text-muted truncate max-w-[16rem]">{stream.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-secondary hover:text-text-primary rounded-full hover:bg-glass transition">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto themed-scrollbar p-3 space-y-1">
          {isLoading ? (
            <p className="text-sm text-text-muted text-center py-6">Loading...</p>
          ) : viewers.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">No active participants right now.</p>
          ) : (
            viewers.map((v) => (
              <div key={v.user_id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-glass transition">
                <Avatar src={v.avatar_url} name={v.full_name || v.username} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{v.full_name || v.username}</p>
                  <p className="text-xs text-text-muted">Joined {formatRelativeTime(v.joined_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface LivestreamMonitorTableProps {
  context: AdminLivestreamContext;
  title: string;
  subtitle: string;
  emptyLabel: string;
  itemNoun: string;
}

export function LivestreamMonitorTable({ context, title, subtitle, emptyLabel, itemNoun }: LivestreamMonitorTableProps) {
  const [statusFilter, setStatusFilter] = useState<AdminLivestreamStatusFilter | undefined>('live');
  const [endTarget, setEndTarget] = useState<AdminLivestreamListItem | null>(null);
  const [viewingTarget, setViewingTarget] = useState<AdminLivestreamListItem | null>(null);

  const { data, isLoading, isError, refetch, isFetching, endStream, isEnding } = useAdminLivestreams(context, statusFilter);

  const handleConfirmEnd = async () => {
    if (!endTarget) return;
    await endStream(endTarget.id);
    setEndTarget(null);
  };

  const items = data?.items || [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          <p className="text-text-secondary mt-1 text-sm">{subtitle}</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh"
          className="p-2 rounded-xl border border-border bg-glass text-text-secondary hover:text-[#00C8FF] hover:border-[#00C8FF]/30 transition disabled:opacity-50 flex-shrink-0"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {([
          [undefined, 'Live now'],
          ['ended', 'Recently ended'],
        ] as const).map(([value, label]) => (
          <button
            key={label}
            onClick={() => setStatusFilter(value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition border ${
              statusFilter === value
                ? 'border-[#00C8FF]/40 bg-[#00C8FF]/10 text-[#00C8FF]'
                : 'border-border bg-glass text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-glass overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 animate-pulse">
              <div className="h-9 w-9 rounded-full bg-border flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 rounded bg-border" />
                <div className="h-2.5 w-24 rounded bg-border" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-border bg-glass p-10 text-center">
          <p className="text-sm text-text-secondary">Unable to load {itemNoun}</p>
          <button onClick={() => refetch()} className="mt-3 flex items-center gap-1.5 mx-auto px-3.5 py-1.5 text-sm font-medium text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-lg transition">
            <ArrowPathIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-glass p-10 text-center">
          <SignalIcon className="h-10 w-10 mx-auto text-border" />
          <p className="text-text-secondary mt-3">{emptyLabel}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((stream) => {
            const VisIcon = VISIBILITY_ICON[stream.visibility] || GlobeAltIcon;
            const isLive = stream.status === 'live';
            return (
              <div key={stream.id} className="rounded-2xl border border-border bg-glass p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={stream.host_avatar_url} name={stream.host_full_name || stream.host_username} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{stream.host_full_name || stream.host_username}</p>
                      <p className="text-xs text-text-muted">Host</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border ${isLive ? 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25' : 'text-text-muted bg-glass border-border'}`}>
                    {isLive && <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" />}
                    {stream.status}
                  </span>
                </div>

                <p className="text-sm font-semibold text-text-primary mt-3 truncate">{stream.title}</p>
                {stream.description && <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{stream.description}</p>}
                {(stream.subject || stream.section_name) && (
                  <p className="text-xs text-[#00C8FF] mt-1 truncate">{[stream.subject, stream.section_name].filter(Boolean).join(' · ')}</p>
                )}

                <div className="flex items-center gap-3 mt-3 text-xs text-text-secondary">
                  <span className="flex items-center gap-1"><VisIcon className="h-3.5 w-3.5" />{stream.visibility}</span>
                  <span className="flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" />{stream.viewer_count} viewer{stream.viewer_count === 1 ? '' : 's'}</span>
                  <span>{stream.started_at ? formatRelativeTime(stream.started_at) : formatRelativeTime(stream.created_at)}</span>
                </div>

                <div className="flex items-center gap-2 mt-3.5">
                  <button onClick={() => setViewingTarget(stream)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold border border-border bg-bg text-text-secondary rounded-xl hover:text-text-primary hover:border-[#00C8FF]/30 transition">
                    <UsersIcon className="h-3.5 w-3.5" />
                    Participants
                  </button>
                  {isLive && (
                    <button onClick={() => setEndTarget(stream)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] rounded-xl hover:bg-[#EF4444]/20 transition">
                      <XCircleIcon className="h-3.5 w-3.5" />
                      End
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {endTarget && (
        <ConfirmDialog
          title={`End this ${itemNoun.replace(/s$/, '')}?`}
          message={`"${endTarget.title}" (hosted by ${endTarget.host_full_name || endTarget.host_username}) will be ended immediately for everyone.`}
          confirmLabel="End Now"
          danger
          isLoading={isEnding}
          onConfirm={handleConfirmEnd}
          onCancel={() => setEndTarget(null)}
        />
      )}

      {viewingTarget && <ViewersModal stream={viewingTarget} onClose={() => setViewingTarget(null)} />}
    </div>
  );
}