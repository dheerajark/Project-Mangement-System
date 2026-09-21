'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import TaskDetailDrawer from '@/components/task-detail-drawer';
import {
  Clock,
  DollarSign,
  TrendingUp,
  Download,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  CheckSquare,
  Search,
  RefreshCw,
  Layers,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Loader2,
  FileSpreadsheet,
  ArrowUpRight,
  ListTodo,
  Sparkles,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface TimesheetReportsViewProps {
  initialProjectId?: string;
  isProjectLevel?: boolean;
}

export default function TimesheetReportsView({
  initialProjectId = '',
  isProjectLevel = false,
}: TimesheetReportsViewProps) {
  const { user, isAuthenticated, hasPermission } = useAuth();
  const router = useRouter();

  // Hydration safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter States
  const [projectId, setProjectId] = useState<string>(initialProjectId || 'ALL');
  const [userId, setUserId] = useState<string>('ALL');
  const [range, setRange] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [billableFilter, setBillableFilter] = useState<'ALL' | 'BILLABLE' | 'NON_BILLABLE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'>('ALL');

  // Summary Tab State: 'projects' | 'users' | 'tasks' | 'daily'
  const [summaryTab, setSummaryTab] = useState<'projects' | 'users' | 'tasks' | 'daily'>(
    isProjectLevel ? 'tasks' : 'projects',
  );

  // Table Searches
  const [projectSearch, setProjectSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [dailySearch, setDailySearch] = useState('');
  const [detailedSearch, setDetailedSearch] = useState('');

  // Table Sorting
  const [sortField, setSortField] = useState<string>('totalHours');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [detailedSortField, setDetailedSortField] = useState<string>('loggedAt');
  const [detailedSortOrder, setDetailedSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination for Detailed Table
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Interactive Task Drawer
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskProjectId, setSelectedTaskProjectId] = useState<string>('');
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);

  // Export Loading State
  const [isExporting, setIsExporting] = useState(false);

  // Auto set dates when 'custom' is selected
  useEffect(() => {
    if (range === 'custom' && !startDate && !endDate) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [range, startDate, endDate]);

  // If initialProjectId changes, sync
  useEffect(() => {
    if (initialProjectId) {
      setProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  // Check if current user can view all members' timesheets
  const canViewAll =
    hasPermission('APPROVE_TIMESHEET') ||
    user?.roles?.some((r) => r.toUpperCase().includes('ADMIN')) ||
    false;

  // 1. Query Projects for filter dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isAuthenticated && !isProjectLevel,
  });

  // 2. Query Org Members for filter dropdown (if authorized)
  const { data: orgMembers = [] } = useQuery({
    queryKey: ['org-members-timesheet-filter'],
    queryFn: async () => {
      const res = await api.get('/organization/members');
      return res.data;
    },
    enabled: isAuthenticated && canViewAll,
  });

  // 3. Query Timesheet Report Summary & Analytics
  const {
    data: report,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: [
      'timesheet-report-summary',
      projectId,
      userId,
      range,
      startDate,
      endDate,
      billableFilter,
      statusFilter,
      isProjectLevel,
    ],
    queryFn: async () => {
      const params: Record<string, any> = { range };

      if (projectId && projectId !== 'ALL') params.projectId = projectId;
      if (userId && userId !== 'ALL') params.userId = userId;
      if (range === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      if (billableFilter === 'BILLABLE') params.billable = 'true';
      if (billableFilter === 'NON_BILLABLE') params.billable = 'false';
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const endpoint =
        isProjectLevel && projectId
          ? `/projects/${projectId}/reports/timesheets`
          : `/reports/timesheets`;

      const res = await api.get(endpoint, { params });
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // Handle CSV Export
  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const params: Record<string, any> = { range };

      if (projectId && projectId !== 'ALL') params.projectId = projectId;
      if (userId && userId !== 'ALL') params.userId = userId;
      if (range === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      if (billableFilter === 'BILLABLE') params.billable = 'true';
      if (billableFilter === 'NON_BILLABLE') params.billable = 'false';
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const endpoint =
        isProjectLevel && projectId
          ? `/projects/${projectId}/reports/timesheets/export`
          : `/reports/timesheets/export`;

      const res = await api.get(endpoint, {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = isProjectLevel
        ? `project-timesheet-report-${projectId}.csv`
        : `timesheet-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export timesheet report CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered & Sorted Project Summaries
  const filteredProjectSummaries = useMemo(() => {
    if (!report?.projectSummaries) return [];
    return report.projectSummaries
      .filter((p: any) => {
        if (!projectSearch) return true;
        const q = projectSearch.toLowerCase();
        return (
          p.projectName.toLowerCase().includes(q) ||
          p.projectCode.toLowerCase().includes(q)
        );
      })
      .sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') {
          return sortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
      });
  }, [report?.projectSummaries, projectSearch, sortField, sortOrder]);

  // Filtered & Sorted User Summaries
  const filteredUserSummaries = useMemo(() => {
    if (!report?.userSummaries) return [];
    return report.userSummaries
      .filter((u: any) => {
        if (!userSearch) return true;
        const q = userSearch.toLowerCase();
        return (
          u.userName.toLowerCase().includes(q) ||
          u.userEmail.toLowerCase().includes(q)
        );
      })
      .sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') {
          return sortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
      });
  }, [report?.userSummaries, userSearch, sortField, sortOrder]);

  // Filtered & Sorted Task Summaries
  const filteredTaskSummaries = useMemo(() => {
    if (!report?.taskSummaries) return [];
    return report.taskSummaries
      .filter((t: any) => {
        if (!taskSearch) return true;
        const q = taskSearch.toLowerCase();
        return (
          t.taskTitle.toLowerCase().includes(q) ||
          t.taskNumber.toLowerCase().includes(q) ||
          t.projectName.toLowerCase().includes(q) ||
          t.taskListName.toLowerCase().includes(q) ||
          t.assigneeName.toLowerCase().includes(q)
        );
      })
      .sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') {
          return sortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
      });
  }, [report?.taskSummaries, taskSearch, sortField, sortOrder]);

  // Filtered & Sorted Daily Breakdown
  const filteredDailyBreakdown = useMemo(() => {
    if (!report?.dailyHours) return [];
    return report.dailyHours
      .filter((d: any) => {
        if (!dailySearch) return true;
        return d.date.includes(dailySearch);
      })
      .sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') {
          return sortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
      });
  }, [report?.dailyHours, dailySearch, sortField, sortOrder]);

  // Filtered & Sorted Detailed Entries
  const filteredDetailedEntries = useMemo(() => {
    if (!report?.detailedEntries) return [];
    return report.detailedEntries
      .filter((e: any) => {
        if (!detailedSearch) return true;
        const q = detailedSearch.toLowerCase();
        return (
          e.userName.toLowerCase().includes(q) ||
          e.taskTitle.toLowerCase().includes(q) ||
          e.taskNumber.toLowerCase().includes(q) ||
          e.projectName.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q))
        );
      })
      .sort((a: any, b: any) => {
        let valA = a[detailedSortField];
        let valB = b[detailedSortField];
        if (detailedSortField === 'loggedAt') {
          const dateA = new Date(valA).getTime();
          const dateB = new Date(valB).getTime();
          return detailedSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        }
        if (typeof valA === 'string') {
          return detailedSortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        return detailedSortOrder === 'asc'
          ? (valA || 0) - (valB || 0)
          : (valB || 0) - (valA || 0);
      });
  }, [report?.detailedEntries, detailedSearch, detailedSortField, detailedSortOrder]);

  // Paginated Detailed Entries
  const totalPages = Math.ceil(filteredDetailedEntries.length / pageSize) || 1;
  const paginatedEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDetailedEntries.slice(start, start + pageSize);
  }, [filteredDetailedEntries, page, pageSize]);

  // Chart Data: Billable vs Non-Billable Donut
  const billableChartData = useMemo(() => {
    if (!report?.kpis) return [];
    return [
      {
        name: 'Billable Hours',
        value: report.kpis.billableHours || 0,
        color: '#10b981', // Emerald
      },
      {
        name: 'Non-Billable Hours',
        value: report.kpis.nonBillableHours || 0,
        color: '#64748b', // Slate
      },
    ].filter((d) => d.value > 0);
  }, [report?.kpis]);

  // Helper for sorting headers
  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const toggleDetailedSort = (field: string) => {
    if (detailedSortField === field) {
      setDetailedSortOrder(detailedSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setDetailedSortField(field);
      setDetailedSortOrder('desc');
    }
  };

  const renderSortIndicator = (field: string, currentField: string, currentOrder: 'asc' | 'desc') => {
    if (currentField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-600 inline ml-1" />;
    }
    return currentOrder === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-indigo-400 inline ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-indigo-400 inline ml-1" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-400 text-sm font-medium">
          Aggregating timesheet analytics & time logs...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-base font-semibold text-rose-300">
          Failed to Load Timesheet Reports
        </h3>
        <p className="text-xs text-rose-400/80 max-w-md mx-auto">
          {(error as any)?.response?.data?.message ||
            'An error occurred while aggregating timesheet reports. Please verify your permissions.'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try Again
        </button>
      </div>
    );
  }

  const kpis = report?.kpis || {
    totalHours: 0,
    billableHours: 0,
    nonBillableHours: 0,
    billablePercentage: 0,
    totalEntries: 0,
    totalUsers: 0,
    totalProjects: 0,
    totalTasks: 0,
  };

  const statusBreakdown = report?.statusBreakdown || {
    draftHours: 0,
    draftCount: 0,
    submittedHours: 0,
    submittedCount: 0,
    approvedHours: 0,
    approvedCount: 0,
    rejectedHours: 0,
    rejectedCount: 0,
  };

  return (
    <div className="space-y-6">
      {/* 1. FILTER CONTROLS BAR */}
      <div className="bg-slate-900/40 border border-slate-850 backdrop-blur-xl rounded-2xl p-4 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Timesheet Filters
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Report Data"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-400 ${isRefetching ? 'animate-spin' : ''}`}
              />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={isExporting || kpis.totalEntries === 0}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              title="Export Timesheet Data to CSV"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Date Range Preset */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Date Range
            </label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Project Selector (if portal-level) */}
          {!isProjectLevel ? (
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Projects</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectCode || 'PRJ'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Scope
              </label>
              <div className="px-3 py-2 bg-slate-950/70 border border-slate-850/60 rounded-xl text-slate-400 text-xs truncate">
                Current Project
              </div>
            </div>
          )}

          {/* User Selector (if authorized) */}
          {canViewAll ? (
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Team Member
              </label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Team Members</option>
                {orgMembers.map((m: any) => {
                  const name =
                    `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim() ||
                    m.user?.email;
                  return (
                    <option key={m.userId || m.id} value={m.userId || m.id}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                User
              </label>
              <div className="px-3 py-2 bg-slate-950/70 border border-slate-850/60 rounded-xl text-slate-400 text-xs truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.email} (Your logs)
              </div>
            </div>
          )}

          {/* Billable Status */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Billing Status
            </label>
            <select
              value={billableFilter}
              onChange={(e) => setBillableFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Hours (Billable & Non-Billable)</option>
              <option value="BILLABLE">Billable Only</option>
              <option value="NON_BILLABLE">Non-Billable Only</option>
            </select>
          </div>

          {/* Timesheet Approval Status */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Approval Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="DRAFT">Draft / Unsubmitted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Pickers (conditional) */}
        {range === 'custom' && (
          <div className="pt-2 border-t border-slate-850/80 flex flex-wrap items-center gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400">Start Date:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400">End Date:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Logged Hours */}
        <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 shadow-lg flex flex-col justify-between hover:border-slate-800 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Hours</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-100 tracking-tight">
              {kpis.totalHours} <span className="text-xs font-normal text-slate-400">hrs</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Across all logged time</p>
          </div>
        </div>

        {/* Billable Hours */}
        <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 shadow-lg flex flex-col justify-between hover:border-slate-800 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Billable</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400 tracking-tight">
              {kpis.billableHours} <span className="text-xs font-normal text-emerald-400/70">hrs</span>
            </div>
            <div className="mt-1">
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {kpis.billablePercentage}% Billable
              </span>
            </div>
          </div>
        </div>

        {/* Non-Billable Hours */}
        <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 shadow-lg flex flex-col justify-between hover:border-slate-800 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Non-Billable</span>
            <div className="p-2 bg-slate-800 text-slate-400 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-300 tracking-tight">
              {kpis.nonBillableHours} <span className="text-xs font-normal text-slate-400">hrs</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {100 - kpis.billablePercentage}% Internal / Non-billable
            </p>
          </div>
        </div>

        {/* Total Time Entries */}
        <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 shadow-lg flex flex-col justify-between hover:border-slate-800 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Time Entries</span>
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
              <ListTodo className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-100 tracking-tight">
              {kpis.totalEntries}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Logged records</p>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 shadow-lg flex flex-col justify-between hover:border-slate-800 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active Users</span>
            <div className="p-2 bg-violet-500/10 text-violet-400 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-100 tracking-tight">
              {kpis.totalUsers}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Who logged work</p>
          </div>
        </div>

        {/* Timesheet Approval Status Summary */}
        <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 shadow-lg flex flex-col justify-between hover:border-slate-800 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Approved Hours</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400 tracking-tight">
              {statusBreakdown.approvedHours} <span className="text-xs font-normal text-emerald-400/70">hrs</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {statusBreakdown.submittedHours} hrs pending approval
            </p>
          </div>
        </div>
      </div>

      {/* 3. VISUAL CHARTS & BREAKDOWNS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Logged Hours (Bar Chart) */}
        <div className="lg:col-span-2 bg-slate-900/30 border border-slate-850 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Daily Logged Hours Breakdown</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Comparison of daily billable vs non-billable hours
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Billable
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-600" /> Non-Billable
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {mounted && report?.dailyHours && report.dailyHours.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.dailyHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={10}
                    tickFormatter={(val) => {
                      const parts = val.split('-');
                      return parts.length === 3 ? `${parts[1]}/${parts[2]}` : val;
                    }}
                  />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const billable = payload.find((p) => p.dataKey === 'billableHours')?.value || 0;
                        const nonBillable = payload.find((p) => p.dataKey === 'nonBillableHours')?.value || 0;
                        const total = (Number(billable) + Number(nonBillable)).toFixed(2);
                        return (
                          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-2xl space-y-1 text-xs">
                            <div className="font-semibold text-slate-200">{label}</div>
                            <div className="text-emerald-400 font-medium">Billable: {billable} hrs</div>
                            <div className="text-slate-400 font-medium">Non-Billable: {nonBillable} hrs</div>
                            <div className="text-indigo-300 font-bold border-t border-slate-800 pt-1">
                              Total: {total} hrs
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="billableHours" stackId="hours" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="nonBillableHours" stackId="hours" fill="#64748b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                <Clock className="w-8 h-8 text-slate-700 mb-2" />
                No daily time entries found for selected filters
              </div>
            )}
          </div>
        </div>

        {/* Billable Ratio & Approval Status */}
        <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div className="mb-3">
            <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Billable vs Non-Billable</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Billing allocation distribution</p>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            {mounted && billableChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={billableChartData}
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {billableChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0];
                        return (
                          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl shadow-2xl text-xs">
                            <div className="font-semibold text-slate-200">{item.name}</div>
                            <div className="text-indigo-400 font-bold">{item.value} hrs</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500 text-xs">No hours recorded</div>
            )}
          </div>

          {/* Status Breakdown Indicators */}
          <div className="pt-3 border-t border-slate-850 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Timesheet Status
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <span className="text-emerald-400 font-medium">Approved</span>
                <span className="text-emerald-300 font-bold">{statusBreakdown.approvedHours}h</span>
              </div>
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                <span className="text-blue-400 font-medium">Submitted</span>
                <span className="text-blue-300 font-bold">{statusBreakdown.submittedHours}h</span>
              </div>
              <div className="p-2 bg-slate-800/60 border border-slate-700/50 rounded-xl flex items-center justify-between">
                <span className="text-slate-400 font-medium">Draft</span>
                <span className="text-slate-300 font-bold">{statusBreakdown.draftHours}h</span>
              </div>
              <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
                <span className="text-rose-400 font-medium">Rejected</span>
                <span className="text-rose-300 font-bold">{statusBreakdown.rejectedHours}h</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. AGGREGATED SUMMARY TABLES (PROJECT / USER / TASK / DAILY) */}
      <div className="bg-slate-900/30 border border-slate-850 rounded-2xl shadow-xl overflow-hidden">
        {/* Tab Controls & Search */}
        <div className="p-4 sm:p-5 border-b border-slate-850 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-850 rounded-xl">
            {!isProjectLevel && (
              <button
                onClick={() => setSummaryTab('projects')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  summaryTab === 'projects'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Project-wise ({report?.projectSummaries?.length || 0})
              </button>
            )}

            <button
              onClick={() => setSummaryTab('users')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                summaryTab === 'users'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              User-wise ({report?.userSummaries?.length || 0})
            </button>

            <button
              onClick={() => setSummaryTab('tasks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                summaryTab === 'tasks'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Task-wise ({report?.taskSummaries?.length || 0})
            </button>

            <button
              onClick={() => setSummaryTab('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                summaryTab === 'daily'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Daily Breakdown ({report?.dailyHours?.length || 0})
            </button>
          </div>

          {/* Search Input for Active Tab */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            {summaryTab === 'projects' && (
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            )}
            {summaryTab === 'users' && (
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search team members..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            )}
            {summaryTab === 'tasks' && (
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Search tasks or code..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            )}
            {summaryTab === 'daily' && (
              <input
                type="text"
                value={dailySearch}
                onChange={(e) => setDailySearch(e.target.value)}
                placeholder="Filter by date YYYY-MM-DD..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            )}
          </div>
        </div>

        {/* 4A. Project-wise Hours Table */}
        {summaryTab === 'projects' && !isProjectLevel && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-850">
                <tr>
                  <th
                    onClick={() => toggleSort('projectName')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    Project {renderSortIndicator('projectName', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('totalHours')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Total Hours {renderSortIndicator('totalHours', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('billableHours')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Billable {renderSortIndicator('billableHours', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('nonBillableHours')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Non-Billable {renderSortIndicator('nonBillableHours', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('entriesCount')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Entries {renderSortIndicator('entriesCount', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('usersCount')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Members {renderSortIndicator('usersCount', sortField, sortOrder)}
                  </th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-950/20">
                {filteredProjectSummaries.length > 0 ? (
                  filteredProjectSummaries.map((p: any) => (
                    <tr key={p.projectId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-100 flex items-center gap-2">
                          <FolderKanban className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          <span>{p.projectName}</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            ({p.projectCode})
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right font-bold text-slate-100">
                        {p.totalHours} hrs
                      </td>
                      <td className="px-6 py-3.5 text-right text-emerald-400 font-semibold">
                        {p.billableHours} hrs
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-400">
                        {p.nonBillableHours} hrs
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-300">{p.entriesCount}</td>
                      <td className="px-6 py-3.5 text-right text-slate-300">{p.usersCount}</td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => router.push(`/projects/${p.projectId}`)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-indigo-400 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <span>Open</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      No project summary entries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4B. User-wise Hours Table */}
        {summaryTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-850">
                <tr>
                  <th
                    onClick={() => toggleSort('userName')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    Team Member {renderSortIndicator('userName', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('totalHours')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Total Hours {renderSortIndicator('totalHours', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('billableHours')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Billable {renderSortIndicator('billableHours', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('nonBillableHours')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Non-Billable {renderSortIndicator('nonBillableHours', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('entriesCount')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Entries Count {renderSortIndicator('entriesCount', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('projectsCount')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Projects {renderSortIndicator('projectsCount', sortField, sortOrder)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-950/20">
                {filteredUserSummaries.length > 0 ? (
                  filteredUserSummaries.map((u: any) => (
                    <tr key={u.userId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold text-[10px]">
                            {u.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-100">{u.userName}</div>
                            <div className="text-[10px] text-slate-500">{u.userEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right font-bold text-slate-100">
                        {u.totalHours} hrs
                      </td>
                      <td className="px-6 py-3.5 text-right text-emerald-400 font-semibold">
                        {u.billableHours} hrs
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-400">
                        {u.nonBillableHours} hrs
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-300">{u.entriesCount}</td>
                      <td className="px-6 py-3.5 text-right text-slate-300">{u.projectsCount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No team member summary entries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4C. Task-wise Hours Table */}
        {summaryTab === 'tasks' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-850">
                <tr>
                  <th
                    onClick={() => toggleSort('taskTitle')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    Task {renderSortIndicator('taskTitle', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('projectName')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    Project / List {renderSortIndicator('projectName', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('assigneeName')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    Assignee {renderSortIndicator('assigneeName', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('totalHours')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Total Hours {renderSortIndicator('totalHours', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('billableHours')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Billable {renderSortIndicator('billableHours', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('nonBillableHours')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Non-Billable {renderSortIndicator('nonBillableHours', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('entriesCount')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Entries {renderSortIndicator('entriesCount', sortField, sortOrder)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-950/20">
                {filteredTaskSummaries.length > 0 ? (
                  filteredTaskSummaries.map((t: any, idx: number) => (
                    <tr key={t.taskId || `notask-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3.5">
                        {t.taskId ? (
                          <button
                            onClick={() => {
                              setSelectedTaskId(t.taskId);
                              setSelectedTaskProjectId(t.projectId || projectId || '');
                              setIsTaskDrawerOpen(true);
                            }}
                            className="font-semibold text-slate-100 hover:text-indigo-400 text-left flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-400 font-mono">
                              {t.taskNumber}
                            </span>
                            <span>{t.taskTitle}</span>
                          </button>
                        ) : (
                          <div className="font-semibold text-slate-400 flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-500 font-mono">
                              -
                            </span>
                            <span>{t.taskTitle}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="text-slate-300">{t.projectName}</div>
                        <div className="text-[10px] text-slate-500">{t.taskListName}</div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-300">{t.assigneeName}</td>
                      <td className="px-6 py-3.5 text-right font-bold text-slate-100">
                        {t.totalHours} hrs
                      </td>
                      <td className="px-6 py-3.5 text-right text-emerald-400 font-semibold">
                        {t.billableHours} hrs
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-400">
                        {t.nonBillableHours} hrs
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-300">{t.entriesCount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      No task summary entries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4D. Daily Breakdown Table */}
        {summaryTab === 'daily' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-850">
                <tr>
                  <th
                    onClick={() => toggleSort('date')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    Date {renderSortIndicator('date', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('totalHours')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Total Hours {renderSortIndicator('totalHours', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('billableHours')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Billable Hours {renderSortIndicator('billableHours', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('nonBillableHours')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Non-Billable Hours {renderSortIndicator('nonBillableHours', sortField, sortOrder)}
                  </th>
                  <th
                    onClick={() => toggleSort('entriesCount')}
                    className="px-6 py-3.5 cursor-pointer hover:text-slate-200 transition-colors text-right"
                  >
                    Time Entries {renderSortIndicator('entriesCount', sortField, sortOrder)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-950/20">
                {filteredDailyBreakdown.length > 0 ? (
                  filteredDailyBreakdown.map((d: any) => (
                    <tr key={d.date} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3.5 font-semibold text-slate-100 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{d.date}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-bold text-slate-100">
                        {d.totalHours} hrs
                      </td>
                      <td className="px-6 py-3.5 text-right text-emerald-400 font-semibold">
                        {d.billableHours} hrs
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-400">
                        {d.nonBillableHours} hrs
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-300">{d.entriesCount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No daily breakdown records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. DETAILED TIMESHEET TABLE */}
      <div className="bg-slate-900/30 border border-slate-850 rounded-2xl shadow-xl overflow-hidden space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-indigo-400" />
              <span>Detailed Time Log Records</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Individual time entries ({filteredDetailedEntries.length} total)
            </p>
          </div>

          {/* Search bar for detailed entries */}
          <div className="relative min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={detailedSearch}
              onChange={(e) => {
                setDetailedSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search user, task, notes..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-850/80">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-850">
              <tr>
                <th
                  onClick={() => toggleDetailedSort('loggedAt')}
                  className="px-4 py-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  Date {renderSortIndicator('loggedAt', detailedSortField, detailedSortOrder)}
                </th>
                <th
                  onClick={() => toggleDetailedSort('userName')}
                  className="px-4 py-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  User {renderSortIndicator('userName', detailedSortField, detailedSortOrder)}
                </th>
                <th
                  onClick={() => toggleDetailedSort('projectName')}
                  className="px-4 py-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  Project {renderSortIndicator('projectName', detailedSortField, detailedSortOrder)}
                </th>
                <th
                  onClick={() => toggleDetailedSort('taskTitle')}
                  className="px-4 py-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  Task {renderSortIndicator('taskTitle', detailedSortField, detailedSortOrder)}
                </th>
                <th
                  onClick={() => toggleDetailedSort('hours')}
                  className="px-4 py-3 cursor-pointer hover:text-slate-200 transition-colors text-right"
                >
                  Hours {renderSortIndicator('hours', detailedSortField, detailedSortOrder)}
                </th>
                <th className="px-4 py-3 text-center">Billing</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 bg-slate-950/20">
              {paginatedEntries.length > 0 ? (
                paginatedEntries.map((e: any) => {
                  const dateFormatted = e.loggedAt
                    ? new Date(e.loggedAt).toISOString().split('T')[0]
                    : '';

                  return (
                    <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-200">
                        {dateFormatted}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-100">{e.userName}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-slate-300">{e.projectName}</span>
                      </td>
                      <td className="px-4 py-3">
                        {e.taskId ? (
                          <button
                            onClick={() => {
                              setSelectedTaskId(e.taskId);
                              setSelectedTaskProjectId(e.projectId || projectId || '');
                              setIsTaskDrawerOpen(true);
                            }}
                            className="font-medium text-indigo-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer text-left"
                          >
                            <span className="text-[10px] px-1 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-slate-400">
                              {e.taskNumber}
                            </span>
                            <span>{e.taskTitle}</span>
                          </button>
                        ) : (
                          <span className="text-slate-500 italic">General / Non-Task</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-slate-100">
                        {e.hours}h
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {e.billable ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Billable
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700/50">
                            Non-Billable
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {e.status === 'APPROVED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Approved
                          </span>
                        )}
                        {e.status === 'SUBMITTED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Submitted
                          </span>
                        )}
                        {(!e.status || e.status === 'DRAFT') && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700/50">
                            Draft
                          </span>
                        )}
                        {e.status === 'REJECTED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-xs truncate">
                        {e.description || <span className="text-slate-600 italic">No notes</span>}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    No matching time log entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              Showing {(page - 1) * pageSize + 1} -{' '}
              {Math.min(page * pageSize, filteredDetailedEntries.length)} of{' '}
              {filteredDetailedEntries.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-slate-950 border border-slate-850 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-900 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs text-slate-400 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-slate-950 border border-slate-850 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-900 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Task Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        projectId={selectedTaskProjectId || projectId || ''}
        isOpen={isTaskDrawerOpen}
        onClose={() => {
          setIsTaskDrawerOpen(false);
          setSelectedTaskId(null);
          setSelectedTaskProjectId('');
        }}
      />
    </div>
  );
}
