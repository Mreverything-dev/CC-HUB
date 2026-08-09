// frontend/src/features/users/hooks/useUsers.ts
import { useState } from 'react';
import { api } from '@/lib/axios';
import { User } from '@/features/auth/types/auth.types';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const searchUsers = async (query: string) => {
    if (!query || query.length < 2) {
      setUsers([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await api.get<User[]>(`/users/search?q=${query}`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    users,
    isLoading,
    searchUsers,
  };
}