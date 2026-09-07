'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Sliders, Settings, LogOut, ArrowLeft } from 'lucide-react';
import NotificationBell from '@/components/notification-bell';

interface HeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  backHref?: string;
  children?: React.ReactNode;
  activeNav?: 'dashboard' | 'preferences' | 'settings' | string;
}

export default function Header({
  title,
  subtitle,
  backHref,
  children,
  activeNav,
}: HeaderProps) {
  const { user, hasPermission, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-xl sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          ) : (
            <div className="w-10 md:hidden" />
          )}

          {subtitle ? (
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {subtitle}
              </span>
              <span className="font-bold text-base text-slate-100 flex items-center gap-2">
                {title}
              </span>
            </div>
          ) : typeof title === 'string' ? (
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
              {title}
            </span>
          ) : (
            title
          )}
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {children}

          <NotificationBell />

          <Link
            href="/settings/personal"
            className={`p-2 rounded-lg transition-all duration-150 flex items-center gap-2 text-sm ${
              activeNav === 'preferences'
                ? 'text-indigo-400 bg-indigo-500/10 font-semibold'
                : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10'
            }`}
            title="Personal Preferences"
          >
            <Sliders className="w-4 h-4" />
            <span className="hidden sm:inline">Preferences</span>
          </Link>

          {user && hasPermission('MANAGE_USERS') && (
            <Link
              href="/settings"
              className={`p-2 rounded-lg transition-all duration-150 flex items-center gap-2 text-sm ${
                activeNav === 'settings'
                  ? 'text-indigo-400 bg-indigo-500/10 font-semibold'
                  : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10'
              }`}
              title="Organization Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-150 flex items-center gap-2 text-sm cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
