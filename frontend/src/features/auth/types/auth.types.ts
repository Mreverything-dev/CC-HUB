// frontend/src/features/auth/types/auth.types.ts
export interface User {
  id: string;
  email: string;
  username: string;
  role: 'student' | 'professor' | 'admin';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  first_name?: string;
  last_name?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  confirm_password: string;
  role: 'student' | 'professor' | 'admin';
  invitation_code?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

// Registration no longer logs the user in - the account is unverified until
// the emailed link is clicked, so no tokens are issued here at all.
export interface RegisterResponse {
  message: string;
  user: User;
  requires_verification: boolean;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
  confirm_password: string;
}

export interface VerificationResponse {
  message: string;
  verified: boolean;
}
