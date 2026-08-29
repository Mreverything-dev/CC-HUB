import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import heroImage from '@/assets/images/backgrounds/img-bg.png';
import { useAuth } from '../hooks/useAuth';
import { LogoIcon } from '@/components/ui/Logo/Logo';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { forgotPassword, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await forgotPassword({ email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send reset email');
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
          <button onClick={() => navigate('/login')} className="mb-6 inline-flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#00C8FF]">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00C8FF]/40 bg-[#00C8FF]/10">
              <LogoIcon size="sm" background="dark" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Forgot password</h1>
              <p className="text-sm text-[#94A3B8]">We’ll send a reset link to your email.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {sent && (
              <div className="flex items-start gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>If the account exists, a reset link has been sent.</span>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#00C8FF]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                disabled={isLoading || sent}
                className="w-full rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3.5 pl-12 text-[#F1F5F9] placeholder-[#64748B] focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || sent}
              className="w-full rounded-xl bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] px-4 py-3.5 font-semibold text-[#060B12] disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : sent ? 'Email sent' : 'Send reset link'}
            </button>
            <p className="text-center text-sm text-[#94A3B8]">
              Remembered your password? <Link to="/login" className="text-[#00C8FF]">Login</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
