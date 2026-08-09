// frontend/src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];  // Add this optional prop
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  
  // Check if user is authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Check if user has allowed role
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    const role = user.role;
    if (role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (role === 'professor') {
      return <Navigate to="/professor/dashboard" replace />;
    } else {
      return <Navigate to="/student/dashboard" replace />;
    }
  }
  
  return <>{children}</>;
}