import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, Mail, CodeXml, RefreshCw } from 'lucide-react';
import heroImage from '@/assets/images/backgrounds/img-bg.png';
import { authApi } from '../api/auth.api';

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  // No token means we just got here straight from registration, not from
  // clicking the emailed link - that's an "awaiting" state, not a failure.
  const [status, setStatus] = useState<'awaiting' | 'loading' | 'success' | 'failed'>(
    token ? 'loading' : 'awaiting'
  );
  const [message, setMessage] = useState(token ? 'Verifying your email...' : '');
  const [email, setEmail] = useState(params.get('email') || '');
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!token) return;
    const run = async () => {
      try {
        const response = await authApi.verifyEmail(token);
        setStatus('success');
        setMessage(response.data.message);
      } catch (error: any) {
        setStatus('failed');
        setMessage(error.response?.data?.detail || 'Verification link is invalid or expired.');
      }
    };
    run();
  }, [token]);

  const resend = async () => {
    if (!email || isResending || cooldown > 0) return;
    setIsResending(true);
    setResendMessage('');
    try {
      await authApi.resendVerification(email);
      setResendMessage('Verification email sent. Check your inbox.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error: any) {
      setResendMessage(error.response?.data?.detail || 'Could not resend verification email.');
    } finally {
      setIsResending(false);
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
              <CodeXml className="h-6 w-6 text-[#00C8FF]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Verify your email</h1>
              <p className="text-sm text-[#94A3B8]">Secure access to your CCS HUB account.</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-[#1E3447] bg-[#0A111A]/90 p-5">
            <div className="flex items-start gap-3">
              {status === 'awaiting' && <Mail className="mt-1 h-5 w-5 text-[#00C8FF]" />}
              {status === 'loading' && <Loader2 className="mt-1 h-5 w-5 animate-spin text-[#00C8FF]" />}
              {status === 'success' && <CheckCircle2 className="mt-1 h-5 w-5 text-green-400" />}
              {status === 'failed' && <AlertCircle className="mt-1 h-5 w-5 text-red-400" />}
              <div>
                <p className="font-medium">
                  {status === 'awaiting' ? 'Check your email' : message}
                </p>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  {status === 'awaiting' &&
                    (email
                      ? `We sent a verification link to ${email}. Click it to activate your account.`
                      : 'We sent a verification link to your email address. Click it to activate your account.')}
                  {status === 'success' && 'You can now log in and continue to your dashboard.'}
                  {status === 'failed' && 'If this page opened from an email, the token may have expired.'}
                  {status === 'loading' && ' '}
                </p>
              </div>
            </div>
          </div>

          {(status === 'awaiting' || status === 'failed') && (
            <div className="mt-6 space-y-4">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#00C8FF]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email to resend"
                  className="w-full rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3.5 pl-12 text-[#F1F5F9] placeholder-[#64748B] focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF]"
                />
              </div>
              <button
                type="button"
                onClick={resend}
                disabled={!email || isResending || cooldown > 0}
                className="inline-flex items-center gap-2 rounded-xl border border-[#1E3447] px-4 py-3 text-sm text-[#F1F5F9] hover:border-[#00C8FF]/60 hover:text-[#00C8FF] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#1E3447] disabled:hover:text-[#F1F5F9]"
              >
                <RefreshCw className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`} />
                {cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : isResending
                  ? 'Sending...'
                  : 'Resend verification email'}
              </button>
              {resendMessage && <p className="text-sm text-[#94A3B8]">{resendMessage}</p>}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login" className="rounded-xl bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] px-4 py-3 text-sm font-semibold text-[#060B12]">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;
