'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  Clock,
  Plus,
  Calendar,
  DollarSign,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Sliders,
  LogOut,
  Settings,
} from 'lucide-react';
import GlobalTimeLogModal from '@/components/global-time-log-modal';
import NotificationBell from '@/components/notification-bell';
import Header from '@/components/header';
import Link from 'next/link';
import { useFormatDate } from '@/hooks/useFormatDate';

export default function TimeLogsPage() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Date Filtering Mode: 'week', 'custom', 'all'
  const [dateMode, setDateMode] = useState<'week' | 'custom' | 'all'>('week');
  const [weekOffset, setWeekOffset] = useState(0);

  // Custom Date range states
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Dropdown filter states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [billableFilter, setBillableFilter] = useState<'ALL' | 'BILLABLE' | 'NON_BILLABLE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNSUBMITTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'>('ALL');

  // Modal State
  const [showLogModal, setShowLogModal] = useState(false);

  // Helper to calculate week range
  const getWeekRange = (offset: number) => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(now.setDate(diff + offset * 7));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { start: monday, end: sunday };
  };

  const weekRange = getWeekRange(weekOffset);
  const formattedWeekStart = weekRange.start.toISOString().split('T')[0];
  const formattedWeekEnd = weekRange.end.toISOString().split('T')[0];

  // Resolve active API start/end date strings based on selection
  let activeStartDate = '';
  let activeEndDate = '';

  if (dateMode === 'week') {
    activeStartDate = formattedWeekStart;
    activeEndDate = formattedWeekEnd;
  } else if (dateMode === 'custom') {
    activeStartDate = customStartDate;
    activeEndDate = customEndDate;
  }

  // Query: Projects (for dropdown filtering)
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // Query: Org Members (for dropdown filtering, gated by permissions)
  const { data: orgMembers = [] } = useQuery({
    queryKey: ['orgMembers'],
    queryFn: async () => {
      const res = await api.get('/organization/members');
      return res.data;
    },
    enabled: isAuthenticated && hasPermission('APPROVE_TIMESHEET'),
  });

  // Query: All Time Entries with Filters
  const { data: logs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: [
      'global-time-entries',
      selectedProjectId,
      selectedUserId,
      activeStartDate,
      activeEndDate,
      billableFilter,
      statusFilter,
    ],
    queryFn: async () => {
      const params: any = {};
      if (selectedProjectId) params.projectId = selectedProjectId;
      if (selectedUserId) params.userId = selectedUserId;
      if (activeStartDate) params.startDate = activeStartDate;
      if (activeEndDate) params.endDate = activeEndDate;
      if (billableFilter !== 'ALL') params.billable = billableFilter === 'BILLABLE';
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await api.get('/time-entries', { params });
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // Mutation: Soft Archive Entry
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/time-entries/${id}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to archive time entry');
    },
  });

  const handleArchive = (id: string) => {
    if (confirm('Are you sure you want to delete this time entry?')) {
      archiveMutation.mutate(id);
    }
  };

  // Aggregation Calculations
  const totalHours = logs.reduce((sum: number, log: any) => sum + log.hours, 0);
  const billableHours = logs
    .filter((log: any) => log.billable)
    .reduce((sum: number, log: any) => sum + log.hours, 0);
  const nonBillableHours = totalHours - billableHours;

  const getEntryStatus = (log: any) => {
    if (!log.timesheet) return 'UNSUBMITTED';
    return log.timesheet.status;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider">
            Approved
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 uppercase tracking-wider">
            Pending
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 uppercase tracking-wider">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-800 border border-slate-700/60 text-slate-400 uppercase tracking-wider">
            Unsubmitted
          </span>
        );
    }
  };

  const handleLogout = async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  // Format week description, e.g. "Week 23 (01/06/2026 to 07/06/2026)"
  const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const currentWeekNumber = getWeekNumber(weekRange.start);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Header */}
      <Header title="Time Logs Dashboard" subtitle="Time Portal" />

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Top Aggregation Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-5 flex flex-col justify-between min-h-[105px] hover:border-slate-800 hover:shadow-lg transition-all duration-200 group">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" /> Total Hours Tracked
            </span>
            <div className="font-mono text-2xl font-black text-slate-100 mt-2">{totalHours.toFixed(1)}h</div>
          </div>

          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-5 flex flex-col justify-between min-h-[105px] hover:border-slate-800 hover:shadow-lg transition-all duration-200 group">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" /> Billable Hours
            </span>
            <div className="font-mono text-2xl font-black text-emerald-400 mt-2">{billableHours.toFixed(1)}h</div>
          </div>

          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-5 flex flex-col justify-between min-h-[105px] hover:border-slate-800 hover:shadow-lg transition-all duration-200 group">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500 group-hover:scale-110 transition-transform" /> Non-Billable Hours
            </span>
            <div className="font-mono text-2xl font-semibold text-slate-400 mt-2">{nonBillableHours.toFixed(1)}h</div>
          </div>
        </section>

        {/* Toolbar & Filters */}
        <section className="bg-slate-900/20 border border-slate-900 p-5 rounded-2xl space-y-4 backdrop-blur-md">
          {/* Top row: Date Range Selector and Universal Add Button */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Week Selector / Range Toggle */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                <button
                  onClick={() => setDateMode('week')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    dateMode === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Weekly Grid
                </button>
                <button
                  onClick={() => setDateMode('custom')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    dateMode === 'custom' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Custom Range
                </button>
                <button
                  onClick={() => setDateMode('all')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    dateMode === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Time
                </button>
              </div>

              {/* Weekly Navigation Controls */}
              {dateMode === 'week' && (
                <div className="flex items-center bg-slate-950 px-2 py-1 rounded-xl border border-slate-850 gap-3">
                  <button
                    onClick={() => setWeekOffset((prev) => prev - 1)}
                    className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-slate-250 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-bold text-slate-300 font-mono tracking-wide">
                    {formatDate(formattedWeekStart)} to {formatDate(formattedWeekEnd)} (Week {currentWeekNumber})
                  </span>
                  <button
                    onClick={() => setWeekOffset((prev) => prev + 1)}
                    className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-slate-250 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Custom Date Input Fields */}
              {dateMode === 'custom' && (
                <div className="flex items-center gap-2 animate-fade-in">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                  <span className="text-slate-500 text-xs">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>
              )}
            </div>

            {/* Universal Add Time Log Button */}
            {hasPermission('LOG_TIME_ENTRY') && (
              <button
                onClick={() => setShowLogModal(true)}
                className="px-4.5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-650/15 cursor-pointer self-start md:self-auto"
              >
                <Plus className="w-4 h-4" /> Add Time Log
              </button>
            )}
          </div>

          <div className="h-px bg-slate-900/60 w-full" />

          {/* Bottom row: Search Dropdown Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Project Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Projects</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* User Filter (Admins/Managers only) */}
            {hasPermission('APPROVE_TIMESHEET') ? (
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Logged By</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Everyone</option>
                  {orgMembers.map((om: any) => (
                    <option key={om.userId} value={om.userId}>
                      {om.user.firstName ? `${om.user.firstName} ${om.user.lastName || ''}` : om.user.email}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Logged By</label>
                <input
                  type="text"
                  disabled
                  value={`${user?.firstName} ${user?.lastName || ''}`}
                  className="w-full px-3 py-2 bg-slate-950/50 border border-slate-900 rounded-xl text-slate-500 text-xs cursor-not-allowed"
                />
              </div>
            )}

            {/* Billing Type Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Billing Type</label>
              <select
                value={billableFilter}
                onChange={(e) => setBillableFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Log Types</option>
                <option value="BILLABLE">Billable Only</option>
                <option value="NON_BILLABLE">Non-Billable Only</option>
              </select>
            </div>

            {/* Approval Status Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="UNSUBMITTED">Unsubmitted (Draft)</option>
                <option value="SUBMITTED">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </section>

        {/* Logs Table Section */}
        <section className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden">
          {isLoadingLogs ? (
            <div className="py-16 flex flex-col justify-center items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-400">Loading general time entries...</span>
            </div>
          ) : logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Project</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Task</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Billable</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Hours</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {logs.map((log: any) => {
                    const entryStatus = getEntryStatus(log);
                    const isLocked = entryStatus === 'SUBMITTED' || entryStatus === 'APPROVED';
                    return (
                      <tr key={log.id} className="hover:bg-slate-900/25 transition-colors group">
                        <td className="px-6 py-3.5">
                          <span className="font-semibold text-slate-200">
                            {log.user.firstName ? `${log.user.firstName} ${log.user.lastName || ''}` : log.user.email}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/projects/${log.projectId}`}
                            className="font-bold text-slate-300 hover:text-indigo-400 transition-colors"
                          >
                            {log.project.name}
                          </Link>
                        </td>
                        <td className="px-6 py-3.5 text-slate-400 font-medium">
                          {formatDate(log.loggedAt)}
                        </td>
                        <td className="px-6 py-3.5">
                          {log.task ? (
                            <span className="font-mono text-[10px] bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-indigo-400 font-bold">
                              {log.project.projectCode}-{log.task.taskNumber}
                            </span>
                          ) : (
                            <span className="text-slate-550 italic text-[10px]">Project Level</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-slate-350 max-w-[220px] truncate" title={log.description}>
                          {log.description || <span className="text-slate-600 italic">No notes</span>}
                        </td>
                        <td className="px-6 py-3.5">
                          {log.billable ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Yes
                            </span>
                          ) : (
                            <span className="text-slate-500 flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-700" /> No
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          {getStatusBadge(entryStatus)}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-200">
                          {log.hours.toFixed(2)}h
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {isLocked ? (
                            <span className="text-slate-655 text-[10px] italic" title="Locked in a submitted or approved timesheet">
                              Locked
                            </span>
                          ) : (
                            hasPermission('ARCHIVE_TIME_ENTRY') && (
                              <button
                                onClick={() => handleArchive(log.id)}
                                disabled={archiveMutation.isPending}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-50"
                                title="Delete Log Entry"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-20">
              <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3.5" />
              <h3 className="text-sm font-bold text-slate-250">No time logs found</h3>
              <p className="text-xs text-slate-500 mt-1">Adjust filters or add a new entry to get started.</p>
            </div>
          )}
        </section>
      </main>

      {/* Reusable Global Modal Dialog */}
      <GlobalTimeLogModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
      />
    </div>
  );
}
