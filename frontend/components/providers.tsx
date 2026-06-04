'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import FloatingTimer from './floating-timer';

function ThemeApplier() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (!token) return null;
      try {
        const res = await api.get('/organization/settings');
        return res.data;
      } catch (e) {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
  });

  useEffect(() => {
    if (settings && settings.theme) {
      const root = window.document.documentElement;
      if (settings.theme === 'light') {
        root.classList.add('light');
        root.style.colorScheme = 'light';
      } else {
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
      }
    }
  }, [settings]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      {children}
      <FloatingTimer />
    </QueryClientProvider>
  );
}
