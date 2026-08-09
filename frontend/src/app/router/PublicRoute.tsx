import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { ReactNode } from 'react';

export function PublicRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" /> : <>{children}</>;
}
