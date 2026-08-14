// frontend/src/pages/Register.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { 
  CodeXml, 
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
import { FaFacebook, FaGithub } from 'react-icons/fa';
import heroImage from '@/assets/images/backgrounds/img-bg.png';

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
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate password match
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    // Validate terms agreement
    if (!formData.agreeToTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }

    // Validate invitation code for professor
    if (formData.role === 'professor' && !formData.invitation_code) {
      setError('Invitation code required for professor registration');
      return;
    }

    try {
      await registerUser(formData);
      setSuccess(true);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    }
  };

  // Mock social login handler
  const handleSocialLogin = (provider: string) => {
    console.log(`TODO: connect ${provider} OAuth`);
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
              <CodeXml className="h-7 w-7 text-[#00C8FF]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[#F1F5F9]">CCS HUB</h2>
              <p className="text-xs font-medium tracking-wider text-[#94A3B8]">
                COLLEGE OF COMPUTER STUDIES
              </p>
            </div>
          </div>

          <p className="mt-10 max-w-md text-3xl font-semibold leading-tight text-[#F1F5F9] [text-shadow:0_2px_16px_rgba(0,0,0,0.6)]">
            Join the{" "}
            <span className="text-[#00C8FF]">CCS Community.</span>
          </p>
          <p className="mt-4 max-w-sm text-sm text-[#94A3B8] [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
            Create your account and start connecting with fellow students and professors across the College of Computer Studies.
          </p>

          {/* Features list */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 text-sm text-[#94A3B8]">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#00C8FF]/30 bg-[#00C8FF]/10">
                <GraduationCap className="h-3 w-3 text-[#00C8FF]" />
              </div>
              <span>Access to course materials and announcements</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#94A3B8]">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#00C8FF]/30 bg-[#00C8FF]/10">
                <UserCheck className="h-3 w-3 text-[#00C8FF]" />
              </div>
              <span>Connect with peers and professors</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#94A3B8]">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#00C8FF]/30 bg-[#00C8FF]/10">
                <Shield className="h-3 w-3 text-[#00C8FF]" />
              </div>
              <span>Secure and private community platform</span>
            </div>
          </div>
        </div>

        {/* Right column — auth card */}
        <div className="flex w-full items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-[rgba(0,200,245,0.18)] bg-[rgba(13,23,34,0.85)] p-6 backdrop-blur-xl shadow-2xl md:p-8 max-h-[90vh] overflow-y-auto scrollbar-hide">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00C8FF]/40 bg-[#00C8FF]/10">
                  <CodeXml className="h-5 w-5 text-[#00C8FF]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-[#F1F5F9]">CCS HUB</h2>
                  <p className="text-[8px] font-medium tracking-wider text-[#94A3B8]">
                    COLLEGE OF COMPUTER STUDIES
                  </p>
                </div>
              </div>
              <h1 className="mt-4 text-2xl font-bold text-[#F1F5F9] lg:mt-0">Create your account</h1>
              <p className="text-sm text-[#94A3B8]">Join the CCS Community</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {/* Success Message */}
              {success && (
                <div className="flex items-start gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Registration successful! Redirecting...</span>
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
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#00C8FF] z-10">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  placeholder="Username"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  required
                  disabled={isLoading || success}
                  className="w-full rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3.5 pl-12 text-[#F1F5F9] placeholder-[#64748B] backdrop-blur-sm transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:shadow-[0_0_16px_rgba(0,200,245,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Email */}
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#00C8FF] z-10">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  disabled={isLoading || success}
                  className="w-full rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3.5 pl-12 text-[#F1F5F9] placeholder-[#64748B] backdrop-blur-sm transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:shadow-[0_0_16px_rgba(0,200,245,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Role Selection */}
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#00C8FF] z-10">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <select
                  value={formData.role}
                  onChange={(e) => {
                    const newRole = e.target.value as 'student' | 'professor';
                    setFormData({...formData, role: newRole, invitation_code: ''});
                  }}
                  disabled={isLoading || success}
                  className="w-full rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3.5 pl-12 text-[#F1F5F9] appearance-none cursor-pointer backdrop-blur-sm transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="student">Student</option>
                  <option value="professor">Professor</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
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
                    disabled={isLoading || success}
                    className="w-full rounded-xl border border-[#00C8FF]/30 bg-[#0A111A]/90 px-4 py-3.5 pl-12 text-[#F1F5F9] placeholder-[#64748B] uppercase tracking-wider font-mono backdrop-blur-sm transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="mt-2 text-xs text-[#64748B]">
                    Contact administrator to get an invitation code
                  </p>
                </div>
              )}

              {/* Password */}
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#00C8FF] z-10">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  disabled={isLoading || success}
                  className="w-full rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3.5 pl-12 pr-12 text-[#F1F5F9] placeholder-[#64748B] backdrop-blur-sm transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:shadow-[0_0_16px_rgba(0,200,245,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading || success}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] transition-colors hover:text-[#00C8FF] focus:outline-none z-10 disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#00C8FF] z-10">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({...formData, confirm_password: e.target.value})}
                  required
                  disabled={isLoading || success}
                  className="w-full rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3.5 pl-12 pr-12 text-[#F1F5F9] placeholder-[#64748B] backdrop-blur-sm transition-all duration-200 focus:border-[#00C8FF] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:shadow-[0_0_16px_rgba(0,200,245,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading || success}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] transition-colors hover:text-[#00C8FF] focus:outline-none z-10 disabled:cursor-not-allowed disabled:opacity-50"
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
              <label className="flex cursor-pointer items-start gap-3 text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition-colors">
                <input
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={(e) => setFormData({...formData, agreeToTerms: e.target.checked})}
                  disabled={isLoading || success}
                  className="mt-0.5 h-4 w-4 rounded border-[#1E3447] bg-[#0A111A] text-[#00C8FF] focus:ring-[#00C8FF] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span>
                  I agree to the <Link to="/terms" className="text-[#00C8FF] hover:text-[#00E0FF] transition-colors">terms and conditions</Link>
                </span>
              </label>

              {/* Sign Up Button */}
              <button
                type="submit"
                disabled={isLoading || success}
                className="relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] px-4 py-3.5 font-semibold text-[#060B12] transition-all duration-200 hover:opacity-90 hover:shadow-[0_0_24px_rgba(0,200,245,0.3)] focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/60 focus:ring-offset-2 focus:ring-offset-[#0D1722] disabled:cursor-not-allowed disabled:opacity-50"
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
                    Registered!
                  </span>
                ) : (
                  "Sign Up"
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
                  disabled={isLoading || success}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:border-[#00C8FF]/50 hover:bg-[#111E2B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FcGoogle className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('facebook')}
                  disabled={isLoading || success}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:border-[#00C8FF]/50 hover:bg-[#111E2B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaFacebook className="h-5 w-5 text-[#1877F2]" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('github')}
                  disabled={isLoading || success}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#1E3447] bg-[#0A111A]/90 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:border-[#00C8FF]/50 hover:bg-[#111E2B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaGithub className="h-5 w-5 text-[#F1F5F9]" />
                </button>
              </div>

              {/* Login Link */}
              <p className="mt-2 text-center text-sm text-[#94A3B8]">
                Already have an account?{" "}
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