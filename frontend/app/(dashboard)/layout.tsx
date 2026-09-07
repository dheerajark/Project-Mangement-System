'use client';

import React from 'react';
import { SidebarProvider } from '@/hooks/useSidebar';
import Sidebar from '@/components/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
