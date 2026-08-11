// frontend/src/app/providers/SocketProvider.tsx
import { ReactNode, useEffect } from 'react';
import { socketService } from '@/lib/socket';
import { useAuthStore } from '@/features/auth/store/auth.store';

export function SocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      socketService.connect();
    } else {
      socketService.disconnect();
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated]);

  return <>{children}</>;
}

// Access the shared socket service instance (connection lifecycle is owned by SocketProvider)
export function useSocket() {
  return socketService;
}