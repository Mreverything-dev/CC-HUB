// frontend/src/lib/axios.ts
import axios from 'axios';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { authApi } from '@/features/auth/api/auth.api';

// If VITE_API_URL isn't set, derive it from whatever host the page was
// loaded from - this makes the same dev build work both at
// http://localhost:3000 (-> localhost:8000) and, for LAN testing (e.g. a
// phone on the same Wi-Fi), at http://<computer-LAN-IP>:3000 (->
// <computer-LAN-IP>:8000) with zero per-network config, since a build-time
// env var can't know which host a given device will use to reach it.
const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api/v1`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ Request interceptor - Add token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔑 Token added to request:', config.url);
    } else {
      console.warn('⚠️ No token found for request:', config.url);
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// ✅ Response interceptor - Handle token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.config.url, response.status);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // ✅ Log the error for debugging
    console.error('❌ API Error:', {
      url: originalRequest?.url,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });

    // ✅ If error is 401 and not a retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('🔄 401 Unauthorized, attempting token refresh...');
      
      if (isRefreshing) {
        console.log('⏳ Token refresh already in progress, queueing request...');
        // If already refreshing, queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // ✅ Get refresh token from store or localStorage
        const refreshToken = useAuthStore.getState().refreshToken || localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          console.error('❌ No refresh token available');
          throw new Error('No refresh token');
        }

        console.log('🔄 Refreshing token...');
        const response = await authApi.refreshToken(refreshToken);
        const newToken = response.data.access_token;
        
        console.log('✅ Token refreshed successfully');
        
        // ✅ Update token in store and localStorage
        const user = useAuthStore.getState().user || JSON.parse(localStorage.getItem('user') || '{}');
        
        if (user) {
          useAuthStore.getState().login(
            user,
            newToken,
            refreshToken
          );
        } else {
          // Fallback: just set the token
          localStorage.setItem('token', newToken);
          useAuthStore.getState().setToken(newToken);
        }

        // ✅ Process queued requests
        processQueue(null, newToken);
        
        // ✅ Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
        
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        
        // ✅ Refresh failed - logout user
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        // ✅ Redirect to login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export { api };