'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useSidebar } from '@/hooks/useSidebar';
import {
  Home,
  FolderKanban,
  Users,
  Clock,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  CheckSquare,
} from 'lucide-react';

export default function Sidebar() {
  const { isOpen, isCollapsed, toggleSidebar, toggleCollapse, setIsOpen } = useSidebar();
  const pathname = usePathname();
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [recentProjectsOpen, setRecentProjectsOpen] = useState(true);

  // Fetch Projects for the "Recent Projects" list
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
  });

  const activeProjects = projects.filter((p: any) => p.status !== 'ARCHIVED').slice(0, 5);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  const navItemClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
      active
        ? 'bg-indigo-650/15 text-indigo-400'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
    }`;
  };

  const overviewItemClass = (path: string) => {
    const active = pathname === path;
    return `flex items-center gap-3 pl-8 pr-3 py-2 rounded-lg text-xs font-semibold transition-all ${
      active
        ? 'text-indigo-400 font-bold'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
    }`;
  };

  const recentItemClass = (path: string) => {
    const active = pathname === path;
    return `flex items-center gap-2 pl-8 pr-3 py-1.5 rounded-lg text-xs font-medium transition-all truncate ${
      active
        ? 'text-indigo-400 font-bold'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
    }`;
  };

  const collapsedItemClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center justify-center h-10 w-10 rounded-lg transition-all relative group ${
      active
        ? 'bg-indigo-650/15 text-indigo-400'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
    }`;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating Hamburger for Mobile */}
      <button
        onClick={toggleSidebar}
        className="fixed top-3.5 left-3.5 z-50 p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-850 shadow-lg md:hidden transition-all duration-150"
      >
        {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-card border-r border-border flex flex-col transition-all duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
          ${isCollapsed ? 'w-16' : 'w-64'}
        `}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-900/80">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 bg-gradient-to-tr from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/15">
                <FolderKanban className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
                PMS Portal
              </span>
            </div>
          ) : (
            <div className="mx-auto">
              <FolderKanban className="w-5 h-5 text-indigo-400" />
            </div>
          )}

          {/* Collapse Toggle Button (Desktop only) */}
          <button
            onClick={toggleCollapse}
            className="hidden md:flex p-1 text-slate-500 hover:text-slate-350 hover:bg-slate-900/60 rounded-md transition-all duration-150"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Body */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
          {isCollapsed ? (
            /* COLLAPSED ICONS ONLY VIEW */
            <div className="flex flex-col items-center gap-4">
              <Link href="/dashboard" className={collapsedItemClass('/dashboard')} title="Home">
                <Home className="w-5 h-5" />
                <span className="absolute left-12 bg-slate-900 border border-slate-800 text-slate-100 text-[10px] px-2.5 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-55 pointer-events-none whitespace-nowrap">
                  Home
                </span>
              </Link>
              <Link href="/projects" className={collapsedItemClass('/projects')} title="Projects">
                <FolderKanban className="w-5 h-5" />
                <span className="absolute left-12 bg-slate-900 border border-slate-800 text-slate-100 text-[10px] px-2.5 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-55 pointer-events-none whitespace-nowrap">
                  Projects
                </span>
              </Link>
              <Link href="/tasks" className={collapsedItemClass('/tasks')} title="Tasks">
                <CheckSquare className="w-5 h-5" />
                <span className="absolute left-12 bg-slate-900 border border-slate-800 text-slate-100 text-[10px] px-2.5 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-55 pointer-events-none whitespace-nowrap">
                  Tasks
                </span>
              </Link>
              <Link href="/issues" className={collapsedItemClass('/issues')} title="Issues">
                <AlertTriangle className="w-5 h-5" />
                <span className="absolute left-12 bg-slate-900 border border-slate-800 text-slate-100 text-[10px] px-2.5 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-55 pointer-events-none whitespace-nowrap">
                  Issues
                </span>
              </Link>
              <Link href="/milestones" className={collapsedItemClass('/milestones')} title="Milestones">
                <Calendar className="w-5 h-5" />
                <span className="absolute left-12 bg-slate-900 border border-slate-800 text-slate-100 text-[10px] px-2.5 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-55 pointer-events-none whitespace-nowrap">
                  Milestones
                </span>
              </Link>
              <Link href="/time-logs" className={collapsedItemClass('/time-logs')} title="Time Logs">
                <Clock className="w-5 h-5" />
                <span className="absolute left-12 bg-slate-900 border border-slate-800 text-slate-100 text-[10px] px-2.5 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-55 pointer-events-none whitespace-nowrap">
                  Time Logs
                </span>
              </Link>
            </div>
          ) : (
            /* EXPANDED SIDEBAR VIEW */
            <nav className="space-y-6">
              {/* Main Section */}
              <div className="space-y-1">
                <Link href="/dashboard" className={navItemClass('/dashboard')}>
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </Link>
                <Link href="/projects" className={navItemClass('/projects')}>
                  <FolderKanban className="w-4 h-4" />
                  <span>Projects</span>
                </Link>
                <div className="flex items-center gap-3 px-3 py-2.5 text-slate-600 cursor-not-allowed text-xs font-bold">
                  <Users className="w-4 h-4" />
                  <span>Collaboration</span>
                </div>
              </div>

              {/* Overview Section */}
              <div className="space-y-1">
                <button
                  onClick={() => setOverviewOpen(!overviewOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-350 uppercase tracking-wider transition-colors"
                >
                  <span>Overview</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${overviewOpen ? '' : '-rotate-90'}`} />
                </button>

                {overviewOpen && (
                  <div className="space-y-1 mt-1">
                    <Link href="/tasks" className={overviewItemClass('/tasks')}>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Tasks</span>
                    </Link>
                    <Link href="/issues" className={overviewItemClass('/issues')}>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Issues</span>
                    </Link>
                    <Link href="/milestones" className={overviewItemClass('/milestones')}>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Milestones</span>
                    </Link>
                    <Link href="/time-logs" className={overviewItemClass('/time-logs')}>
                      <Clock className="w-3.5 h-3.5" />
                      <span>Time Logs</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Recent Projects Section */}
              {activeProjects.length > 0 && (
                <div className="space-y-1">
                  <button
                    onClick={() => setRecentProjectsOpen(!recentProjectsOpen)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-350 uppercase tracking-wider transition-colors"
                  >
                    <span>Recent Projects</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${recentProjectsOpen ? '' : '-rotate-90'}`} />
                  </button>

                  {recentProjectsOpen && (
                    <div className="space-y-1 mt-1">
                      {activeProjects.map((proj: any) => (
                        <Link
                          key={proj.id}
                          href={`/projects/${proj.id}`}
                          className={recentItemClass(`/projects/${proj.id}`)}
                          title={proj.name}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                          <span>{proj.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </nav>
          )}
        </div>
      </aside>
    </>
  );
}
