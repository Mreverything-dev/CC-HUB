// frontend/src/features/auth/api/auth.api.ts
import { api } from '@/lib/axios';
import { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  ChangePasswordRequest,
  User 
} from '../types/auth.types';

export const authApi = {
  register: (data: RegisterRequest) => 
    api.post<AuthResponse>('/auth/register', data),
  
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
};