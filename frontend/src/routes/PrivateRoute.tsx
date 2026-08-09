// frontend/src/routes/PrivateRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';

export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}