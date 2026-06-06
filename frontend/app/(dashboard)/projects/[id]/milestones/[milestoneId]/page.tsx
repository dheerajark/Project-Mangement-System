'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function MilestoneRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  useEffect(() => {
    if (projectId) {
      router.replace(`/projects/${projectId}?tab=milestones`);
    }
  }, [projectId, router]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
    </div>
  );
}
