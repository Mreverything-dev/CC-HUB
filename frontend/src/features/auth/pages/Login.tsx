// frontend/src/features/auth/pages/Login.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { Mail, AlertCircle, Lock, Eye, EyeOff, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { LogoIcon } from '@/components/ui/Logo/Logo';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../store/auth.store';
import { useLoadingStore } from '@/app/store/useLoadingStore';
import { ThemeToggle } from '@/components/ui/ThemeToggle/ThemeToggle';
import toast from 'react-hot-toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_.]{3,50}$/;

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email or username is required')
    .max(255, 'Must be 255 characters or fewer')
    .refine((v) => (v.includes('@') ? EMAIL_RE.test(v) : USERNAME_RE.test(v)), {
      message: 'Enter a valid email or username',
    }),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Must be 128 characters or fewer'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function Login() {
  const { login, isLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { login: setAuth } = useAuthStore();
  const { show: showGlobalLoading, hide: hideGlobalLoading } = useLoadingStore();
  const [showPassword, setShowPassword] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const isLight = theme === 'light';
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  });

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const onSubmit = async (data: LoginFormData) => {
    if (cooldownSeconds > 0) return;
    try {
      await login(data);
    } catch (error: any) {
      if (error?.response?.status === 429) {
        const retryAfter = Number(error.response?.headers?.['retry-after']);
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          setCooldownSeconds(retryAfter);
        }
      }
    }
  };

  const loginWithGoogle = useGoogleLogin({
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

          if (data.is_new_user) {
            toast.success('🎉 Welcome! Your account has been created with Google.');
          } else {
            toast.success(`👋 Welcome back, ${data.user.username}!`);
          }

          showGlobalLoading('Signing you in...');
          await new Promise((resolve) => setTimeout(resolve, 300));

          const role = data.user.role;
          if (role === 'admin') {
            navigate('/admin/dashboard');
          } else if (role === 'professor') {
            navigate('/professor/dashboard');
          } else {
            navigate('/student/dashboard');
          }

          setTimeout(() => {
            hideGlobalLoading();
          }, 1200);
        } else {
          toast.error(data.detail || 'Google login failed');
        }
      } catch (error) {
        console.error('Google login error:', error);
        toast.error('Failed to connect to Google. Please try again.');
        hideGlobalLoading();
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error('Google login cancelled or failed');
    },
  });

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Light-mode specific colors
  const heroText = isLight ? 'text-slate-900' : 'text-white';
  const heroSubText = isLight ? 'text-slate-600' : 'text-white/90';
  const heroShadow = isLight ? '' : '[text-shadow:0_2px_16px_rgba(0,0,0,0.6)]';
  const heroSubShadow = isLight ? '' : '[text-shadow:0_1px_8px_rgba(0,0,0,0.6)]';

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
            Connect. Collaborate.{' '}
            <span className="text-[#00C8FF]">Code the future.</span>
          </p>
          <p className={`mt-4 max-w-sm text-sm ${heroSubText} ${heroSubShadow}`}>
            One hub for announcements, sections, chat, and live sessions across
            the whole College of Computer Studies.
          </p>
        </div>

        {/* Right column — auth card */}
        <div className="flex w-full items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-border bg-bg p-6 shadow-2xl md:p-8">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00C8FF]/40 bg-[#00C8FF]/10">
                  <LogoIcon size="sm" background={isLight ? 'light' : 'dark'} />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-text-primary">CCS HUB</h2>
                  <p className="text-[8px] font-medium tracking-wider text-text-muted">
                    COLLEGE OF COMPUTER STUDIES
                  </p>
                </div>
              </div>
              <h1 className="mt-4 text-2xl font-bold text-text-primary lg:mt-0">Welcome Back!</h1>
              <p className="text-sm text-text-secondary">Sign in to continue to CCS Hub</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              {/* Error Messages */}
              {errors.email && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errors.email.message}</span>
                </div>
              )}
              {errors.password && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errors.password.message}</span>
                </div>
              )}

              {/* Rate-limit cooldown */}
              {cooldownSeconds > 0 && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Too many login attempts. Please try again in{' '}
                    <span className="font-semibold">
                      {cooldownSeconds} second{cooldownSeconds === 1 ? '' : 's'}
                    </span>
                    .
                  </span>
                </div>
              )}

              {/* Email Input */}
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  placeholder="Email or Username"
                  maxLength={255}
                  {...register('email')}
                  autoComplete="username"
                  disabled={isLoading || isGoogleLoading}
                  className="w-full rounded-xl border border-border bg-bg px-4 py-3.5 pl-12 text-text-primary placeholder-text-muted transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Password Input */}
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  maxLength={128}
                  {...register('password')}
                  autoComplete="current-password"
                  disabled={isLoading || isGoogleLoading}
                  className="w-full rounded-xl border border-border bg-bg px-4 py-3.5 pl-12 pr-12 text-text-primary placeholder-text-muted transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  disabled={isLoading || isGoogleLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-[#00C8FF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 z-10"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
                  <input
                    type="checkbox"
                    {...register('rememberMe')}
                    disabled={isLoading || isGoogleLoading}
                    className="h-4 w-4 rounded border-border bg-bg text-[#00C8FF] focus:ring-[#00C8FF] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  Remember me
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[#00C8FF] transition-colors hover:text-[#00E0FF]"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading || isGoogleLoading || cooldownSeconds > 0}
                className="relative w-full overflow-hidden rounded-xl bg-[#00C8FF] px-4 py-3.5 font-semibold text-white transition-all duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/60 focus:ring-offset-2 focus:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin">
                      <LogoIcon size="sm" background="dark" />
                    </div>
                    Logging in...
                  </span>
                ) : cooldownSeconds > 0 ? (
                  `Log In — ${cooldownSeconds}s`
                ) : (
                  "Log In"
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-text-secondary">or continue with</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Google Login Button */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => loginWithGoogle()}
                  disabled={isLoading || isGoogleLoading}
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

              {/* Sign Up Link */}
              <p className="mt-2 text-center text-sm text-text-secondary">
                Don't have an account?{' '}
                <Link
                  to="/Register"
                  className="font-medium text-[#00C8FF] transition-colors hover:text-[#00E0FF]"
                >
                  Sign up
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;