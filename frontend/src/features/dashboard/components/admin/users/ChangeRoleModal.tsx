// frontend/src/features/dashboard/components/admin/users/ChangeRoleModal.tsx
import { useState } from 'react';
import { XMarkIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { AdminUserListItem, AdminUserRole } from '@/services/api/admin.service';

const ROLES: AdminUserRole[] = ['student', 'professor', 'admin'];

interface ChangeRoleModalProps {
  user: AdminUserListItem;
  onClose: () => void;
  onConfirm: (role: AdminUserRole) => Promise<void>;
  isLoading: boolean;
}

export function ChangeRoleModal({ user, onClose, onConfirm, isLoading }: ChangeRoleModalProps) {
  const [selected, setSelected] = useState<AdminUserRole>(user.role);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E3447]">
          <h3 className="font-semibold text-[#F1F5F9]">Change Role</h3>
          <button onClick={onClose} className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] rounded-full hover:bg-white/5 transition">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-[#94A3B8]">
            {user.full_name || user.username} is currently <RoleBadge role={user.role} />
          </p>

          <div className="space-y-2">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setSelected(role)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-medium transition ${
                  selected === role
                    ? 'border-[#00C8FF]/40 bg-[#00C8FF]/10 text-[#00C8FF]'
                    : 'border-[#1E3447] bg-[#0A111A] text-[#94A3B8] hover:text-[#F1F5F9]'
                }`}
              >
                <span className="capitalize">{role}</span>
                {selected === role && <span className="h-2 w-2 rounded-full bg-[#00C8FF]" />}
              </button>
            ))}
          </div>

          {selected !== user.role && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300 text-xs">
              <ShieldExclamationIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                This changes what {user.username} can access immediately. Their existing {user.role} profile data is
                kept, not deleted.
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(selected)}
              disabled={selected === user.role || isLoading}
              className="px-5 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-40"
            >
              {isLoading ? 'Saving...' : 'Save Role'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
