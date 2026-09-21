'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/header';
import TaskDetailDrawer from '@/components/task-detail-drawer';
import CreateTaskListModal from '@/components/create-task-list-modal';
import EditTaskListModal from '@/components/edit-task-list-modal';
import TaskListDiscussionDrawer from '@/components/task-list-discussion-drawer';
import {
  Flag,
  Calendar,
  Plus,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Inbox,
  ListTodo,
  CheckSquare,
  Clock,
  User,
  Edit2,
  Archive,
  FolderPlus,
  FolderTree,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { useFormatDate } from '@/hooks/useFormatDate';

export default function DedicatedMilestoneDetailPage() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const milestoneId = params.milestoneId as string;
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();

  // Selected Task Drawer State
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);

  // Create Task List Modal State
  const [isCreateTaskListModalOpen, setIsCreateTaskListModalOpen] = useState(false);
  const [editingTaskList, setEditingTaskList] = useState<any>(null);
  const [discussionTaskListId, setDiscussionTaskListId] = useState<string | null>(null);

  // Create Task Modal State
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [createTaskTitle, setCreateTaskTitle] = useState('');
  const [createTaskDescription, setCreateTaskDescription] = useState('');
  const [createTaskPriority, setCreateTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [createTaskType, setCreateTaskType] = useState<'TASK' | 'BUG' | 'STORY' | 'IMPROVEMENT'>('TASK');
  const [createTaskAssigneeId, setCreateTaskAssigneeId] = useState('');
  const [createTaskEstimatedHours, setCreateTaskEstimatedHours] = useState<number | null>(null);
  const [createTaskDueDate, setCreateTaskDueDate] = useState('');
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);

  // Fetch Project Details
  const { data: project, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
    enabled: isAuthenticated && !!projectId,
  });

  // Fetch Project Milestones
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/milestones`);
      return res.data;
    },
    enabled: isAuthenticated && !!projectId,
  });

  // Fetch Milestone Details
  const { data: milestone, isLoading: isLoadingMilestone, error: milestoneError } = useQuery({
    queryKey: ['milestone', milestoneId],
    queryFn: async () => {
      const res = await api.get(`/milestones/${milestoneId}`);
      return res.data;
    },
    enabled: isAuthenticated && !!milestoneId,
  });

  // Fetch Milestone Tasks
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/tasks`);
      return res.data;
    },
    enabled: isAuthenticated && !!projectId,
  });

  // Create Task Mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/tasks', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestone', milestoneId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      setIsCreateTaskModalOpen(false);
      setCreateTaskTitle('');
      setCreateTaskDescription('');
      setCreateTaskPriority('MEDIUM');
      setCreateTaskType('TASK');
      setCreateTaskAssigneeId('');
      setCreateTaskEstimatedHours(null);
      setCreateTaskDueDate('');
      setCreateTaskError(null);
    },
    onError: (err: any) => {
      setCreateTaskError(err.response?.data?.message || 'Failed to create task');
    },
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateTaskError(null);
    if (!createTaskTitle.trim()) {
      setCreateTaskError('Task title is required');
      return;
    }
    createTaskMutation.mutate({
      title: createTaskTitle.trim(),
      description: createTaskDescription.trim() || null,
      priority: createTaskPriority,
      type: createTaskType,
      assigneeId: createTaskAssigneeId || null,
      estimatedHours: createTaskEstimatedHours,
      dueDate: createTaskDueDate || null,
      projectId,
      milestoneId,
    });
  };

  if (isLoading || isLoadingProject || isLoadingMilestone) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (milestoneError || !milestone) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <div>
            <h1 className="text-xl font-bold text-slate-100">Milestone Not Found</h1>
            <p className="text-slate-400 text-sm mt-2">
              The milestone you are looking for does not exist or has been removed.
            </p>
          </div>
          <Link
            href={`/projects/${projectId}?tab=milestones`}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg text-sm transition-all duration-150 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Project Milestones
          </Link>
        </div>
      </div>
    );
  }

  const milestoneTasks = tasks.filter((t: any) => t.milestoneId === milestoneId);

  const getMilestoneStatusColor = (msStatus: string) => {
    switch (msStatus) {
      case 'PLANNED':
        return 'bg-slate-900 text-slate-400 border border-slate-800';
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'ACHIEVED':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'MISSED':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default:
        return 'bg-slate-700 text-slate-350';
    }
  };

  const getTaskStatusBadgeColor = (taskStatus: string) => {
    switch (taskStatus) {
      case 'DONE':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'REVIEW':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'TODO':
        return 'bg-slate-900 text-slate-400 border border-slate-800';
      case 'BLOCKED':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Header */}
      <Header
        title={
          <span className="font-bold text-base text-slate-100 flex items-center gap-2">
            <Flag className="w-4 h-4 text-indigo-400" />
            {milestone.title}
            <span className={`ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getMilestoneStatusColor(milestone.status)}`}>
              {milestone.status.replace('_', ' ')}
            </span>
          </span>
        }
        subtitle={`Milestone View • ${project?.name || 'Project'}`}
        backHref={`/projects/${projectId}?tab=milestones`}
      >
        {hasPermission('CREATE_TASK') && (
          <button
            onClick={() => setIsCreateTaskModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        )}
      </Header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
          <Link href={`/projects/${projectId}?tab=milestones`} className="hover:text-indigo-400 transition-colors">
            {project?.name || 'Project'}
          </Link>
          <span>/</span>
          <Link href={`/projects/${projectId}?tab=milestones`} className="hover:text-indigo-400 transition-colors">
            Milestones
          </Link>
          <span>/</span>
          <span className="text-slate-200">{milestone.title}</span>
        </div>

        {/* Milestone Detail Card */}
        <article className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />

          <div className="space-y-3">
            <h2 className="text-xl font-extrabold text-slate-100">{milestone.title}</h2>
            {milestone.description && (
              <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                {milestone.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-slate-900/80">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Timeline</span>
              <div className="flex flex-wrap gap-3 text-xs text-slate-300 font-semibold">
                {milestone.startDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Start: {formatDate(milestone.startDate)}
                  </span>
                )}
                {milestone.dueDate ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Due: {formatDate(milestone.dueDate)}
                  </span>
                ) : (
                  <span className="text-slate-500 italic">No due date set</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tasks Progress</span>
              <span className="text-sm font-bold text-slate-200">
                {milestone.completedTasks} / {milestone.totalTasks} Deliverables Completed
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Progress Percentage</span>
                <span className="font-mono text-indigo-400 font-black">{milestone.progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 border border-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${milestone.progress}%` }}
                />
              </div>
            </div>
          </div>
        </article>

        {/* Associated Task Lists Section */}
        {milestone?.taskLists && milestone.taskLists.length > 0 && (
          <section className="bg-slate-900/20 border border-slate-900 rounded-3xl p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-indigo-400" />
                Associated Task Lists ({milestone.taskLists.length})
              </h3>
              {hasPermission('CREATE_TASK') && (
                <button
                  type="button"
                  onClick={() => setIsCreateTaskListModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Add Task List</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {milestone.taskLists.map((tl: any) => (
                <div
                  key={tl.id}
                  onClick={() => router.push(`/projects/${projectId}?tab=tasks`)}
                  className="bg-slate-950/60 border border-slate-900 hover:border-indigo-500/40 rounded-2xl p-4 transition-all cursor-pointer group space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-200 group-hover:text-indigo-300 transition-colors truncate">
                      {tl.name}
                    </span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        tl.flag === 'INTERNAL'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {tl.flag}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDiscussionTaskListId(tl.id);
                        }}
                        title="Open task list discussion"
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-300 rounded-lg transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                      </button>
                      {hasPermission('CREATE_TASK') && (
                        <button
                          type="button"
                          onClick={() => setEditingTaskList(tl)}
                          title="Move or edit task list"
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-300 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {tl.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-1">{tl.description}</p>
                  )}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Progress</span>
                      <span className="font-mono text-indigo-400 font-bold">{tl.progress || 0}% ({tl.completedTasks || 0}/{tl.totalTasks || 0})</span>
                    </div>
                    <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${tl.progress || 0}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Linked Tasks Section */}
        <section className="bg-slate-900/20 border border-slate-900 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-900 pb-4">
            <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
              <Inbox className="w-4 h-4 text-indigo-400" />
              Tasks & Deliverables ({milestoneTasks.length})
            </h3>
            {hasPermission('CREATE_TASK') && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreateTaskListModalOpen(true)}
                  className="px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                >
                  <FolderPlus className="w-4 h-4 text-indigo-400" />
                  <span>Add Task List</span>
                </button>
                <button
                  onClick={() => setIsCreateTaskModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Task</span>
                </button>
              </div>
            )}
          </div>

          {milestoneTasks.length === 0 ? (
            /* Zoho-style empty state inside dedicated milestone page */
            <div className="bg-slate-950/40 border border-slate-900/80 rounded-3xl p-10 md:p-14 text-center space-y-5 max-w-lg mx-auto relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

              <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-indigo-600/20 to-blue-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/10">
                <ListTodo className="w-8 h-8 text-indigo-400" />
              </div>

              <div className="space-y-1.5 max-w-sm mx-auto">
                <h4 className="font-extrabold text-base text-slate-100">No task lists available</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  You don't have any active tasks. Yet to associate tasks in this Milestone.
                </p>
              </div>

              {hasPermission('CREATE_TASK') && (
                <div className="flex items-center justify-center gap-2.5">
                  <button
                    onClick={() => setIsCreateTaskListModalOpen(true)}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4 text-indigo-400" />
                    <span>Add Task List</span>
                  </button>
                  <button
                    onClick={() => setIsCreateTaskModalOpen(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all inline-flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Task</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {milestoneTasks.map((t: any) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTaskId(t.id);
                    setIsTaskDrawerOpen(true);
                  }}
                  className="bg-slate-950/60 border border-slate-900 hover:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all cursor-pointer group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-indigo-400">
                        {project?.projectCode}-{t.taskNumber}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${getTaskStatusBadgeColor(t.status)}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h5 className="font-extrabold text-xs text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2">
                      {t.title}
                    </h5>
                    {t.description && (
                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>
                    )}
                  </div>

                  {t.assignee && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 font-semibold pt-3 border-t border-slate-900">
                      <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold flex items-center justify-center text-[8px] uppercase">
                        {t.assignee.firstName ? t.assignee.firstName[0] : t.assignee.email[0]}
                      </div>
                      <span className="truncate">
                        {t.assignee.firstName ? `${t.assignee.firstName} ${t.assignee.lastName || ''}` : t.assignee.email}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Task Details Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        projectId={projectId}
        isOpen={isTaskDrawerOpen}
        onClose={() => {
          setIsTaskDrawerOpen(false);
          setSelectedTaskId(null);
        }}
        onSelectTask={(newTaskId) => {
          setSelectedTaskId(newTaskId);
          setIsTaskDrawerOpen(true);
        }}
      />

      {/* CREATE TASK MODAL */}
      {isCreateTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-400" />
                Add Task to {milestone.title}
              </h3>
              <button
                onClick={() => setIsCreateTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-800 transition-all text-xl"
              >
                &times;
              </button>
            </div>

            {createTaskError && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-xs p-4 rounded-xl flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{createTaskError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design Landing Page Wireframes"
                  value={createTaskTitle}
                  onChange={(e) => setCreateTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Task details and acceptance criteria..."
                  value={createTaskDescription}
                  onChange={(e) => setCreateTaskDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</label>
                  <select
                    value={createTaskPriority}
                    onChange={(e) => setCreateTaskPriority(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</label>
                  <select
                    value={createTaskType}
                    onChange={(e) => setCreateTaskType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                    <option value="STORY">Story</option>
                    <option value="IMPROVEMENT">Improvement</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assignee</label>
                  <select
                    value={createTaskAssigneeId}
                    onChange={(e) => setCreateTaskAssigneeId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {project?.members?.map((m: any) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.firstName ? `${m.user.firstName} ${m.user.lastName || ''}` : m.user.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</label>
                  <input
                    type="date"
                    value={createTaskDueDate}
                    onChange={(e) => setCreateTaskDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateTaskModalOpen(false)}
                  className="px-4.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-900 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTaskMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                >
                  {createTaskMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Task List Modal */}
      <CreateTaskListModal
        isOpen={isCreateTaskListModalOpen}
        onClose={() => setIsCreateTaskListModalOpen(false)}
        projectId={projectId}
        milestones={milestones.length > 0 ? milestones : (milestone ? [milestone] : [])}
        defaultMilestoneId={milestoneId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['milestone', milestoneId] });
          queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
          queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
          queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
        }}
      />

      {/* Edit Task List Modal */}
      {editingTaskList && (
        <EditTaskListModal
          isOpen={!!editingTaskList}
          onClose={() => {
            setEditingTaskList(null);
            queryClient.invalidateQueries({ queryKey: ['milestone', milestoneId] });
            queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
          }}
          taskList={editingTaskList}
          projectId={projectId}
          milestones={milestones.length > 0 ? milestones : (milestone ? [milestone] : [])}
        />
      )}

      {/* Task List Discussion Drawer */}
      <TaskListDiscussionDrawer
        taskListId={discussionTaskListId}
        projectId={projectId}
        project={project}
        onClose={() => setDiscussionTaskListId(null)}
      />

    </div>
  );
}
