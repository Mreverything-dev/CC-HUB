// frontend/src/features/dashboard/components/admin/users/EditUserModal.tsx
import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { AdminUserListItem } from '@/services/api/admin.service';

const inputClassName =
  'w-full px-3 py-2.5 rounded-xl border border-border bg-glass text-sm text-text-primary placeholder-text-muted focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition';

interface EditUserModalProps {
  user: AdminUserListItem;
  isLoading: boolean;
  onConfirm: (data: { username?: string; email?: string; first_name?: string; last_name?: string }) => Promise<unknown>;
  onClose: () => void;
}

export default function EditUserModal({ user, isLoading, onConfirm, onClose }: EditUserModalProps) {
  const nameParts = (user.full_name || '').trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || '';
  const lastNameGuess = nameParts.slice(1).join(' ');
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastNameGuess);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await onConfirm({
        username: username.trim() !== user.username ? username.trim() : undefined,
        email: email.trim() !== user.email ? email.trim() : undefined,
        first_name: first.trim() !== firstName ? first.trim() : undefined,
        last_name: last.trim() !== lastNameGuess ? last.trim() : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update user');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto themed-scrollbar" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-primary">Edit User</h2>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-glass rounded-full transition">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">First Name</label>
              <input type="text" value={first} onChange={(e) => setFirst(e.target.value)} className={inputClassName} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Last Name</label>
              <input type="text" value={last} onChange={(e) => setLast(e.target.value)} className={inputClassName} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} className={inputClassName} />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClassName} />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-glass rounded-xl transition">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="w-full sm:w-auto px-6 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-50">
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}