'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import FloatingTimer from './floating-timer';

import { getPersonalPreferences } from '../services/getPersonalPreferences';

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
    staleTime: 5 * 60 * 1000,
  });

  const applyPreferences = () => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    const personal = getPersonalPreferences();

    // Clear previous theme & mode classes
    root.classList.remove('light', 'dark', 'dim');
    root.classList.remove(
      'theme-indigo',
      'theme-emerald',
      'theme-amber',
      'theme-rose',
      'theme-slate',
      'theme-orange',
      'theme-cyan',
      'theme-teal',
      'theme-red',
      'theme-green',
      'theme-blue'
    );

    let effectiveMode = personal.mode || (settings?.theme?.split('-')[0] === 'light' ? 'day' : 'night');
    if (effectiveMode === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveMode = prefersDark ? 'night' : 'day';
    }

    if (personal.dimMode || (effectiveMode as string) === 'dim') {
      root.classList.add('dim');
      root.style.colorScheme = 'dark';
    } else if (effectiveMode === 'day') {
      root.classList.add('light');
      root.style.colorScheme = 'light';
    } else {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    }

    const orgAccent = settings?.theme?.split('-')[1] || 'blue';
    const accent = personal.accentColor || orgAccent;
    root.classList.add(`theme-${accent}`);
  };

  useEffect(() => {
    applyPreferences();
    window.addEventListener('personal_preferences_changed', applyPreferences);
    return () => {
      window.removeEventListener('personal_preferences_changed', applyPreferences);
    };
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
