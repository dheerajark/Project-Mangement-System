'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { LogOut, Shield, ShieldCheck, User, Users, FolderKanban, Clock, AlertTriangle, Loader2, Settings } from 'lucide-react';

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const { data: assignedTasks } = useQuery({
    queryKey: ['assignedTasks'],
    queryFn: async () => {
      const res = await api.get('/tasks/assigned');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const { data: myTimeEntries } = useQuery({
    queryKey: ['myTimeEntries'],
    queryFn: async () => {
      const res = await api.get('/time-entries/me');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const activeProjectsCount = projects ? projects.filter((p: any) => p.status === 'ACTIVE').length : 0;
  const assignedTasksCount = assignedTasks ? assignedTasks.length : 0;
  const totalLoggedHours = myTimeEntries
    ? myTimeEntries.reduce((sum: number, entry: any) => sum + entry.hours, 0)
    : 0;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-gradient-to-tr from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FolderKanban className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
              PMS Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-300 font-medium">Session Active</span>
            </div>
            {user && user.permissions.includes('MANAGE_USERS') && (
              <Link
                href="/settings"
                className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all duration-150 flex items-center gap-2 text-sm"
                title="Organization Settings"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-150 flex items-center gap-2 text-sm"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Hero Banner */}
        <section className="bg-gradient-to-r from-indigo-950/45 via-slate-900/60 to-blue-950/30 border border-slate-900 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[30%] h-[100%] rounded-full bg-indigo-500/5 blur-[80px]" />
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 bg-slate-850 border border-slate-800 rounded-full flex items-center justify-center text-indigo-400 shadow-inner">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100">
                Hello, {user?.firstName || 'User'} {user?.lastName || ''}
              </h2>
              <p className="text-slate-400 text-sm mt-1">{user?.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {user?.roles.map((role) => (
              <span
                key={role}
                className="px-3.5 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-full shadow-inner"
              >
                {role}
              </span>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Security Permissions Widget */}
          <article className="lg:col-span-1 bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-900">
              <Shield className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-slate-200">Security Credentials</h3>
            </div>
            
            <div className="space-y-3">
              <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                Assigned Permissions
              </div>
              <ul className="grid grid-cols-1 gap-2">
                {user?.permissions.map((permission) => (
                  <li
                    key={permission}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-slate-800/60 rounded-xl text-xs text-slate-300"
                  >
                    <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span className="font-mono">{permission}</span>
                  </li>
                ))}
                {(!user?.permissions || user.permissions.length === 0) && (
                  <li className="text-sm text-slate-500 italic">No permissions assigned</li>
                )}
              </ul>
            </div>
          </article>

          {/* Quick Metrics Placeholders (MVP Modules Preview) */}
          <section className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Project Widget Card */}
            <Link
              href="/projects"
              className="bg-slate-900/30 border border-slate-900 hover:border-indigo-500/30 hover:bg-slate-900/40 rounded-2xl p-6 flex flex-col justify-between group transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/[0.02]"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="text-slate-400 text-sm font-semibold group-hover:text-slate-350 transition-colors">Active Projects</h4>
                  <p className="text-3xl font-extrabold text-slate-100 mt-1">{activeProjectsCount}</p>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-800 text-indigo-400 rounded-xl group-hover:scale-110 transition-transform duration-200">
                  <FolderKanban className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-6 text-xs text-slate-500 border-t border-slate-900 pt-4 flex justify-between">
                <span>Phase 3 Project Module</span>
                <span className="text-indigo-400 font-medium group-hover:underline">View Projects</span>
              </div>
            </Link>

            {/* Tasks Widget Card */}
            <Link
              href="/projects"
              className="bg-slate-900/30 border border-slate-900 hover:border-slate-850 hover:bg-slate-900/50 rounded-2xl p-6 flex flex-col justify-between group transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/[0.02]"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="text-slate-400 text-sm font-semibold group-hover:text-slate-350 transition-colors">My Tasks</h4>
                  <p className="text-3xl font-extrabold text-slate-100 mt-1">{assignedTasksCount}</p>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-800 text-blue-400 rounded-xl group-hover:scale-110 transition-transform duration-200">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-6 text-xs text-slate-500 border-t border-slate-900 pt-4 flex justify-between">
                <span>Phase 4 Task Management</span>
                <span className="text-blue-400 font-medium group-hover:underline">View Projects</span>
              </div>
            </Link>

            {/* Timesheets Widget Card */}
            <Link
              href="/projects"
              className="bg-slate-900/30 border border-slate-900 hover:border-indigo-500/30 hover:bg-slate-900/40 rounded-2xl p-6 flex flex-col justify-between group transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/[0.02]"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="text-slate-400 text-sm font-semibold group-hover:text-slate-350 transition-colors">Time Logged</h4>
                  <p className="text-3xl font-extrabold text-slate-100 mt-1">{totalLoggedHours.toFixed(1)} hrs</p>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-800 text-emerald-400 rounded-xl group-hover:scale-110 transition-transform duration-200">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-6 text-xs text-slate-500 border-t border-slate-900 pt-4 flex justify-between">
                <span>Phase 7 Time Tracking</span>
                <span className="text-emerald-400 font-medium group-hover:underline">View Time Logs</span>
              </div>
            </Link>

            {/* Bugs/Issues Widget Card */}
            <div className="bg-slate-900/30 border border-slate-900 hover:border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between group transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/[0.02]">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="text-slate-400 text-sm font-semibold">Open Issues</h4>
                  <p className="text-3xl font-extrabold text-slate-100 mt-1">0</p>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-800 text-rose-400 rounded-xl group-hover:scale-110 transition-transform duration-200">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-6 text-xs text-slate-500 border-t border-slate-900 pt-4 flex justify-between">
                <span>Phase 8 Issue/Bug Tracking</span>
                <span className="text-rose-400 font-medium">Coming Soon</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
