'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { RegisterDto } from '../types/auth.types'; // we will define types soon
import { LoginDto } from '../types/auth.types';

export type UserPayload = {
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
};

// Helper function to decode JWT payload without external libraries
function decodeJwt(token: string): UserPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      const decoded = decodeJwt(token);
      if (decoded) {
        setUser(decoded);
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    }
    setIsLoading(false);
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (dto: LoginDto) => {
      const response = await api.post('/auth/login', dto);
      return response.data;
    },
    onSuccess: (data) => {
      const { access_token, refresh_token } = data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      const decoded = decodeJwt(access_token);
      setUser(decoded);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (dto: RegisterDto) => {
      const response = await api.post('/auth/register', dto);
      return response.data;
    },
    onSuccess: (data) => {
      const { access_token, refresh_token } = data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      const decoded = decodeJwt(access_token);
      setUser(decoded);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        await api.post('/auth/logout');
      } catch (e) {
        // Suppress errors during logout if server token is already expired
      }
    },
    onSuccess: () => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
    },
  });

  const hasRole = (roleName: string): boolean => {
    return user?.roles.includes(roleName) || false;
  };

  const hasPermission = (permissionName: string): boolean => {
    return user?.permissions.includes(permissionName) || false;
  };

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    logout: logoutMutation.mutateAsync,
    hasRole,
    hasPermission,
  };
}
