// frontend/src/features/friends/components/FriendsPage.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  UserPlusIcon,
  FunnelIcon,
  UsersIcon,
  UserGroupIcon,
  SparklesIcon,
  NoSymbolIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useFriends } from '../hooks/useFriends';
import { useChat } from '@/features/chat/hooks/useChat';
import { Friend } from '@/types/friend.types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FriendCard } from './FriendCard';
import { FriendRequestCard } from './FriendRequestCard';
import { SuggestionCard } from './SuggestionCard';
import { BlockedUserCard } from './BlockedUserCard';
import { FindPeoplePanel } from './FindPeoplePanel';
import { ReportUserDialog } from './ReportUserDialog';
import { parseServerDate } from '@/lib/formatters';

type Tab = 'all' | 'requests' | 'suggestions' | 'blocked' | 'find';
type SortMode = 'recent' | 'name' | 'online';

const SKELETON_ROWS = [0, 1, 2];

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#1E3447] bg-[#0D1722]/60 p-3.5 animate-pulse">
      <div className="h-11 w-11 rounded-full bg-[#1E3447]" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 rounded bg-[#1E3447]" />
        <div className="h-2.5 w-20 rounded bg-[#1E3447]" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-8 text-center">
      <p className="text-sm text-[#EF4444]">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 text-sm text-[#00C8FF] hover:underline font-medium"
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-10 text-center">
      <p className="text-sm text-[#F1F5F9] font-medium">{title}</p>
      {subtitle && <p className="text-xs text-[#64748B] mt-1">{subtitle}</p>}
      {action}
    </div>
  );
}

export default function FriendsPage() {
  const {
    friends,
    friendRequests,
    suggestions,
    blockedUsers,
    isLoading,
    isFriendsError,
    isLoadingSuggestions,
    isSuggestionsError,
    isLoadingBlocked,
    isBlockedError,
    sendFriendRequest,
    respondToFriendRequest,
    cancelFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,
    reportUser,
    refetchFriends,
    refetchSuggestions,
    refetchBlocked,
  } = useFriends();
  const { createDirectConversation, openWidget } = useChat();

  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const [confirmAction, setConfirmAction] = useState<{ type: 'remove' | 'block'; friend: Friend } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reportTarget, setReportTarget] = useState<Friend | null>(null);
  const [reportBusy, setReportBusy] = useState(false);

  useEffect(() => {
    if (!filterOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [filterOpen]);

  const received = friendRequests.received;
  const sent = friendRequests.sent;
  const friendIds = useMemo(() => new Set(friends.map((f) => f.user_id)), [friends]);
  const pendingSentIds = useMemo(() => new Set(sent.map((r) => r.receiver_id)), [sent]);
  const onlineCount = useMemo(() => friends.filter((f) => f.is_online).length, [friends]);
  const visibleSuggestions = useMemo(
    () => suggestions.filter((s) => !dismissed.has(s.user_id)),
    [suggestions, dismissed]
  );

  const filteredFriends = useMemo(() => {
    let list = friends;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (f) => f.username.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sortMode === 'name') {
      sorted.sort((a, b) => a.username.localeCompare(b.username));
    } else if (sortMode === 'online') {
      sorted.sort((a, b) => Number(b.is_online) - Number(a.is_online));
    } else {
      sorted.sort((a, b) => parseServerDate(b.created_at).getTime() - parseServerDate(a.created_at).getTime());
    }
    return sorted;
  }, [friends, search, sortMode]);

  const handleSendRequest = async (receiverId: string) => {
    setSendingTo(receiverId);
    try {
      await sendFriendRequest({ receiver_id: receiverId });
    } finally {
      setSendingTo(null);
    }
  };

  const handleAccept = async (requestId: string) => {
    setBusyRequestId(requestId);
    try {
      await respondToFriendRequest({ requestId, data: { status: 'accepted' } });
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    setBusyRequestId(requestId);
    try {
      await respondToFriendRequest({ requestId, data: { status: 'rejected' } });
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setBusyRequestId(requestId);
    try {
      await cancelFriendRequest(requestId);
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleMessage = async (userId: string) => {
    await createDirectConversation(userId);
    openWidget();
  };

  const handleUnblock = async (userId: string) => {
    setUnblockingId(userId);
    try {
      await unblockUser(userId);
    } finally {
      setUnblockingId(null);
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      if (confirmAction.type === 'remove') {
        await removeFriend(confirmAction.friend.user_id);
      } else {
        await blockUser(confirmAction.friend.user_id);
      }
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleReportSubmit = async (reason: string, details: string) => {
    if (!reportTarget) return;
    setReportBusy(true);
    try {
      await reportUser({ userId: reportTarget.user_id, data: { reason, details: details || undefined } });
      setReportTarget(null);
    } finally {
      setReportBusy(false);
    }
  };

  const TABS: { id: Tab; label: string; count?: number; icon: typeof UsersIcon }[] = [
    { id: 'all', label: 'All Friends', count: friends.length, icon: UsersIcon },
    { id: 'requests', label: 'Requests', count: received.length, icon: UserGroupIcon },
    { id: 'suggestions', label: 'Suggestions', count: visibleSuggestions.length, icon: SparklesIcon },
    { id: 'blocked', label: 'Blocked', count: blockedUsers.length, icon: NoSymbolIcon },
    { id: 'find', label: 'Find People', icon: MagnifyingGlassIcon },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#F1F5F9]">Friends</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">Connect, collaborate, and stay updated with your friends.</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search friends..."
              className="w-full rounded-xl border border-[#1E3447] bg-[#0D1722] py-2 pl-9 pr-3 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
            />
          </div>
          <button
            onClick={() => setActiveTab('find')}
            title="Add Friend"
            className="p-2.5 rounded-xl border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] hover:bg-[#00C8FF]/20 transition flex-shrink-0"
          >
            <UserPlusIcon className="h-5 w-5" />
          </button>
          <div className="relative flex-shrink-0" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              title="Filter / Sort"
              className="p-2.5 rounded-xl border border-[#1E3447] bg-[#0D1722] text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 transition"
            >
              <FunnelIcon className="h-5 w-5" />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl z-20 overflow-hidden">
                <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                  Sort All Friends
                </p>
                {([
                  ['recent', 'Recently Added'],
                  ['name', 'Name (A-Z)'],
                  ['online', 'Online First'],
                ] as [SortMode, string][]).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setSortMode(mode);
                      setFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium transition ${
                      sortMode === mode ? 'text-[#00C8FF] bg-[#00C8FF]/10' : 'text-[#F1F5F9] hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Friends', value: friends.length },
          { label: 'Online', value: onlineCount },
          { label: 'Friend Requests', value: received.length },
          { label: 'Suggestions', value: visibleSuggestions.length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-3.5 text-center">
            <p className="text-lg font-bold text-[#F1F5F9]">{stat.value}</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto themed-scrollbar pb-1 -mx-1 px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition border ${
                isActive
                  ? 'border-[#00C8FF]/40 bg-[#00C8FF]/10 text-[#00C8FF]'
                  : 'border-transparent text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${
                    isActive ? 'bg-[#00C8FF]/20 text-[#00C8FF]' : 'bg-white/10 text-[#94A3B8]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* All Friends */}
      {activeTab === 'all' && (
        <div className="space-y-2.5">
          {isLoading ? (
            SKELETON_ROWS.map((i) => <SkeletonRow key={i} />)
          ) : isFriendsError ? (
            <ErrorState message="Couldn't load your friends." onRetry={refetchFriends} />
          ) : filteredFriends.length === 0 ? (
            friends.length === 0 ? (
              <EmptyState
                title="No friends yet"
                subtitle="Find people to connect with"
                action={
                  <button
                    onClick={() => setActiveTab('find')}
                    className="mt-3 text-sm text-[#00C8FF] hover:underline font-medium"
                  >
                    Find People
                  </button>
                }
              />
            ) : (
              <EmptyState title="No friends match your search" />
            )
          ) : (
            filteredFriends.map((friend) => (
              <FriendCard
                key={friend.id}
                friend={friend}
                onMessage={handleMessage}
                onRemove={(f) => setConfirmAction({ type: 'remove', friend: f })}
                onBlock={(f) => setConfirmAction({ type: 'block', friend: f })}
                onReport={(f) => setReportTarget(f)}
              />
            ))
          )}
        </div>
      )}

      {/* Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-[#F1F5F9] mb-2.5">Received</h3>
            {isLoading ? (
              <div className="space-y-2.5">{SKELETON_ROWS.map((i) => <SkeletonRow key={i} />)}</div>
            ) : received.length === 0 ? (
              <p className="text-sm text-[#64748B]">No incoming requests.</p>
            ) : (
              <div className="space-y-2.5">
                {received.map((req) => (
                  <FriendRequestCard
                    key={req.id}
                    request={req}
                    variant="received"
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    isBusy={busyRequestId === req.id}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#F1F5F9] mb-2.5">Sent</h3>
            {sent.length === 0 ? (
              <p className="text-sm text-[#64748B]">No outgoing requests.</p>
            ) : (
              <div className="space-y-2.5">
                {sent.map((req) => (
                  <FriendRequestCard
                    key={req.id}
                    request={req}
                    variant="sent"
                    onCancel={handleCancel}
                    isBusy={busyRequestId === req.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {activeTab === 'suggestions' && (
        <div>
          {isLoadingSuggestions ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SKELETON_ROWS.map((i) => <SkeletonRow key={i} />)}
            </div>
          ) : isSuggestionsError ? (
            <ErrorState message="Couldn't load suggestions." onRetry={refetchSuggestions} />
          ) : visibleSuggestions.length === 0 ? (
            <EmptyState title="No suggestions right now" subtitle="Check back later for new people to connect with." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleSuggestions.map((s) => (
                <SuggestionCard
                  key={s.user_id}
                  suggestion={s}
                  isPending={pendingSentIds.has(s.user_id)}
                  isSending={sendingTo === s.user_id}
                  onAdd={handleSendRequest}
                  onDismiss={(id) => setDismissed((prev) => new Set(prev).add(id))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Blocked */}
      {activeTab === 'blocked' && (
        <div className="space-y-2.5">
          {isLoadingBlocked ? (
            SKELETON_ROWS.map((i) => <SkeletonRow key={i} />)
          ) : isBlockedError ? (
            <ErrorState message="Couldn't load blocked users." onRetry={refetchBlocked} />
          ) : blockedUsers.length === 0 ? (
            <EmptyState title="No blocked users" />
          ) : (
            blockedUsers.map((b) => (
              <BlockedUserCard
                key={b.id}
                blocked={b}
                isUnblocking={unblockingId === b.user_id}
                onUnblock={handleUnblock}
              />
            ))
          )}
        </div>
      )}

      {/* Find People */}
      {activeTab === 'find' && (
        <FindPeoplePanel
          friendIds={friendIds}
          pendingSentIds={pendingSentIds}
          sendingTo={sendingTo}
          onSendRequest={handleSendRequest}
        />
      )}

      {/* Confirm remove/block */}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.type === 'remove' ? 'Remove friend?' : 'Block this user?'}
          message={
            confirmAction.type === 'remove'
              ? `${confirmAction.friend.username} will be removed from your friends list.`
              : `${confirmAction.friend.username} will be unfriended and won't be able to send you friend requests.`
          }
          confirmLabel={confirmAction.type === 'remove' ? 'Remove' : 'Block'}
          isLoading={confirmBusy}
          danger
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Report dialog */}
      {reportTarget && (
        <ReportUserDialog
          username={reportTarget.username}
          isLoading={reportBusy}
          onSubmit={handleReportSubmit}
          onCancel={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}
