'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  CheckSquare,
  Plus,
  Loader2,
  Clock,
  User,
  Sliders,
  LogOut,
  Settings,
  Filter,
  Search,
  ListTodo,
  AlertTriangle,
  BookOpen,
  Bug,
  Sparkles,
} from 'lucide-react';
import GlobalTaskModal from '@/components/global-task-modal';
import TaskDetailDrawer from '@/components/task-detail-drawer';
import NotificationBell from '@/components/notification-bell';
import Header from '@/components/header';
import Link from 'next/link';

export default function TasksPage() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Dropdown filter states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [searchText, setSearchText] = useState('');

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);

  // Queries: Projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const activeProjects = projects.filter((p: any) => p.status !== 'ARCHIVED');

  // Queries: Organization Members
  const { data: orgMembers = [] } = useQuery({
    queryKey: ['orgMembers'],
    queryFn: async () => {
      const res = await api.get('/organization/members');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // Queries: All Tasks with filters
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: [
      'global-tasks',
      selectedProjectId,
      selectedAssigneeId,
      selectedStatus,
      selectedPriority,
      selectedType,
      searchText,
    ],
    queryFn: async () => {
      const params: any = {};
      if (selectedProjectId) params.projectId = selectedProjectId;
      if (selectedAssigneeId) params.assigneeId = selectedAssigneeId;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedPriority) params.priority = selectedPriority;
      if (selectedType) params.type = selectedType;
      if (searchText.trim()) params.search = searchText.trim();

      const res = await api.get('/tasks', { params });
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const handleLogout = async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  // Status aggregation calculations
  const totalTasks = tasks.length;
  const todoCount = tasks.filter((t: any) => t.status === 'TODO').length;
  const inProgressCount = tasks.filter((t: any) => t.status === 'IN_PROGRESS').length;
  const reviewCount = tasks.filter((t: any) => t.status === 'REVIEW').length;
  const doneCount = tasks.filter((t: any) => t.status === 'DONE').length;
  const blockedCount = tasks.filter((t: any) => t.status === 'BLOCKED').length;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-450 border border-amber-500/20';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-450 border border-blue-500/20';
      default:
        return 'bg-slate-900 text-slate-400 border border-slate-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'DONE':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'PLANNING':
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-450 border border-blue-500/20';
      case 'REVIEW':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'COMPLETED':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'BLOCKED':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'TODO':
        return 'bg-slate-900 text-slate-400 border border-slate-800';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'BUG':
        return <Bug className="w-3.5 h-3.5 text-rose-400" />;
      case 'STORY':
        return <BookOpen className="w-3.5 h-3.5 text-emerald-400" />;
      case 'IMPROVEMENT':
        return <Sparkles className="w-3.5 h-3.5 text-violet-400" />;
      default:
        return <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  // Find project ID of selected task to pass to drawer
  const selectedTaskObj = tasks.find((t: any) => t.id === selectedTaskId);
  const projectIdForDrawer = selectedTaskObj ? selectedTaskObj.projectId : '';

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
      <Header title="Tasks Dashboard" subtitle="Tasks Portal" />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Status Metrics Section */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total Tasks</span>
            <div className="font-mono text-xl font-bold text-indigo-400 mt-1">{totalTasks}</div>
          </div>
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">To Do</span>
            <div className="font-mono text-xl font-bold text-slate-400 mt-1">{todoCount}</div>
          </div>
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-semibold">In Progress</span>
            <div className="font-mono text-xl font-bold text-blue-400 mt-1">{inProgressCount}</div>
          </div>
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">In Review</span>
            <div className="font-mono text-xl font-bold text-amber-400 mt-1">{reviewCount}</div>
          </div>
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Completed</span>
            <div className="font-mono text-xl font-bold text-emerald-400 mt-1">{doneCount}</div>
          </div>
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Blocked</span>
            <div className="font-mono text-xl font-bold text-rose-450 mt-1">{blockedCount}</div>
          </div>
        </section>

        {/* Filters and Search toolbar */}
        <section className="bg-slate-900/20 border border-slate-900 p-5 rounded-2xl space-y-4 backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search tasks by title or description..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Create Button */}
            {hasPermission('CREATE_TASK') && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4.5 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-650/15 cursor-pointer self-start md:self-auto"
              >
                <Plus className="w-4 h-4" /> Create Task
              </button>
            )}
          </div>

          <div className="h-px bg-slate-900/60 w-full" />

          {/* Filters Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Project Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Projects</option>
                {activeProjects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Assignee</label>
              <select
                value={selectedAssigneeId}
                onChange={(e) => setSelectedAssigneeId(e.target.value)}
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

            {/* Status Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEW">In Review</option>
                <option value="DONE">Done</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Priority</label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Types</option>
                <option value="TASK">Task</option>
                <option value="BUG">Bug</option>
                <option value="STORY">Story</option>
                <option value="IMPROVEMENT">Improvement</option>
              </select>
            </div>
          </div>
        </section>

        {/* Tasks Cards Grid */}
        <section>
          {isLoadingTasks ? (
            <div className="py-16 flex flex-col justify-center items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-400">Loading tasks...</span>
            </div>
          ) : tasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {tasks.map((t: any) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTaskId(t.id);
                    setIsTaskDrawerOpen(true);
                  }}
                  className="bg-slate-900/30 border border-slate-900 hover:border-slate-800 hover:bg-slate-900/50 rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-[20%] h-[20%] rounded-full bg-indigo-500/[0.01] group-hover:bg-indigo-500/[0.03] blur-[25px] transition-all" />

                  {/* Top Row: Code & Priority */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-950 border border-slate-800/80 rounded text-slate-400 font-semibold group-hover:text-indigo-400 transition-colors">
                        {t.project?.projectCode}-{t.taskNumber}
                      </span>
                      <div className="p-1 bg-slate-950/40 border border-slate-800/50 rounded" title={t.type}>
                        {getTypeIcon(t.type)}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium truncate max-w-[110px]" title={t.project?.name}>
                        {t.project?.name}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase ${getPriorityColor(t.priority)}`}>
                      {t.priority}
                    </span>
                  </div>

                  {/* Middle Row: Title */}
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-xs text-slate-100 leading-snug group-hover:text-indigo-300 transition-colors line-clamp-2">
                      {t.title}
                    </h4>
                    {t.description && (
                      <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>
                    )}
                  </div>

                  {/* Bottom Row: Status badge, Estimation, Assignee */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-900/80 text-[10px]">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${getStatusColor(t.status)}`}>
                      {t.status.replace('_', ' ')}
                    </span>

                    <div className="flex items-center gap-2 min-w-0">
                      {t.estimatedHours !== null && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 mr-1.5" title="Estimation">
                          <Clock className="w-3.5 h-3.5 text-slate-650" />
                          <span>{t.estimatedHours}h</span>
                        </div>
                      )}
                      
                      {t.assignee ? (
                        <div className="flex items-center gap-1.5 min-w-0" title={`Assignee: ${t.assignee.firstName || t.assignee.email}`}>
                          <div className="w-5.5 h-5.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold flex items-center justify-center shrink-0 text-[8px] uppercase">
                            {t.assignee.firstName ? t.assignee.firstName[0] : t.assignee.email[0]}
                          </div>
                          <span className="text-slate-400 font-semibold truncate max-w-[80px]">
                            {t.assignee.firstName || t.assignee.email.split('@')[0]}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-slate-600 italic">
                          <User className="w-3.5 h-3.5 text-slate-700" />
                          <span>Unassigned</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-905 border border-slate-900 rounded-2xl">
              <ListTodo className="w-12 h-12 text-slate-700 mx-auto mb-3.5" />
              <h3 className="text-sm font-bold text-slate-250">No tasks found</h3>
              <p className="text-xs text-slate-500 mt-1">Adjust filters or create a new task to get started.</p>
            </div>
          )}
        </section>
      </main>

      {/* Task Creation Modal */}
      <GlobalTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        projectId={projectIdForDrawer}
        isOpen={isTaskDrawerOpen}
        onClose={() => {
          setIsTaskDrawerOpen(false);
          setSelectedTaskId(null);
          queryClient.invalidateQueries({ queryKey: ['global-tasks'] });
        }}
      />
    </div>
  );
}
