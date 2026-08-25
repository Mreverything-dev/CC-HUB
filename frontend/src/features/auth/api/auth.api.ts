// frontend/src/features/auth/api/auth.api.ts
import { api } from '@/lib/axios';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RegisterResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  ConfirmChangePasswordResponse,
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
  
  // Step 1: validates current password + new password, emails a
  // confirmation link. The password is not changed until that link is
  // clicked (see confirmChangePassword below).
  changePassword: (data: ChangePasswordRequest) =>
    api.post<ChangePasswordResponse>('/auth/change-password', data),

  // Step 2: called from the ConfirmPasswordChange page once the user
  // clicks the emailed link.
  confirmChangePassword: (token: string) =>
    api.get<ConfirmChangePasswordResponse>('/auth/confirm-change-password', { params: { token } }),

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
