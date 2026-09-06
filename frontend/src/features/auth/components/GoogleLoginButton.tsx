// frontend/src/features/auth/components/GoogleLoginButton.tsx
import { useGoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

interface GoogleLoginButtonProps {
  className?: string;
  text?: string;
  variant?: 'login' | 'register';
}

export function GoogleLoginButton({ 
  className = '', 
  text = 'Continue with Google',
  variant: _variant = 'login'
}: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const loginWithGoogle = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (codeResponse) => {
      setIsLoading(true);
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
          login(data.user, data.access_token, data.refresh_token);
          
          if (data.is_new_user) {
            toast.success('🎉 Welcome! Your account has been created with Google.');
          } else {
            toast.success(`👋 Welcome back, ${data.user.username}!`);
          }
          
          // ✅ Redirect based on role
          const role = data.user.role;
          if (role === 'admin') {
            navigate('/admin/dashboard');
          } else if (role === 'professor') {
            navigate('/professor/dashboard');
          } else {
            navigate('/student/dashboard');
          }
        } else {
          toast.error(data.detail || 'Google login failed');
        }
      } catch (error) {
        console.error('Google login error:', error);
        toast.error('Failed to connect to Google. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      toast.error('Google login cancelled or failed');
    },
  });

  return (
    <motion.button
      type="button"
      onClick={() => loginWithGoogle()}
      disabled={isLoading}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        w-full flex items-center justify-center gap-3 px-4 py-2.5 
        border border-gray-300 rounded-xl 
        bg-white hover:bg-gray-50 
        text-sm font-medium text-gray-700 
        transition duration-200 
        shadow-sm hover:shadow-md 
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="#EA4335"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-2.09-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#4285F4"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Connecting...
        </span>
      ) : (
        text
      )}
    </motion.button>
  );
}