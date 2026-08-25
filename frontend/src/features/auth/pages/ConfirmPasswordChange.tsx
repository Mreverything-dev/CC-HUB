import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, CodeXml, ShieldCheck } from 'lucide-react';
import heroImage from '@/assets/images/backgrounds/img-bg.png';
import { authApi } from '../api/auth.api';

/**
 * Landing page for the "Confirm Password Change" link emailed by
 * POST /auth/change-password (step 1) - mirrors VerifyEmail.tsx's exact
 * shape (auto-confirm on mount via the token in the URL, loading/success/
 * failed states), since this reuses the same email-verification-link UX
 * rather than inventing a new confirmation pattern.
 */
export function ConfirmPasswordChange() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<'missing' | 'loading' | 'success' | 'failed'>(
    token ? 'loading' : 'missing'
  );
  const [message, setMessage] = useState(token ? 'Confirming your password change...' : '');

  useEffect(() => {
    if (!token) return;
    const run = async () => {
      try {
        const response = await authApi.confirmChangePassword(token);
        setStatus('success');
        setMessage(response.data.message);
      } catch (error: any) {
        setStatus('failed');
        setMessage(error.response?.data?.detail || 'This confirmation link is invalid or expired.');
      }
    };
    run();
  }, [token]);

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
              <h1 className="text-2xl font-bold">Confirm password change</h1>
              <p className="text-sm text-[#94A3B8]">Secure access to your CCS HUB account.</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-[#1E3447] bg-[#0A111A]/90 p-5">
            <div className="flex items-start gap-3">
              {status === 'missing' && <ShieldCheck className="mt-1 h-5 w-5 text-[#00C8FF]" />}
              {status === 'loading' && <Loader2 className="mt-1 h-5 w-5 animate-spin text-[#00C8FF]" />}
              {status === 'success' && <CheckCircle2 className="mt-1 h-5 w-5 text-green-400" />}
              {status === 'failed' && <AlertCircle className="mt-1 h-5 w-5 text-red-400" />}
              <div>
                <p className="font-medium">
                  {status === 'missing' ? 'No confirmation link found' : message}
                </p>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  {status === 'missing' && 'Open the confirmation link from the email we sent you to finish changing your password.'}
                  {status === 'success' && 'You can now log in using your new password.'}
                  {status === 'failed' && 'Go back to Settings and try changing your password again to get a new link.'}
                  {status === 'loading' && ' '}
                </p>
              </div>
            </div>
          </div>

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

export default ConfirmPasswordChange;
