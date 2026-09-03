// frontend/src/features/dashboard/components/admin/users/SetPasswordModal.tsx
import { useState } from 'react';
import { XMarkIcon, KeyIcon } from '@heroicons/react/24/outline';
import { AdminUserListItem } from '@/services/api/admin.service';

const inputClassName =
  'w-full px-3 py-2.5 rounded-xl border border-[#1E3447] bg-[#162534] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition';

interface SetPasswordModalProps {
  user: AdminUserListItem;
  isLoading: boolean;
  onConfirm: (newPassword: string, confirmPassword: string) => Promise<unknown>;
  onClose: () => void;
}

export default function SetPasswordModal({ user, isLoading, onConfirm, onClose }: SetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      await onConfirm(newPassword, confirmPassword);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update password');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#F1F5F9]">
            <KeyIcon className="h-5 w-5 text-[#00C8FF]" />
            Set New Password
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-[#94A3B8] mb-4">
          Set a new password for <span className="text-[#F1F5F9] font-medium">{user.full_name || user.username}</span>.
          They can log in with it immediately - no email confirmation is sent.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
              className={inputClassName}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className={inputClassName}
            />
          </div>
          <p className="text-xs text-[#64748B]">
            At least 6 characters, with an uppercase letter, a lowercase letter, and a number.
          </p>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-[#1E3447]">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Set Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
