'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPersonalPreferences } from '@/services/getPersonalPreferences';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const prefs = getPersonalPreferences();
    const landing = prefs.landingPage || '/dashboard';
    router.replace(landing);
  }, [router]);

  return null;
}
