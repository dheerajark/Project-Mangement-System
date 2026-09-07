'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function NotificationPreferencesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/personal?tab=accessibility');
  }, [router]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
    </div>
  );
}
