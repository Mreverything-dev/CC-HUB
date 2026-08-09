// frontend/src/features/auth/store/auth.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthState } from '../types/auth.types';

interface AuthStore extends AuthState {
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setToken: (token: string) => void;
  setRefreshToken: (refreshToken: string) => void;  // ✅ Add this
  getToken: () => string | null;  // ✅ Add this
  getRefreshToken: () => string | null;  // ✅ Add this
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      
      login: (user, token, refreshToken) => {
        // ✅ Store in localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));
        
        set({
          user,
          token,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
        
        console.log('🔐 User logged in:', user.username);
      },
      
      logout: () => {
        // ✅ Clear localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
        
        console.log('🚪 User logged out');
      },
      
      updateUser: (userData) => set((state) => {
        const updatedUser = state.user ? { ...state.user, ...userData } : null;
        if (updatedUser) {
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        return { user: updatedUser };
      }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setToken: (token) => {
        localStorage.setItem('token', token);
        set({ token });
        console.log('🔑 Token updated');
      },
      
      setRefreshToken: (refreshToken) => {
        localStorage.setItem('refresh_token', refreshToken);
        set({ refreshToken });
      },
      
      getToken: () => {
        // ✅ Check store first, then localStorage
        const state = get();
        return state.token || localStorage.getItem('token');
      },
      
      getRefreshToken: () => {
        const state = get();
        return state.refreshToken || localStorage.getItem('refresh_token');
      },
      
      // ✅ Check if authenticated by checking token existence
      checkAuth: () => {
        const token = get().getToken();
        const user = localStorage.getItem('user');
        if (token && user) {
          const userData = JSON.parse(user);
          set({
            user: userData,
            token: token,
            isAuthenticated: true,
          });
          return true;
        }
        return false;
      },
    }),
    {
      name: 'auth-storage',
      // ✅ Partialize to only persist specific fields
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);