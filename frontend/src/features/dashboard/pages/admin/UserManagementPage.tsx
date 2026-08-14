// frontend/src/features/dashboard/pages/admin/UserManagementPage.tsx
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  ArrowPathIcon,
  UsersIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/formatters';
import { AdminUserListItem, AdminUserOnlineFilter, AdminUserRole } from '@/services/api/admin.service';
import { useAdminUsers, useDebouncedValue } from '../../hooks/useAdminUsers';
import { UserActionsMenu } from '../../components/admin/users/UserActionsMenu';
import { Pagination } from '../../components/admin/users/Pagination';

type TabId = 'all' | 'students' | 'professors' | 'admins' | 'suspended';

const LIMIT = 10;

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
        isActive
          ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30'
          : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
      }`}
    >
      {isActive ? 'Active' : 'Suspended'}
    </span>
  );
}

function UserIdentity({ user }: { user: AdminUserListItem }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative flex-shrink-0">
        <Avatar src={user.avatar_url} name={user.full_name || user.username} size="sm" />
        <span
          title={user.is_online ? 'Online' : 'Offline'}
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#0A111A] ${
            user.is_online ? 'bg-[#22C55E]' : 'bg-[#64748B]'
          }`}
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#F1F5F9] truncate">{user.full_name || user.username}</p>
        <p className="text-xs text-[#64748B] truncate">{user.email}</p>
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 350);
  const [page, setPage] = useState(1);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [onlineFilter, setOnlineFilter] = useState<AdminUserOnlineFilter | undefined>(undefined);
  const [confirmTarget, setConfirmTarget] = useState<AdminUserListItem | null>(null);

  const role: AdminUserRole | undefined =
    activeTab === 'students' ? 'student' : activeTab === 'professors' ? 'professor' : activeTab === 'admins' ? 'admin' : undefined;
  const status = activeTab === 'suspended' ? 'suspended' : undefined;

  const { data, isLoading, isError, refetch, isFetching, updateStatus, isUpdatingStatus } = useAdminUsers({
    page,
    limit: LIMIT,
    search: search.trim() || undefined,
    role,
    status,
    online: onlineFilter,
  });

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, onlineFilter]);

  const handleConfirmToggle = async () => {
    if (!confirmTarget) return;
    await updateStatus({ userId: confirmTarget.id, isActive: !confirmTarget.is_active });
    setConfirmTarget(null);
  };

  const counts = data?.counts;
  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: counts?.all },
    { id: 'students', label: 'Students', count: counts?.students },
    { id: 'professors', label: 'Professors', count: counts?.professors },
    { id: 'admins', label: 'Admin', count: counts?.admins },
    { id: 'suspended', label: 'Suspended', count: counts?.suspended },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Users</h1>
          <p className="text-[#94A3B8] mt-1 text-sm">Manage all users in the system.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh"
          className="p-2 rounded-xl border border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-[#94A3B8] hover:text-[#00C8FF] hover:border-[#00C8FF]/30 transition disabled:opacity-50 flex-shrink-0"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 overflow-x-auto themed-scrollbar pb-1 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition border ${
              activeTab === tab.id
                ? 'border-[#00C8FF]/40 bg-[#00C8FF]/10 text-[#00C8FF]'
                : 'border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#00C8FF]/20'
            }`}
          >
            {tab.label}
            {tab.count !== undefined ? ` (${tab.count})` : ''}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search users by name, username, or email..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu((v) => !v)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition ${
                onlineFilter
                  ? 'border-[#00C8FF]/40 bg-[#00C8FF]/10 text-[#00C8FF]'
                  : 'border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              <FunnelIcon className="h-4 w-4" />
              Filter
            </button>
            {showFilterMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilterMenu(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl z-20 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B] px-2 py-1">
                    Presence
                  </p>
                  {([
                    [undefined, 'All'],
                    ['online', 'Online'],
                    ['offline', 'Offline'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={label}
                      onClick={() => {
                        setOnlineFilter(value);
                        setShowFilterMenu(false);
                      }}
                      className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-sm text-[#F1F5F9] hover:bg-white/5 transition"
                    >
                      {label}
                      {onlineFilter === value && <CheckIcon className="h-4 w-4 text-[#00C8FF]" />}
                    </button>
                  ))}
                  <p className="text-[10px] text-[#64748B] px-2 pt-2 pb-1 border-t border-[#1E3447] mt-1">
                    Use the tabs above to filter by role or suspension status.
                  </p>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => toast('Adding users from the admin panel is coming soon')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] text-[#060B12] text-sm font-semibold hover:opacity-90 transition"
          >
            <PlusIcon className="h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Table / cards */}
      {isLoading ? (
        <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1E3447] last:border-0 animate-pulse">
              <div className="h-9 w-9 rounded-full bg-[#1E3447] flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded bg-[#1E3447]" />
                <div className="h-2.5 w-40 rounded bg-[#1E3447]" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] p-10 text-center">
          <p className="text-sm text-[#94A3B8]">Unable to load users</p>
          <button
            onClick={() => refetch()}
            className="mt-3 flex items-center gap-1.5 mx-auto px-3.5 py-1.5 text-sm font-medium text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-lg transition"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] p-10 text-center">
          <UsersIcon className="h-10 w-10 mx-auto text-[#1E3447]" />
          <p className="text-[#94A3B8] mt-3">{search ? `No users match "${search}"` : 'No users found'}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#1E3447]">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">User</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Role</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Section</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Joined</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr key={user.id} className="border-b border-[#1E3447] last:border-0 hover:bg-white/[0.03] transition">
                    <td className="px-4 py-3">
                      <UserIdentity user={user} />
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-3 text-sm text-[#94A3B8]">{user.section_name || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge isActive={user.is_active} />
                    </td>
                    <td className="px-4 py-3 text-sm text-[#94A3B8]">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <UserActionsMenu user={user} onToggleStatus={setConfirmTarget} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {data.items.map((user) => (
              <div
                key={user.id}
                className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <UserIdentity user={user} />
                  <UserActionsMenu user={user} onToggleStatus={setConfirmTarget} />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <RoleBadge role={user.role} />
                  <StatusBadge isActive={user.is_active} />
                  {user.section_name && <span className="text-xs text-[#64748B]">{user.section_name}</span>}
                </div>
                <p className="text-xs text-[#64748B] mt-2">Joined {formatDate(user.created_at)}</p>
              </div>
            ))}
          </div>

          <Pagination page={data.page} totalPages={data.total_pages} total={data.total} limit={data.limit} onChange={setPage} />
        </>
      )}

      {confirmTarget && (
        <ConfirmDialog
          title={confirmTarget.is_active ? 'Suspend this user?' : 'Activate this user?'}
          message={
            confirmTarget.is_active
              ? `${confirmTarget.full_name || confirmTarget.username} will no longer be able to log in until reactivated.`
              : `${confirmTarget.full_name || confirmTarget.username} will be able to log in again.`
          }
          confirmLabel={confirmTarget.is_active ? 'Suspend' : 'Activate'}
          danger={confirmTarget.is_active}
          isLoading={isUpdatingStatus}
          onConfirm={handleConfirmToggle}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}
