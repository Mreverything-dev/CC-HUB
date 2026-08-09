// frontend/src/features/auth/hooks/useAuth.ts
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth.api';
import { LoginRequest, RegisterRequest } from '../types/auth.types';
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

  const register = async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.register(data);
      console.log('✅ Registration response:', response.data);
      
      if (!response.data.user) {
        console.error('❌ No user data in registration response');
        throw new Error('Registration failed: No user data received');
      }
      
      console.log('👤 User role:', response.data.user.role);
      
      setAuth(response.data.user, response.data.access_token, response.data.refresh_token);
      toast.success(`Account created successfully! Welcome, ${response.data.user.username}!`);
      
      redirectUser(response.data.user.role);
      
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

  return { login, register, logout, changePassword, isLoading, user };
}