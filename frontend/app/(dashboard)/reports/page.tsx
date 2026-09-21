'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/header';
import TaskDetailDrawer from '@/components/task-detail-drawer';
import StatusDistributionChart from '@/components/reports/status-distribution-chart';
import PriorityDistributionChart from '@/components/reports/priority-distribution-chart';
import CompletionRatioChart from '@/components/reports/completion-ratio-chart';
import AssigneeWorkloadChart from '@/components/reports/assignee-workload-chart';
import TimesheetReportsView from '@/components/reports/timesheet-reports-view';
import {
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  FolderKanban,
  User,
  UserX,
  Download,
  RefreshCw,
  TrendingUp,
  Layers,
  Flag,
  Users,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Activity,
  ArrowUpRight,
  Filter,
  CheckSquare,
  Search,
  Loader2,
  ListTodo,
  Sparkles,
  ArrowUpDown,
  FileSpreadsheet,
  SlidersHorizontal,
} from 'lucide-react';

function ReportsContent() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active Report View: 'tasks' | 'timesheets' | 'overview'
  const [activeReportTab, setActiveReportTab] = useState<'tasks' | 'timesheets' | 'overview'>('tasks');

  // Selected filters
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [range, setRange] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [taskListFilter, setTaskListFilter] = useState<string>('ALL');
  const [milestoneFilter, setMilestoneFilter] = useState<string>('ALL');
  const [upcomingWindowDays, setUpcomingWindowDays] = useState<number>(7);

  // Table searches
  const [allTasksSearch, setAllTasksSearch] = useState<string>('');
  const [overdueSearch, setOverdueSearch] = useState<string>('');
  const [upcomingSearch, setUpcomingSearch] = useState<string>('');
  const [completedSearch, setCompletedSearch] = useState<string>('');
  const [assigneeSearch, setAssigneeSearch] = useState<string>('');
  const [taskListSearch, setTaskListSearch] = useState<string>('');
  const [milestoneSearch, setMilestoneSearch] = useState<string>('');

  // Table Sortings
  const [allTasksSortField, setAllTasksSortField] = useState<string>('rawTaskNumber');
  const [allTasksSortOrder, setAllTasksSortOrder] = useState<'asc' | 'desc'>('asc');

  const [overdueSortField, setOverdueSortField] = useState<string>('daysOverdue');
  const [overdueSortOrder, setOverdueSortOrder] = useState<'asc' | 'desc'>('desc');

  const [upcomingSortField, setUpcomingSortField] = useState<string>('dueDate');
  const [upcomingSortOrder, setUpcomingSortOrder] = useState<'asc' | 'desc'>('asc');

  const [completedSortField, setCompletedSortField] = useState<string>('completedDate');
  const [completedSortOrder, setCompletedSortOrder] = useState<'asc' | 'desc'>('desc');

  const [assigneeSortField, setAssigneeSortField] = useState<string>('totalTasks');
  const [assigneeSortOrder, setAssigneeSortOrder] = useState<'asc' | 'desc'>('desc');

  // Detailed Tables Tab (all | overdue | upcoming | completed)
  const [activeTableTab, setActiveTableTab] = useState<'all' | 'overdue' | 'upcoming' | 'completed'>('all');

  // Pagination states per tab
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Reset pagination on tab/filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeTableTab,
    selectedProjectId,
    range,
    startDate,
    endDate,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    taskListFilter,
    milestoneFilter,
    allTasksSearch,
    overdueSearch,
    upcomingSearch,
    completedSearch,
    upcomingWindowDays,
  ]);

  // Interactive Task Drawer
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);

  // Recharts hydration fix
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  // 1. Fetch authorized projects
  const {
    data: projects = [],
    isLoading: isLoadingProjects,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // Set default selected project from URL query or first active project
  useEffect(() => {
    const urlProjectId = searchParams.get('projectId');
    if (urlProjectId && projects.some((p: any) => p.id === urlProjectId)) {
      setSelectedProjectId(urlProjectId);
    } else if (!selectedProjectId && projects.length > 0) {
      const firstActive = projects.find((p: any) => p.status !== 'ARCHIVED') || projects[0];
      setSelectedProjectId(firstActive.id);
    }

    const tabParam = searchParams.get('tab');
    if (tabParam === 'timesheets' || tabParam === 'tasks' || tabParam === 'overview') {
      setActiveReportTab(tabParam);
    }
  }, [projects, searchParams, selectedProjectId]);

  // Set default custom dates if selected
  useEffect(() => {
    if (range === 'custom') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [range]);

  // 2. Fetch Task Report summary
  const {
    data: taskReport,
    isLoading: isLoadingTaskReport,
    isRefetching: isRefetchingTaskReport,
    refetch: refetchTaskReport,
    error: taskReportError,
  } = useQuery({
    queryKey: [
      'project-task-reports',
      selectedProjectId,
      range,
      startDate,
      endDate,
      statusFilter,
      priorityFilter,
      assigneeFilter,
      taskListFilter,
      milestoneFilter,
      upcomingWindowDays,
    ],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      const params: Record<string, any> = { range };
      if (range === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;
      if (assigneeFilter !== 'ALL') params.assigneeId = assigneeFilter;
      if (taskListFilter !== 'ALL') params.taskListId = taskListFilter;
      if (milestoneFilter !== 'ALL') params.milestoneId = milestoneFilter;
      params.upcomingDays = upcomingWindowDays;

      const res = await api.get(`/projects/${selectedProjectId}/reports/tasks`, { params });
      return res.data;
    },
    enabled: !!selectedProjectId && mounted && (range !== 'custom' || (!!startDate && !!endDate)),
  });

  // Export CSV Handler
  const handleExportCSV = async () => {
    if (!selectedProjectId) return;
    try {
      const params: Record<string, string> = { range };
      if (range === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;
      if (assigneeFilter !== 'ALL') params.assigneeId = assigneeFilter;
      if (taskListFilter !== 'ALL') params.taskListId = taskListFilter;
      if (milestoneFilter !== 'ALL') params.milestoneId = milestoneFilter;

      const res = await api.get(`/projects/${selectedProjectId}/reports/tasks/export`, {
        params,
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `task-report-${selectedProjectId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export CSV report', err);
    }
  };

  const handleOpenTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsTaskDrawerOpen(true);
  };

  // Status & Priority Badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'DONE':
      case 'ACHIEVED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {status}
          </span>
        );
      case 'IN_PROGRESS':
      case 'PLANNING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            {status.replace(/_/g, ' ')}
          </span>
        );
      case 'REVIEW':
      case 'PLANNED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {status}
          </span>
        );
      case 'BLOCKED':
      case 'MISSED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {status}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 bg-slate-800 text-slate-400 border border-slate-700/50">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            {status}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            LOW
          </span>
        );
    }
  };

  // Filtered & Sorted All Tasks
  const filteredAllTasks = useMemo(() => {
    if (!taskReport?.allTasks) return [];
    let list = [...taskReport.allTasks];
    if (allTasksSearch.trim()) {
      const q = allTasksSearch.toLowerCase();
      list = list.filter(
        (t: any) =>
          t.title.toLowerCase().includes(q) ||
          t.taskNumber.toLowerCase().includes(q) ||
          t.assignee.name.toLowerCase().includes(q) ||
          (t.taskList && t.taskList.toLowerCase().includes(q)) ||
          (t.milestone && t.milestone.toLowerCase().includes(q)),
      );
    }
    list.sort((a: any, b: any) => {
      let aVal = a[allTasksSortField];
      let bVal = b[allTasksSortField];
      if (allTasksSortField === 'assignee') {
        aVal = a.assignee?.name || '';
        bVal = b.assignee?.name || '';
      }
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return allTasksSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (aVal < bVal) return allTasksSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return allTasksSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [taskReport?.allTasks, allTasksSearch, allTasksSortField, allTasksSortOrder]);

  // Filtered & Sorted Overdue Tasks
  const filteredOverdueTasks = useMemo(() => {
    if (!taskReport?.overdueTasks) return [];
    let list = [...taskReport.overdueTasks];
    if (overdueSearch.trim()) {
      const q = overdueSearch.toLowerCase();
      list = list.filter(
        (t: any) =>
          t.title.toLowerCase().includes(q) ||
          t.taskNumber.toLowerCase().includes(q) ||
          t.assignee.name.toLowerCase().includes(q) ||
          (t.taskList && t.taskList.toLowerCase().includes(q)) ||
          (t.milestone && t.milestone.toLowerCase().includes(q)),
      );
    }
    list.sort((a: any, b: any) => {
      let aVal = a[overdueSortField];
      let bVal = b[overdueSortField];
      if (overdueSortField === 'assignee') {
        aVal = a.assignee?.name || '';
        bVal = b.assignee?.name || '';
      }
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return overdueSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (aVal < bVal) return overdueSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return overdueSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [taskReport?.overdueTasks, overdueSearch, overdueSortField, overdueSortOrder]);

  // Filtered & Sorted Upcoming Tasks
  const filteredUpcomingTasks = useMemo(() => {
    if (!taskReport?.upcomingTasks) return [];
    let list = [...taskReport.upcomingTasks];
    // Filter by selected upcoming window days
    list = list.filter((t: any) => t.daysRemaining <= upcomingWindowDays);
    if (upcomingSearch.trim()) {
      const q = upcomingSearch.toLowerCase();
      list = list.filter(
        (t: any) =>
          t.title.toLowerCase().includes(q) ||
          t.taskNumber.toLowerCase().includes(q) ||
          t.assignee.name.toLowerCase().includes(q) ||
          (t.taskList && t.taskList.toLowerCase().includes(q)) ||
          (t.milestone && t.milestone.toLowerCase().includes(q)),
      );
    }
    list.sort((a: any, b: any) => {
      let aVal = a[upcomingSortField];
      let bVal = b[upcomingSortField];
      if (upcomingSortField === 'assignee') {
        aVal = a.assignee?.name || '';
        bVal = b.assignee?.name || '';
      }
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return upcomingSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (aVal < bVal) return upcomingSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return upcomingSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [taskReport?.upcomingTasks, upcomingSearch, upcomingSortField, upcomingSortOrder, upcomingWindowDays]);

  // Filtered & Sorted Completed Tasks
  const filteredCompletedTasks = useMemo(() => {
    if (!taskReport?.completedTasks) return [];
    let list = [...taskReport.completedTasks];
    if (completedSearch.trim()) {
      const q = completedSearch.toLowerCase();
      list = list.filter(
        (t: any) =>
          t.title.toLowerCase().includes(q) ||
          t.taskNumber.toLowerCase().includes(q) ||
          t.assignee.name.toLowerCase().includes(q) ||
          (t.taskList && t.taskList.toLowerCase().includes(q)) ||
          (t.milestone && t.milestone.toLowerCase().includes(q)),
      );
    }
    list.sort((a: any, b: any) => {
      let aVal = a[completedSortField];
      let bVal = b[completedSortField];
      if (completedSortField === 'assignee') {
        aVal = a.assignee?.name || '';
        bVal = b.assignee?.name || '';
      }
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return completedSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (aVal < bVal) return completedSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return completedSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [taskReport?.completedTasks, completedSearch, completedSortField, completedSortOrder]);

  // Filtered Assignees
  const filteredAssignees = useMemo(() => {
    if (!taskReport?.tasksByAssignee) return [];
    let list = [...taskReport.tasksByAssignee];
    if (assigneeSearch.trim()) {
      const q = assigneeSearch.toLowerCase();
      list = list.filter((a: any) => a.name.toLowerCase().includes(q));
    }
    list.sort((a: any, b: any) => {
      const aVal = a[assigneeSortField];
      const bVal = b[assigneeSortField];
      if (typeof aVal === 'string') {
        return assigneeSortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return assigneeSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return list;
  }, [taskReport?.tasksByAssignee, assigneeSearch, assigneeSortField, assigneeSortOrder]);

  // Filtered Task Lists
  const filteredTaskLists = useMemo(() => {
    if (!taskReport?.taskListSummaries) return [];
    if (!taskListSearch.trim()) return taskReport.taskListSummaries;
    const q = taskListSearch.toLowerCase();
    return taskReport.taskListSummaries.filter((tl: any) => tl.name.toLowerCase().includes(q));
  }, [taskReport?.taskListSummaries, taskListSearch]);

  // Filtered Milestones
  const filteredMilestones = useMemo(() => {
    if (!taskReport?.milestoneSummaries) return [];
    if (!milestoneSearch.trim()) return taskReport.milestoneSummaries;
    const q = milestoneSearch.toLowerCase();
    return taskReport.milestoneSummaries.filter((m: any) => m.title.toLowerCase().includes(q));
  }, [taskReport?.milestoneSummaries, milestoneSearch]);

  // Active table current list for pagination
  const currentActiveList = useMemo(() => {
    switch (activeTableTab) {
      case 'all':
        return filteredAllTasks;
      case 'overdue':
        return filteredOverdueTasks;
      case 'upcoming':
        return filteredUpcomingTasks;
      case 'completed':
        return filteredCompletedTasks;
      default:
        return [];
    }
  }, [
    activeTableTab,
    filteredAllTasks,
    filteredOverdueTasks,
    filteredUpcomingTasks,
    filteredCompletedTasks,
  ]);

  const totalPages = Math.max(1, Math.ceil(currentActiveList.length / pageSize));
  const paginatedList = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return currentActiveList.slice(startIdx, startIdx + pageSize);
  }, [currentActiveList, currentPage, pageSize]);

  if (!mounted || isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Standardized Header */}
      <Header
        title={
          activeReportTab === 'timesheets'
            ? 'Timesheet Reports'
            : activeReportTab === 'overview'
            ? 'Project Overview'
            : 'Task Reports'
        }
        subtitle="Reports & Analytics"
        activeNav="reports"
      >
        {activeReportTab === 'tasks' && (
          <button
            onClick={handleExportCSV}
            disabled={!taskReport || isLoadingTaskReport}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-xs active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV Report</span>
          </button>
        )}
      </Header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Level Tab Navigation */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-900/40 border border-slate-850/80 rounded-2xl w-fit backdrop-blur-xl">
          <button
            onClick={() => {
              setActiveReportTab('tasks');
              const params = new URLSearchParams(window.location.search);
              params.set('tab', 'tasks');
              router.replace(`/reports?${params.toString()}`);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeReportTab === 'tasks'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Task Reports</span>
          </button>

          <button
            onClick={() => {
              setActiveReportTab('timesheets');
              const params = new URLSearchParams(window.location.search);
              params.set('tab', 'timesheets');
              router.replace(`/reports?${params.toString()}`);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeReportTab === 'timesheets'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Timesheet Reports</span>
          </button>

          <button
            onClick={() => {
              setActiveReportTab('overview');
              const params = new URLSearchParams(window.location.search);
              params.set('tab', 'overview');
              router.replace(`/reports?${params.toString()}`);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeReportTab === 'overview'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Project Overview</span>
          </button>
        </div>

        {/* Timesheet Reports Tab Content */}
        {activeReportTab === 'timesheets' && (
          <TimesheetReportsView initialProjectId={selectedProjectId} isProjectLevel={false} />
        )}

        {/* Task Reports / Overview Content */}
        {activeReportTab !== 'timesheets' && (
          <>
            {/* 1. Project Selector & Filter Controls Bar */}
            <section className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 space-y-4 backdrop-blur-md shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Project Selector Dropdown */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                    <FolderKanban className="w-4 h-4 text-indigo-400" />
                    <span>Select Project:</span>
                  </label>
                  <div className="relative min-w-[260px] sm:min-w-[320px]">
                    <select
                      value={selectedProjectId}
                      onChange={(e) => {
                        setSelectedProjectId(e.target.value);
                        const params = new URLSearchParams(window.location.search);
                        params.set('projectId', e.target.value);
                        router.replace(`/reports?${params.toString()}`);
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 font-semibold focus:outline-none focus:border-indigo-500 text-xs appearance-none cursor-pointer pr-10"
                    >
                      {isLoadingProjects ? (
                        <option>Loading projects...</option>
                      ) : projects.length === 0 ? (
                        <option>No projects available</option>
                      ) : (
                        projects.map((proj: any) => (
                          <option key={proj.id} value={proj.id}>
                            [{proj.projectCode}] {proj.name} ({proj.status})
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Refresh Action */}
                <div className="flex items-center gap-3 self-end lg:self-auto">
                  <button
                    onClick={() => refetchTaskReport()}
                    disabled={isLoadingTaskReport || isRefetchingTaskReport}
                    className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    title="Refresh Report Data"
                  >
                    <RefreshCw
                      className={`w-4 h-4 text-indigo-400 ${
                        isLoadingTaskReport || isRefetchingTaskReport ? 'animate-spin' : ''
                      }`}
                    />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>

              {/* Filter Toolbar Grid */}
              <div className="pt-4 border-t border-slate-900/80 flex flex-wrap items-center gap-3">
                {/* Date Window */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Window:</span>
                  </span>
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                    {['all', '7d', '30d', '90d', 'custom'].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setRange(opt)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer ${
                          range === opt
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt === 'all'
                          ? 'All Time'
                          : opt === 'custom'
                          ? 'Custom'
                          : opt === '7d'
                          ? '7 Days'
                          : opt === '30d'
                          ? '30 Days'
                          : '90 Days'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Dates */}
                {range === 'custom' && (
                  <div className="flex items-center gap-2 animate-fade-in">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
                    <span className="text-slate-500 text-xs font-semibold">to</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
                  </div>
                )}

                {/* Status Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Status:
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">All Statuses</option>
                    {taskReport?.filterOptions?.statuses?.map((st: string) => (
                      <option key={st} value={st}>
                        {st.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Priority:
                  </span>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">All Priorities</option>
                    {taskReport?.filterOptions?.priorities?.map((pr: string) => (
                      <option key={pr} value={pr}>
                        {pr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assignee Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Assignee:
                  </span>
                  <select
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[160px]"
                  >
                    <option value="ALL">All Assignees</option>
                    <option value="UNASSIGNED">Unassigned</option>
                    {taskReport?.tasksByAssignee
                      ?.filter((a: any) => a.userId !== null)
                      .map((a: any) => (
                        <option key={a.userId} value={a.userId}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Task List Filter */}
                {taskReport?.filterOptions?.taskLists?.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      List:
                    </span>
                    <select
                      value={taskListFilter}
                      onChange={(e) => setTaskListFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[160px]"
                    >
                      <option value="ALL">All Lists</option>
                      <option value="UNASSIGNED">No Task List</option>
                      {taskReport.filterOptions.taskLists.map((tl: any) => (
                        <option key={tl.id} value={tl.id}>
                          {tl.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Milestone Filter */}
                {taskReport?.filterOptions?.milestones?.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Milestone:
                    </span>
                    <select
                      value={milestoneFilter}
                      onChange={(e) => setMilestoneFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[160px]"
                    >
                      <option value="ALL">All Milestones</option>
                      <option value="UNASSIGNED">No Milestone</option>
                      {taskReport.filterOptions.milestones.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </section>

            {/* Loading / Error States */}
            {isLoadingTaskReport ? (
              <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4 bg-slate-900/20 border border-slate-900 rounded-2xl p-12">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className="text-slate-400 text-sm font-semibold">
                  Compiling task reporting analytics and distributions...
                </p>
              </div>
            ) : taskReportError || !taskReport ? (
              <div className="bg-rose-950/20 border border-rose-900/60 text-rose-200 p-8 rounded-2xl flex items-start gap-4 shadow-xl">
                <AlertCircle className="w-8 h-8 text-rose-500 shrink-0" />
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-rose-300">
                    Unable to load task reports
                  </h3>
                  <p className="text-xs text-rose-400/90 leading-relaxed">
                    {(taskReportError as any)?.response?.data?.message ||
                      'You may not have sufficient permissions to view task reports for this project, or the project does not exist.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* 2. Basic KPI Ribbon Cards (7 KPI Cards) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                  {/* Total Tasks */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-lg">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Total Tasks
                    </span>
                    <div className="mt-2.5">
                      <div className="text-2xl font-black text-slate-100">
                        {taskReport.kpis.totalTasks}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {taskReport.kpis.totalEstimatedHours}h estimated
                      </div>
                    </div>
                  </div>

                  {/* Completed Tasks */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        Completed
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="mt-2.5">
                      <div className="text-2xl font-black text-emerald-400">
                        {taskReport.kpis.completedTasks}
                      </div>
                      <div className="text-[10px] text-emerald-400/80 font-bold mt-0.5">
                        {taskReport.kpis.completionPercentage}% Rate
                      </div>
                    </div>
                  </div>

                  {/* Pending Tasks */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-lg">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Pending
                    </span>
                    <div className="mt-2.5">
                      <div className="text-2xl font-black text-slate-200">
                        {taskReport.kpis.pendingTasks}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Awaiting completion
                      </div>
                    </div>
                  </div>

                  {/* In Progress Tasks */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                        In Progress
                      </span>
                      <Activity className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="mt-2.5">
                      <div className="text-2xl font-black text-blue-400">
                        {taskReport.kpis.inProgressTasks}
                      </div>
                      <div className="text-[10px] text-blue-400/80 font-semibold mt-0.5">
                        Active work
                      </div>
                    </div>
                  </div>

                  {/* Overdue Tasks */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                        Overdue
                      </span>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                    <div className="mt-2.5">
                      <div className="text-2xl font-black text-rose-400">
                        {taskReport.kpis.overdueTasks}
                      </div>
                      <div className="text-[10px] text-rose-400/80 font-semibold mt-0.5">
                        Past due date
                      </div>
                    </div>
                  </div>

                  {/* Tasks Due Soon */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        Due Soon
                      </span>
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="mt-2.5">
                      <div className="text-2xl font-black text-amber-400">
                        {taskReport.kpis.dueSoonTasks}
                      </div>
                      <div className="text-[10px] text-amber-400/80 font-semibold mt-0.5">
                        Next {upcomingWindowDays} days
                      </div>
                    </div>
                  </div>

                  {/* Unassigned Tasks */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Unassigned
                      </span>
                      <UserX className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="mt-2.5">
                      <div className="text-2xl font-black text-slate-200">
                        {taskReport.kpis.unassignedTasks ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        No owner assigned
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Reusable Charts Grid (4 Useful Charts for Phase 1) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Chart 1: Tasks by Status */}
                  <StatusDistributionChart
                    data={taskReport.tasksByStatus}
                    title="Tasks by Status"
                  />

                  {/* Chart 2: Tasks by Priority */}
                  <PriorityDistributionChart
                    data={taskReport.tasksByPriority}
                    title="Tasks by Priority"
                  />

                  {/* Chart 3: Completed vs Pending Summary */}
                  <CompletionRatioChart
                    totalTasks={taskReport.kpis.totalTasks}
                    completedTasks={taskReport.kpis.completedTasks}
                    pendingTasks={taskReport.kpis.pendingTasks}
                    inProgressTasks={taskReport.kpis.inProgressTasks}
                    overdueTasks={taskReport.kpis.overdueTasks}
                    completionPercentage={taskReport.kpis.completionPercentage}
                    title="Completed vs Pending Tasks"
                  />

                  {/* Chart 4: Tasks by Assignee Workload Chart */}
                  <AssigneeWorkloadChart
                    data={taskReport.tasksByAssignee}
                    title="Tasks by Assignee Workload"
                  />
                </div>

                {/* 4. Tasks by Assignee Workload Table */}
                <section className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        <span>Workload Distribution Table</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {taskReport.tasksByAssignee?.length || 0} Members
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Breakdown of tasks, completion status, and overdue counts allocated per team member.
                      </p>
                    </div>

                    <div className="relative min-w-[220px]">
                      <input
                        type="text"
                        placeholder="Search assignees..."
                        value={assigneeSearch}
                        onChange={(e) => setAssigneeSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  {filteredAssignees.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-900">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-900">
                          <tr>
                            <th
                              onClick={() => {
                                setAssigneeSortField('name');
                                setAssigneeSortOrder(assigneeSortOrder === 'asc' ? 'desc' : 'asc');
                              }}
                              className="px-4 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                            >
                              <div className="flex items-center gap-1">
                                <span>Assignee</span>
                                <ArrowUpDown className="w-3 h-3 text-slate-600" />
                              </div>
                            </th>
                            <th
                              onClick={() => {
                                setAssigneeSortField('totalTasks');
                                setAssigneeSortOrder(assigneeSortOrder === 'asc' ? 'desc' : 'asc');
                              }}
                              className="px-4 py-3.5 text-right cursor-pointer hover:text-slate-200 transition-colors"
                            >
                              <div className="flex items-center justify-end gap-1">
                                <span>Total Tasks</span>
                                <ArrowUpDown className="w-3 h-3 text-slate-600" />
                              </div>
                            </th>
                            <th className="px-4 py-3.5 text-right text-emerald-400">Completed</th>
                            <th className="px-4 py-3.5 text-right text-blue-400">In Progress</th>
                            <th className="px-4 py-3.5 text-right text-slate-400">Pending</th>
                            <th className="px-4 py-3.5 text-right text-rose-400">Overdue</th>
                            <th className="px-4 py-3.5 min-w-[140px]">Progress</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900 bg-slate-950/40">
                          {filteredAssignees.map((a: any, idx: number) => (
                            <tr key={a.userId || `unassigned-${idx}`} className="hover:bg-slate-900/40 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-200 flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0 text-[10px] uppercase">
                                  {a.name ? a.name[0] : '?'}
                                </div>
                                <span className="truncate">{a.name}</span>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-200">
                                {a.totalTasks}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                                {a.completedTasks}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-blue-400">
                                {a.inProgressTasks}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-400">
                                {a.pendingTasks}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-rose-400">
                                {a.overdueTasks > 0 ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    {a.overdueTasks}
                                  </span>
                                ) : (
                                  '0'
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                      style={{ width: `${a.progress}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-300 shrink-0">
                                    {a.progress}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-900">
                      No assignees found matching query.
                    </div>
                  )}
                </section>

                {/* 5. Task List Summary & Milestone Summary Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Task List Summary */}
                  <section className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-2">
                          <ListTodo className="w-4 h-4 text-blue-400" />
                          <span>Task List Summary</span>
                        </h3>
                      </div>

                      <div className="relative min-w-[160px]">
                        <input
                          type="text"
                          placeholder="Filter lists..."
                          value={taskListSearch}
                          onChange={(e) => setTaskListSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {filteredTaskLists.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-900 max-h-72 overflow-y-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-900 sticky top-0">
                            <tr>
                              <th className="px-3 py-2.5">Task List</th>
                              <th className="px-3 py-2.5 text-right">Total</th>
                              <th className="px-3 py-2.5 text-right text-emerald-400">Done</th>
                              <th className="px-3 py-2.5 text-right text-rose-400">Late</th>
                              <th className="px-3 py-2.5 min-w-[90px]">Progress</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900 bg-slate-950/40">
                            {filteredTaskLists.map((tl: any) => (
                              <tr key={tl.id || 'default-list'} className="hover:bg-slate-900/40 transition-colors">
                                <td className="px-3 py-2 font-bold text-slate-200 truncate max-w-[150px]">
                                  {tl.name}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-300">
                                  {tl.totalTasks}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-emerald-400">
                                  {tl.completedTasks}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-rose-400">
                                  {tl.overdueTasks > 0 ? tl.overdueTasks : 0}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                                      <div
                                        className="bg-blue-500 h-full rounded-full"
                                        style={{ width: `${tl.progress}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                      {tl.progress}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-900">
                        No task lists found.
                      </div>
                    )}
                  </section>

                  {/* Milestone Summary */}
                  <section className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-2">
                          <Flag className="w-4 h-4 text-violet-400" />
                          <span>Milestone Summary</span>
                        </h3>
                      </div>

                      <div className="relative min-w-[160px]">
                        <input
                          type="text"
                          placeholder="Filter milestones..."
                          value={milestoneSearch}
                          onChange={(e) => setMilestoneSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {filteredMilestones.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-900 max-h-72 overflow-y-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-900 sticky top-0">
                            <tr>
                              <th className="px-3 py-2.5">Milestone</th>
                              <th className="px-3 py-2.5 text-right">Total</th>
                              <th className="px-3 py-2.5 text-right text-emerald-400">Done</th>
                              <th className="px-3 py-2.5 text-right text-rose-400">Late</th>
                              <th className="px-3 py-2.5 min-w-[90px]">Progress</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900 bg-slate-950/40">
                            {filteredMilestones.map((m: any) => (
                              <tr key={m.id || 'no-milestone'} className="hover:bg-slate-900/40 transition-colors">
                                <td className="px-3 py-2 font-bold text-slate-200 truncate max-w-[150px]">
                                  {m.title}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-300">
                                  {m.totalTasks}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-emerald-400">
                                  {m.completedTasks}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-rose-400">
                                  {m.overdueTasks > 0 ? m.overdueTasks : 0}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                                      <div
                                        className="bg-violet-500 h-full rounded-full"
                                        style={{ width: `${m.progress}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                      {m.progress}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-900">
                        No milestones found.
                      </div>
                    )}
                  </section>
                </div>

                {/* 6. Detailed Task Report Tables with Pagination */}
                <section className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900/80 pb-4">
                    {/* Table Tab Selector */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setActiveTableTab('all')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                          activeTableTab === 'all'
                            ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-950'
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                        <span>All Tasks</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300">
                          {taskReport.allTasks?.length || 0}
                        </span>
                      </button>

                      <button
                        onClick={() => setActiveTableTab('overdue')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                          activeTableTab === 'overdue'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-950'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Overdue Tasks</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300">
                          {taskReport.overdueTasks?.length || 0}
                        </span>
                      </button>

                      <button
                        onClick={() => setActiveTableTab('upcoming')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                          activeTableTab === 'upcoming'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-950'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Upcoming Tasks</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300">
                          {filteredUpcomingTasks.length}
                        </span>
                      </button>

                      <button
                        onClick={() => setActiveTableTab('completed')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                          activeTableTab === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-950'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Completed Tasks</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300">
                          {taskReport.completedTasks?.length || 0}
                        </span>
                      </button>
                    </div>

                    {/* Upcoming Period Selector (only on Upcoming Tab) */}
                    {activeTableTab === 'upcoming' && (
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Period:
                        </span>
                        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                          {[7, 14, 30].map((days) => (
                            <button
                              key={days}
                              onClick={() => setUpcomingWindowDays(days)}
                              className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                upcomingWindowDays === days
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Next {days}d
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Table Tab 1: All Tasks Report Table */}
                  {activeTableTab === 'all' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">
                          Comprehensive report of all tasks across current filters. Click any row to view full details.
                        </p>
                        <div className="relative min-w-[240px]">
                          <input
                            type="text"
                            placeholder="Search tasks, code, assignee..."
                            value={allTasksSearch}
                            onChange={(e) => setAllTasksSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      {paginatedList.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-900">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-900">
                              <tr>
                                <th
                                  onClick={() => {
                                    setAllTasksSortField('rawTaskNumber');
                                    setAllTasksSortOrder(allTasksSortOrder === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="px-4 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Task Code</span>
                                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                                  </div>
                                </th>
                                <th
                                  onClick={() => {
                                    setAllTasksSortField('title');
                                    setAllTasksSortOrder(allTasksSortOrder === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="px-4 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Title</span>
                                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                                  </div>
                                </th>
                                <th className="px-4 py-3.5">Task List</th>
                                <th className="px-4 py-3.5">Milestone</th>
                                <th
                                  onClick={() => {
                                    setAllTasksSortField('assignee');
                                    setAllTasksSortOrder(allTasksSortOrder === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="px-4 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Assignee</span>
                                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                                  </div>
                                </th>
                                <th
                                  onClick={() => {
                                    setAllTasksSortField('startDate');
                                    setAllTasksSortOrder(allTasksSortOrder === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="px-4 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Start Date</span>
                                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                                  </div>
                                </th>
                                <th
                                  onClick={() => {
                                    setAllTasksSortField('dueDate');
                                    setAllTasksSortOrder(allTasksSortOrder === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="px-4 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Due Date</span>
                                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                                  </div>
                                </th>
                                <th className="px-4 py-3.5 min-w-[100px]">Progress</th>
                                <th className="px-4 py-3.5">Priority</th>
                                <th className="px-4 py-3.5">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 bg-slate-950/40">
                              {paginatedList.map((t: any) => (
                                <tr
                                  key={t.id}
                                  onClick={() => handleOpenTask(t.id)}
                                  className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                                >
                                  <td className="px-4 py-3 font-mono text-indigo-400 font-bold group-hover:underline flex items-center gap-1">
                                    {t.taskNumber}
                                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </td>
                                  <td className="px-4 py-3 font-bold text-slate-200 line-clamp-1 max-w-xs">
                                    {t.title}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.taskList || 'Default'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.milestone || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-300 font-medium">
                                    {t.assignee.name}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.startDate ? new Date(t.startDate).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            t.status === 'DONE'
                                              ? 'bg-emerald-500'
                                              : t.status === 'IN_PROGRESS'
                                              ? 'bg-blue-500'
                                              : 'bg-slate-600'
                                          }`}
                                          style={{ width: `${t.progress ?? (t.status === 'DONE' ? 100 : 0)}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                        {t.progress ?? (t.status === 'DONE' ? 100 : 0)}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">{getPriorityBadge(t.priority)}</td>
                                  <td className="px-4 py-3">{getStatusBadge(t.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-slate-900">
                          <CheckSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-slate-400 text-xs font-semibold">
                            No tasks found matching current filters.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Table Tab 2: Overdue Tasks */}
                  {activeTableTab === 'overdue' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">
                          Tasks past their due date requiring immediate attention. Click any row to view task details.
                        </p>
                        <div className="relative min-w-[240px]">
                          <input
                            type="text"
                            placeholder="Search overdue tasks..."
                            value={overdueSearch}
                            onChange={(e) => setOverdueSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      {paginatedList.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-900">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-900">
                              <tr>
                                <th className="px-4 py-3.5">Task Code</th>
                                <th className="px-4 py-3.5">Title</th>
                                <th className="px-4 py-3.5">Task List</th>
                                <th className="px-4 py-3.5">Milestone</th>
                                <th className="px-4 py-3.5">Assignee</th>
                                <th className="px-4 py-3.5">Due Date</th>
                                <th
                                  onClick={() => {
                                    setOverdueSortField('daysOverdue');
                                    setOverdueSortOrder(overdueSortOrder === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="px-4 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Days Late</span>
                                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                                  </div>
                                </th>
                                <th className="px-4 py-3.5">Priority</th>
                                <th className="px-4 py-3.5">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 bg-slate-950/40">
                              {paginatedList.map((t: any) => (
                                <tr
                                  key={t.id}
                                  onClick={() => handleOpenTask(t.id)}
                                  className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                                >
                                  <td className="px-4 py-3 font-mono text-indigo-400 font-bold group-hover:underline flex items-center gap-1">
                                    {t.taskNumber}
                                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </td>
                                  <td className="px-4 py-3 font-bold text-slate-200 line-clamp-1 max-w-xs">
                                    {t.title}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.taskList || 'Default'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.milestone || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-300 font-medium">
                                    {t.assignee.name}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                      {t.daysOverdue}d overdue
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">{getPriorityBadge(t.priority)}</td>
                                  <td className="px-4 py-3">{getStatusBadge(t.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-slate-900">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-50 mb-2" />
                          <p className="text-slate-400 text-xs font-semibold">
                            No overdue tasks found matching current filters.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Table Tab 3: Upcoming Tasks */}
                  {activeTableTab === 'upcoming' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">
                          Tasks due in the next {upcomingWindowDays} days. Click any row to view task details.
                        </p>
                        <div className="relative min-w-[240px]">
                          <input
                            type="text"
                            placeholder="Search upcoming tasks..."
                            value={upcomingSearch}
                            onChange={(e) => setUpcomingSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      {paginatedList.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-900">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-900">
                              <tr>
                                <th className="px-4 py-3.5">Task Code</th>
                                <th className="px-4 py-3.5">Title</th>
                                <th className="px-4 py-3.5">Task List</th>
                                <th className="px-4 py-3.5">Milestone</th>
                                <th className="px-4 py-3.5">Assignee</th>
                                <th className="px-4 py-3.5">Start Date</th>
                                <th className="px-4 py-3.5">Due Date</th>
                                <th
                                  onClick={() => {
                                    setUpcomingSortField('daysRemaining');
                                    setUpcomingSortOrder(upcomingSortOrder === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="px-4 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Remaining</span>
                                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                                  </div>
                                </th>
                                <th className="px-4 py-3.5">Priority</th>
                                <th className="px-4 py-3.5">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 bg-slate-950/40">
                              {paginatedList.map((t: any) => (
                                <tr
                                  key={t.id}
                                  onClick={() => handleOpenTask(t.id)}
                                  className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                                >
                                  <td className="px-4 py-3 font-mono text-indigo-400 font-bold group-hover:underline flex items-center gap-1">
                                    {t.taskNumber}
                                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </td>
                                  <td className="px-4 py-3 font-bold text-slate-200 line-clamp-1 max-w-xs">
                                    {t.title}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.taskList || 'Default'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.milestone || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-300 font-medium">
                                    {t.assignee.name}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.startDate ? new Date(t.startDate).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      {t.daysRemaining}d remaining
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">{getPriorityBadge(t.priority)}</td>
                                  <td className="px-4 py-3">{getStatusBadge(t.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-slate-900">
                          <Clock className="w-8 h-8 text-amber-500 mx-auto opacity-50 mb-2" />
                          <p className="text-slate-400 text-xs font-semibold">
                            No upcoming tasks found in the next {upcomingWindowDays} days.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Table Tab 4: Completed Tasks */}
                  {activeTableTab === 'completed' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">
                          Historical archive of completed tasks. Click any row to view task details.
                        </p>
                        <div className="relative min-w-[240px]">
                          <input
                            type="text"
                            placeholder="Search completed tasks..."
                            value={completedSearch}
                            onChange={(e) => setCompletedSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      {paginatedList.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-900">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-900">
                              <tr>
                                <th className="px-4 py-3.5">Task Code</th>
                                <th className="px-4 py-3.5">Title</th>
                                <th className="px-4 py-3.5">Assignee</th>
                                <th className="px-4 py-3.5">Task List</th>
                                <th className="px-4 py-3.5">Milestone</th>
                                <th
                                  onClick={() => {
                                    setCompletedSortField('completedDate');
                                    setCompletedSortOrder(completedSortOrder === 'asc' ? 'desc' : 'asc');
                                  }}
                                  className="px-4 py-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Completed Date</span>
                                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                                  </div>
                                </th>
                                <th className="px-4 py-3.5">Priority</th>
                                <th className="px-4 py-3.5">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 bg-slate-950/40">
                              {paginatedList.map((t: any) => (
                                <tr
                                  key={t.id}
                                  onClick={() => handleOpenTask(t.id)}
                                  className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                                >
                                  <td className="px-4 py-3 font-mono text-indigo-400 font-bold group-hover:underline flex items-center gap-1">
                                    {t.taskNumber}
                                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </td>
                                  <td className="px-4 py-3 font-bold text-slate-200 line-clamp-1 max-w-xs">
                                    {t.title}
                                  </td>
                                  <td className="px-4 py-3 text-slate-300 font-medium">
                                    {t.assignee.name}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.taskList || 'Default'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400">
                                    {t.milestone || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-emerald-400 font-semibold">
                                    {t.completedDate ? new Date(t.completedDate).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="px-4 py-3">{getPriorityBadge(t.priority)}</td>
                                  <td className="px-4 py-3">{getStatusBadge(t.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-slate-900">
                          <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-slate-400 text-xs font-semibold">
                            No completed tasks found matching current filters.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pagination Controls Bar */}
                  {currentActiveList.length > 0 && (
                    <div className="pt-4 border-t border-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>
                          Showing <span className="font-bold text-slate-200">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                          <span className="font-bold text-slate-200">
                            {Math.min(currentPage * pageSize, currentActiveList.length)}
                          </span>{' '}
                          of <span className="font-bold text-slate-200">{currentActiveList.length}</span> entries
                        </span>

                        <div className="flex items-center gap-1.5 ml-2">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Per page:</span>
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                            className="bg-slate-950 border border-slate-850 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                          </select>
                        </div>
                      </div>

                      {/* Pagination Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Prev</span>
                        </button>

                        <div className="flex items-center gap-1 px-2 text-xs font-bold text-slate-300">
                          <span>Page {currentPage} of {totalPages}</span>
                        </div>

                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>

      {/* Interactive Task Detail Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        projectId={selectedProjectId}
        isOpen={isTaskDrawerOpen}
        onClose={() => {
          setIsTaskDrawerOpen(false);
          setSelectedTaskId(null);
          refetchTaskReport();
        }}
      />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
