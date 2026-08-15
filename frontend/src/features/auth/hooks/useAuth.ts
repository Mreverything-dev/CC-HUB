// frontend/src/features/auth/hooks/useAuth.ts
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth.api';
import { LoginRequest, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest } from '../types/auth.types';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const { login: setAuth, logout: clearAuth, user } = useAuthStore();
  const navigate = useNavigate();

  const redirectUser = (role: string) => {
    console.log('🔀 Redirecting user with role:', role);
    if (role === 'admin') {
      navigate('/admin/dashboard');
    } else if (role === 'professor') {
      navigate('/professor/dashboard');
    } else {
      navigate('/student/dashboard');
    }
  };

  const login = async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data);
      console.log('✅ Login response:', response.data);
      
      setAuth(response.data.user, response.data.access_token, response.data.refresh_token);
      toast.success(`Welcome back, ${response.data.user.username}!`);
      
      redirectUser(response.data.user.role);
      
      return response.data;
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Registration does NOT log the user in - the account is unverified until
  // they click the emailed link, so this deliberately does not call setAuth
  // or redirect to a dashboard. The caller (Register page) sends them to the
  // "check your email" verification page instead.
  const register = async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.register(data);
      console.log('✅ Registration response:', response.data);

      if (!response.data.user) {
        console.error('❌ No user data in registration response');
        throw new Error('Registration failed: No user data received');
      }

      toast.success('Account created! Check your email to verify your account.');

      return response.data;
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      toast.error(error.response?.data?.detail || 'Registration failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore errors on logout
    } finally {
      clearAuth();
      toast.success('Logged out successfully');
      navigate('/login');
    }
  };

  const changePassword = async (data: any) => {
    setIsLoading(true);
    try {
      await authApi.changePassword(data);
      toast.success('Password changed successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (data: ForgotPasswordRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.forgotPassword(data);
      toast.success(response.data.message);
      return response.data;
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send reset email');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (data: ResetPasswordRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.resetPassword(data);
      toast.success(response.data.message);
      return response.data;
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to reset password');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { login, register, logout, changePassword, forgotPassword, resetPassword, isLoading, user };
}
