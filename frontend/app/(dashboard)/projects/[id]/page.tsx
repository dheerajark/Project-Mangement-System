'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  Sliders,
  DollarSign,
  Coins,
  Tag,
  Layout,
  Copy,
  PieChart,
  TrendingUp,
  Flag,
  ShieldAlert,
  Layers,
  Pencil,
  SlidersHorizontal,
  Repeat,
} from 'lucide-react';
import Link from 'next/link';
import TaskDetailDrawer from '@/components/task-detail-drawer';
import TasksTab from '@/components/tasks-tab';
import KanbanBoard from '@/components/kanban-board';
import TimeLogsTab from '@/components/time-logs-tab';
import MilestonesTab from '@/components/milestones-tab';
import IssuesTab from '@/components/issues-tab';
import NotificationBell from '@/components/notification-bell';
import Header from '@/components/header';
import ReportsTab from '@/components/reports-tab';
import DocumentsTab from '@/components/documents-tab';
import CreateProjectModal from '@/components/create-project-modal';
import AddUserModal from '@/components/add-user-modal';
import EditMemberModal from '@/components/edit-member-modal';
import ConfigureTabsModal, { DEFAULT_ENABLED_TABS } from '@/components/configure-tabs-modal';
import { useFormatDate } from '@/hooks/useFormatDate';

export default function ProjectDetailsPage() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const formatDate = useFormatDate();

  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'members' | 'timeLogs' | 'milestones' | 'issues' | 'documents' | 'reports'>('overview');

  // Component UI State (Project Info)
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoName, setInfoName] = useState('');
  const [infoDescription, setInfoDescription] = useState('');
  const [infoStartDate, setInfoStartDate] = useState('');
  const [infoEndDate, setInfoEndDate] = useState('');
  const [infoVisibility, setInfoVisibility] = useState<'PRIVATE' | 'ORGANIZATION'>('PRIVATE');
  const [infoStatus, setInfoStatus] = useState<'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'>('ACTIVE');
  const [infoCurrency, setInfoCurrency] = useState('USD');
  const [infoBudgetType, setInfoBudgetType] = useState('NONE');
  const [infoBudgetAmount, setInfoBudgetAmount] = useState('');
  const [infoBudgetHours, setInfoBudgetHours] = useState('');
  const [infoBillingMethod, setInfoBillingMethod] = useState('NONE');
  const [infoBillingRate, setInfoBillingRate] = useState('');
  const [infoTags, setInfoTags] = useState('');
  const [infoIsTemplate, setInfoIsTemplate] = useState(false);
  const [infoTaskLayout, setInfoTaskLayout] = useState('STANDARD');
  const [infoError, setInfoError] = useState<string | null>(null);

  // Add Member / Edit Member Modal States
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>('ALL');
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
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
  const [createTaskStartDate, setCreateTaskStartDate] = useState('');
  const [createTaskDueDate, setCreateTaskDueDate] = useState('');
  const [createTaskMilestoneId, setCreateTaskMilestoneId] = useState('');
  const [createTaskTaskListId, setCreateTaskTaskListId] = useState('');
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);
  const [createTaskSuccess, setCreateTaskSuccess] = useState<string | null>(null);
  const [autoOpenCreateMilestoneModal, setAutoOpenCreateMilestoneModal] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [reorderError, setReorderError] = useState<string | null>(null);

  // Create Task Recurrence State
  const [createTaskIsRecurring, setCreateTaskIsRecurring] = useState(false);
  const [createTaskFrequency, setCreateTaskFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('WEEKLY');
  const [createTaskInterval, setCreateTaskInterval] = useState(1);
  const [createTaskDaysOfWeek, setCreateTaskDaysOfWeek] = useState<number[]>([1]);
  const [createTaskDayOfMonth, setCreateTaskDayOfMonth] = useState(1);
  const [createTaskNonWorkingDayAction, setCreateTaskNonWorkingDayAction] = useState<'NEXT_WORKING_DAY' | 'PREVIOUS_WORKING_DAY' | 'EXACT_DATE'>('NEXT_WORKING_DAY');
  const [createTaskEndType, setCreateTaskEndType] = useState<'NEVER' | 'ON_DATE' | 'AFTER_OCCURRENCES'>('NEVER');
  const [createTaskEndDate, setCreateTaskEndDate] = useState('');
  const [createTaskMaxOccurrences, setCreateTaskMaxOccurrences] = useState(10);
  const [createTaskCloneSubtasks, setCreateTaskCloneSubtasks] = useState(true);

  // Tab Customization Modal State
  const [isConfigureTabsModalOpen, setIsConfigureTabsModalOpen] = useState(false);
  const [userCustomTabs, setUserCustomTabs] = useState<string[] | null>(null);

  // Load user custom tabs preference from localStorage on mount/projectId change
  useEffect(() => {
    if (!projectId || typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(`pms_project_${projectId}_tabs`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUserCustomTabs(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to parse saved tabs from localStorage', e);
    }
  }, [projectId]);

  const handleOpenCreateTaskModal = (taskListId?: string, milestoneId?: string) => {
    setCreateTaskTaskListId(taskListId || '');
    setCreateTaskMilestoneId(milestoneId || '');
    setCreateTaskStartDate('');
    setCreateTaskDueDate('');
    setCreateTaskError(null);
    setCreateTaskSuccess(null);
    setIsCreateTaskModalOpen(true);
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Handle URL deep-linking query parameters (e.g. ?tab=tasks&taskId=...)
  useEffect(() => {
    if (!searchParams) return;
    const tab = searchParams.get('tab');
    const taskId = searchParams.get('taskId');
    const issueId = searchParams.get('issueId');

    if (tab) {
      if (['overview', 'tasks', 'members', 'timeLogs', 'milestones', 'issues', 'documents', 'reports'].includes(tab)) {
        setActiveTab(tab as any);
      }
    } else if (taskId) {
      setActiveTab('tasks');
    } else if (issueId) {
      setActiveTab('issues');
    }

    if (taskId) {
      setSelectedTaskId(taskId);
      setIsTaskDrawerOpen(true);
    }
  }, [searchParams]);

  // Fetch Project Details Query
  const { data: project, isLoading: isLoadingProject, error: projectLoadError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
    enabled: isAuthenticated && !!projectId,
  });

  // Enabled tabs resolution: localStorage personal preference -> project.settings.enabledTabs -> default
  const enabledTabs: string[] = React.useMemo(() => {
    if (userCustomTabs && userCustomTabs.length > 0) {
      return Array.from(new Set(['overview', ...userCustomTabs]));
    }
    if (project?.settings?.enabledTabs) {
      try {
        const parsed = typeof project.settings.enabledTabs === 'string'
          ? JSON.parse(project.settings.enabledTabs)
          : project.settings.enabledTabs;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set(['overview', ...parsed]));
        }
      } catch {
        const split = project.settings.enabledTabs.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (split.length > 0) return Array.from(new Set(['overview', ...split]));
      }
    }
    return DEFAULT_ENABLED_TABS;
  }, [userCustomTabs, project?.settings?.enabledTabs]);

  // Keep activeTab aligned with enabled tabs
  useEffect(() => {
    if (!enabledTabs.includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [enabledTabs, activeTab]);

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

  // Fetch Task Lists Query
  const { data: taskLists = [], isLoading: isLoadingTaskLists } = useQuery({
    queryKey: ['task-lists', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/task-lists`);
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
      setInfoCurrency(project.currency || 'USD');
      setInfoBudgetType(project.budgetType || 'NONE');
      setInfoBudgetAmount(project.budgetAmount !== null && project.budgetAmount !== undefined ? String(project.budgetAmount) : '');
      setInfoBudgetHours(project.budgetHours !== null && project.budgetHours !== undefined ? String(project.budgetHours) : '');
      setInfoBillingMethod(project.billingMethod || 'NONE');
      setInfoBillingRate(project.billingRate !== null && project.billingRate !== undefined ? String(project.billingRate) : '');
      setInfoTags(Array.isArray(project.tags) ? project.tags.join(', ') : (project.tags || ''));
      setInfoIsTemplate(project.isTemplate || false);
      setInfoTaskLayout(project.taskLayout || 'STANDARD');
    }
  }, [project]);

  const getCurrencySymbol = (code: string = 'USD') => {
    switch (code) {
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'INR': return '₹';
      case 'CAD': return 'CA$';
      case 'AUD': return 'A$';
      case 'USD':
      default: return '$';
    }
  };

  const formatEnumLabel = (val?: string) => {
    if (!val || val === 'NONE') return 'None';
    return val.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  };

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
      enabledTabs?: string;
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
    mutationFn: async ({ payload, addAnother }: { payload: any; addAnother: boolean }) => {
      const res = await api.post('/tasks', payload);
      return { data: res.data, addAnother };
    },
    onSuccess: ({ addAnother }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      queryClient.invalidateQueries({ queryKey: ['board', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['global-tasks'] });

      if (addAnother) {
        setCreateTaskTitle('');
        setCreateTaskDescription('');
        setCreateTaskEstimatedHours(null);
        setCreateTaskStartDate('');
        setCreateTaskDueDate('');
        setCreateTaskError(null);
        setCreateTaskSuccess('Task created successfully! Ready for the next task.');
        setTimeout(() => setCreateTaskSuccess(null), 3000);
      } else {
        setIsCreateTaskModalOpen(false);
        setCreateTaskTitle('');
        setCreateTaskDescription('');
        setCreateTaskPriority('MEDIUM');
        setCreateTaskType('TASK');
        setCreateTaskAssigneeId('');
        setCreateTaskEstimatedHours(null);
        setCreateTaskStartDate('');
        setCreateTaskDueDate('');
        setCreateTaskMilestoneId('');
        setCreateTaskTaskListId('');
        setCreateTaskIsRecurring(false);
        setCreateTaskFrequency('WEEKLY');
        setCreateTaskInterval(1);
        setCreateTaskDaysOfWeek([1]);
        setCreateTaskDayOfMonth(1);
        setCreateTaskNonWorkingDayAction('NEXT_WORKING_DAY');
        setCreateTaskEndType('NEVER');
        setCreateTaskEndDate('');
        setCreateTaskMaxOccurrences(10);
        setCreateTaskCloneSubtasks(true);
        setCreateTaskError(null);
        setCreateTaskSuccess(null);
      }
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
      currency: infoCurrency,
      budgetType: infoBudgetType,
      budgetAmount: infoBudgetAmount === '' ? null : parseFloat(infoBudgetAmount),
      budgetHours: infoBudgetHours === '' ? null : parseFloat(infoBudgetHours),
      billingMethod: infoBillingMethod,
      billingRate: infoBillingRate === '' ? null : parseFloat(infoBillingRate),
      tags: infoTags.trim() || null,
      isTemplate: infoIsTemplate,
      taskLayout: infoTaskLayout,
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

  const handleCreateTask = (e: React.FormEvent, addAnother: boolean = false) => {
    e.preventDefault();
    setCreateTaskError(null);
    if (!createTaskTitle.trim()) {
      setCreateTaskError('Task title is required');
      return;
    }
    if (createTaskStartDate && createTaskDueDate && new Date(createTaskStartDate) > new Date(createTaskDueDate)) {
      setCreateTaskError('Start date cannot be after due date.');
      return;
    }

    const recurrencePayload = createTaskIsRecurring
      ? {
          frequency: createTaskFrequency,
          interval: createTaskInterval,
          daysOfWeek: createTaskFrequency === 'WEEKLY' ? createTaskDaysOfWeek.join(',') : undefined,
          dayOfMonth: createTaskFrequency === 'MONTHLY' ? createTaskDayOfMonth : undefined,
          nonWorkingDayAction: createTaskNonWorkingDayAction,
          endType: createTaskEndType,
          endDate: createTaskEndType === 'ON_DATE' && createTaskEndDate ? new Date(createTaskEndDate).toISOString() : undefined,
          maxOccurrences: createTaskEndType === 'AFTER_OCCURRENCES' ? createTaskMaxOccurrences : undefined,
          cloneSubtasks: createTaskCloneSubtasks,
        }
      : undefined;

    createTaskMutation.mutate({
      payload: {
        title: createTaskTitle.trim(),
        description: createTaskDescription.trim() || null,
        priority: createTaskPriority,
        type: createTaskType,
        assigneeId: createTaskAssigneeId || null,
        estimatedHours: createTaskEstimatedHours,
        startDate: createTaskStartDate || null,
        dueDate: createTaskDueDate || null,
        projectId,
        milestoneId: createTaskMilestoneId || null,
        taskListId: createTaskTaskListId || null,
        recurrence: recurrencePayload,
      },
      addAnother,
    });
  };

  const handleSaveTabs = async (newTabs: string[]) => {
    const sanitized = Array.from(new Set(['overview', ...newTabs]));
    try {
      localStorage.setItem(`pms_project_${projectId}_tabs`, JSON.stringify(sanitized));
      setUserCustomTabs(sanitized);
    } catch (e) {
      console.error('Failed to save tabs to localStorage', e);
    }

    if (canEdit) {
      await updateSettingsMutation.mutateAsync({
        enabledTabs: JSON.stringify(sanitized),
      });
    }
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
      <Header
        title={
          <span className="font-bold text-base text-slate-100 flex items-center gap-2">
            {project.name}
            <span className="text-xs font-mono px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-indigo-400 font-normal">
              {project.projectCode}
            </span>
          </span>
        }
        subtitle="Project Module"
        backHref="/projects"
      >
        <div className="hidden md:flex flex-col items-end gap-1">
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
      </Header>

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

        {/* Dynamic Tab Selector with Customize Tabs button */}
        <div className="flex items-center justify-between border-b border-slate-900 overflow-x-auto">
          <div className="flex gap-6 min-w-max">
            {/* Overview Tab (Always enabled) */}
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
            
            {/* Tasks Tab */}
            {enabledTabs.includes('tasks') && (
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
            )}

            {/* Members Tab */}
            {enabledTabs.includes('members') && (
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
            )}

            {/* Milestones Tab */}
            {enabledTabs.includes('milestones') && (
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
            )}

            {/* Issues Tab */}
            {enabledTabs.includes('issues') && project.settings?.allowIssueTracking !== false && (
              <button
                onClick={() => setActiveTab('issues')}
                className={`pb-3.5 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 ${
                  activeTab === 'issues' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Issues
                {activeTab === 'issues' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            )}

            {/* Time Logs Tab */}
            {enabledTabs.includes('timeLogs') && project.settings?.allowTimeTracking && (
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

            {/* Reports Tab */}
            {enabledTabs.includes('reports') && (
              <button
                onClick={() => setActiveTab('reports')}
                className={`pb-3.5 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 ${
                  activeTab === 'reports' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Reports
                {activeTab === 'reports' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            )}

            {/* Documents Tab */}
            {enabledTabs.includes('documents') && (
              <button
                onClick={() => setActiveTab('documents')}
                className={`pb-3.5 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 ${
                  activeTab === 'documents' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Documents
                {activeTab === 'documents' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            )}
          </div>

          {/* Customize Tabs Trigger Button */}
          <div className="shrink-0 pb-3 pl-4">
            <button
              type="button"
              onClick={() => setIsConfigureTabsModalOpen(true)}
              title="Customize Project Tabs"
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-slate-400 hover:text-indigo-400 text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs cursor-pointer group"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-90 transition-transform duration-200" />
              <span className="hidden sm:inline">Customize Tabs</span>
            </button>
          </div>
        </div>

        {/* Tab contents */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Project Info & Settings */}
            <div className="lg:col-span-2 space-y-8">
              {/* Project Details Card */}
              <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[30%] h-[30%] rounded-full bg-indigo-500/[0.02] blur-[40px] pointer-events-none" />
                
                <div className="flex justify-between items-center border-b border-slate-900 pb-4 relative z-10">
                  <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-indigo-400" />
                    Project Information
                  </h3>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsEditProjectModalOpen(true);
                      }}
                      className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer z-20"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit Details
                    </button>
                  )}
                </div>

                <div className="space-y-6 relative z-10">
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
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Project Owner</span>
                      <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        {project.owner?.firstName
                          ? `${project.owner.firstName} ${project.owner.lastName || ''}`
                          : (project.owner?.email || 'Unassigned')}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Created By</span>
                      <p className="text-sm font-semibold text-slate-300">
                        {project.creator?.firstName
                          ? `${project.creator.firstName} ${project.creator.lastName || ''}`
                          : (project.owner?.firstName ? `${project.owner.firstName} ${project.owner.lastName || ''}` : 'Admin User')}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Project Group</span>
                      <div>
                        {project.group ? (
                          <span
                            className="px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5"
                            style={{
                              backgroundColor: `${project.group.color || '#6366f1'}15`,
                              color: project.group.color || '#818cf8',
                              border: `1px solid ${project.group.color || '#6366f1'}30`,
                            }}
                          >
                            <Layers className="w-3 h-3" />
                            {project.group.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">None / General</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Schedule Mode</span>
                      <div>
                        {project.isStrict ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> Strict Schedule
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            Flexible Schedule
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Visibility Setting</span>
                      <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 capitalize">
                        {project.visibility === 'ORGANIZATION' ? <Globe className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-indigo-400" />}
                        {project.visibility.toLowerCase()}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Work Calendar</span>
                      <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {project.workingDays ? project.workingDays.split(',').length : 5} Days / Wk ({project.hoursPerDay || '8.0'} hrs/day)
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Client Portal Access</span>
                      <div>
                        {project.allowClientAccess ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Allowed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            Restricted
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Start Date</span>
                      <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        {formatDate(project.startDate)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">End Date</span>
                      <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        {formatDate(project.endDate)}
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

                  {/* Module Navigation Tabs Config */}
                  <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-indigo-400">
                        <SlidersHorizontal className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-200">Custom Navigation Tabs</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {enabledTabs.length} of 8 tabs enabled for this workspace.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsConfigureTabsModalOpen(true)}
                      className="px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      Configure Tabs
                    </button>
                  </div>
                </div>
              </article>
            </div>

            {/* Right Column: Financial Overview, Project Attributes, Danger Zone */}
            <div className="space-y-8">
              {/* Financial & Budget Widget */}
              <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-6">
                <div className="border-b border-slate-900 pb-4 flex items-center justify-between">
                  <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                    <Coins className="w-4.5 h-4.5 text-emerald-400" />
                    Budget & Billing
                  </h3>
                  <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
                    {project.currency || 'USD'}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Budget Progress */}
                  <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Budget Mode</span>
                      <span className="font-bold text-slate-200">{formatEnumLabel(project.budgetType)}</span>
                    </div>

                    {project.budgetType === 'FIXED_COST' && project.budgetAmount && (
                      <div className="space-y-2 pt-1 border-t border-slate-900">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Spent / Budget</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {getCurrencySymbol(project.currency)}{project.spentAmount?.toLocaleString() || 0} / {getCurrencySymbol(project.currency)}{project.budgetAmount?.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                          <div
                            className={`h-full rounded-full transition-all ${
                              (project.spentAmount || 0) > project.budgetAmount
                                ? 'bg-rose-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.round(((project.spentAmount || 0) / project.budgetAmount) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {(project.budgetType === 'BASED_ON_PROJECT_HOURS' || project.budgetType === 'BASED_ON_STAFF_HOURS' || project.budgetType === 'BASED_ON_TASK_HOURS') && project.budgetHours && (
                      <div className="space-y-2 pt-1 border-t border-slate-900">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Logged / Allocated</span>
                          <span className="font-mono font-bold text-indigo-400">
                            {project.loggedHours || 0}h / {project.budgetHours}h
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                          <div
                            className={`h-full rounded-full transition-all ${
                              (project.loggedHours || 0) > project.budgetHours
                                ? 'bg-rose-500'
                                : 'bg-indigo-500'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.round(((project.loggedHours || 0) / project.budgetHours) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {(!project.budgetType || project.budgetType === 'NONE') && (
                      <p className="text-xs text-slate-500 italic">No budget limit set for this project.</p>
                    )}
                  </div>

                  {/* Billing Method */}
                  <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Billing Scheme</span>
                      <span className="font-bold text-slate-200">{formatEnumLabel(project.billingMethod)}</span>
                    </div>
                    {project.billingRate !== null && project.billingRate !== undefined && (
                      <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                        <span className="text-slate-400 font-medium">Billing Rate</span>
                        <span className="font-mono font-bold text-slate-200">
                          {getCurrencySymbol(project.currency)}{project.billingRate}/hr
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </article>

              {/* Project Attributes & Tags Widget */}
              <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-6">
                <div className="border-b border-slate-900 pb-4">
                  <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                    <Tag className="w-4.5 h-4.5 text-indigo-400" />
                    Layout & Tags
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-900 rounded-xl text-xs">
                    <span className="text-slate-400">Task Layout</span>
                    <span className="font-bold text-indigo-300 capitalize">{project.taskLayout?.toLowerCase() || 'Standard'}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-900 rounded-xl text-xs">
                    <span className="text-slate-400">Project Type</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase border ${
                      project.isTemplate
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {project.isTemplate ? 'Template Baseline' : 'Standard Project'}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="space-y-2 pt-2 border-t border-slate-900">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tags</span>
                    {project.tags && project.tags.trim() ? (
                      <div className="flex flex-wrap gap-1.5">
                        {project.tags.split(',').map((tag: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-slate-950 border border-slate-850 rounded-lg text-xs font-medium text-indigo-300"
                          >
                            #{tag.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No tags assigned.</p>
                    )}
                  </div>
                </div>
              </article>

              {/* Danger Zone */}
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

        {/* Tasks View Tab (Zoho Projects Parity: Classic, Plain, Kanban Views) */}
        {activeTab === 'tasks' && (
          <TasksTab
            project={project}
            tasks={tasks || []}
            isLoadingTasks={isLoadingTasks}
            milestones={milestones || []}
            canCreateTask={canCreateTask}
            canEditTask={canEdit}
            onTaskClick={(taskId) => {
              setSelectedTaskId(taskId);
              setIsTaskDrawerOpen(true);
            }}
            onOpenCreateTaskModal={(defaultTaskListId, defaultMilestoneId) => {
              handleOpenCreateTaskModal(defaultTaskListId, defaultMilestoneId);
            }}
            onOpenCreateMilestoneModal={() => {
              setActiveTab('milestones');
              setAutoOpenCreateMilestoneModal(true);
            }}
          />
        )}

        {/* Project Members Tab */}
        {/* Members Tab - Zoho Projects Data Table */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/30 border border-slate-900 p-5 rounded-2xl">
              <div>
                <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  Project Members ({project.members.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage user roles, access privileges, and staff hourly billing rates
                </p>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Users to Project
                </button>
              )}
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-950/40 border border-slate-900 p-4 rounded-xl">
              {/* Role Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                {['ALL', 'OWNER', 'MANAGER', 'MEMBER', 'CLIENT'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setMemberRoleFilter(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                      memberRoleFilter === r
                        ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {r === 'ALL' ? 'All Members' : r.charAt(0) + r.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="w-full md:w-72 relative">
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder="Search members by name or email..."
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Members Data Table */}
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-semibold tracking-wider uppercase text-[10px]">
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Project Role</th>
                      <th className="py-3.5 px-4">Staff Rate ($/hr)</th>
                      <th className="py-3.5 px-4">Joined Date</th>
                      <th className="py-3.5 px-4">Added By</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/80 text-slate-300">
                    {project.members
                      .filter((m: any) => {
                        const matchesRole =
                          memberRoleFilter === 'ALL' || m.role === memberRoleFilter;
                        const name = m.user?.firstName
                          ? `${m.user.firstName} ${m.user.lastName || ''}`.toLowerCase()
                          : '';
                        const email = (m.user?.email || '').toLowerCase();
                        const query = memberSearchQuery.toLowerCase().trim();
                        const matchesQuery = !query || name.includes(query) || email.includes(query);
                        return matchesRole && matchesQuery;
                      })
                      .map((m: any) => {
                        const isOwner = m.role === 'OWNER';
                        const isManager = m.role === 'MANAGER';
                        const isClient = m.role === 'CLIENT';
                        const isSelf = m.userId === user?.sub;
                        const memberName = m.user?.firstName
                          ? `${m.user.firstName} ${m.user.lastName || ''}`
                          : m.user?.email || 'User';

                        return (
                          <tr
                            key={m.id}
                            className="hover:bg-slate-850/40 transition-colors group"
                          >
                            {/* User Info */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-xs shrink-0">
                                  {memberName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-100 text-xs truncate">
                                    {memberName} {isSelf && <span className="text-[10px] text-indigo-400 font-normal ml-1">(You)</span>}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">{m.user?.email}</div>
                                </div>
                              </div>
                            </td>

                            {/* Role Badge */}
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                                  isOwner
                                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                    : isManager
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : isClient
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-slate-800/80 text-slate-400 border-slate-700/50'
                                }`}
                              >
                                {m.role}
                              </span>
                            </td>

                            {/* Staff Hourly Rate */}
                            <td className="py-3.5 px-4 font-mono font-medium text-slate-300">
                              {m.hourlyRate !== null && m.hourlyRate !== undefined ? (
                                <span className="text-emerald-400 font-semibold">${parseFloat(m.hourlyRate).toFixed(2)}/hr</span>
                              ) : (
                                <span className="text-slate-600 text-[11px] font-sans">Default Rate</span>
                              )}
                            </td>

                            {/* Joined Date */}
                            <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                              {formatDate(m.joinedAt || m.createdAt)}
                            </td>

                            {/* Added By */}
                            <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                              {getAddedByName(m.addedBy)}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingMember(m)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                                    title="Edit role and hourly rate"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {canEdit && !isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to remove ${memberName} from this project?`)) {
                                        removeMemberMutation.mutate(m.userId);
                                      }
                                    }}
                                    disabled={removeMemberMutation.isPending}
                                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                                    title="Remove member from project"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'milestones' && (
          <MilestonesTab
            projectId={projectId}
            onOpenCreateTaskModal={(mId) => handleOpenCreateTaskModal(undefined, mId)}
            autoOpenCreateModal={autoOpenCreateMilestoneModal}
            onResetAutoOpenCreateModal={() => setAutoOpenCreateMilestoneModal(false)}
          />
        )}

        {activeTab === 'issues' && (
          <IssuesTab
            projectId={projectId}
            projectMembers={project.members || []}
            projectTasks={tasks || []}
          />
        )}

        {activeTab === 'timeLogs' && project.settings?.allowTimeTracking && (
          <TimeLogsTab projectId={projectId} />
        )}

        {activeTab === 'reports' && (
          <ReportsTab projectId={projectId} />
        )}

        {activeTab === 'documents' && (
          <DocumentsTab projectId={projectId} />
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
        onSelectTask={(newTaskId) => {
          setSelectedTaskId(newTaskId);
          setIsTaskDrawerOpen(true);
        }}
      />

      {/* Create Task Slide-Over Panel */}
      {isCreateTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsCreateTaskModalOpen(false)}
          />

          <div className="relative bg-slate-900 border-l border-slate-800 w-full max-w-xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 text-slate-100 overflow-hidden z-10">
            
            <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                <ListTodo className="w-4.5 h-4.5 text-indigo-400" />
                Create New Project Task
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateTaskModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <form onSubmit={(e) => handleCreateTask(e, false)} className="flex flex-col flex-1 overflow-hidden">
              
              {/* Scrollable Form Body */}
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {createTaskError && (
                  <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-xs p-3.5 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 text-rose-400 flex-shrink-0" />
                    <span>{createTaskError}</span>
                  </div>
                )}

                {createTaskSuccess && (
                  <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs p-3.5 rounded-xl flex items-center gap-2">
                    <Check className="w-4.5 h-4.5 text-emerald-400 flex-shrink-0" />
                    <span>{createTaskSuccess}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Task Name / Title *
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
                    rows={4}
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
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                      Work Hours (Est.)
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
                      Task List
                    </label>
                    <select
                      value={createTaskTaskListId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCreateTaskTaskListId(val);
                        if (val) {
                          const targetList = taskLists?.find((tl: any) => tl.id === val);
                          if (targetList?.milestoneId) {
                            setCreateTaskMilestoneId(targetList.milestoneId);
                          }
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">None (General / Unassigned)</option>
                      {taskLists?.map((tl: any) => (
                        <option key={tl.id} value={tl.id}>
                          {tl.name} {tl.flag === 'INTERNAL' ? '(Internal)' : '(External)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Milestone
                    </label>
                    <select
                      value={createTaskMilestoneId}
                      onChange={(e) => setCreateTaskMilestoneId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">None</option>
                      {milestones?.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={createTaskStartDate}
                      onChange={(e) => setCreateTaskStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
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

                {/* Recurrence Configuration Section */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-violet-400" />
                        <div>
                          <div className="text-xs font-bold text-slate-200">
                            Repeat this task (Recurrence)
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Automatically create subsequent occurrences following a schedule
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCreateTaskIsRecurring(!createTaskIsRecurring)}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          createTaskIsRecurring ? 'bg-violet-600' : 'bg-slate-800'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 left-1 ${
                            createTaskIsRecurring ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {createTaskIsRecurring && (
                      <div className="space-y-4 pt-3 border-t border-slate-850/80 animate-in fade-in duration-200">
                        {/* Frequency & Interval */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Frequency
                            </label>
                            <select
                              value={createTaskFrequency}
                              onChange={(e) => setCreateTaskFrequency(e.target.value as any)}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-500 cursor-pointer"
                            >
                              <option value="DAILY">Daily</option>
                              <option value="WEEKLY">Weekly</option>
                              <option value="MONTHLY">Monthly</option>
                              <option value="YEARLY">Yearly</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Repeat Every
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="365"
                                value={createTaskInterval}
                                onChange={(e) => setCreateTaskInterval(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-500"
                              />
                              <span className="text-[11px] text-slate-400 font-medium">
                                {createTaskFrequency === 'DAILY' && (createTaskInterval === 1 ? 'day' : 'days')}
                                {createTaskFrequency === 'WEEKLY' && (createTaskInterval === 1 ? 'week' : 'weeks')}
                                {createTaskFrequency === 'MONTHLY' && (createTaskInterval === 1 ? 'month' : 'months')}
                                {createTaskFrequency === 'YEARLY' && (createTaskInterval === 1 ? 'year' : 'years')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Weekly Weekdays Selector */}
                        {createTaskFrequency === 'WEEKLY' && (
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Repeat on Days
                            </label>
                            <div className="flex items-center gap-1.5">
                              {[
                                { day: 1, label: 'M', name: 'Mon' },
                                { day: 2, label: 'T', name: 'Tue' },
                                { day: 3, label: 'W', name: 'Wed' },
                                { day: 4, label: 'T', name: 'Thu' },
                                { day: 5, label: 'F', name: 'Fri' },
                                { day: 6, label: 'S', name: 'Sat' },
                                { day: 0, label: 'S', name: 'Sun' },
                              ].map(({ day, label, name }) => {
                                const isSelected = createTaskDaysOfWeek.includes(day);
                                return (
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        if (createTaskDaysOfWeek.length > 1) {
                                          setCreateTaskDaysOfWeek(createTaskDaysOfWeek.filter((d) => d !== day));
                                        }
                                      } else {
                                        setCreateTaskDaysOfWeek([...createTaskDaysOfWeek, day]);
                                      }
                                    }}
                                    title={name}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Monthly Day of Month */}
                        {createTaskFrequency === 'MONTHLY' && (
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Day of Month (1 - 31)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={createTaskDayOfMonth}
                              onChange={(e) =>
                                setCreateTaskDayOfMonth(
                                  Math.min(31, Math.max(1, parseInt(e.target.value) || 1))
                                )
                              }
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-500"
                            />
                          </div>
                        )}

                        {/* Non-working days handling */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            If Occurrence Lands on Non-Working Day
                          </label>
                          <select
                            value={createTaskNonWorkingDayAction}
                            onChange={(e) => setCreateTaskNonWorkingDayAction(e.target.value as any)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-500 cursor-pointer"
                          >
                            <option value="NEXT_WORKING_DAY">Move to next working day</option>
                            <option value="PREVIOUS_WORKING_DAY">Move to previous working day</option>
                            <option value="EXACT_DATE">Keep exact calendar date</option>
                          </select>
                        </div>

                        {/* End Condition */}
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Ends
                          </label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input
                                type="radio"
                                name="createTaskEndType"
                                checked={createTaskEndType === 'NEVER'}
                                onChange={() => setCreateTaskEndType('NEVER')}
                                className="accent-violet-600"
                              />
                              <span>Never (Indefinite series)</span>
                            </label>

                            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input
                                type="radio"
                                name="createTaskEndType"
                                checked={createTaskEndType === 'ON_DATE'}
                                onChange={() => setCreateTaskEndType('ON_DATE')}
                                className="accent-violet-600"
                              />
                              <span>On date</span>
                              {createTaskEndType === 'ON_DATE' && (
                                <input
                                  type="date"
                                  value={createTaskEndDate}
                                  onChange={(e) => setCreateTaskEndDate(e.target.value)}
                                  className="ml-2 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 [color-scheme:dark]"
                                />
                              )}
                            </label>

                            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input
                                type="radio"
                                name="createTaskEndType"
                                checked={createTaskEndType === 'AFTER_OCCURRENCES'}
                                onChange={() => setCreateTaskEndType('AFTER_OCCURRENCES')}
                                className="accent-violet-600"
                              />
                              <span>After</span>
                              {createTaskEndType === 'AFTER_OCCURRENCES' && (
                                <input
                                  type="number"
                                  min="1"
                                  max="999"
                                  value={createTaskMaxOccurrences}
                                  onChange={(e) =>
                                    setCreateTaskMaxOccurrences(Math.max(1, parseInt(e.target.value) || 1))
                                  }
                                  className="w-20 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                                />
                              )}
                              <span>occurrences</span>
                            </label>
                          </div>
                        </div>

                        {/* Live Summary banner */}
                        <div className="p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[11px] text-violet-300 flex items-start gap-2">
                          <Repeat className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                          <div>
                            Repeats every{' '}
                            {createTaskInterval > 1 ? `${createTaskInterval} ` : ''}
                            {createTaskFrequency === 'DAILY' && (createTaskInterval === 1 ? 'day' : 'days')}
                            {createTaskFrequency === 'WEEKLY' && (
                              <>
                                week on{' '}
                                <span className="font-semibold">
                                  {createTaskDaysOfWeek
                                    .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
                                    .join(', ')}
                                </span>
                              </>
                            )}
                            {createTaskFrequency === 'MONTHLY' && `month on day ${createTaskDayOfMonth}`}
                            {createTaskFrequency === 'YEARLY' && (createTaskInterval === 1 ? 'year' : 'years')}
                            {createTaskEndType === 'ON_DATE' && createTaskEndDate && ` until ${createTaskEndDate}`}
                            {createTaskEndType === 'AFTER_OCCURRENCES' && `, ending after ${createTaskMaxOccurrences} occurrences`}
                            .{' '}
                            {createTaskNonWorkingDayAction === 'NEXT_WORKING_DAY' &&
                              'Non-working days move forward.'}
                            {createTaskNonWorkingDayAction === 'PREVIOUS_WORKING_DAY' &&
                              'Non-working days move backward.'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fixed Footer at bottom */}
              <div className="flex items-center justify-between gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateTaskModalOpen(false)}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleCreateTask(e, true)}
                    disabled={createTaskMutation.isPending}
                    className="px-4 py-2 bg-slate-900 border border-slate-750 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Create this task and keep the form open for another entry"
                  >
                    {createTaskMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <Plus className="w-3.5 h-3.5" />
                    Save & Add Another
                  </button>

                  <button
                    type="submit"
                    disabled={createTaskMutation.isPending}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                  >
                    {createTaskMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Create Task
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Edit Project Slide-Over Drawer */}
      <CreateProjectModal
        isOpen={isEditProjectModalOpen}
        onClose={() => setIsEditProjectModalOpen(false)}
        project={project}
      />

      {/* Zoho-Style Add User Slide-Over Drawer */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        projectId={projectId}
        projectName={project?.name}
        availableUsers={availableUsers}
      />

      {/* Edit Member Role & Hourly Rate Modal */}
      <EditMemberModal
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        projectId={projectId}
        member={editingMember}
      />

      {/* Configure Project Tabs Modal */}
      <ConfigureTabsModal
        isOpen={isConfigureTabsModalOpen}
        onClose={() => setIsConfigureTabsModalOpen(false)}
        currentEnabledTabs={enabledTabs}
        canEditProject={canEdit}
        onSave={handleSaveTabs}
      />

    </div>
  );
}
