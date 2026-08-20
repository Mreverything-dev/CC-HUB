// frontend/src/features/dashboard/components/admin/users/AddUserModal.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XMarkIcon, UserIcon, AcademicCapIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { adminService, AdminUserRole } from '@/services/api/admin.service';

interface AddUserModalProps {
  onClose: () => void;
}

const inputClassName =
  'w-full px-3 py-2.5 rounded-xl border border-[#1E3447] bg-[#162534] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition';

const ROLE_OPTIONS: { value: AdminUserRole; label: string; icon: typeof UserIcon }[] = [
  { value: 'student', label: 'Student', icon: UserIcon },
  { value: 'professor', label: 'Professor', icon: AcademicCapIcon },
  { value: 'admin', label: 'Admin', icon: ShieldCheckIcon },
];

export default function AddUserModal({ onClose }: AddUserModalProps) {
  const queryClient = useQueryClient();
  const createUserMutation = useMutation({
    mutationFn: adminService.createUser,
    onSuccess: (response) => {
      toast.success(`${response.data.username} created successfully`);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
  });
  const isCreatingUser = createUserMutation.isPending;
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<AdminUserRole>('student');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await createUserMutation.mutateAsync({
        full_name: fullName.trim() || undefined,
        username: username.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        role,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="w-full max-w-md rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-4 sm:p-6 max-h-[90vh] overflow-y-auto themed-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#F1F5F9]">Add User</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map(({ value, label, icon: Icon }) => {
                const isActive = role === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition ${
                      isActive
                        ? 'border-[#00C8FF]/50 bg-[#00C8FF]/10 text-[#00C8FF]'
                        : 'border-[#1E3447] bg-[#0A111A] text-[#94A3B8] hover:border-[#00C8FF]/30'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              className={inputClassName}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Username *</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className={inputClassName}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClassName}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputClassName}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Confirm Password *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className={inputClassName}
              />
            </div>
          </div>
          <p className="text-xs text-[#64748B] -mt-2">
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
              disabled={isCreatingUser}
              className="w-full sm:w-auto px-6 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-50"
            >
              {isCreatingUser ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
