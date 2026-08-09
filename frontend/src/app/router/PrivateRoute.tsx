import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { ReactNode } from 'react';

export function PrivateRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}
