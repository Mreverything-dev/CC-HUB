// frontend/src/features/auth/pages/Login.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook, FaGithub } from 'react-icons/fa';
import { Mail, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import heroImage from '@/assets/images/backgrounds/img-bg.png';
import { LogoIcon } from '@/components/ui/Logo/Logo';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function Login() {
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    await login(data);
  };

  // Mock social login handler
  const handleSocialLogin = (provider: string) => {
    console.log(`TODO: connect ${provider} OAuth`);
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050A0F] text-[#F1F5F9]">
      {/* CCS building hero image, full-page background */}
      <div className="absolute inset-0 z-0">
        <img src={heroImage} alt="" className="h-full w-full object-cover" />
      </div>
      {/* Strong dark overlay so the form stays readable over the photo */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[#050A0F]/60" />
      {/* Vignette: darker at the left/right edges, tapering toward the center */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-[#050A0F] via-transparent to-[#050A0F]/90" />
      {/* Subtle cyan/blue futuristic glow */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-[#00C8FF]/10 blur-[120px] z-0" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#3B82F6]/10 blur-[120px] z-0" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-2 lg:px-16">
        {/* Left column — brand */}
        <div className="hidden flex-col lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00C8FF]/40 bg-[#00C8FF]/10 shadow-[0_0_20px_rgba(0,200,245,0.18)] backdrop-blur-sm">
              <LogoIcon size="sm" background="dark" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[#F1F5F9]">CCS HUB</h2>
              <p className="text-xs font-medium tracking-wider text-[#94A3B8]">
                COLLEGE OF COMPUTER STUDIES
              </p>
            </div>
          </div>

          <p className="mt-10 max-w-md text-3xl font-semibold leading-tight text-[#F1F5F9] [text-shadow:0_2px_16px_rgba(0,0,0,0.6)]">
            Connect. Collaborate.{" "}
            <span className="text-[#00C8FF]">Code the future.</span>
          </p>
          <p className="mt-4 max-w-sm text-sm text-[#94A3B8] [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
            One hub for announcements, sections, chat, and live sessions across
            the whole College of Computer Studies.
          </p>
        </div>

        {/* Right column — auth card */}
        <div className="flex w-full items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-[rgba(0,200,245,0.18)] bg-[rgba(13,23,34,0.85)] p-6 backdrop-blur-xl shadow-2xl md:p-8">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00C8FF]/40 bg-[#00C8FF]/10">
                  <LogoIcon size="sm" background="dark" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-[#F1F5F9]">CCS HUB</h2>
                  <p className="text-[8px] font-medium tracking-wider text-[#94A3B8]">
                    COLLEGE OF COMPUTER STUDIES
                  </p>
                </div>
              </div>
              <h1 className="mt-4 text-2xl font-bold text-[#F1F5F9] lg:mt-0">Welcome Back!</h1>
              <p className="text-sm text-[#94A3B8]">Sign in to continue to CCS Hub</p>
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

              {/* Email Input with Mail Icon */}
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#00C8FF] z-10">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  placeholder="Email or Username"
                  {...register('email')}
                  autoComplete="username"
                  disabled={isLoading}
                  className="w-full rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3.5 pl-12 text-[#F1F5F9] placeholder-[#64748B] backdrop-blur-sm transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:shadow-[0_0_16px_rgba(0,200,245,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Password Input with Lock Icon and Eye Toggle */}
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#00C8FF] z-10">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  {...register('password')}
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="w-full rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3.5 pl-12 pr-12 text-[#F1F5F9] placeholder-[#64748B] backdrop-blur-sm transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:shadow-[0_0_16px_rgba(0,200,245,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] transition-colors hover:text-[#00C8FF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 z-10"
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
                <label className="flex cursor-pointer items-center gap-2 text-[#94A3B8] hover:text-[#F1F5F9] transition-colors">
                  <input
                    type="checkbox"
                    {...register('rememberMe')}
                    disabled={isLoading}
                    className="h-4 w-4 rounded border-[#1E3447] bg-[#0A111A] text-[#00C8FF] focus:ring-[#00C8FF] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
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
                disabled={isLoading}
                className="relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] px-4 py-3.5 font-semibold text-[#060B12] transition-all duration-200 hover:opacity-90 hover:shadow-[0_0_24px_rgba(0,200,245,0.3)] focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/60 focus:ring-offset-2 focus:ring-offset-[#0D1722] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Logging in...
                  </span>
                ) : (
                  "Log In"
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-[#1E3447]" />
                <span className="text-xs text-[#94A3B8]">or continue with</span>
                <div className="h-px flex-1 bg-[#1E3447]" />
              </div>

              {/* Social Login Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  disabled={isLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:border-[#00C8FF]/50 hover:bg-[#111E2B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FcGoogle className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('facebook')}
                  disabled={isLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:border-[#00C8FF]/50 hover:bg-[#111E2B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaFacebook className="h-5 w-5 text-[#1877F2]" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('github')}
                  disabled={isLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:border-[#00C8FF]/50 hover:bg-[#111E2B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaGithub className="h-5 w-5 text-[#F1F5F9]" />
                </button>
              </div>

              {/* Sign Up Link */}
              <p className="mt-2 text-center text-sm text-[#94A3B8]">
                Don't have an account?{" "}
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