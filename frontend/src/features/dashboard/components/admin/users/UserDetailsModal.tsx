// frontend/src/features/dashboard/components/admin/users/UserDetailsModal.tsx
import { useNavigate } from 'react-router-dom';
import { XMarkIcon, EnvelopeIcon, CalendarIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { formatAbsoluteTime } from '@/lib/formatters';
import { useAdminUserDetail } from '../../../hooks/useAdminUsers';

interface UserDetailsModalProps {
  userId: string;
  onClose: () => void;
}

export function UserDetailsModal({ userId, onClose }: UserDetailsModalProps) {
  const navigate = useNavigate();
  const { data: user, isLoading } = useAdminUserDetail(userId);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E3447]">
          <h3 className="font-semibold text-[#F1F5F9]">User Details</h3>
          <button onClick={onClose} className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] rounded-full hover:bg-white/5 transition">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {isLoading || !user ? (
          <div className="p-8 text-center text-sm text-[#64748B]">Loading...</div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Avatar src={user.avatar_url} name={user.full_name || user.username} size="lg" />
              <div className="min-w-0">
                <p className="text-base font-semibold text-[#F1F5F9] truncate">{user.full_name || user.username}</p>
                <p className="text-xs text-[#64748B]">@{user.username}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <RoleBadge role={user.role} />
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                  user.is_active ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30' : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
                }`}
              >
                {user.is_active ? 'Active' : 'Suspended'}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs ${user.is_online ? 'text-[#22C55E]' : 'text-[#64748B]'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${user.is_online ? 'bg-[#22C55E]' : 'bg-[#64748B]'}`} />
                {user.is_online ? 'Online' : 'Offline'}
              </span>
            </div>

            <dl className="space-y-2.5 text-sm border-t border-[#1E3447] pt-4">
              <div className="flex items-start gap-2.5">
                <EnvelopeIcon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-[#64748B] text-xs">Email</dt>
                  <dd className="text-[#F1F5F9] break-all">{user.email}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <UserGroupIcon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-[#64748B] text-xs">Section</dt>
                  <dd className="text-[#F1F5F9]">{user.section_name || '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarIcon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-[#64748B] text-xs">Joined</dt>
                  <dd className="text-[#F1F5F9]">{formatAbsoluteTime(user.created_at)}</dd>
                </div>
              </div>
            </dl>

            <button
              onClick={() => navigate(`/profile/${user.id}`)}
              className="w-full mt-1 px-4 py-2.5 text-sm font-semibold border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] rounded-xl hover:bg-[#00C8FF]/20 transition"
            >
              View Full Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
