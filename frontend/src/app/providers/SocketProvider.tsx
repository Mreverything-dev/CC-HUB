import { ReactNode, createContext, useContext, useEffect } from 'react';
import { socketService } from '@/lib/socket';

const SocketContext = createContext(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    socketService.connect();
    return () => socketService.disconnect();
  }, []);

  return <SocketContext.Provider value={null}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
