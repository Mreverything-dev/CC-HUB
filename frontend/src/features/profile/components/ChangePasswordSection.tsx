// frontend/src/features/profile/components/ChangePasswordSection.tsx
import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, Loader2, MailCheck } from 'lucide-react';
import { authApi } from '@/features/auth/api/auth.api';
import toast from 'react-hot-toast';

interface FieldErrors {
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
}

/**
 * Settings > Security > Change Password. Step 1 only - submitting this form
 * emails a confirmation link (POST /auth/change-password); the password
 * itself doesn't change until that link is clicked, which lands on
 * ConfirmPasswordChange.tsx and shows the actual "changed successfully"
 * message. This reuses the exact same authenticated change-password +
 * email-confirmation backend flow, not a separate password-reset system.
 */
export function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!currentPassword) {
      next.current_password = 'Enter your current password.';
    }
    if (!newPassword) {
      next.new_password = 'Enter a new password.';
    } else if (newPassword.length < 6) {
      next.new_password = 'Password must be at least 6 characters.';
    } else if (currentPassword && newPassword === currentPassword) {
      next.new_password = 'New password must be different from your current password.';
    }
    if (!confirmPassword) {
      next.confirm_password = 'Confirm your new password.';
    } else if (confirmPassword !== newPassword) {
      next.confirm_password = 'Passwords do not match.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);
    try {
      const response = await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      toast.success('Confirmation email sent');
      setConfirmationMessage(response.data.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'string' && detail.toLowerCase().includes('current password')) {
        setErrors({ current_password: detail });
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Failed to change password');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#00C8FF]/30 bg-[#00C8FF]/10">
          <ShieldCheck className="h-5 w-5 text-[#00C8FF]" />
        </div>
        <div>
          <h3 className="font-semibold text-[#F1F5F9]">Change Password</h3>
          <p className="text-xs text-[#64748B]">Update your account password securely.</p>
        </div>
      </div>

      {confirmationMessage ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 p-4">
          <MailCheck className="h-5 w-5 flex-shrink-0 text-[#22C55E] mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#F1F5F9]">Check your inbox to confirm this change</p>
            <p className="text-xs text-[#94A3B8] mt-1">{confirmationMessage}</p>
            <button
              type="button"
              onClick={() => setConfirmationMessage(null)}
              className="mt-3 text-xs font-medium text-[#00C8FF] hover:underline"
            >
              Start over
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4 max-w-md">
          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            error={errors.current_password}
            autoComplete="current-password"
            disabled={isSubmitting}
          />
          <PasswordField
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggleShow={() => setShowNew((v) => !v)}
            error={errors.new_password}
            autoComplete="new-password"
            hint="At least 6 characters."
            disabled={isSubmitting}
          />
          <PasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggleShow={() => setShowConfirm((v) => !v)}
            error={errors.confirm_password}
            autoComplete="new-password"
            disabled={isSubmitting}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Sending confirmation...' : 'Change Password'}
          </button>
        </form>
      )}
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  error,
  autoComplete,
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  error?: string;
  autoComplete: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`w-full pl-4 pr-11 py-3 rounded-xl border ${
            error ? 'border-[#EF4444]/60' : 'border-[#1E3447]'
          } bg-[#0A111A] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition disabled:opacity-50`}
        />
        <button
          type="button"
          onClick={onToggleShow}
          disabled={disabled}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#00C8FF] transition disabled:opacity-50"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-[#EF4444] mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[#64748B] mt-1">{hint}</p>
      ) : null}
    </div>
  );
}
