// frontend/src/routes/PublicRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}