import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { LogoIcon } from '@/components/ui/Logo/Logo';
import heroImage from '@/assets/images/backgrounds/img-bg.png';
import { useAuth } from '../hooks/useAuth';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { resetPassword, isLoading } = useAuth();

  const validate = () => {
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validation = validate();
    if (validation) return setError(validation);
    try {
      await resetPassword({ token, new_password: password, confirm_password: confirmPassword });
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Reset token is invalid or expired.');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050A0F] text-[#F1F5F9]">
      <div className="absolute inset-0 z-0">
        <img src={heroImage} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-0 z-0 bg-[#050A0F]/70" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-[#050A0F] via-transparent to-[#050A0F]/90" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-12">
        <div className="w-full rounded-3xl border border-[rgba(0,200,245,0.18)] bg-[rgba(13,23,34,0.88)] p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00C8FF]/40 bg-[#00C8FF]/10">
              <LogoIcon size="sm" background="dark" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Reset password</h1>
              <p className="text-sm text-[#94A3B8]">Choose a new password for your CCS HUB account.</p>
            </div>
          </div>

          {done ? (
            <div className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
              <CheckCircle className="mb-1 inline h-4 w-4" /> Password updated. Redirecting to login...
            </div>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              {(error || !token) && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error || 'Missing reset token.'}</span>
                </div>
              )}
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#00C8FF]" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="w-full rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3.5 pl-12 pr-12 text-[#F1F5F9] placeholder-[#64748B]" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#00C8FF]" />
                <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="w-full rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3.5 pl-12 pr-12 text-[#F1F5F9] placeholder-[#64748B]" />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <button type="submit" disabled={isLoading || !token} className="w-full rounded-xl bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] px-4 py-3.5 font-semibold text-[#060B12] disabled:opacity-50">
                {isLoading ? 'Resetting...' : 'Reset password'}
              </button>
              <p className="text-center text-sm text-[#94A3B8]">
                Back to <Link to="/login" className="text-[#00C8FF]">login</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
