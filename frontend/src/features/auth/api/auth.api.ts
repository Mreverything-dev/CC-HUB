// frontend/src/features/auth/api/auth.api.ts
import { api } from '@/lib/axios';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RegisterResponse,
  ChangePasswordRequest,
  User,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerificationResponse
} from '../types/auth.types';

export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<RegisterResponse>('/auth/register', data),
  
  login: (data: LoginRequest) => 
    api.post<AuthResponse>('/auth/login', data),
  
  logout: () => 
    api.post('/auth/logout'),
  
  refreshToken: (refreshToken: string) => 
    api.post<{ access_token: string; token_type: string }>('/auth/refresh', { refresh_token: refreshToken }),
  
  getMe: () => 
    api.get<User>('/auth/me'),
  
  changePassword: (data: ChangePasswordRequest) =>
    api.post('/auth/change-password', data),

  updateUsername: (username: string) =>
    api.put<{ message: string; username: string }>('/auth/update-username', { username }),

  verifyEmail: (token: string) =>
    api.get<VerificationResponse>('/auth/verify-email', { params: { token } }),

  resendVerification: (email: string) =>
    api.post('/auth/resend-verification', { email }),

  verificationStatus: () =>
    api.get<{ is_verified: boolean; email: string; username: string }>('/auth/verification-status'),

  forgotPassword: (data: ForgotPasswordRequest) =>
    api.post('/auth/forgot-password', data),

  resetPassword: (data: ResetPasswordRequest) =>
    api.post('/auth/reset-password', data),
};
