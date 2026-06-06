'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  LogOut,
  Shield,
  ShieldCheck,
  User,
  Users,
  FolderKanban,
  Clock,
  AlertTriangle,
  Loader2,
  Settings,
  Sliders,
  Calendar,
  CheckCircle2,
  TrendingUp,
  FileText,
  ChevronRight,
} from 'lucide-react';
import NotificationBell from '@/components/notification-bell';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<string>('14d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (range === 'custom') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 14);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [range]);

  const { data: report, isLoading: isLoadingReport, error } = useQuery({
    queryKey: ['dashboard-reports', range, startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = { range };
      if (range === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      const res = await api.get('/dashboard/reports/summary', { params });
      return res.data;
    },
    enabled: isAuthenticated && mounted && (range !== 'custom' || (!!startDate && !!endDate)),
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading || !isAuthenticated || !mounted) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const handleCustomRangeApply = () => {
    // Queries will automatically trigger because state is bound to queryKey
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
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
            <NotificationBell />
            <Link
              href="/settings/notifications"
              className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all duration-150 flex items-center gap-2 text-sm"
              title="Notification Preferences"
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">Preferences</span>
            </Link>
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

        {/* Dashboard Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/20 p-4 border border-slate-900 rounded-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Dashboard Range:</span>
            </div>

            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
              {['7d', '14d', '30d', 'custom'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setRange(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${range === opt
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  {opt === 'custom' ? 'Custom' : opt === '7d' ? '7 Days' : opt === '14d' ? '14 Days' : '30 Days'}
                </button>
              ))}
            </div>

            {range === 'custom' && (
              <div className="flex items-center gap-2 animate-fade-in">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-250 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                />
                <span className="text-slate-500 text-xs">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-250 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                />
              </div>
            )}
          </div>

          <Link
            href="/projects"
            className="px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-650/10"
          >
            Manage Projects
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoadingReport ? (
          <div className="py-24 flex justify-center">
            <div className="text-center space-y-4">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Compiling your workspace metrics...</p>
            </div>
          </div>
        ) : error || !report ? (
          <div className="bg-rose-950/20 border border-rose-900/60 p-6 rounded-2xl text-rose-200 text-sm">
            Failed to fetch global dashboard analytics. Please verify server connectivity.
          </div>
        ) : (
          <div className="space-y-8">
            {/* Metrics Ribbon Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Active Projects */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 md:p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Projects</span>
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                    <FolderKanban className="w-4.5 h-4.5 text-indigo-400" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-black text-slate-50">{report.metrics.activeProjectsCount}</span>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-1.5">Organization Projects</p>
                </div>
              </div>

              {/* My Open Tasks */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 md:p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">My Open Tasks</span>
                  <div className="p-1.5 bg-blue-500/10 rounded-lg">
                    <Users className="w-4.5 h-4.5 text-blue-400" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-black text-slate-50">{report.metrics.openAssignedTasks}</span>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-1.5">Assigned to me</p>
                </div>
              </div>

              {/* My Overdue Tasks */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 md:p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">My Overdue Tasks</span>
                  <div className="p-1.5 bg-rose-500/10 rounded-lg">
                    <AlertTriangle className="w-4.5 h-4.5 text-rose-450" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-black text-rose-400">{report.metrics.overdueAssignedTasks}</span>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-1.5">Action required</p>
                </div>
              </div>

              {/* Logged This Week */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 md:p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Logged This Week</span>
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                    <Clock className="w-4.5 h-4.5 text-emerald-450" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-black text-slate-50">{report.metrics.hoursLoggedThisWeek.toFixed(1)}h</span>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-1.5">Time sheet totals</p>
                </div>
              </div>
            </div>

            {/* Middle Section: Daily Tracked Hours & Security Credentials */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Daily Logged Hours Graph */}
              <article className="lg:col-span-2 bg-slate-900/30 border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
                <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  Daily Tracked Time Logs (Hours)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.dailyLoggedHours} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorDashboardHours" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="date"
                        stroke="#475569"
                        fontSize={9}
                        tickLine={false}
                        tickFormatter={(tick) => tick.substring(5)}
                      />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #1e293b',
                          borderRadius: '12px',
                          fontSize: '11px',
                          color: '#f8fafc',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="hours"
                        name="Hours Logged"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorDashboardHours)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </article>

              {/* Security Credentials */}
              <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-900 mb-5">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-bold text-slate-200">Security Credentials</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                      Assigned Permissions
                    </div>
                    <ul className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                      {user?.permissions.map((permission) => (
                        <li
                          key={permission}
                          className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-slate-800/60 rounded-xl text-[10px] text-slate-350"
                        >
                          <ShieldCheck className="w-4.5 h-4.5 text-indigo-450 flex-shrink-0" />
                          <span className="font-mono">{permission}</span>
                        </li>
                      ))}
                      {(!user?.permissions || user.permissions.length === 0) && (
                        <li className="text-sm text-slate-500 italic">No permissions assigned</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 uppercase border-t border-slate-900 pt-4 mt-4 text-center">
                  Organization ID: <span className="font-mono text-slate-400">{user?.organizationId}</span>
                </div>
              </article>
            </div>

            {/* Bottom Section: Active Projects Progress Table & Recent Time Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Projects Summary */}
              <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 overflow-hidden">
                <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-indigo-400" />
                  Active Projects Progress
                </h3>
                {report.projects.length > 0 ? (
                  <div className="space-y-4">
                    {report.projects.map((p: any) => (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="block p-4 bg-slate-950/60 border border-slate-900 rounded-xl hover:border-indigo-500/20 hover:bg-slate-950 transition-all group"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition-colors truncate">
                              {p.name}
                            </span>
                            <span className="font-mono text-[8px] px-1.5 py-0.5 bg-slate-900 border border-slate-850 rounded text-slate-400">
                              {p.projectCode}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {p.completedTasks} / {p.totalTasks} Tasks
                          </span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mb-2 border border-slate-850">
                          <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase">
                          <span>{Math.round(p.progress)}% Complete</span>
                          <span className="text-violet-400">Milestones: {p.achievedMilestones} / {p.totalMilestones}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-xs py-12 text-center">No active projects available</div>
                )}
              </article>

              {/* Recent Time Logs */}
              <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 overflow-hidden">
                <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  My Recent Time Logs
                </h3>
                {report.recentLogs.length > 0 ? (
                  <div className="space-y-3.5">
                    {report.recentLogs.map((rl: any) => (
                      <div
                        key={rl.id}
                        className="p-3.5 bg-slate-950/60 border border-slate-900 rounded-xl flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {rl.projectName}
                            </span>
                            {rl.taskNumber && (
                              <span className="font-mono text-[8.5px] px-1.5 py-0.2 bg-slate-900 border border-slate-850 rounded text-slate-400">
                                {rl.taskNumber}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-xs text-slate-200 truncate leading-snug">{rl.taskTitle}</h4>
                          {rl.description && (
                            <p className="text-[10px] text-slate-500 truncate italic">"{rl.description}"</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-500/5 px-2.5 py-1 rounded border border-emerald-500/10">
                            {rl.hours.toFixed(1)} hrs
                          </span>
                          <p className="text-[8.5px] text-slate-500 mt-1">
                            {new Date(rl.loggedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-8 h-8 text-slate-650 mx-auto opacity-40 mb-2" />
                    <p className="text-slate-500 text-xs">No time logs tracked recently</p>
                  </div>
                )}
              </article>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
