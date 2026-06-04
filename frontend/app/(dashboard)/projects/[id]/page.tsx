'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderKanban,
  User,
  Users,
  Calendar,
  Lock,
  Globe,
  Archive,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Settings2,
  Clock,
  AlertTriangle,
  UploadCloud,
  FileText,
  UserCheck,
  ListTodo,
  CheckSquare,
  Bug,
  BookOpen,
  Sparkles,
  Filter,
  X,
} from 'lucide-react';
import Link from 'next/link';
import TaskDetailDrawer from '@/components/task-detail-drawer';
import KanbanBoard from '@/components/kanban-board';
import TimeLogsTab from '@/components/time-logs-tab';
import MilestonesTab from '@/components/milestones-tab';

export default function ProjectDetailsPage() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();

  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'members' | 'timeLogs' | 'milestones'>('overview');

  // Component UI State (Project Info)
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoName, setInfoName] = useState('');
  const [infoDescription, setInfoDescription] = useState('');
  const [infoStartDate, setInfoStartDate] = useState('');
  const [infoEndDate, setInfoEndDate] = useState('');
  const [infoVisibility, setInfoVisibility] = useState<'PRIVATE' | 'ORGANIZATION'>('PRIVATE');
  const [infoStatus, setInfoStatus] = useState<'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'>('ACTIVE');
  const [infoError, setInfoError] = useState<string | null>(null);

  // Add Member State
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedMemberRole, setSelectedMemberRole] = useState<'OWNER' | 'MANAGER' | 'MEMBER'>('MEMBER');
  const [memberError, setMemberError] = useState<string | null>(null);

  // Tasks Filter State
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Task Drawer State
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);

  // Create Task Form State
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [createTaskTitle, setCreateTaskTitle] = useState('');
  const [createTaskDescription, setCreateTaskDescription] = useState('');
  const [createTaskPriority, setCreateTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [createTaskType, setCreateTaskType] = useState<'TASK' | 'BUG' | 'STORY' | 'IMPROVEMENT'>('TASK');
  const [createTaskAssigneeId, setCreateTaskAssigneeId] = useState('');
  const [createTaskEstimatedHours, setCreateTaskEstimatedHours] = useState<number | null>(null);
  const [createTaskDueDate, setCreateTaskDueDate] = useState('');
  const [createTaskMilestoneId, setCreateTaskMilestoneId] = useState('');
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [reorderError, setReorderError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch Project Details Query
  const { data: project, isLoading: isLoadingProject, error: projectLoadError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
    enabled: isAuthenticated && !!projectId,
  });

  // Fetch Tasks for Project Query
  const { data: tasks, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/tasks`);
      return res.data;
    },
    enabled: isAuthenticated && !!projectId,
  });

  // Fetch Milestones Query
  const { data: milestones = [], isLoading: isLoadingMilestones } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/milestones`);
      return res.data;
    },
    enabled: isAuthenticated && !!projectId,
  });

  // Fetch Kanban Board Query
  const { data: boardData, isLoading: isLoadingBoard } = useQuery({
    queryKey: ['board', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/board`);
      return res.data;
    },
    enabled: isAuthenticated && !!projectId,
  });

  // Reorder Task Mutation with Optimistic Updates
  const reorderTaskMutation = useMutation({
    mutationFn: async ({ taskId, status, position }: { taskId: string; status: string; position: number }) => {
      const res = await api.patch(`/tasks/${taskId}/reorder`, { status, position });
      return res.data;
    },
    onMutate: async ({ taskId, status, position }) => {
      await queryClient.cancelQueries({ queryKey: ['board', projectId] });
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });

      const previousBoard = queryClient.getQueryData(['board', projectId]);
      const previousTasks = queryClient.getQueryData(['tasks', projectId]);

      if (previousBoard) {
        const board = JSON.parse(JSON.stringify(previousBoard)) as any;
        
        let foundTask: any = null;
        let sourceColKey: string = '';
        for (const colKey of Object.keys(board)) {
          const index = board[colKey].findIndex((t: any) => t.id === taskId);
          if (index !== -1) {
            foundTask = board[colKey][index];
            board[colKey].splice(index, 1);
            sourceColKey = colKey;
            break;
          }
        }

        if (foundTask) {
          const statusMap: Record<string, string> = {
            'TODO': 'todo',
            'IN_PROGRESS': 'inProgress',
            'REVIEW': 'review',
            'DONE': 'done',
            'BLOCKED': 'blocked',
          };
          const targetColKey = statusMap[status] || 'todo';
          foundTask.status = status;

          const targetCol = board[targetColKey] || [];
          const targetIndex = Math.max(0, Math.min(position, targetCol.length));
          targetCol.splice(targetIndex, 0, foundTask);

          board[sourceColKey] = board[sourceColKey].map((t: any, idx: number) => ({ ...t, position: idx }));
          board[targetColKey] = board[targetColKey].map((t: any, idx: number) => ({ ...t, position: idx }));

          queryClient.setQueryData(['board', projectId], board);
        }
      }

      setReorderError(null);
      return { previousBoard, previousTasks };
    },
    onError: (err: any, variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(['board', projectId], context.previousBoard);
      }
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks);
      }
      setReorderError(err.response?.data?.message || 'Failed to reorder task: Invalid transition or permissions.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  // Fetch Organization Members (for adding to project)
  const { data: orgMembers, isLoading: isLoadingOrgMembers } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => {
      const res = await api.get('/organization/members');
      return res.data;
    },
    enabled: isAuthenticated && hasPermission('EDIT_PROJECT'),
  });

  // Populate edit fields on load
  useEffect(() => {
    if (project) {
      setInfoName(project.name);
      setInfoDescription(project.description || '');
      setInfoStartDate(project.startDate ? project.startDate.split('T')[0] : '');
      setInfoEndDate(project.endDate ? project.endDate.split('T')[0] : '');
      setInfoVisibility(project.visibility);
      setInfoStatus(project.status);
    }
  }, [project]);

  // Update Project Info Mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch(`/projects/${projectId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsEditingInfo(false);
      setInfoError(null);
    },
    onError: (err: any) => {
      setInfoError(err.response?.data?.message || 'Failed to update project');
    },
  });

  // Archive Project Mutation
  const archiveProjectMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/projects/${projectId}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setInfoError(null);
    },
    onError: (err: any) => {
      setInfoError(err.response?.data?.message || 'Failed to archive project');
    },
  });

  // Update Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: {
      allowTimeTracking?: boolean;
      allowIssueTracking?: boolean;
      allowFileUploads?: boolean;
    }) => {
      const res = await api.patch(`/projects/${projectId}/settings`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  // Add Member Mutation
  const addMemberMutation = useMutation({
    mutationFn: async (data: { userId: string; role: 'OWNER' | 'MANAGER' | 'MEMBER' }) => {
      const res = await api.post(`/projects/${projectId}/members`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setSelectedUserId('');
      setSelectedMemberRole('MEMBER');
      setMemberError(null);
    },
    onError: (err: any) => {
      setMemberError(err.response?.data?.message || 'Failed to add member');
    },
  });

  // Remove Member Mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberUserId: string) => {
      const res = await api.delete(`/projects/${projectId}/members/${memberUserId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setMemberError(null);
    },
    onError: (err: any) => {
      setMemberError(err.response?.data?.message || 'Failed to remove member');
    },
  });

  // Create Task Mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/tasks', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      setIsCreateTaskModalOpen(false);
      setCreateTaskTitle('');
      setCreateTaskDescription('');
      setCreateTaskPriority('MEDIUM');
      setCreateTaskType('TASK');
      setCreateTaskAssigneeId('');
      setCreateTaskEstimatedHours(null);
      setCreateTaskDueDate('');
      setCreateTaskMilestoneId('');
      setCreateTaskError(null);
    },
    onError: (err: any) => {
      setCreateTaskError(err.response?.data?.message || 'Failed to create task');
    },
  });

  // Handlers
  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setInfoError(null);
    if (!infoName.trim()) {
      setInfoError('Project name is required');
      return;
    }
    updateProjectMutation.mutate({
      name: infoName,
      description: infoDescription || null,
      startDate: infoStartDate || null,
      endDate: infoEndDate || null,
      visibility: infoVisibility,
      status: infoStatus,
    });
  };

  const handleArchive = () => {
    if (confirm('Are you sure you want to archive this project? This will freeze all project settings and members.')) {
      archiveProjectMutation.mutate();
    }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);
    if (!selectedUserId) {
      setMemberError('Please select a member to add');
      return;
    }
    addMemberMutation.mutate({
      userId: selectedUserId,
      role: selectedMemberRole,
    });
  };

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
      milestoneId: createTaskMilestoneId || null,
    });
  };

  if (isLoading || isLoadingProject) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (projectLoadError || !project) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <div>
            <h1 className="text-xl font-bold text-slate-100">Project Not Found</h1>
            <p className="text-slate-400 text-sm mt-2">
              The project you are looking for does not exist or you do not have permission to view it.
            </p>
          </div>
          <Link
            href="/projects"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg text-sm transition-all duration-150 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const isArchived = project.status === 'ARCHIVED';
  const canEdit = hasPermission('EDIT_PROJECT') && !isArchived;
  const canArchive = hasPermission('ARCHIVE_PROJECT') && !isArchived;
  const canCreateTask = hasPermission('CREATE_TASK') && !isArchived;

  // Filter org members to only show those who are not already in the project
  const availableUsers = orgMembers?.filter((om: any) => {
    const isAlreadyMember = project.members.some((pm: any) => pm.userId === om.userId);
    return !isAlreadyMember;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'DONE':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'PLANNING':
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'REVIEW':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'COMPLETED':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'BLOCKED':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'TODO':
        return 'bg-slate-900 text-slate-400 border border-slate-800';
      case 'ARCHIVED':
        return 'bg-slate-850 text-slate-400 border border-slate-700/50';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-450 border border-rose-500/25';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-450 border border-amber-500/25';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-450 border border-blue-500/25';
      default:
        return 'bg-slate-900 text-slate-400 border border-slate-800';
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

  const getAddedByName = (addedById: string | null) => {
    if (!addedById) return 'System';
    if (addedById === user?.sub) return 'You';
    const om = orgMembers?.find((m: any) => m.userId === addedById);
    if (om) {
      return om.user.firstName ? `${om.user.firstName} ${om.user.lastName || ''}` : om.user.email;
    }
    const pm = project.members.find((m: any) => m.userId === addedById);
    if (pm) {
      return pm.user.firstName ? `${pm.user.firstName} ${pm.user.lastName || ''}` : pm.user.email;
    }
    return 'Admin';
  };

  // Client-side filtering of project tasks
  const filteredTasks = tasks?.filter((t: any) => {
    const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
    const matchPriority = filterPriority === 'ALL' || t.priority === filterPriority;
    const matchType = filterType === 'ALL' || t.type === filterType;
    return matchStatus && matchPriority && matchType;
  }) || [];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/projects"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Project Module</span>
              <span className="font-bold text-base text-slate-100 flex items-center gap-2">
                {project.name}
                <span className="text-xs font-mono px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-indigo-400 font-normal">
                  {project.projectCode}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Project Progress
                <span className="font-mono text-indigo-400">{project.progress ?? 0}%</span>
              </div>
              <div className="w-28 h-1.5 bg-slate-950 border border-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                  style={{ width: `${project.progress ?? 0}%` }}
                />
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(project.status)}`}>
              {project.status}
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Banner Warning for Archived Project */}
        {isArchived && (
          <div className="bg-amber-950/20 border border-amber-900/60 text-amber-200 p-4.5 rounded-2xl flex items-start gap-3.5">
            <AlertTriangle className="w-5.5 h-5.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Archived Project Sandbox</h4>
              <p className="text-amber-400/80 text-xs mt-1">
                This project has been archived. All settings, memberships, and core updates are frozen and cannot be modified.
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Tab Selector */}
        <div className="flex border-b border-slate-900 gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3.5 text-xs font-bold uppercase tracking-wider transition-all relative ${
              activeTab === 'overview' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview
            {activeTab === 'overview' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-3.5 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 ${
              activeTab === 'tasks' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tasks
            <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-slate-400">
              {tasks?.length || 0}
            </span>
            {activeTab === 'tasks' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`pb-3.5 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 ${
              activeTab === 'members' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Members
            <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-slate-400">
              {project.members.length}
            </span>
            {activeTab === 'members' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('milestones')}
            className={`pb-3.5 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 ${
              activeTab === 'milestones' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Milestones
            <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-slate-400">
              {milestones?.length || 0}
            </span>
            {activeTab === 'milestones' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
            )}
          </button>

          {project.settings?.allowTimeTracking && (
            <button
              onClick={() => setActiveTab('timeLogs')}
              className={`pb-3.5 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 ${
                activeTab === 'timeLogs' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Time Logs
              {activeTab === 'timeLogs' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          )}
        </div>

        {/* Tab contents */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Project Info & Settings */}
            <div className="lg:col-span-2 space-y-8">
              {/* Project Details Card */}
              <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[30%] h-[30%] rounded-full bg-indigo-500/[0.02] blur-[40px]" />
                
                <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                  <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-indigo-400" />
                    Project Information
                  </h3>
                  {canEdit && !isEditingInfo && (
                    <button
                      onClick={() => setIsEditingInfo(true)}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                    >
                      Edit Details
                    </button>
                  )}
                </div>

                {infoError && (
                  <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-xs p-4 rounded-xl flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{infoError}</span>
                  </div>
                )}

                {isEditingInfo ? (
                  <form onSubmit={handleSaveInfo} className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Project Name</label>
                      <input
                        type="text"
                        required
                        value={infoName}
                        onChange={(e) => setInfoName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Description</label>
                      <textarea
                        value={infoDescription}
                        onChange={(e) => setInfoDescription(e.target.value)}
                        rows={3}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Start Date</label>
                        <input
                          type="date"
                          value={infoStartDate}
                          onChange={(e) => setInfoStartDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">End Date</label>
                        <input
                          type="date"
                          value={infoEndDate}
                          onChange={(e) => setInfoEndDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Visibility Setting</label>
                        <select
                          value={infoVisibility}
                          onChange={(e) => setInfoVisibility(e.target.value as any)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                        >
                          <option value="PRIVATE">Private</option>
                          <option value="ORGANIZATION">Organization</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</label>
                        <select
                          value={infoStatus}
                          onChange={(e) => setInfoStatus(e.target.value as any)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                        >
                          <option value="PLANNING">Planning</option>
                          <option value="ACTIVE">Active</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-900">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingInfo(false);
                          setInfoError(null);
                        }}
                        className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-900 active:scale-98 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updateProjectMutation.isPending}
                        className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-98 transition-all flex items-center gap-1.5"
                      >
                        {updateProjectMutation.isPending && <Loader2 className="w-3 animate-spin" />}
                        Save Details
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Project Name</span>
                        <p className="text-sm font-bold text-slate-100">{project.name}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Project Code</span>
                        <p className="text-sm font-mono font-semibold text-indigo-400">{project.projectCode}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Created By</span>
                        <p className="text-sm font-semibold text-slate-200">
                          {project.owner.firstName
                            ? `${project.owner.firstName} ${project.owner.lastName || ''}`
                            : project.owner.email}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Visibility Setting</span>
                        <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 capitalize">
                          {project.visibility === 'ORGANIZATION' ? <Globe className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-indigo-400" />}
                          {project.visibility.toLowerCase()}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Start Date</span>
                        <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not scheduled'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">End Date</span>
                        <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'Not scheduled'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-4 border-t border-slate-900">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Description</span>
                      <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
                        {project.description || 'No description provided for this project.'}
                      </p>
                    </div>
                  </div>
                )}
              </article>

              {/* Project Settings/Feature Toggles Card */}
              <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 md:p-8 space-y-6">
                <div className="border-b border-slate-900 pb-4">
                  <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-indigo-400" />
                    Feature Access Controls
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Time Tracking Toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400">
                        <Clock className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-200">Allow Time Tracking</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Enable team members to log worked hours against tasks.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={project.settings?.allowTimeTracking ?? true}
                      onChange={(e) => updateSettingsMutation.mutate({ allowTimeTracking: e.target.checked })}
                      className="h-4.5 w-8 rounded-full bg-slate-800 border-slate-700 checked:bg-indigo-600 focus:ring-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed appearance-none checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all checked:after:border-indigo-600 relative transition-colors duration-200"
                      style={{
                        backgroundColor: (project.settings?.allowTimeTracking ?? true) ? '#4f46e5' : '#1e293b',
                        borderRadius: '9999px',
                      }}
                    />
                  </div>

                  {/* Issue Tracking Toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-rose-400">
                        <AlertTriangle className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-200">Allow Issue / Bug Tracking</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Enable bug submission and issue lifecycle tracking.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={project.settings?.allowIssueTracking ?? true}
                      onChange={(e) => updateSettingsMutation.mutate({ allowIssueTracking: e.target.checked })}
                      className="h-4.5 w-8 rounded-full bg-slate-800 border-slate-700 checked:bg-indigo-600 focus:ring-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed appearance-none checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all checked:after:border-indigo-600 relative transition-colors duration-200"
                      style={{
                        backgroundColor: (project.settings?.allowIssueTracking ?? true) ? '#4f46e5' : '#1e293b',
                        borderRadius: '9999px',
                      }}
                    />
                  </div>

                  {/* File Uploads Toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-blue-400">
                        <UploadCloud className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-200">Allow Document Uploads</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Enable file sharing and repository storage inside tasks.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={project.settings?.allowFileUploads ?? true}
                      onChange={(e) => updateSettingsMutation.mutate({ allowFileUploads: e.target.checked })}
                      className="h-4.5 w-8 rounded-full bg-slate-800 border-slate-700 checked:bg-indigo-600 focus:ring-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed appearance-none checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all checked:after:border-indigo-600 relative transition-colors duration-200"
                      style={{
                        backgroundColor: (project.settings?.allowFileUploads ?? true) ? '#4f46e5' : '#1e293b',
                        borderRadius: '9999px',
                      }}
                    />
                  </div>
                </div>
              </article>
            </div>

            {/* Right Column: Danger Zone */}
            <div className="space-y-8">
              {canArchive && (
                <article className="border border-rose-900/40 bg-rose-950/5 rounded-2xl p-6 space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-rose-200 text-sm flex items-center gap-2">
                      <Archive className="w-4 h-4 text-rose-400" />
                      Danger Zone
                    </h4>
                    <p className="text-[10px] text-rose-400/80">
                      Archiving this project freezes all active settings, memberships, and metadata. Standard users cannot perform writes on archived modules. This action is irreversible.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleArchive}
                    className="w-full py-2.5 border border-rose-900/40 hover:border-rose-800 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 font-semibold rounded-xl text-xs transition-all duration-150 flex items-center justify-center gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    Archive Project
                  </button>
                </article>
              )}
            </div>
          </div>
        )}

        {/* Tasks View Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {reorderError && (
              <div className="bg-rose-950/40 border border-rose-900/60 text-rose-200 p-4 rounded-xl flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-450 flex-shrink-0" />
                <div className="flex-1 flex justify-between items-center">
                  <span className="text-xs font-semibold">{reorderError}</span>
                  <button onClick={() => setReorderError(null)} className="p-1 hover:bg-rose-900/30 rounded-lg">
                    <X className="w-4 h-4 text-rose-400" />
                  </button>
                </div>
              </div>
            )}

            {/* Filter controls header */}
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              
              {/* Left Filters */}
              <div className="flex flex-wrap items-center gap-3">
                {/* View Toggle */}
                <div className="flex bg-slate-950 border border-slate-850 p-1 rounded-xl gap-1 mr-2">
                  <button
                    onClick={() => setViewMode('board')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === 'board' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Board
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    List
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold mr-1">
                  <Filter className="w-4 h-4 text-indigo-400" />
                  <span>Filter by:</span>
                </div>

                {/* Status Filter - Only enable in List view */}
                <select
                  value={filterStatus}
                  disabled={viewMode === 'board'}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={`px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-350 focus:outline-none focus:border-indigo-500 font-semibold ${
                    viewMode === 'board' ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                  <option value="BLOCKED">Blocked</option>
                </select>

                {/* Priority Filter */}
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-350 focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>

                {/* Type Filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-350 focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="ALL">All Types</option>
                  <option value="TASK">Task</option>
                  <option value="BUG">Bug</option>
                  <option value="STORY">Story</option>
                  <option value="IMPROVEMENT">Improvement</option>
                </select>
              </div>

              {/* Right: Create Button */}
              {canCreateTask && (
                <button
                  onClick={() => setIsCreateTaskModalOpen(true)}
                  className="w-full md:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              )}
            </div>

            {/* Conditionally Render Board vs List */}
            {viewMode === 'board' ? (
              isLoadingBoard ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : (
                <KanbanBoard
                  projectId={projectId}
                  projectCode={project.projectCode}
                  boardData={{
                    todo: boardData?.todo?.filter((t: any) => {
                      const matchPriority = filterPriority === 'ALL' || t.priority === filterPriority;
                      const matchType = filterType === 'ALL' || t.type === filterType;
                      return matchPriority && matchType;
                    }) || [],
                    inProgress: boardData?.inProgress?.filter((t: any) => {
                      const matchPriority = filterPriority === 'ALL' || t.priority === filterPriority;
                      const matchType = filterType === 'ALL' || t.type === filterType;
                      return matchPriority && matchType;
                    }) || [],
                    review: boardData?.review?.filter((t: any) => {
                      const matchPriority = filterPriority === 'ALL' || t.priority === filterPriority;
                      const matchType = filterType === 'ALL' || t.type === filterType;
                      return matchPriority && matchType;
                    }) || [],
                    done: boardData?.done?.filter((t: any) => {
                      const matchPriority = filterPriority === 'ALL' || t.priority === filterPriority;
                      const matchType = filterType === 'ALL' || t.type === filterType;
                      return matchPriority && matchType;
                    }) || [],
                    blocked: boardData?.blocked?.filter((t: any) => {
                      const matchPriority = filterPriority === 'ALL' || t.priority === filterPriority;
                      const matchType = filterType === 'ALL' || t.type === filterType;
                      return matchPriority && matchType;
                    }) || [],
                  }}
                  isReadOnly={isArchived || !hasPermission('EDIT_TASK')}
                  onCardClick={(taskId) => {
                    setSelectedTaskId(taskId);
                    setIsTaskDrawerOpen(true);
                  }}
                  onReorder={async (taskId, targetStatus, targetPosition) => {
                    try {
                      await reorderTaskMutation.mutateAsync({ taskId, status: targetStatus, position: targetPosition });
                    } catch (e) {
                      // Already handled in onError
                    }
                  }}
                />
              )
            ) : (
              /* Tasks list grid */
              isLoadingTasks ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : filteredTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTasks.map((t: any) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTaskId(t.id);
                        setIsTaskDrawerOpen(true);
                      }}
                      className="bg-slate-900/30 border border-slate-900 hover:border-slate-800 hover:bg-slate-900/50 rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-[20%] h-[20%] rounded-full bg-indigo-500/[0.01] group-hover:bg-indigo-500/[0.03] blur-[25px] transition-all" />

                      {/* Top Row: Code, Type Icon, Priority */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-950 border border-slate-800/80 rounded text-slate-400 font-semibold group-hover:text-indigo-400 transition-colors">
                            {project.projectCode}-{t.taskNumber}
                          </span>
                          <div className="p-1 bg-slate-950/40 border border-slate-800/50 rounded" title={t.type}>
                            {getTypeIcon(t.type)}
                          </div>
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

                      {/* Bottom Row: Status badge, Assignee initials/name */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-900/80 text-[10px]">
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
                <div className="text-center py-16 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl">
                  <ListTodo className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-200">No tasks found</h3>
                  <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or create a new task.</p>
                </div>
              )
            )}
          </div>
        )}

        {/* Project Members Tab */}
        {activeTab === 'members' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Member Management Widget */}
            <div className="lg:col-span-2 space-y-6">
              <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-6">
                <div className="border-b border-slate-900 pb-4">
                  <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                    <Users className="w-4.5 h-4.5 text-indigo-400" />
                    Project Members ({project.members.length})
                  </h3>
                </div>

                {memberError && (
                  <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-[11px] p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 text-rose-400 flex-shrink-0" />
                    <span>{memberError}</span>
                  </div>
                )}

                {/* Add Member Form */}
                {canEdit && availableUsers && availableUsers.length > 0 && (
                  <form onSubmit={handleAddMember} className="space-y-3 p-4 bg-slate-950/40 border border-slate-900 rounded-xl">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                      Add Team Member
                    </div>
                    
                    <div className="space-y-1">
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Select User...</option>
                        {availableUsers.map((m: any) => (
                          <option key={m.user.id} value={m.user.id}>
                            {m.user.firstName
                              ? `${m.user.firstName} ${m.user.lastName || ''} (${m.user.email})`
                              : m.user.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <select
                        value={selectedMemberRole}
                        onChange={(e) => setSelectedMemberRole(e.target.value as any)}
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="MEMBER">Member (Standard)</option>
                        <option value="MANAGER">Manager (Edit Privs)</option>
                        <option value="OWNER">Owner (Full Admin)</option>
                      </select>

                      <button
                        type="submit"
                        disabled={addMemberMutation.isPending}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </div>
                  </form>
                )}

                {/* Members List */}
                <ul className="space-y-3">
                  {project.members.map((m: any) => {
                    const isOwner = m.role === 'OWNER';
                    const isSelf = m.userId === user?.sub;
                    return (
                      <li
                        key={m.id}
                        className="flex items-center justify-between p-3.5 bg-slate-950/20 border border-slate-900 hover:border-slate-800/85 rounded-xl transition-all"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-200 truncate">
                              {m.user.firstName
                                ? `${m.user.firstName} ${m.user.lastName || ''}`
                                : m.user.email}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${
                              isOwner
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : m.role === 'MANAGER'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700/50'
                            }`}>
                              {m.role}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{m.user.email}</div>
                          <div className="text-[9px] text-slate-650 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                            Added by {getAddedByName(m.addedBy)}
                          </div>
                        </div>

                        {canEdit && !isSelf && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to remove this member from the project?`)) {
                                removeMemberMutation.mutate(m.userId);
                              }
                            }}
                            disabled={removeMemberMutation.isPending}
                            className="p-1.5 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-900/30 hover:bg-rose-500/5 rounded-lg active:scale-95 transition-all"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </article>
            </div>
            
            <div className="space-y-6">
              {/* Optional Right Column Context */}
            </div>
          </div>
        )}

        {activeTab === 'milestones' && (
          <MilestonesTab projectId={projectId} />
        )}

        {activeTab === 'timeLogs' && project.settings?.allowTimeTracking && (
          <TimeLogsTab projectId={projectId} />
        )}

      </main>

      {/* Task Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        projectId={projectId}
        isOpen={isTaskDrawerOpen}
        onClose={() => {
          setIsTaskDrawerOpen(false);
          setSelectedTaskId(null);
        }}
      />

      {/* Create Task Modal Overlay */}
      {isCreateTaskModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity"
            onClick={() => setIsCreateTaskModalOpen(false)}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
              
              <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                  <ListTodo className="w-4.5 h-4.5 text-indigo-400" />
                  Create New Project Task
                </h3>
                <button
                  onClick={() => setIsCreateTaskModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-850"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>

              <form onSubmit={handleCreateTask} className="p-6 space-y-4">
                
                {createTaskError && (
                  <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-xs p-3.5 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 text-rose-400 flex-shrink-0" />
                    <span>{createTaskError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={createTaskTitle}
                    onChange={(e) => setCreateTaskTitle(e.target.value)}
                    placeholder="E.g., Implement secure API key rotation endpoint"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    value={createTaskDescription}
                    onChange={(e) => setCreateTaskDescription(e.target.value)}
                    rows={3}
                    placeholder="Provide scope guidelines, technical considerations, or links..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Task Type
                    </label>
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

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Priority
                    </label>
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Assignee
                    </label>
                    <select
                      value={createTaskAssigneeId}
                      onChange={(e) => setCreateTaskAssigneeId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Unassigned</option>
                      {project.members.map((m: any) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.firstName ? `${m.user.firstName} ${m.user.lastName || ''}` : m.user.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Estimation (Hours)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={createTaskEstimatedHours ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseFloat(e.target.value) : null;
                        setCreateTaskEstimatedHours(val);
                      }}
                      placeholder="E.g., 6.0"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Milestone
                    </label>
                    <select
                      value={createTaskMilestoneId}
                      onChange={(e) => setCreateTaskMilestoneId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">None</option>
                      {milestones?.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={createTaskDueDate}
                      onChange={(e) => setCreateTaskDueDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateTaskModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createTaskMutation.isPending}
                    className="px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    {createTaskMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Create Task
                  </button>
                </div>

              </form>

            </div>
          </div>
        </>
      )}

    </div>
  );
}
