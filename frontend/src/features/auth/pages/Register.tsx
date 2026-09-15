// frontend/src/features/auth/pages/Register.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useGoogleLogin } from '@react-oauth/google';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  GraduationCap,
  Shield,
  UserCheck,
  User
} from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { useTheme } from '@/contexts/ThemeContext';
import { LogoIcon } from '@/components/ui/Logo/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle/ThemeToggle';
import toast from 'react-hot-toast';

interface RegisterFormData {
  email: string;
  username: string;
  password: string;
  confirm_password: string;
  role: 'student' | 'professor';
  invitation_code: string;
  agreeToTerms: boolean;
}

export function Register() {
  const { register: registerUser, isLoading } = useAuth();
  const { login: setAuth } = useAuthStore();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    username: '',
    password: '',
    confirm_password: '',
    role: 'student',
    invitation_code: '',
    agreeToTerms: false,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isLight = theme === 'light';
  const heroText = isLight ? 'text-slate-900' : 'text-white';
  const heroSubText = isLight ? 'text-slate-600' : 'text-white/90';
  const heroShadow = isLight ? '' : '[text-shadow:0_2px_16px_rgba(0,0,0,0.6)]';
  const heroSubShadow = isLight ? '' : '[text-shadow:0_1px_8px_rgba(0,0,0,0.6)]';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!/^[A-Za-z0-9_.]{3,50}$/.test(formData.username)) {
      setError('Username must be 3-50 characters and can only contain letters, numbers, underscores, and dots.');
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    if (!formData.agreeToTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }

    if (formData.role === 'professor' && !formData.invitation_code) {
      setError('Invitation code required for professor registration');
      return;
    }

    try {
      await registerUser({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        confirm_password: formData.confirm_password,
        role: formData.role,
        invitation_code: formData.invitation_code,
        terms_accepted: formData.agreeToTerms,
      });
      setSuccess(true);

      setTimeout(() => {
        navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`);
      }, 1200);
    } catch (err: any) {
      const detail = err.response?.data?.detail;

      if (Array.isArray(detail)) {
        const messages = detail
          .map((d: any) => {
            if (typeof d === 'string') return d;
            const field = Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : '';
            return field ? `${field}: ${d?.msg || 'Invalid value'}` : (d?.msg || 'Invalid value');
          })
          .filter(Boolean)
          .join(' • ');
        setError(messages || 'Registration failed. Please check your input.');
      } else if (typeof detail === 'string') {
        setError(detail);
      } else if (detail && typeof detail === 'object') {
        setError(detail.msg || JSON.stringify(detail));
      } else {
        setError('Registration failed. Please try again.');
      }
    }
  };

  const registerWithGoogle = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (codeResponse) => {
      setIsGoogleLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/auth/google/login`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: codeResponse.code }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          setAuth(data.user, data.access_token, data.refresh_token);

          toast.success('🎉 Welcome! Your account has been created with Google.');

          const role = data.user.role;
          if (role === 'admin') {
            navigate('/admin/dashboard');
          } else if (role === 'professor') {
            navigate('/professor/dashboard');
          } else {
            navigate('/student/dashboard');
          }
        } else {
          toast.error(data.detail || 'Google sign up failed');
        }
      } catch (error) {
        console.error('Google sign up error:', error);
        toast.error('Failed to connect to Google. Please try again.');
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error('Google sign up cancelled or failed');
    },
  });

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-bg text-text-primary">
      {/* Subtle cyan/blue futuristic glow */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-[#00C8FF]/10 blur-[120px] z-0" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#3B82F6]/10 blur-[120px] z-0" />

      {/* Theme Toggle - Upper Right */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-2 lg:px-16">
        {/* Left column — brand */}
        <div className="hidden flex-col lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00C8FF]/40 bg-[#00C8FF]/10 shadow-[0_0_20px_rgba(0,200,245,0.18)] backdrop-blur-sm">
              <LogoIcon size="sm" background={isLight ? 'light' : 'dark'} />
            </div>
            <div>
              <h2 className={`text-2xl font-bold tracking-tight ${heroText}`}>CCS HUB</h2>
              <p className={`text-xs font-medium tracking-wider ${heroSubText}`}>
                COLLEGE OF COMPUTER STUDIES
              </p>
            </div>
          </div>

          <p className={`mt-10 max-w-md text-3xl font-semibold leading-tight ${heroText} ${heroShadow}`}>
            Join the{' '}
            <span className="text-[#00C8FF]">CCS Community.</span>
          </p>
          <p className={`mt-4 max-w-sm text-sm ${heroSubText} ${heroSubShadow}`}>
            Create your account and start connecting with fellow students and professors across the College of Computer Studies.
          </p>

          {/* Features list */}
          <div className="mt-8 space-y-3">
            <div className={`flex items-center gap-3 text-sm ${heroSubText}`}>
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#00C8FF]/30 bg-[#00C8FF]/10">
                <GraduationCap className="h-3 w-3 text-[#00C8FF]" />
              </div>
              <span>Access to course materials and announcements</span>
            </div>
            <div className={`flex items-center gap-3 text-sm ${heroSubText}`}>
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#00C8FF]/30 bg-[#00C8FF]/10">
                <UserCheck className="h-3 w-3 text-[#00C8FF]" />
              </div>
              <span>Connect with peers and professors</span>
            </div>
            <div className={`flex items-center gap-3 text-sm ${heroSubText}`}>
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#00C8FF]/30 bg-[#00C8FF]/10">
                <Shield className="h-3 w-3 text-[#00C8FF]" />
              </div>
              <span>Secure and private community platform</span>
            </div>
          </div>
        </div>

        {/* Right column — auth card */}
        <div className="flex w-full items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-border bg-bg p-6 shadow-2xl md:p-8 max-h-[90vh] overflow-y-auto scrollbar-hide">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00C8FF]/40 bg-[#00C8FF]/10">
                  <LogoIcon size="sm" background={isLight ? 'light' : 'dark'} />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-text-primary">CCS HUB</h2>
                  <p className="text-[8px] font-medium tracking-wider text-text-secondary">
                    COLLEGE OF COMPUTER STUDIES
                  </p>
                </div>
              </div>
              <h1 className="mt-4 text-2xl font-bold text-text-primary lg:mt-0">Create your account</h1>
              <p className="text-sm text-text-secondary">Join the CCS Community</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {/* Success Message */}
              {success && (
                <div className="flex items-start gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Account created! Check your email to verify your account...</span>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Username */}
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  placeholder="Username"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  required
                  maxLength={50}
                  disabled={isLoading || isGoogleLoading || success}
                  className="w-full rounded-xl border border-border bg-bg px-4 py-3.5 pl-12 text-text-primary placeholder-text-muted transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Email */}
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  maxLength={255}
                  disabled={isLoading || isGoogleLoading || success}
                  className="w-full rounded-xl border border-border bg-bg px-4 py-3.5 pl-12 text-text-primary placeholder-text-muted transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Role Selection */}
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <select
                  value={formData.role}
                  onChange={(e) => {
                    const newRole = e.target.value as 'student' | 'professor';
                    setFormData({...formData, role: newRole, invitation_code: ''});
                  }}
                  disabled={isLoading || isGoogleLoading || success}
                  className="w-full rounded-xl border border-border bg-bg px-4 py-3.5 pl-12 text-text-primary appearance-none cursor-pointer transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="student">Student</option>
                  <option value="professor">Professor</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Invitation Code (Professor Only) */}
              {formData.role === 'professor' && (
                <div className="relative border border-[#00C8FF]/20 bg-[#00C8FF]/5 rounded-xl p-4">
                  <div className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#00C8FF] z-10">
                    <Shield className="h-6 w-7" />
                  </div>
                  <input
                    type="text"
                    placeholder="Invitation Code"
                    value={formData.invitation_code}
                    onChange={(e) => setFormData({...formData, invitation_code: e.target.value.toUpperCase()})}
                    required
                    disabled={isLoading || isGoogleLoading || success}
                    className="w-full rounded-xl border border-[#00C8FF]/30 bg-bg px-4 py-3.5 pl-12 text-text-primary placeholder-text-muted uppercase tracking-wider font-mono transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="mt-2 text-xs text-text-muted">
                    Contact administrator to get an invitation code
                  </p>
                </div>
              )}

              {/* Password */}
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  maxLength={128}
                  disabled={isLoading || isGoogleLoading || success}
                  className="w-full rounded-xl border border-border bg-bg px-4 py-3.5 pl-12 pr-12 text-text-primary placeholder-text-muted transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading || isGoogleLoading || success}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-[#00C8FF] focus:outline-none z-10 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({...formData, confirm_password: e.target.value})}
                  required
                  maxLength={128}
                  disabled={isLoading || isGoogleLoading || success}
                  className="w-full rounded-xl border border-border bg-bg px-4 py-3.5 pl-12 pr-12 text-text-primary placeholder-text-muted transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading || isGoogleLoading || success}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-[#00C8FF] focus:outline-none z-10 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Terms and Conditions */}
              <label className="flex cursor-pointer items-start gap-3 text-sm text-text-secondary hover:text-text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={(e) => setFormData({...formData, agreeToTerms: e.target.checked})}
                  disabled={isLoading || isGoogleLoading || success}
                  className="mt-0.5 h-4 w-4 rounded border-border bg-bg text-[#00C8FF] focus:ring-[#00C8FF] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span>
                  I agree to the <Link to="/terms" className="text-[#00C8FF] hover:text-[#00E0FF] transition-colors">terms and conditions</Link>
                </span>
              </label>

              {/* Sign Up Button */}
              <button
                type="submit"
                disabled={isLoading || isGoogleLoading || success}
                className="relative w-full overflow-hidden rounded-xl bg-[#00C8FF] px-4 py-3.5 font-semibold text-white transition-all duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/60 focus:ring-offset-2 focus:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating account...
                  </span>
                ) : success ? (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Check your email!
                  </span>
                ) : (
                  "Sign Up"
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-text-secondary">or continue with</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Google Sign Up Button */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => registerWithGoogle()}
                  disabled={isLoading || isGoogleLoading || success}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-bg px-4 py-3 transition-all duration-200 hover:border-[#00C8FF]/50 hover:bg-glass disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGoogleLoading ? (
                    <svg className="h-5 w-5 animate-spin text-[#00C8FF]" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <FcGoogle className="h-5 w-5" />
                  )}
                </button>
              </div>

              <p className="text-center text-[11px] text-text-muted">
                By continuing with Google, you agree to our{' '}
                <Link to="/terms" className="text-[#00C8FF] hover:text-[#00E0FF] transition-colors">
                  Terms &amp; Conditions
                </Link>
                .
              </p>

              {/* Login Link */}
              <p className="mt-2 text-center text-sm text-text-secondary">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-medium text-[#00C8FF] transition-colors hover:text-[#00E0FF]"
                >
                  Login
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}