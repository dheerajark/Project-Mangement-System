'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useFormatDate } from '@/hooks/useFormatDate';
import {
  X,
  Eye,
  EyeOff,
  MessageSquare,
  Paperclip,
  Calendar,
  Clock,
  Loader2,
  Plus,
  AlertCircle,
  Activity,
  FileText,
  Send,
  User,
  AlertTriangle,
  Archive,
  Play,
  Square,
  CheckSquare,
  CheckCircle2,
  Check,
  Copy,
  Trash2,
  Tag,
  DollarSign,
  Layers,
  ChevronRight,
  SlidersHorizontal,
  FolderTree,
  FileCode,
  Share2,
  CornerDownRight,
  Workflow,
  Link as LinkIcon,
  Unlink,
  History,
  Edit2,
  UploadCloud,
  Download,
  Search,
  LayoutGrid,
  List,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive,
  Globe,
  ExternalLink,
  Folder,
  Link2,
  Repeat,
  RefreshCw,
  Bell,
  CalendarClock,
  AtSign,
} from 'lucide-react';
import {
  CustomFieldDefinition,
  FIELD_TYPE_CONFIG,
} from '@/components/dynamic-custom-fields';

interface TaskDetailDrawerProps {
  taskId: string | null;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectTask?: (taskId: string) => void;
}

export default function TaskDetailDrawer({
  taskId,
  projectId,
  isOpen,
  onClose,
  onSelectTask,
}: TaskDetailDrawerProps) {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();

  // Active Tab: 'overview' | 'dependencies' | 'recurrence' | 'reminders' | 'time' | 'comments' | 'attachments' | 'history'
  const [activeTab, setActiveTab] = useState<'overview' | 'dependencies' | 'recurrence' | 'reminders' | 'time' | 'comments' | 'attachments' | 'history'>('overview');

  // Recurrence Management State
  const [isConfiguringRecurrence, setIsConfiguringRecurrence] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('WEEKLY');
  const [recurInterval, setRecurInterval] = useState(1);
  const [recurDaysOfWeek, setRecurDaysOfWeek] = useState<number[]>([1]);
  const [recurDayOfMonth, setRecurDayOfMonth] = useState(1);
  const [recurNonWorkingDay, setRecurNonWorkingDay] = useState<'NEXT_WORKING_DAY' | 'PREVIOUS_WORKING_DAY' | 'EXACT_DATE'>('NEXT_WORKING_DAY');
  const [recurEndType, setRecurEndType] = useState<'NEVER' | 'ON_DATE' | 'AFTER_OCCURRENCES'>('NEVER');
  const [recurEndDate, setRecurEndDate] = useState('');
  const [recurMaxOccurrences, setRecurMaxOccurrences] = useState(10);
  const [recurCloneSubtasks, setRecurCloneSubtasks] = useState(true);
  const [recurError, setRecurError] = useState<string | null>(null);
  const [recurSuccess, setRecurSuccess] = useState<string | null>(null);

  // Reminder Management State (Zoho Projects Spec)
  const [reminderType, setReminderType] = useState<'BEFORE_DUE' | 'ON_DUE' | 'AFTER_DUE' | 'CUSTOM_DATE'>('BEFORE_DUE');
  const [reminderValue, setReminderValue] = useState(1);
  const [reminderUnit, setReminderUnit] = useState<'MINUTES' | 'HOURS' | 'DAYS'>('DAYS');
  const [reminderTimeOfDay, setReminderTimeOfDay] = useState('09:00');
  const [reminderCustomDateTime, setReminderCustomDateTime] = useState('');
  const [reminderRecipientType, setReminderRecipientType] = useState<'ASSIGNEE' | 'REPORTER' | 'WATCHERS' | 'CUSTOM_USER' | 'ALL_STAKEHOLDERS'>('ASSIGNEE');
  const [reminderCustomUserId, setReminderCustomUserId] = useState('');
  const [reminderRepeatOverdue, setReminderRepeatOverdue] = useState(true);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderSuccess, setReminderSuccess] = useState<string | null>(null);

  // Form Editing State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [description, setDescription] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [attachFileName, setAttachFileName] = useState('');
  const [attachFileSize, setAttachFileSize] = useState(1024 * 150);
  const [attachFileUrl, setAttachFileUrl] = useState('');
  const [attachMimeType, setAttachMimeType] = useState('');
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);
  const [attachmentViewMode, setAttachmentViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [attachmentSearch, setAttachmentSearch] = useState('');
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null);
  const [isAttachDocModalOpen, setIsAttachDocModalOpen] = useState(false);
  const [attachDocSearch, setAttachDocSearch] = useState('');
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [editAttachmentName, setEditAttachmentName] = useState('');
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [unlinkingDocId, setUnlinkingDocId] = useState<string | null>(null);

  // Subtask state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskPriority, setNewSubtaskPriority] = useState<string>('MEDIUM');
  const [newSubtaskAssigneeId, setNewSubtaskAssigneeId] = useState<string>('');
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState<string>('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  // Tags & Custom Fields
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [customFieldKey, setCustomFieldKey] = useState('');
  const [customFieldValue, setCustomFieldValue] = useState('');
  const [isAddingCustomField, setIsAddingCustomField] = useState(false);

  // Modals & UI Feedback
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Dependency Management State
  const [isAddDepModalOpen, setIsAddDepModalOpen] = useState(false);
  const [depDirection, setDepDirection] = useState<'PREDECESSOR' | 'SUCCESSOR'>('PREDECESSOR');
  const [selectedTargetTaskId, setSelectedTargetTaskId] = useState('');
  const [selectedDepType, setSelectedDepType] = useState('FINISH_TO_START');
  const [selectedDepLag, setSelectedDepLag] = useState(0);
  const [selectedDepLinkType, setSelectedDepLinkType] = useState('HARD');
  const [editingDep, setEditingDep] = useState<any | null>(null);
  const [depModalError, setDepModalError] = useState<string | null>(null);

  // Fetch Task Details
  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const res = await api.get(`/tasks/${taskId}`);
      return res.data;
    },
    enabled: isOpen && !!taskId,
  });

  // Fetch Task Recurrence Details
  const { data: taskRecurrence, isLoading: isLoadingRecurrence } = useQuery({
    queryKey: ['task-recurrence', taskId],
    queryFn: async () => {
      const res = await api.get(`/tasks/${taskId}/recurrence`);
      return res.data;
    },
    enabled: isOpen && !!taskId,
  });

  // Sync Recurrence State when loaded
  useEffect(() => {
    if (taskRecurrence) {
      setRecurFrequency(taskRecurrence.frequency || 'WEEKLY');
      setRecurInterval(taskRecurrence.interval || 1);
      if (taskRecurrence.daysOfWeek) {
        setRecurDaysOfWeek(
          taskRecurrence.daysOfWeek
            .split(',')
            .map((d: string) => parseInt(d.trim(), 10))
            .filter((n: number) => !isNaN(n)),
        );
      }
      setRecurDayOfMonth(taskRecurrence.dayOfMonth || 1);
      setRecurNonWorkingDay(taskRecurrence.nonWorkingDayAction || 'NEXT_WORKING_DAY');
      setRecurEndType(taskRecurrence.endType || 'NEVER');
      setRecurEndDate(
        taskRecurrence.endDate ? taskRecurrence.endDate.split('T')[0] : '',
      );
      setRecurMaxOccurrences(taskRecurrence.maxOccurrences || 10);
      setRecurCloneSubtasks(taskRecurrence.cloneSubtasks ?? true);
    }
  }, [taskRecurrence]);

  // Fetch Project Milestones
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/milestones`);
      return res.data;
    },
    enabled: isOpen && !!projectId,
  });

  // Fetch Project Task Lists
  const { data: taskLists = [] } = useQuery({
    queryKey: ['task-lists', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/task-lists`);
      return res.data;
    },
    enabled: isOpen && !!projectId,
  });

  // Fetch Task Dependencies
  const { data: dependenciesData, isLoading: isLoadingDeps } = useQuery({
    queryKey: ['task-dependencies', taskId],
    queryFn: async () => {
      const res = await api.get(`/tasks/${taskId}/dependencies`);
      return res.data;
    },
    enabled: isOpen && !!taskId,
  });

  // Fetch Project Tasks for Dependency Selector
  const { data: projectTasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/tasks`);
      return res.data;
    },
    enabled: isAddDepModalOpen && !!projectId,
  });

  // Fetch Project Documents for linking to task
  const { data: projectDocuments = [], isLoading: isLoadingProjectDocs } = useQuery({
    queryKey: ['project-documents-for-task', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/documents`);
      return res.data;
    },
    enabled: isAttachDocModalOpen && !!projectId,
  });

  // Fetch Task Reminders (Zoho Projects Spec)
  const { data: taskReminders = [], isLoading: isLoadingReminders } = useQuery({
    queryKey: ['task-reminders', taskId],
    queryFn: async () => {
      const res = await api.get(`/tasks/${taskId}/reminders`);
      return res.data;
    },
    enabled: isOpen && !!taskId,
  });

  // Populate fields
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatusError(null);
      setUpdateError(null);
    }
  }, [task]);

  // Mutations
  const updateTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch(`/tasks/${taskId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board', projectId] });
      setIsEditingTitle(false);
      setIsEditingDesc(false);
    },
    onError: (err: any) => {
      setUpdateError(err?.response?.data?.message || 'Failed to update task');
    },
  });

  // Dependency Mutations
  const createDependencyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(`/tasks/${taskId}/dependencies`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['project-dependencies', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setIsAddDepModalOpen(false);
      setSelectedTargetTaskId('');
      setDepModalError(null);
    },
    onError: (err: any) => {
      setDepModalError(err?.response?.data?.message || 'Failed to establish dependency');
    },
  });

  // Recurrence Mutations
  const configureRecurrenceMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(`/tasks/${taskId}/recurrence`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-recurrence', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setIsConfiguringRecurrence(false);
      setRecurSuccess('Recurrence schedule configured successfully!');
      setTimeout(() => setRecurSuccess(null), 3000);
    },
    onError: (err: any) => {
      setRecurError(err?.response?.data?.message || 'Failed to configure recurrence');
    },
  });

  const updateRecurrenceMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.patch(`/recurrence/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-recurrence', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setIsConfiguringRecurrence(false);
      setRecurSuccess('Recurrence settings updated!');
      setTimeout(() => setRecurSuccess(null), 3000);
    },
    onError: (err: any) => {
      setRecurError(err?.response?.data?.message || 'Failed to update recurrence');
    },
  });

  const pauseRecurrenceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/recurrence/${id}/pause`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-recurrence', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const resumeRecurrenceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/recurrence/${id}/resume`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-recurrence', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const stopRecurrenceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/recurrence/${id}/stop`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-recurrence', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const generateNextOccurrenceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/recurrence/${id}/generate-next`);
      return res.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['task-recurrence', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setRecurSuccess(`Occurrence #${data.recurrenceIndex || ''} generated successfully!`);
      setTimeout(() => setRecurSuccess(null), 3000);
    },
    onError: (err: any) => {
      setRecurError(err?.response?.data?.message || 'Failed to generate next occurrence');
    },
  });

  const deleteRecurrenceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/recurrence/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-recurrence', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setActiveTab('overview');
    },
  });

  const updateDependencyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.patch(`/tasks/dependencies/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['project-dependencies', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setEditingDep(null);
      setDepModalError(null);
    },
    onError: (err: any) => {
      setDepModalError(err?.response?.data?.message || 'Failed to update dependency');
    },
  });

  const deleteDependencyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/tasks/dependencies/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['project-dependencies', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await api.patch(`/tasks/${taskId}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board', projectId] });
      setStatusError(null);
    },
    onError: (err: any) => {
      setStatusError(err.response?.data?.message || 'Illegal status transition');
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/tasks/${taskId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board', projectId] });
      setShowDeleteModal(false);
      onClose();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete task');
    },
  });

  const cloneTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/tasks/${taskId}/clone`);
      return res.data;
    },
    onSuccess: (cloned) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board', projectId] });
      alert(`Task successfully duplicated as: ${cloned.title}`);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to duplicate task');
    },
  });

  // Task Reminder Mutations (Zoho Projects Spec)
  const createReminderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(`/tasks/${taskId}/reminders`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-reminders', taskId] });
      setReminderSuccess('Reminder scheduled successfully!');
      setReminderError(null);
      setTimeout(() => setReminderSuccess(null), 3500);
    },
    onError: (err: any) => {
      setReminderError(err?.response?.data?.message || 'Failed to schedule reminder');
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const res = await api.delete(`/tasks/${taskId}/reminders/${reminderId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-reminders', taskId] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || 'Failed to remove reminder');
    },
  });

  // Time Tracking State
  const [elapsed, setElapsed] = useState<number>(0);
  const [isStopping, setIsStopping] = useState<boolean>(false);
  const [stopDescription, setStopDescription] = useState<string>('');

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fetch Task Time Logs
  const { data: taskLogs = [] } = useQuery({
    queryKey: ['time-entries', 'task', taskId],
    queryFn: async () => {
      const res = await api.get(`/tasks/${taskId}/time-entries`);
      return res.data;
    },
    enabled: isOpen && !!taskId && !!task?.project?.settings?.allowTimeTracking,
  });

  // Fetch active timer
  const { data: activeTimer } = useQuery({
    queryKey: ['active-timer'],
    queryFn: async () => {
      const res = await api.get('/time-entries/active');
      return res.data;
    },
    refetchInterval: 10000,
    enabled: isOpen,
  });

  const isThisTimerRunning = activeTimer && activeTimer.isTimerRunning && activeTimer.taskId === taskId;

  useEffect(() => {
    if (!isThisTimerRunning || !activeTimer.timerStartedAt) {
      setElapsed(0);
      return;
    }

    const startMs = new Date(activeTimer.timerStartedAt).getTime();
    const initialElapsed = Math.floor((Date.now() - startMs) / 1000);
    setElapsed(initialElapsed > 0 ? initialElapsed : 0);

    const interval = setInterval(() => {
      const currentElapsed = Math.floor((Date.now() - startMs) / 1000);
      setElapsed(currentElapsed > 0 ? currentElapsed : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [isThisTimerRunning, activeTimer]);

  const startTimerMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/time-entries/timer/start', { projectId, taskId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries', 'task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['time-entries', projectId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to start timer');
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: async (desc: string) => {
      const res = await api.post('/time-entries/timer/stop', { description: desc });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries', 'task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['time-entries', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setIsStopping(false);
      setStopDescription('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to stop timer');
    },
  });

  const archiveTimeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/time-entries/${id}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', 'task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['time-entries', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to archive entry');
    },
  });

  const archiveTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/tasks/${taskId}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const toggleWatcherMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/tasks/${taskId}/watchers`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(`/tasks/${taskId}/comments`, { content });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setCommentContent('');
    },
  });

  // Attachment helpers
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileExt = (name?: string) => {
    if (!name) return 'FILE';
    const parts = name.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'FILE';
  };

  const getFileBadge = (mimeType?: string, name: string = '') => {
    const ext = getFileExt(name);

    if (ext === 'html' || ext === 'htm') {
      return {
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        icon: <Globe className="w-4 h-4 text-amber-400" />,
        ext: 'HTML',
      };
    }
    if (ext === 'pdf' || mimeType?.includes('pdf')) {
      return {
        bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
        icon: <FileText className="w-4 h-4 text-rose-400" />,
        ext: 'PDF',
      };
    }
    if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext) || mimeType?.includes('image')) {
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        icon: <ImageIcon className="w-4 h-4 text-emerald-400" />,
        ext: ext.toUpperCase(),
      };
    }
    if (['js', 'ts', 'tsx', 'jsx', 'json', 'css', 'py', 'sh', 'sql'].includes(ext) || mimeType?.includes('json') || mimeType?.includes('code')) {
      return {
        bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
        icon: <FileCode className="w-4 h-4 text-indigo-400" />,
        ext: ext.toUpperCase(),
      };
    }
    if (['xlsx', 'xls', 'csv'].includes(ext) || mimeType?.includes('spreadsheet')) {
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />,
        ext: 'XLS',
      };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return {
        bg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
        icon: <FileArchive className="w-4 h-4 text-purple-400" />,
        ext: ext.toUpperCase(),
      };
    }
    return {
      bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
      icon: <FileText className="w-4 h-4 text-blue-400" />,
      ext: ext.toUpperCase(),
    };
  };

  const addAttachmentMutation = useMutation({
    mutationFn: async (data: { fileName: string; fileUrl: string; fileSize: number }) => {
      const res = await api.post(`/tasks/${taskId}/attachments`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setAttachFileName('');
      setAttachFileUrl('');
      setAttachMimeType('');
      setShowAttachmentForm(false);
      setAttachmentError(null);
    },
    onError: (err: any) => {
      setAttachmentError(err?.response?.data?.message || 'Failed to upload attachment');
    },
  });

  const bulkAddAttachmentsMutation = useMutation({
    mutationFn: async (attachments: { fileName: string; fileUrl: string; fileSize: number }[]) => {
      const res = await api.post(`/tasks/${taskId}/attachments/bulk`, { attachments });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setAttachFileName('');
      setAttachFileUrl('');
      setShowAttachmentForm(false);
      setAttachmentError(null);
    },
    onError: (err: any) => {
      setAttachmentError(err?.response?.data?.message || 'Failed to upload attachments');
    },
  });

  const updateAttachmentMutation = useMutation({
    mutationFn: async ({ attachmentId, fileName }: { attachmentId: string; fileName: string }) => {
      const res = await api.patch(`/tasks/${taskId}/attachments/${attachmentId}`, { fileName });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setEditingAttachmentId(null);
      setEditAttachmentName('');
      setAttachmentError(null);
    },
    onError: (err: any) => {
      setAttachmentError(err?.response?.data?.message || 'Failed to rename attachment');
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setDeletingAttachmentId(null);
      setAttachmentError(null);
    },
    onError: (err: any) => {
      setAttachmentError(err?.response?.data?.message || 'Failed to delete attachment');
    },
  });

  const linkDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await api.post(`/tasks/${taskId}/attachments/link-document`, { documentId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      setIsAttachDocModalOpen(false);
      setAttachmentError(null);
    },
    onError: (err: any) => {
      setAttachmentError(err?.response?.data?.message || 'Failed to link document');
    },
  });

  const unlinkDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await api.delete(`/tasks/${taskId}/attachments/unlink-document/${documentId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      setUnlinkingDocId(null);
      setAttachmentError(null);
    },
    onError: (err: any) => {
      setAttachmentError(err?.response?.data?.message || 'Failed to unlink document');
    },
  });

  const handleFilesUpload = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    const oversized = fileList.find((f) => f.size > MAX_SIZE);
    if (oversized) {
      setAttachmentError(`File "${oversized.name}" exceeds the 50MB size limit.`);
      return;
    }

    if (fileList.length === 1) {
      const file = fileList[0];
      addAttachmentMutation.mutate({
        fileName: file.name,
        fileUrl: URL.createObjectURL(file),
        fileSize: file.size,
      });
    } else {
      const items = fileList.map((f) => ({
        fileName: f.name,
        fileUrl: URL.createObjectURL(f),
        fileSize: f.size,
      }));
      bulkAddAttachmentsMutation.mutate(items);
    }
  };

  const handleManualAddAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachFileName.trim()) return;

    addAttachmentMutation.mutate({
      fileName: attachFileName.trim(),
      fileUrl: attachFileUrl.trim() || `https://storage.zoho-pms.internal/attachments/${encodeURIComponent(attachFileName.trim())}`,
      fileSize: attachFileSize,
    });
  };

  const createSubtaskMutation = useMutation({
    mutationFn: async (payload: { title: string; priority?: string; assigneeId?: string; dueDate?: string }) => {
      const res = await api.post(`/tasks/${taskId}/subtasks`, {
        title: payload.title,
        priority: payload.priority || 'MEDIUM',
        assigneeId: payload.assigneeId || undefined,
        dueDate: payload.dueDate || undefined,
        projectId,
        taskListId: task?.taskListId || undefined,
        milestoneId: task?.milestoneId || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board', projectId] });
      setNewSubtaskTitle('');
      setNewSubtaskPriority('MEDIUM');
      setNewSubtaskAssigneeId('');
      setNewSubtaskDueDate('');
      setIsAddingSubtask(false);
    },
  });

  const toggleSubtaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/tasks/${id}`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board', projectId] });
    },
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: async (subId: string) => {
      const res = await api.delete(`/tasks/${subId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board', projectId] });
    },
  });

  const convertSubtaskMutation = useMutation({
    mutationFn: async (subId: string) => {
      const res = await api.patch(`/tasks/${subId}`, { parentTaskId: null });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board', projectId] });
    },
  });

  // Parse Tags
  const parsedTags: string[] = useMemo(() => {
    if (!task?.tags) return [];
    return task.tags
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);
  }, [task?.tags]);

  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim().replace(/^#/, '');
    if (!clean) return;
    if (parsedTags.includes(clean)) {
      setNewTagInput('');
      setIsAddingTag(false);
      return;
    }
    const updated = [...parsedTags, clean].join(', ');
    updateTaskMutation.mutate({ tags: updated });
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = parsedTags.filter((t) => t !== tagToRemove).join(', ');
    updateTaskMutation.mutate({ tags: updated || null });
  };

  // Custom field definitions query
  const { data: customFieldDefinitions = [] } = useQuery<CustomFieldDefinition[]>({
    queryKey: ['custom-fields', task?.projectId],
    queryFn: async () => {
      if (!task?.projectId) return [];
      const res = await api.get(`/custom-fields?projectId=${task.projectId}`);
      return res.data;
    },
    enabled: !!task?.projectId && isOpen,
  });

  const [inlineEditingFieldKey, setInlineEditingFieldKey] = useState<string | null>(null);
  const [inlineEditingValue, setInlineEditingValue] = useState<any>('');

  // Parse Custom Fields
  const parsedCustomFields: Record<string, any> = useMemo(() => {
    if (!task?.customFields) return {};
    try {
      return JSON.parse(task.customFields);
    } catch {
      return {};
    }
  }, [task?.customFields]);

  const handleUpdateCustomFieldValue = (key: string, val: any) => {
    const updated = {
      ...parsedCustomFields,
      [key]: val,
    };
    if (val === undefined || val === null || val === '') {
      delete updated[key];
    }
    const jsonString = Object.keys(updated).length > 0 ? JSON.stringify(updated) : null;
    updateTaskMutation.mutate({ customFields: jsonString });
    setInlineEditingFieldKey(null);
  };

  const handleAddCustomField = () => {
    if (!customFieldKey.trim() || !customFieldValue.trim()) return;
    const updated = {
      ...parsedCustomFields,
      [customFieldKey.trim()]: customFieldValue.trim(),
    };
    updateTaskMutation.mutate({ customFields: JSON.stringify(updated) });
    setCustomFieldKey('');
    setCustomFieldValue('');
    setIsAddingCustomField(false);
  };

  const handleRemoveCustomField = (keyToRemove: string) => {
    const updated = { ...parsedCustomFields };
    delete updated[keyToRemove];
    const jsonString = Object.keys(updated).length > 0 ? JSON.stringify(updated) : null;
    updateTaskMutation.mutate({ customFields: jsonString });
  };

  // Subtask Rollup Calculation
  const subtasksCount = task?.subtasks?.length || 0;
  const doneSubtasksCount = task?.subtasks?.filter((s: any) => s.status === 'DONE').length || 0;
  const subtaskCompletionPercent = subtasksCount > 0 ? Math.round((doneSubtasksCount / subtasksCount) * 100) : 0;

  if (!isOpen) return null;

  const isArchived = task?.deletedAt || task?.project?.status === 'ARCHIVED';
  const isWatching = task?.watchers?.some((w: any) => w.userId === user?.sub);
  const isExternal =
    task?.taskList?.flag === 'EXTERNAL' ||
    (!task?.taskList && task?.milestone?.flag === 'EXTERNAL');

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO':
        return 'bg-slate-900 border-slate-800 text-slate-400';
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'REVIEW':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'DONE':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'BLOCKED':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  const handleSaveTitle = () => {
    if (title.trim() && title !== task.title) {
      updateTaskMutation.mutate({ title: title.trim() });
    } else {
      setTitle(task.title);
      setIsEditingTitle(false);
    }
  };

  const handleSaveDescription = () => {
    if (description !== (task.description || '')) {
      updateTaskMutation.mutate({ description: description.trim() || null });
    } else {
      setIsEditingDesc(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/projects/${projectId}/tasks/${taskId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentContent.trim()) {
      addCommentMutation.mutate(commentContent.trim());
    }
  };

  const handlePostAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (attachFileName.trim()) {
      const fileName = attachFileName.trim();
      addAttachmentMutation.mutate({
        fileName,
        fileUrl: `https://example.com/mock-files/${encodeURIComponent(fileName)}`,
        fileSize: attachFileSize,
      });
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full md:w-[760px] lg:w-[840px] bg-slate-950 border-l border-slate-850 z-50 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        )}

        {/* Top Header & Action Toolbar */}
        <header className="border-b border-slate-850 p-4 md:px-6 flex items-center justify-between flex-shrink-0 bg-slate-900/95 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-mono px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-indigo-400 font-bold uppercase shrink-0 shadow-xs">
              {task?.project?.projectCode}-{task?.taskNumber}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
              <span className="font-semibold text-slate-300 truncate">{task?.project?.name}</span>
              {task?.taskList && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="text-slate-400 truncate">{task.taskList.name}</span>
                </>
              )}
            </div>
            {task?.parentTask && (
              <button
                type="button"
                onClick={() => onSelectTask && onSelectTask(task.parentTask.id)}
                className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-all cursor-pointer truncate max-w-[220px]"
                title={`Jump to Parent Task: ${task.parentTask.title}`}
              >
                <CornerDownRight className="w-3.5 h-3.5 rotate-180 text-indigo-400 shrink-0" />
                <span className="truncate">Parent: {task.parentTask.title}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Copy task link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copiedLink ? 'Copied' : 'Copy Link'}</span>
            </button>

            {/* Watcher Button */}
            {task && (
              <button
                onClick={() => toggleWatcherMutation.mutate()}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  isWatching
                    ? 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title={isWatching ? 'Stop watching this task' : 'Watch this task'}
              >
                {isWatching ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {isWatching ? 'Watching' : 'Watch'} ({task.watchers?.length || 0})
                </span>
              </button>
            )}

            {/* Clone Button */}
            {task && !isArchived && (
              <button
                onClick={() => {
                  if (confirm(`Duplicate task "${task.title}"?`)) {
                    cloneTaskMutation.mutate();
                  }
                }}
                disabled={cloneTaskMutation.isPending}
                className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-slate-200 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                title="Duplicate / Clone Task"
              >
                {cloneTaskMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                <span className="hidden sm:inline">Clone</span>
              </button>
            )}

            {/* Delete Button */}
            {task && !isArchived && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2 bg-slate-950 hover:bg-rose-950/20 hover:text-rose-400 border border-slate-800 hover:border-rose-900/40 rounded-xl text-slate-400 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Tab Bar Navigation */}
        <div className="flex items-center gap-1 px-4 md:px-6 bg-slate-900/60 border-b border-slate-850 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Overview</span>
            {subtasksCount > 0 && (
              <span className="px-1.5 py-0.2 bg-slate-800 rounded-full text-[10px] font-mono text-slate-300">
                {doneSubtasksCount}/{subtasksCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('dependencies')}
            className={`px-3.5 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'dependencies'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
            }`}
          >
            <Workflow className="w-4 h-4" />
            <span>Dependencies</span>
            {((dependenciesData?.predecessors?.length || 0) + (dependenciesData?.successors?.length || 0)) > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-mono">
                {(dependenciesData?.predecessors?.length || 0) + (dependenciesData?.successors?.length || 0)}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('recurrence')}
            className={`px-3.5 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'recurrence'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <span>Recurrence</span>
            {taskRecurrence && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                taskRecurrence.status === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : taskRecurrence.status === 'PAUSED'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {taskRecurrence.status}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('reminders')}
            className={`px-3.5 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'reminders'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Reminders</span>
            {taskReminders.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-mono">
                {taskReminders.length}
              </span>
            )}
          </button>

          {task?.project?.settings?.allowTimeTracking && (
            <button
              onClick={() => setActiveTab('time')}
              className={`px-3.5 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'time'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Time Logs</span>
              {taskLogs.length > 0 && (
                <span className="px-1.5 py-0.2 bg-slate-800 rounded-full text-[10px] font-mono text-slate-300">
                  {taskLogs.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('comments')}
            className={`px-3.5 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'comments'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Comments</span>
            {task?.comments?.length > 0 && (
              <span className="px-1.5 py-0.2 bg-slate-800 rounded-full text-[10px] font-mono text-slate-300">
                {task.comments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('attachments')}
            className={`px-3.5 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'attachments'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
            }`}
          >
            <Paperclip className="w-4 h-4" />
            <span>Attachments</span>
            {((task?.attachments?.length || 0) + (task?.documents?.length || 0)) > 0 && (
              <span className="px-1.5 py-0.2 bg-slate-800 rounded-full text-[10px] font-mono text-slate-300">
                {(task?.attachments?.length || 0) + (task?.documents?.length || 0)}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Status & History</span>
          </button>
        </div>

        {/* Drawer Body Scroll */}
        {task && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            
            {/* Archived Warning banner */}
            {isArchived && (
              <div className="bg-amber-950/20 border border-amber-900/60 text-amber-200 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs">Task Read-Only State</h4>
                  <p className="text-amber-400/80 text-[10px] mt-1">
                    {task.deletedAt 
                      ? 'This task has been archived. Edits and logging functions are disabled.'
                      : 'The parent project has been archived. All tasks inside are frozen.'}
                  </p>
                </div>
              </div>
            )}

            {/* Recurring Series Top Banner (Zoho Projects Spec) */}
            {(task.recurringTaskId || task.recurringTask || taskRecurrence) && (
              <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900/80 to-purple-950/30 border border-indigo-800/40 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shrink-0">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-100">
                        {task.isRecurringTemplate
                          ? 'Recurring Template Task'
                          : `Recurring Series (Occurrence #${task.recurrenceIndex || 1})`}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          (taskRecurrence?.status || task.recurringTask?.status) === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : (taskRecurrence?.status || task.recurringTask?.status) === 'PAUSED'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {taskRecurrence?.status || task.recurringTask?.status || 'ACTIVE'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {(taskRecurrence?.nextRunDate || task.recurringTask?.nextRunDate)
                        ? `Next occurrence scheduled for ${formatDate(taskRecurrence?.nextRunDate || task.recurringTask?.nextRunDate)}`
                        : 'Recurrence series completed or paused.'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('recurrence')}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                  >
                    Manage Series
                  </button>
                  {taskRecurrence?.id && taskRecurrence.status === 'ACTIVE' && (
                    <button
                      type="button"
                      disabled={generateNextOccurrenceMutation.isPending}
                      onClick={() => generateNextOccurrenceMutation.mutate(taskRecurrence.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {generateNextOccurrenceMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <Plus className="w-3.5 h-3.5" />
                      Generate Next Now
                    </button>
                  )}
                </div>
              </div>
            )}

            {updateError && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-rose-400 flex-shrink-0" />
                <span>{updateError}</span>
              </div>
            )}

            {/* Main Grid: Left Tab Content + Right Properties Rail */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Main Tab Content (8 Cols) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Task Title Banner */}
                <div className="space-y-1">
                  {isEditingTitle && !isArchived ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleSaveTitle}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTitle();
                          if (e.key === 'Escape') {
                            setTitle(task.title);
                            setIsEditingTitle(false);
                          }
                        }}
                        autoFocus
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-indigo-500 rounded-xl text-slate-100 font-bold text-base focus:outline-none ring-1 ring-indigo-500"
                      />
                      <button
                        onClick={handleSaveTitle}
                        className="px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <h2
                      onClick={() => !isArchived && setIsEditingTitle(true)}
                      className={`text-lg md:text-xl font-bold text-slate-100 leading-snug tracking-tight ${
                        !isArchived ? 'cursor-pointer hover:bg-slate-900/60 p-2 rounded-xl -ml-2 transition-colors' : ''
                      }`}
                      title={!isArchived ? 'Click to edit task title' : undefined}
                    >
                      {task.title}
                    </h2>
                  )}
                </div>

                {/* TAB 1: OVERVIEW */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Progress Rollup & Status Summary Banner */}
                    <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Task Progress
                          </span>
                          <span className="font-mono font-bold text-indigo-400">
                            {task.progress ?? 0}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(task.status)}`}>
                            {task.status.replace('_', ' ')}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            (task.progress ?? 0) === 100
                              ? 'bg-emerald-500'
                              : (task.progress ?? 0) > 0
                              ? 'bg-gradient-to-r from-indigo-500 to-blue-500'
                              : 'bg-slate-800'
                          }`}
                          style={{ width: `${task.progress ?? 0}%` }}
                        />
                      </div>

                      {/* Quick progress presets */}
                      {!isArchived && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-500 mr-1">Quick Set:</span>
                          {[0, 25, 50, 75, 100].map((pct) => (
                            <button
                              key={pct}
                              onClick={() => updateTaskMutation.mutate({ progress: pct })}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border transition-all cursor-pointer ${
                                (task.progress ?? 0) === pct
                                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Description Section */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Description
                        </label>
                        {!isEditingDesc && !isArchived && (
                          <button
                            type="button"
                            onClick={() => setIsEditingDesc(true)}
                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {isEditingDesc && !isArchived ? (
                        <div className="space-y-2.5">
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={5}
                            placeholder="Add rich task description, requirements, or steps..."
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 resize-none font-sans leading-relaxed"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDescription(task.description || '');
                                setIsEditingDesc(false);
                              }}
                              className="px-3 py-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 rounded-xl text-xs font-semibold text-slate-300 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveDescription}
                              className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 rounded-xl text-xs font-semibold text-white shadow-xs cursor-pointer"
                            >
                              Save Description
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => !isArchived && setIsEditingDesc(true)}
                          className={`min-h-20 text-xs text-slate-300 leading-relaxed bg-slate-900/20 border border-slate-850 rounded-xl p-4 ${
                            !isArchived ? 'cursor-pointer hover:border-slate-800 transition-colors' : ''
                          }`}
                        >
                          {task.description ? (
                            <p className="whitespace-pre-wrap">{task.description}</p>
                          ) : (
                            <p className="text-slate-500 italic">No description provided. Click to add detailed context.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Subtasks Checklist */}
                    <div className="space-y-3 pt-4 border-t border-slate-850">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                            Subtasks Checklist ({subtasksCount})
                          </h4>
                          {subtasksCount > 0 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({doneSubtasksCount} of {subtasksCount} completed • {subtaskCompletionPercent}%)
                            </span>
                          )}
                        </div>

                        {!isArchived && !isAddingSubtask && (
                          <button
                            type="button"
                            onClick={() => setIsAddingSubtask(true)}
                            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/20 transition-all self-start sm:self-auto"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Subtask
                          </button>
                        )}
                      </div>

                      {/* Subtasks Progress Bar */}
                      {subtasksCount > 0 && (
                        <div className="w-full h-1.5 bg-slate-950 border border-slate-850 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              subtaskCompletionPercent === 100
                                ? 'bg-emerald-500'
                                : 'bg-gradient-to-r from-indigo-500 to-blue-500'
                            }`}
                            style={{ width: `${subtaskCompletionPercent}%` }}
                          />
                        </div>
                      )}

                      {/* Add Subtask Form */}
                      {isAddingSubtask && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (newSubtaskTitle.trim()) {
                              createSubtaskMutation.mutate({
                                title: newSubtaskTitle.trim(),
                                priority: newSubtaskPriority,
                                assigneeId: newSubtaskAssigneeId || undefined,
                                dueDate: newSubtaskDueDate || undefined,
                              });
                            }
                          }}
                          className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3 animate-in fade-in duration-150"
                        >
                          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                            New Subtask
                          </div>
                          <input
                            type="text"
                            autoFocus
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            placeholder="Subtask title / requirement..."
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Priority
                              </label>
                              <select
                                value={newSubtaskPriority}
                                onChange={(e) => setNewSubtaskPriority(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                              >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="CRITICAL">Critical</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Assignee
                              </label>
                              <select
                                value={newSubtaskAssigneeId}
                                onChange={(e) => setNewSubtaskAssigneeId(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                              >
                                <option value="">Unassigned</option>
                                {task.project?.members?.map((m: any) => {
                                  const isClient = m.role === 'CLIENT';
                                  const isDisabled = isClient && !isExternal;
                                  const userName = m.user?.firstName ? `${m.user.firstName} ${m.user.lastName || ''}` : m.user?.email;
                                  return (
                                    <option key={m.user?.id || m.userId} value={m.user?.id || m.userId} disabled={isDisabled}>
                                      {userName} {isClient ? (isDisabled ? '(Client - External only)' : '(Client)') : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Due Date
                              </label>
                              <input
                                type="date"
                                value={newSubtaskDueDate}
                                onChange={(e) => setNewSubtaskDueDate(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingSubtask(false);
                                setNewSubtaskTitle('');
                              }}
                              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={createSubtaskMutation.isPending || !newSubtaskTitle.trim()}
                              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                            >
                              {createSubtaskMutation.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                              <span>Add Subtask</span>
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Subtasks List */}
                      <ul className="space-y-2">
                        {task.subtasks && task.subtasks.length > 0 ? (
                          task.subtasks.map((st: any) => {
                            const isDone = st.status === 'DONE';
                            return (
                              <li
                                key={st.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-950/40 hover:bg-slate-950/80 border border-slate-850 hover:border-slate-800 rounded-xl transition-all gap-2 group"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <input
                                    type="checkbox"
                                    disabled={isArchived}
                                    checked={isDone}
                                    onChange={() =>
                                      toggleSubtaskStatusMutation.mutate({
                                        id: st.id,
                                        status: isDone ? 'TODO' : 'DONE',
                                      })
                                    }
                                    className="w-4 h-4 rounded bg-slate-900 border-slate-750 text-indigo-600 focus:ring-0 cursor-pointer shrink-0"
                                  />
                                  <span
                                    onClick={() => onSelectTask && onSelectTask(st.id)}
                                    className={`text-xs font-medium truncate cursor-pointer hover:text-indigo-300 transition-colors ${
                                      isDone ? 'line-through text-slate-500' : 'text-slate-200'
                                    }`}
                                    title="Click to view subtask details"
                                  >
                                    {st.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0 flex-wrap">
                                  {st.priority && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase ${getPriorityColor(
                                        st.priority
                                      )}`}
                                    >
                                      {st.priority}
                                    </span>
                                  )}

                                  {st.assignee && (
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {st.assignee.firstName || st.assignee.email.split('@')[0]}
                                    </span>
                                  )}

                                  {st.dueDate && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {formatDate(st.dueDate)}
                                    </span>
                                  )}

                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${getStatusColor(
                                      st.status
                                    )}`}
                                  >
                                    {st.status.replace('_', ' ')}
                                  </span>

                                  {/* Action Buttons */}
                                  {!isArchived && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        onClick={() => onSelectTask && onSelectTask(st.id)}
                                        className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-900 rounded transition-colors cursor-pointer"
                                        title="Open Subtask Details"
                                      >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Convert "${st.title}" into a standalone parent task?`)) {
                                            convertSubtaskMutation.mutate(st.id);
                                          }
                                        }}
                                        className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-900 rounded transition-colors cursor-pointer text-[10px]"
                                        title="Convert to Standalone Task"
                                      >
                                        <Layers className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Delete subtask "${st.title}"?`)) {
                                            deleteSubtaskMutation.mutate(st.id);
                                          }
                                        }}
                                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded transition-colors cursor-pointer"
                                        title="Delete Subtask"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })
                        ) : (
                          !isAddingSubtask && (
                            <p className="text-[11px] text-slate-500 italic">
                              No subtasks added yet. Break down this task into smaller actionable steps.
                            </p>
                          )
                        )}
                      </ul>
                    </div>

                    {/* Tags Manager */}
                    <div className="space-y-3 pt-4 border-t border-slate-850">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Tag className="w-4 h-4 text-indigo-400" />
                          Tags ({parsedTags.length})
                        </h4>
                        {!isArchived && !isAddingTag && (
                          <button
                            type="button"
                            onClick={() => setIsAddingTag(true)}
                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Tag
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {parsedTags.map((t) => (
                          <span
                            key={t}
                            className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 flex items-center gap-1.5"
                          >
                            <span>#{t}</span>
                            {!isArchived && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(t)}
                                className="text-slate-500 hover:text-rose-400 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))}

                        {isAddingTag && (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              autoFocus
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddTag(newTagInput);
                                }
                                if (e.key === 'Escape') setIsAddingTag(false);
                              }}
                              placeholder="Tag name..."
                              className="px-2.5 py-1 bg-slate-950 border border-indigo-500 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none w-28"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddTag(newTagInput)}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsAddingTag(false)}
                              className="px-1.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {parsedTags.length === 0 && !isAddingTag && (
                          <p className="text-[11px] text-slate-500 italic">No tags associated with this task.</p>
                        )}
                      </div>
                    </div>

                    {/* Custom Fields Manager */}
                    <div className="space-y-4 pt-4 border-t border-slate-850">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                          <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                          Custom Fields ({customFieldDefinitions.length > 0 ? customFieldDefinitions.length : Object.keys(parsedCustomFields).length})
                        </h4>
                        {!isArchived && !isAddingCustomField && (
                          <button
                            type="button"
                            onClick={() => setIsAddingCustomField(true)}
                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Custom Value
                          </button>
                        )}
                      </div>

                      {/* Add Custom Field Form */}
                      {isAddingCustomField && (
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                            New Custom Field Key / Value
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Field Name (e.g. Environment)"
                              value={customFieldKey}
                              onChange={(e) => setCustomFieldKey(e.target.value)}
                              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                            <input
                              type="text"
                              placeholder="Value (e.g. Production)"
                              value={customFieldValue}
                              onChange={(e) => setCustomFieldValue(e.target.value)}
                              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingCustomField(false);
                                setCustomFieldKey('');
                                setCustomFieldValue('');
                              }}
                              className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleAddCustomField}
                              disabled={!customFieldKey.trim() || !customFieldValue.trim()}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              Save Field
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Defined Custom Fields List */}
                      {customFieldDefinitions.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {customFieldDefinitions.map((field) => {
                            const val = parsedCustomFields[field.apiName];
                            const isEditing = inlineEditingFieldKey === field.apiName;
                            const typeCfg = FIELD_TYPE_CONFIG[field.type] || {
                              label: field.type,
                              icon: SlidersHorizontal,
                              color: 'text-slate-400',
                            };
                            const Icon = typeCfg.icon;

                            // Parse options for select
                            let parsedOpts: Array<{ label: string; value: string; color?: string }> = [];
                            if (field.options) {
                              try {
                                const o = JSON.parse(field.options);
                                parsedOpts = o.map((x: any) =>
                                  typeof x === 'string' ? { label: x, value: x } : x,
                                );
                              } catch {
                                parsedOpts = [];
                              }
                            }

                            return (
                              <div
                                key={field.id}
                                className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1.5 hover:border-slate-800 transition-all group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                                    <Icon className="w-3 h-3 text-indigo-400 shrink-0" />
                                    {field.name}
                                    {field.isRequired && (
                                      <span className="text-rose-400 font-bold">*</span>
                                    )}
                                  </span>

                                  {!isArchived && !isEditing && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInlineEditingFieldKey(field.apiName);
                                        setInlineEditingValue(val !== undefined ? val : '');
                                      }}
                                      className="text-slate-500 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded cursor-pointer"
                                      title="Edit Value"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>

                                {/* Field Display or Inline Edit Form */}
                                {isEditing ? (
                                  <div className="space-y-1.5 pt-1">
                                    {field.type === 'SELECT' ? (
                                      <select
                                        value={inlineEditingValue}
                                        onChange={(e) => setInlineEditingValue(e.target.value)}
                                        className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                                      >
                                        <option value="">-- None --</option>
                                        {parsedOpts.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : field.type === 'CHECKBOX' ? (
                                      <label className="flex items-center gap-2 cursor-pointer py-1">
                                        <input
                                          type="checkbox"
                                          checked={inlineEditingValue === true || inlineEditingValue === 'true'}
                                          onChange={(e) => setInlineEditingValue(e.target.checked)}
                                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs text-slate-200">
                                          {inlineEditingValue ? 'Enabled' : 'Disabled'}
                                        </span>
                                      </label>
                                    ) : (
                                      <input
                                        type={field.type === 'NUMBER' || field.type === 'DECIMAL' || field.type === 'CURRENCY' || field.type === 'PERCENTAGE' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
                                        value={inlineEditingValue}
                                        onChange={(e) => setInlineEditingValue(e.target.value)}
                                        placeholder={field.placeholder || 'Enter value...'}
                                        className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                                      />
                                    )}

                                    <div className="flex justify-end gap-1.5 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => setInlineEditingFieldKey(null)}
                                        className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateCustomFieldValue(field.apiName, inlineEditingValue)}
                                        className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-semibold cursor-pointer"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs font-medium text-slate-200 pt-0.5">
                                    {val === undefined || val === null || val === '' ? (
                                      <span className="text-slate-600 italic text-[11px]">
                                        Not set
                                      </span>
                                    ) : field.type === 'SELECT' ? (
                                      (() => {
                                        const opt = parsedOpts.find((o) => o.value === val);
                                        return (
                                          <span
                                            className="px-2 py-0.5 rounded text-[11px] font-semibold inline-flex items-center gap-1.5 border"
                                            style={{
                                              backgroundColor: `${opt?.color || '#3b82f6'}15`,
                                              borderColor: `${opt?.color || '#3b82f6'}30`,
                                              color: opt?.color || '#93c5fd',
                                            }}
                                          >
                                            <span
                                              className="w-1.5 h-1.5 rounded-full"
                                              style={{ backgroundColor: opt?.color || '#3b82f6' }}
                                            />
                                            {opt?.label || val}
                                          </span>
                                        );
                                      })()
                                    ) : field.type === 'MULTI_SELECT' ? (
                                      <div className="flex flex-wrap gap-1">
                                        {(Array.isArray(val) ? val : String(val).split(',')).map((item: any, i: number) => (
                                          <span
                                            key={i}
                                            className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-medium"
                                          >
                                            {String(item).trim()}
                                          </span>
                                        ))}
                                      </div>
                                    ) : field.type === 'URL' ? (
                                      <a
                                        href={val.startsWith('http') ? val : `https://${val}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-400 hover:text-indigo-300 underline inline-flex items-center gap-1 truncate"
                                      >
                                        <Globe className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{val}</span>
                                      </a>
                                    ) : field.type === 'EMAIL' ? (
                                      <a
                                        href={`mailto:${val}`}
                                        className="text-indigo-400 hover:text-indigo-300 underline inline-flex items-center gap-1 truncate"
                                      >
                                        <AtSign className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{val}</span>
                                      </a>
                                    ) : field.type === 'PHONE' ? (
                                      <a
                                        href={`tel:${val}`}
                                        className="text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-1 truncate"
                                      >
                                        <span>{val}</span>
                                      </a>
                                    ) : field.type === 'CHECKBOX' ? (
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1 ${
                                          val === true || val === 'true'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                                        }`}
                                      >
                                        {val === true || val === 'true' ? 'Enabled' : 'Disabled'}
                                      </span>
                                    ) : field.type === 'CURRENCY' ? (
                                      <span className="text-emerald-400 font-semibold font-mono">
                                        ${Number(val).toLocaleString()}
                                      </span>
                                    ) : field.type === 'PERCENTAGE' ? (
                                      <span className="text-amber-400 font-semibold font-mono">
                                        {val}%
                                      </span>
                                    ) : (
                                      <span className="text-slate-200">{String(val)}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Fallback dynamic listing for unmapped ad-hoc fields */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {Object.entries(parsedCustomFields).map(([key, val]) => (
                            <div
                              key={key}
                              className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl flex items-center justify-between"
                            >
                              <div className="min-w-0">
                                <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                                  {key}
                                </span>
                                <span className="text-xs font-medium text-slate-200 truncate">
                                  {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                </span>
                              </div>
                              {!isArchived && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomField(key)}
                                  className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                                  title="Remove custom field"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}

                          {Object.keys(parsedCustomFields).length === 0 && !isAddingCustomField && (
                            <p className="text-[11px] text-slate-500 italic col-span-2">
                              No custom fields defined for this task.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* TAB 1.5: DEPENDENCIES */}
                {activeTab === 'dependencies' && (
                  <div className="space-y-6">
                    {/* Header & Info */}
                    <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                          <Workflow className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                            Task Dependencies & Critical Path
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Sequencing constraints with automated CPM date rescheduling
                          </p>
                        </div>
                      </div>

                      {!isArchived && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDepDirection('PREDECESSOR');
                              setSelectedTargetTaskId('');
                              setSelectedDepType('FINISH_TO_START');
                              setSelectedDepLag(0);
                              setSelectedDepLinkType('HARD');
                              setDepModalError(null);
                              setIsAddDepModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Predecessor</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDepDirection('SUCCESSOR');
                              setSelectedTargetTaskId('');
                              setSelectedDepType('FINISH_TO_START');
                              setSelectedDepLag(0);
                              setSelectedDepLinkType('HARD');
                              setDepModalError(null);
                              setIsAddDepModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Successor</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Section 1: Predecessors (Depends On) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          Predecessors ({dependenciesData?.predecessors?.length || 0})
                          <span className="text-[10px] text-slate-500 font-normal lowercase">
                            (tasks that this task depends on)
                          </span>
                        </h4>
                      </div>

                      {dependenciesData?.predecessors?.length > 0 ? (
                        <div className="divide-y divide-slate-850/60 bg-slate-950/40 border border-slate-850 rounded-2xl overflow-hidden">
                          {dependenciesData.predecessors.map((dep: any) => (
                            <div
                              key={dep.id}
                              className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors"
                            >
                              <div className="flex items-start sm:items-center gap-3 min-w-0">
                                <span className="font-mono text-xs font-bold text-indigo-400 shrink-0">
                                  #{dep.predecessor?.taskNumber}
                                </span>
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => onSelectTask && onSelectTask(dep.predecessor?.id)}
                                    className="text-xs font-semibold text-slate-200 hover:text-indigo-300 truncate hover:underline text-left block"
                                  >
                                    {dep.predecessor?.title}
                                  </button>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                    <span>
                                      {dep.predecessor?.assignee?.firstName
                                        ? `${dep.predecessor.assignee.firstName} ${dep.predecessor.assignee.lastName || ''}`
                                        : 'Unassigned'}
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Due: {dep.predecessor?.dueDate ? formatDate(dep.predecessor.dueDate) : 'No date'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusColor(dep.predecessor?.status)}`}>
                                  {dep.predecessor?.status?.replace('_', ' ')}
                                </span>

                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                  {dep.type}
                                  {dep.lag !== 0 && ` (${dep.lag > 0 ? `+${dep.lag}` : dep.lag}d)`}
                                </span>

                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                                  {dep.linkType}
                                </span>

                                {!isArchived && (
                                  <div className="flex items-center gap-1 ml-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditingDep(dep)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-850 cursor-pointer"
                                      title="Edit Dependency"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteDependencyMutation.mutate(dep.id)}
                                      disabled={deleteDependencyMutation.isPending}
                                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-850 cursor-pointer disabled:opacity-50"
                                      title="Remove Dependency"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center bg-slate-950/20 border border-slate-850/60 rounded-2xl text-slate-500 text-xs">
                          No predecessors configured. This task can start independently.
                        </div>
                      )}
                    </div>

                    {/* Section 2: Successors (Required For) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          Successors ({dependenciesData?.successors?.length || 0})
                          <span className="text-[10px] text-slate-500 font-normal lowercase">
                            (tasks waiting on this task)
                          </span>
                        </h4>
                      </div>

                      {dependenciesData?.successors?.length > 0 ? (
                        <div className="divide-y divide-slate-850/60 bg-slate-950/40 border border-slate-850 rounded-2xl overflow-hidden">
                          {dependenciesData.successors.map((dep: any) => (
                            <div
                              key={dep.id}
                              className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors"
                            >
                              <div className="flex items-start sm:items-center gap-3 min-w-0">
                                <span className="font-mono text-xs font-bold text-blue-400 shrink-0">
                                  #{dep.successor?.taskNumber}
                                </span>
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => onSelectTask && onSelectTask(dep.successor?.id)}
                                    className="text-xs font-semibold text-slate-200 hover:text-indigo-300 truncate hover:underline text-left block"
                                  >
                                    {dep.successor?.title}
                                  </button>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                    <span>
                                      {dep.successor?.assignee?.firstName
                                        ? `${dep.successor.assignee.firstName} ${dep.successor.assignee.lastName || ''}`
                                        : 'Unassigned'}
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Start: {dep.successor?.startDate ? formatDate(dep.successor.startDate) : 'No date'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusColor(dep.successor?.status)}`}>
                                  {dep.successor?.status?.replace('_', ' ')}
                                </span>

                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  {dep.type}
                                  {dep.lag !== 0 && ` (${dep.lag > 0 ? `+${dep.lag}` : dep.lag}d)`}
                                </span>

                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                                  {dep.linkType}
                                </span>

                                {!isArchived && (
                                  <div className="flex items-center gap-1 ml-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditingDep(dep)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-850 cursor-pointer"
                                      title="Edit Dependency"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteDependencyMutation.mutate(dep.id)}
                                      disabled={deleteDependencyMutation.isPending}
                                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-850 cursor-pointer disabled:opacity-50"
                                      title="Remove Dependency"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center bg-slate-950/20 border border-slate-850/60 rounded-2xl text-slate-500 text-xs">
                          No successor tasks are waiting on this task.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: TIME LOGS */}
                {activeTab === 'time' && task?.project?.settings?.allowTimeTracking && (
                  <div className="space-y-6">
                    {/* Stopwatch Timer Card */}
                    <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl border ${
                          isThisTimerRunning 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}>
                          <Clock className={`w-5 h-5 ${isThisTimerRunning ? 'animate-pulse' : ''}`} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Live Task Stopwatch
                          </div>
                          <div className="text-lg font-mono font-extrabold text-slate-100">
                            {isThisTimerRunning ? formatTime(elapsed) : '00:00:00'}
                          </div>
                        </div>
                      </div>

                      {!isArchived && (
                        <div>
                          {isThisTimerRunning ? (
                            isStopping ? (
                              <div className="flex flex-col gap-1.5 items-end">
                                <input
                                  type="text"
                                  placeholder="What did you work on?"
                                  value={stopDescription}
                                  onChange={(e) => setStopDescription(e.target.value)}
                                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-48"
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => setIsStopping(false)}
                                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => stopTimerMutation.mutate(stopDescription)}
                                    disabled={stopTimerMutation.isPending}
                                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
                                  >
                                    Confirm Stop
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setIsStopping(true)}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                              >
                                <Square className="w-3.5 h-3.5 fill-white" /> Stop Timer
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => startTimerMutation.mutate()}
                              disabled={startTimerMutation.isPending}
                              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" /> Start Timer
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Progress Bar of Planned vs Actual */}
                    {(() => {
                      const totalTaskLogged = taskLogs.reduce((sum: number, l: any) => sum + l.hours, 0);
                      const hasEstimate = task.estimatedHours && task.estimatedHours > 0;
                      const percent = hasEstimate ? Math.min(100, Math.round((totalTaskLogged / task.estimatedHours) * 100)) : 0;
                      const isOverBudget = hasEstimate && totalTaskLogged > task.estimatedHours;
                      
                      return (
                        <div className="p-4 bg-slate-900/20 border border-slate-850 rounded-2xl space-y-2">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-400">Total Logged Time</span>
                            <span className={isOverBudget ? 'text-rose-400 font-mono' : 'text-indigo-400 font-mono'}>
                              {totalTaskLogged.toFixed(1)}h{hasEstimate ? ` / ${task.estimatedHours.toFixed(1)}h (${percent}%)` : ''}
                            </span>
                          </div>
                          {hasEstimate && (
                            <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-2.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isOverBudget ? 'bg-rose-500' : percent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Task Level Time Logs List */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        Logged Entries History ({taskLogs.length})
                      </h4>

                      {taskLogs.length > 0 ? (
                        <ul className="space-y-2">
                          {taskLogs.map((log: any) => {
                            const isLocked = log.timesheet && (log.timesheet.status === 'SUBMITTED' || log.timesheet.status === 'APPROVED');
                            return (
                              <li
                                key={log.id}
                                className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-850 rounded-xl"
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                                    <span>
                                      {log.user.firstName ? `${log.user.firstName} ${log.user.lastName || ''}` : log.user.email}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      {formatDate(log.loggedAt)}
                                    </span>
                                    {log.isBillable && (
                                      <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-bold">
                                        BILLABLE
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-1 max-w-[320px] truncate" title={log.description}>
                                    {log.description || <span className="text-slate-600 italic">No notes captured</span>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-xs font-bold text-indigo-400">
                                    {log.hours.toFixed(1)}h
                                  </span>
                                  
                                  {hasPermission('ARCHIVE_TIME_ENTRY') && !isArchived && (
                                    <button
                                      onClick={() => {
                                        if (confirm('Are you sure you want to archive this task time log?')) {
                                          archiveTimeMutation.mutate(log.id);
                                        }
                                      }}
                                      disabled={isLocked || archiveTimeMutation.isPending}
                                      className={`p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-all ${
                                        isLocked ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-800 cursor-pointer'
                                      }`}
                                      title={isLocked ? 'Locked in submitted timesheet' : 'Archive time log'}
                                    >
                                      <Archive className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">No hours logged against this task yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: COMMENTS (With @Mention Support) */}
                {activeTab === 'comments' && (
                  <div className="space-y-4">
                    {/* Add Comment Box */}
                    {!isArchived && (
                      <div className="space-y-2">
                        <form onSubmit={handlePostComment} className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={commentContent}
                              onChange={(e) => setCommentContent(e.target.value)}
                              placeholder="Discuss task progress, add updates, type @name to mention..."
                              className="w-full pl-3.5 pr-9 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                            <div className="absolute right-2.5 top-2.5 text-slate-500">
                              <AtSign className="w-4 h-4" />
                            </div>
                          </div>
                          <button
                            type="submit"
                            disabled={addCommentMutation.isPending || !commentContent.trim()}
                            className="px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                          >
                            {addCommentMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            Comment
                          </button>
                        </form>

                        {/* Quick @Mention chips */}
                        {task.project?.members && task.project.members.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1 font-semibold text-slate-400">
                              <AtSign className="w-3 h-3 text-indigo-400" /> Mention:
                            </span>
                            {task.project.members.slice(0, 6).map((m: any) => {
                              const handleName = m.user.firstName || m.user.email?.split('@')[0] || 'user';
                              return (
                                <button
                                  key={m.user.id}
                                  type="button"
                                  onClick={() => {
                                    setCommentContent((prev) => {
                                      const suffix = `@${handleName} `;
                                      return prev ? `${prev.trim()} ${suffix}` : suffix;
                                    });
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-slate-950 hover:bg-indigo-950/40 text-slate-300 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/30 transition-colors cursor-pointer"
                                  title={`Mention ${m.user.firstName ? `${m.user.firstName} ${m.user.lastName || ''}` : m.user.email}`}
                                >
                                  @{handleName}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Comment Feed */}
                    <ul className="space-y-3.5">
                      {task.comments && task.comments.length > 0 ? (
                        task.comments.map((comment: any) => {
                          const renderHighlightedContent = (text: string) => {
                            if (!text) return null;
                            const parts = text.split(/(@[a-zA-Z0-9._-]+)/g);
                            return parts.map((part, i) => {
                              if (part.startsWith('@')) {
                                return (
                                  <span
                                    key={i}
                                    className="inline-flex items-center px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30 text-[11px] mx-0.5"
                                  >
                                    {part}
                                  </span>
                                );
                              }
                              return part;
                            });
                          };

                          return (
                            <li
                              key={comment.id}
                              className="bg-slate-900/30 border border-slate-855 rounded-xl p-4 space-y-2"
                            >
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-indigo-400" />
                                  {comment.user?.firstName
                                    ? `${comment.user.firstName} ${comment.user.lastName || ''}`
                                    : comment.user?.email}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(comment.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap pl-5">
                                {renderHighlightedContent(comment.content)}
                              </p>
                            </li>
                          );
                        })
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">No comments yet. Start the conversation!</p>
                      )}
                    </ul>
                  </div>
                )}

                {/* TAB 4: ATTACHMENTS */}
                {activeTab === 'attachments' && (
                  <div className="space-y-5">
                    {/* Error Banner */}
                    {attachmentError && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{attachmentError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachmentError(null)}
                          className="p-1 hover:bg-rose-500/20 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Header & Controls Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-850">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-4 h-4 text-indigo-400" />
                          <h4 className="text-xs font-bold text-slate-200">
                            Files & Documents ({((task.attachments?.length || 0) + (task.documents?.length || 0))})
                          </h4>
                        </div>
                        {/* Search Filter */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            value={attachmentSearch}
                            onChange={(e) => setAttachmentSearch(e.target.value)}
                            placeholder="Filter files..."
                            className="pl-8 pr-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-44"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* View Mode Toggle */}
                        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setAttachmentViewMode('GRID')}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              attachmentViewMode === 'GRID'
                                ? 'bg-indigo-600 text-white shadow'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Grid View"
                          >
                            <LayoutGrid className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttachmentViewMode('LIST')}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              attachmentViewMode === 'LIST'
                                ? 'bg-indigo-600 text-white shadow'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="List View"
                          >
                            <List className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Attach from Project Documents Button */}
                        {task.project?.settings?.allowFileUploads && !isArchived && (
                          <button
                            type="button"
                            onClick={() => setIsAttachDocModalOpen(true)}
                            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Folder className="w-3.5 h-3.5 text-indigo-400" />
                            <span>From Documents</span>
                          </button>
                        )}

                        {/* Add / Upload Button */}
                        {task.project?.settings?.allowFileUploads && !isArchived && (
                          <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer">
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Upload</span>
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files) handleFilesUpload(e.target.files);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Drag-and-Drop Dropzone */}
                    {task.project?.settings?.allowFileUploads && !isArchived && (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingOver(true);
                        }}
                        onDragLeave={() => setIsDraggingOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingOver(false);
                          if (e.dataTransfer.files) handleFilesUpload(e.dataTransfer.files);
                        }}
                        className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
                          isDraggingOver
                            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                            : 'border-slate-800/80 hover:border-slate-700 bg-slate-950/40'
                        }`}
                      >
                        <input
                          type="file"
                          id="task-drawer-file-dropzone"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files) handleFilesUpload(e.target.files);
                            e.target.value = '';
                          }}
                        />
                        <label htmlFor="task-drawer-file-dropzone" className="cursor-pointer block">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-2">
                            <UploadCloud className="w-5 h-5" />
                          </div>
                          <p className="text-xs font-semibold text-slate-200">
                            Drag & drop files here, or <span className="text-indigo-400 underline">browse files</span>
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Supports multi-file upload • PDF, Images, Word, Excel, Code, Archives up to 50MB
                          </p>
                        </label>
                        <div className="mt-2 pt-2 border-t border-slate-900/60 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowAttachmentForm(!showAttachmentForm);
                            }}
                            className="text-[11px] text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Link2 className="w-3 h-3" />
                            {showAttachmentForm ? 'Hide manual URL registration' : 'Register file via storage URL / manual path'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Manual Attachment Registration Form */}
                    {showAttachmentForm && (
                      <form
                        onSubmit={handleManualAddAttachment}
                        className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 animate-in fade-in duration-150"
                      >
                        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          Register Document Attachment URL
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            required
                            value={attachFileName}
                            onChange={(e) => setAttachFileName(e.target.value)}
                            placeholder="specification_v2.pdf"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                          />
                          <input
                            type="text"
                            value={attachFileUrl}
                            onChange={(e) => setAttachFileUrl(e.target.value)}
                            placeholder="https://storage.zoho-pms.internal/..."
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                          />
                          <select
                            value={attachFileSize}
                            onChange={(e) => setAttachFileSize(parseInt(e.target.value, 10))}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value={1024 * 125}>125 KB (PDF Document)</option>
                            <option value={1024 * 1024 * 2.4}>2.4 MB (Design Asset)</option>
                            <option value={1024 * 512}>512 KB (Log File)</option>
                            <option value={1024 * 1024 * 10}>10 MB (Archive Bundle)</option>
                          </select>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowAttachmentForm(false)}
                            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 hover:bg-slate-850 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={addAttachmentMutation.isPending}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {addAttachmentMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Register Attachment
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Attachments & Documents Lists */}
                    {(() => {
                      const allDirect = (task.attachments || []).filter((a: any) =>
                        !attachmentSearch ||
                        a.fileName?.toLowerCase().includes(attachmentSearch.toLowerCase()) ||
                        a.uploadedBy?.firstName?.toLowerCase().includes(attachmentSearch.toLowerCase()) ||
                        a.uploadedBy?.email?.toLowerCase().includes(attachmentSearch.toLowerCase())
                      );
                      const allLinkedDocs = (task.documents || []).filter((d: any) =>
                        !attachmentSearch ||
                        d.name?.toLowerCase().includes(attachmentSearch.toLowerCase()) ||
                        d.tags?.toLowerCase().includes(attachmentSearch.toLowerCase()) ||
                        d.uploadedBy?.firstName?.toLowerCase().includes(attachmentSearch.toLowerCase())
                      );
                      const totalVisible = allDirect.length + allLinkedDocs.length;

                      if (totalVisible === 0) {
                        return (
                          <div className="py-10 text-center space-y-2 bg-slate-950/20 border border-slate-850 rounded-2xl p-6">
                            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-500 mx-auto">
                              <Paperclip className="w-6 h-6" />
                            </div>
                            <p className="text-xs font-semibold text-slate-300">
                              {attachmentSearch ? 'No files match your search' : 'No attachments on this task'}
                            </p>
                            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                              Upload files directly or link existing documents from the project documents center.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4">
                          {/* Direct Task Attachments Section */}
                          {allDirect.length > 0 && (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <span>Direct Attachments ({allDirect.length})</span>
                              </div>

                              {attachmentViewMode === 'GRID' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {allDirect.map((file: any) => {
                                    const badge = getFileBadge(undefined, file.fileName);
                                    const isEditing = editingAttachmentId === file.id;

                                    return (
                                      <div
                                        key={file.id}
                                        className="p-3.5 bg-slate-900/40 border border-slate-850 hover:border-slate-750 rounded-2xl space-y-3 transition-all group relative flex flex-col justify-between"
                                      >
                                        <div className="flex items-start gap-3 min-w-0">
                                          <div className={`p-2.5 rounded-xl border shrink-0 ${badge.bg}`}>
                                            {badge.icon}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            {isEditing ? (
                                              <div className="space-y-1.5">
                                                <input
                                                  type="text"
                                                  value={editAttachmentName}
                                                  onChange={(e) => setEditAttachmentName(e.target.value)}
                                                  className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded-lg text-slate-100 text-xs focus:outline-none"
                                                  autoFocus
                                                />
                                                <div className="flex gap-1.5">
                                                  <button
                                                    type="button"
                                                    disabled={updateAttachmentMutation.isPending}
                                                    onClick={() =>
                                                      updateAttachmentMutation.mutate({
                                                        attachmentId: file.id,
                                                        fileName: editAttachmentName,
                                                      })
                                                    }
                                                    className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold cursor-pointer"
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setEditingAttachmentId(null)}
                                                    className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] cursor-pointer"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <>
                                                <h5
                                                  className="text-xs font-semibold text-slate-200 truncate group-hover:text-indigo-300 transition-colors"
                                                  title={file.fileName}
                                                >
                                                  {file.fileName}
                                                </h5>
                                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                  <span>{formatFileSize(file.fileSize)}</span>
                                                  <span>•</span>
                                                  <span>{file.uploadedBy?.firstName || file.uploadedBy?.email || 'User'}</span>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
                                          <div className="flex items-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setPreviewAttachment({
                                                  fileName: file.fileName,
                                                  fileUrl: file.fileUrl,
                                                  fileSize: file.fileSize,
                                                  uploadedBy: file.uploadedBy,
                                                  createdAt: file.createdAt,
                                                })
                                              }
                                              className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                                              title="Preview attachment"
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                            </button>
                                            <a
                                              href={file.fileUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              download={file.fileName}
                                              className="p-1.5 text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                              title="Download file"
                                            >
                                              <Download className="w-3.5 h-3.5" />
                                            </a>
                                            {!isArchived && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingAttachmentId(file.id);
                                                  setEditAttachmentName(file.fileName);
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                                                title="Rename attachment"
                                              >
                                                <Edit2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>

                                          {!isArchived && (
                                            <button
                                              type="button"
                                              disabled={deleteAttachmentMutation.isPending}
                                              onClick={() => deleteAttachmentMutation.mutate(file.id)}
                                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                              title="Delete attachment"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {allDirect.map((file: any) => {
                                    const badge = getFileBadge(undefined, file.fileName);
                                    const isEditing = editingAttachmentId === file.id;

                                    return (
                                      <div
                                        key={file.id}
                                        className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-850 hover:border-slate-800 rounded-xl transition-colors"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className={`p-2 rounded-lg border shrink-0 ${badge.bg}`}>
                                            {badge.icon}
                                          </div>
                                          <div className="min-w-0">
                                            {isEditing ? (
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="text"
                                                  value={editAttachmentName}
                                                  onChange={(e) => setEditAttachmentName(e.target.value)}
                                                  className="px-2 py-1 bg-slate-950 border border-indigo-500 rounded-lg text-slate-100 text-xs focus:outline-none"
                                                  autoFocus
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    updateAttachmentMutation.mutate({
                                                      attachmentId: file.id,
                                                      fileName: editAttachmentName,
                                                    })
                                                  }
                                                  className="px-2 py-1 bg-indigo-600 text-white rounded text-xs font-bold"
                                                >
                                                  Save
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setEditingAttachmentId(null)}
                                                  className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-xs"
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            ) : (
                                              <>
                                                <div className="text-xs font-semibold text-slate-200 truncate" title={file.fileName}>
                                                  {file.fileName}
                                                </div>
                                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                  <span>{formatFileSize(file.fileSize)}</span>
                                                  <span>•</span>
                                                  <span>by {file.uploadedBy?.firstName || file.uploadedBy?.email || 'User'}</span>
                                                  <span>•</span>
                                                  <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPreviewAttachment({
                                                fileName: file.fileName,
                                                fileUrl: file.fileUrl,
                                                fileSize: file.fileSize,
                                                uploadedBy: file.uploadedBy,
                                                createdAt: file.createdAt,
                                              })
                                            }
                                            className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/30 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                          >
                                            <Eye className="w-3.5 h-3.5" /> Preview
                                          </button>
                                          <a
                                            href={file.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download={file.fileName}
                                            className="px-2.5 py-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/10 rounded-lg flex items-center gap-1 transition-colors"
                                          >
                                            <Download className="w-3.5 h-3.5" /> Get
                                          </a>
                                          {!isArchived && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingAttachmentId(file.id);
                                                setEditAttachmentName(file.fileName);
                                              }}
                                              className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          {!isArchived && (
                                            <button
                                              type="button"
                                              disabled={deleteAttachmentMutation.isPending}
                                              onClick={() => deleteAttachmentMutation.mutate(file.id)}
                                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Linked Project Documents Section */}
                          {allLinkedDocs.length > 0 && (
                            <div className="space-y-2.5 pt-2 border-t border-slate-900">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <span className="flex items-center gap-1.5">
                                  <Folder className="w-3.5 h-3.5 text-indigo-400" />
                                  Linked Project Documents ({allLinkedDocs.length})
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {allLinkedDocs.map((doc: any) => {
                                  const badge = getFileBadge(doc.mimeType, doc.name);

                                  return (
                                    <div
                                      key={doc.id}
                                      className="p-3.5 bg-slate-900/40 border border-slate-850 hover:border-slate-750 rounded-2xl space-y-3 transition-all group flex flex-col justify-between"
                                    >
                                      <div className="flex items-start gap-3 min-w-0">
                                        <div className={`p-2.5 rounded-xl border shrink-0 ${badge.bg}`}>
                                          {badge.icon}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5">
                                            <h5
                                              className="text-xs font-semibold text-slate-200 truncate group-hover:text-indigo-300 transition-colors"
                                              title={doc.name}
                                            >
                                              {doc.name}
                                            </h5>
                                            <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded shrink-0">
                                              v{doc.version || '1.0'}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                            <span>{formatFileSize(doc.fileSize)}</span>
                                            <span>•</span>
                                            <span>{doc.folder?.name ? `📁 ${doc.folder.name}` : 'Root'}</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPreviewAttachment({
                                                fileName: doc.name,
                                                fileUrl: doc.fileUrl,
                                                fileSize: doc.fileSize,
                                                mimeType: doc.mimeType,
                                                uploadedBy: doc.uploadedBy,
                                                createdAt: doc.createdAt,
                                                version: doc.version,
                                                isDoc: true,
                                              })
                                            }
                                            className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                                            title="Preview document"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </button>
                                          <a
                                            href={doc.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download={doc.name}
                                            className="p-1.5 text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                            title="Download document"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </a>
                                        </div>

                                        {!isArchived && (
                                          <button
                                            type="button"
                                            disabled={unlinkDocumentMutation.isPending}
                                            onClick={() => unlinkDocumentMutation.mutate(doc.id)}
                                            className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
                                            title="Unlink from task (preserves document)"
                                          >
                                            <Unlink className="w-3.5 h-3.5" />
                                            <span>Unlink</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TAB 3: RECURRENCE */}
                {activeTab === 'recurrence' && (
                  <div className="space-y-6">
                    {recurError && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                        <span>{recurError}</span>
                      </div>
                    )}

                    {recurSuccess && (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>{recurSuccess}</span>
                      </div>
                    )}

                    {taskRecurrence ? (
                      <div className="space-y-6">
                        {/* Series Overview Card */}
                        <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-3 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl">
                                <Repeat className="w-6 h-6" />
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                  <span>Recurring Series Settings</span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      taskRecurrence.status === 'ACTIVE'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : taskRecurrence.status === 'PAUSED'
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                    }`}
                                  >
                                    {taskRecurrence.status}
                                  </span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Repeats {taskRecurrence.frequency.toLowerCase()} (every {taskRecurrence.interval}{' '}
                                  {taskRecurrence.frequency === 'DAILY' && (taskRecurrence.interval > 1 ? 'days' : 'day')}
                                  {taskRecurrence.frequency === 'WEEKLY' && (taskRecurrence.interval > 1 ? 'weeks' : 'week')}
                                  {taskRecurrence.frequency === 'MONTHLY' && (taskRecurrence.interval > 1 ? 'months' : 'month')}
                                  {taskRecurrence.frequency === 'YEARLY' && (taskRecurrence.interval > 1 ? 'years' : 'year')})
                                  {taskRecurrence.daysOfWeek && ` on ${taskRecurrence.daysOfWeek.split(',').map((d: string) => ({'1':'Mon','2':'Tue','3':'Wed','4':'Thu','5':'Fri','6':'Sat','7':'Sun'}[d] || d)).join(', ')}`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {taskRecurrence.status === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  onClick={() => pauseRecurrenceMutation.mutate(taskRecurrence.id)}
                                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                                >
                                  Pause
                                </button>
                              ) : taskRecurrence.status === 'PAUSED' ? (
                                <button
                                  type="button"
                                  onClick={() => resumeRecurrenceMutation.mutate(taskRecurrence.id)}
                                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                                >
                                  Resume
                                </button>
                              ) : null}

                              {taskRecurrence.status !== 'STOPPED' && (
                                <button
                                  type="button"
                                  onClick={() => stopRecurrenceMutation.mutate(taskRecurrence.id)}
                                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                                >
                                  Stop
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setIsConfiguringRecurrence(!isConfiguringRecurrence)}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                              >
                                {isConfiguringRecurrence ? 'Cancel Edit' : 'Edit Rules'}
                              </button>
                            </div>
                          </div>

                          {/* Quick Stats Grid */}
                          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/80">
                            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                              <span className="block text-[10px] uppercase font-bold text-slate-400">Total Occurrences</span>
                              <span className="text-sm font-bold text-slate-100 mt-0.5 block font-mono">
                                {taskRecurrence.occurrencesCount} {taskRecurrence.maxOccurrences ? `/ ${taskRecurrence.maxOccurrences}` : ''}
                              </span>
                            </div>

                            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                              <span className="block text-[10px] uppercase font-bold text-slate-400">Next Scheduled Date</span>
                              <span className="text-sm font-bold text-indigo-400 mt-0.5 block">
                                {taskRecurrence.nextRunDate ? formatDate(taskRecurrence.nextRunDate) : 'None (Completed)'}
                              </span>
                            </div>

                            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                              <span className="block text-[10px] uppercase font-bold text-slate-400">Non-Working Day Action</span>
                              <span className="text-xs font-semibold text-slate-300 mt-0.5 block">
                                {taskRecurrence.nonWorkingDayAction.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Edit Recurrence Form (When expanded) */}
                        {isConfiguringRecurrence && (
                          <div className="p-5 bg-slate-900/60 border border-indigo-900/40 rounded-2xl space-y-4 animate-in fade-in duration-200">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                              Update Series Configuration
                            </h4>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Frequency</label>
                                <select
                                  value={recurFrequency}
                                  onChange={(e) => setRecurFrequency(e.target.value as any)}
                                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="DAILY">Daily</option>
                                  <option value="WEEKLY">Weekly</option>
                                  <option value="MONTHLY">Monthly</option>
                                  <option value="YEARLY">Yearly</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Repeat Interval</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={recurInterval}
                                  onChange={(e) => setRecurInterval(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>

                            {recurFrequency === 'WEEKLY' && (
                              <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Days of Week</label>
                                <div className="flex items-center gap-1.5">
                                  {[
                                    { day: 1, label: 'M' },
                                    { day: 2, label: 'T' },
                                    { day: 3, label: 'W' },
                                    { day: 4, label: 'T' },
                                    { day: 5, label: 'F' },
                                    { day: 6, label: 'S' },
                                    { day: 7, label: 'S' },
                                  ].map((item) => {
                                    const isSel = recurDaysOfWeek.includes(item.day);
                                    return (
                                      <button
                                        key={item.day}
                                        type="button"
                                        onClick={() => {
                                          if (isSel) {
                                            if (recurDaysOfWeek.length > 1) {
                                              setRecurDaysOfWeek(recurDaysOfWeek.filter((d) => d !== item.day));
                                            }
                                          } else {
                                            setRecurDaysOfWeek([...recurDaysOfWeek, item.day].sort());
                                          }
                                        }}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                                          isSel ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'
                                        }`}
                                      >
                                        {item.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setIsConfiguringRecurrence(false)}
                                className="px-3.5 py-2 bg-slate-950 border border-slate-850 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={updateRecurrenceMutation.isPending}
                                onClick={() =>
                                  updateRecurrenceMutation.mutate({
                                    id: taskRecurrence.id,
                                    payload: {
                                      frequency: recurFrequency,
                                      interval: recurInterval,
                                      daysOfWeek: recurFrequency === 'WEEKLY' ? recurDaysOfWeek.join(',') : undefined,
                                      dayOfMonth: recurFrequency === 'MONTHLY' ? recurDayOfMonth : undefined,
                                      nonWorkingDayAction: recurNonWorkingDay,
                                      endType: recurEndType,
                                      endDate: recurEndType === 'ON_DATE' && recurEndDate ? new Date(recurEndDate).toISOString() : undefined,
                                      maxOccurrences: recurEndType === 'AFTER_OCCURRENCES' ? recurMaxOccurrences : undefined,
                                    },
                                  })
                                }
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                              >
                                {updateRecurrenceMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Save Series Rules
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Occurrences History Table */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-indigo-400" />
                            Generated Occurrences in Series ({taskRecurrence.tasks?.length || 0})
                          </h4>

                          <div className="overflow-x-auto rounded-xl border border-slate-850">
                            <table className="w-full text-left text-xs text-slate-300">
                              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-850 text-[10px]">
                                <tr>
                                  <th className="px-4 py-3">#</th>
                                  <th className="px-4 py-3">Task</th>
                                  <th className="px-4 py-3">Status</th>
                                  <th className="px-4 py-3">Start Date</th>
                                  <th className="px-4 py-3">Due Date</th>
                                  <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850/60 bg-slate-900/20">
                                {taskRecurrence.tasks?.map((occ: any) => (
                                  <tr
                                    key={occ.id}
                                    className={`hover:bg-slate-850/40 transition-colors ${
                                      occ.id === taskId ? 'bg-indigo-950/20' : ''
                                    }`}
                                  >
                                    <td className="px-4 py-3 font-mono text-slate-400">
                                      #{occ.recurrenceIndex || 1}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-slate-100">
                                      #{occ.taskNumber} - {occ.title}
                                      {occ.id === taskId && (
                                        <span className="ml-2 px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded text-[10px]">
                                          Current
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          occ.status === 'DONE'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : occ.status === 'IN_PROGRESS'
                                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            : 'bg-slate-800 text-slate-400'
                                        }`}
                                      >
                                        {occ.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 font-mono">
                                      {occ.startDate ? formatDate(occ.startDate) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 font-mono">
                                      {occ.dueDate ? formatDate(occ.dueDate) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {occ.id !== taskId && onSelectTask && (
                                        <button
                                          type="button"
                                          onClick={() => onSelectTask(occ.id)}
                                          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                                        >
                                          View Task
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Danger zone: delete series */}
                        <div className="pt-4 border-t border-slate-850 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this recurring series? Past generated tasks will be preserved.')) {
                                deleteRecurrenceMutation.mutate(taskRecurrence.id);
                              }
                            }}
                            className="px-3.5 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-900/30 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Recurring Series
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* No recurrence configured: prompt to enable */
                      <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-5 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                          <Repeat className="w-6 h-6" />
                        </div>
                        <div className="max-w-md mx-auto space-y-1">
                          <h3 className="text-sm font-bold text-slate-100">Set Up Recurring Task</h3>
                          <p className="text-xs text-slate-400">
                            Configure an automated recurrence schedule for this task. Future instances will be generated automatically with preserved attributes and subtasks.
                          </p>
                        </div>

                        <div className="max-w-md mx-auto text-left p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase">Frequency</label>
                              <select
                                value={recurFrequency}
                                onChange={(e) => setRecurFrequency(e.target.value as any)}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                              >
                                <option value="DAILY">Daily</option>
                                <option value="WEEKLY">Weekly</option>
                                <option value="MONTHLY">Monthly</option>
                                <option value="YEARLY">Yearly</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase">Repeat Every</label>
                              <input
                                type="number"
                                min="1"
                                value={recurInterval}
                                onChange={(e) => setRecurInterval(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          {recurFrequency === 'WEEKLY' && (
                            <div className="space-y-1.5">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase">Repeat on Days</label>
                              <div className="flex items-center gap-1.5">
                                {[
                                  { day: 1, label: 'M' },
                                  { day: 2, label: 'T' },
                                  { day: 3, label: 'W' },
                                  { day: 4, label: 'T' },
                                  { day: 5, label: 'F' },
                                  { day: 6, label: 'S' },
                                  { day: 7, label: 'S' },
                                ].map((item) => {
                                  const isSel = recurDaysOfWeek.includes(item.day);
                                  return (
                                    <button
                                      key={item.day}
                                      type="button"
                                      onClick={() => {
                                        if (isSel) {
                                          if (recurDaysOfWeek.length > 1) {
                                            setRecurDaysOfWeek(recurDaysOfWeek.filter((d) => d !== item.day));
                                          }
                                        } else {
                                          setRecurDaysOfWeek([...recurDaysOfWeek, item.day].sort());
                                        }
                                      }}
                                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                                        isSel ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                                      }`}
                                    >
                                      {item.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={configureRecurrenceMutation.isPending}
                            onClick={() =>
                              configureRecurrenceMutation.mutate({
                                frequency: recurFrequency,
                                interval: recurInterval,
                                daysOfWeek: recurFrequency === 'WEEKLY' ? recurDaysOfWeek.join(',') : undefined,
                                dayOfMonth: recurFrequency === 'MONTHLY' ? recurDayOfMonth : undefined,
                                nonWorkingDayAction: recurNonWorkingDay,
                                startDate: task.startDate ? new Date(task.startDate).toISOString() : new Date().toISOString(),
                                endType: recurEndType,
                                endDate: recurEndType === 'ON_DATE' && recurEndDate ? new Date(recurEndDate).toISOString() : undefined,
                                maxOccurrences: recurEndType === 'AFTER_OCCURRENCES' ? recurMaxOccurrences : undefined,
                                cloneSubtasks: true,
                              })
                            }
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all"
                          >
                            {configureRecurrenceMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <Repeat className="w-4 h-4" />
                            Enable Recurrence Schedule
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: REMINDERS (Zoho Projects Spec) */}
                {activeTab === 'reminders' && (
                  <div className="space-y-6">
                    {/* Error & Success Feedback Alerts */}
                    {reminderError && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                          <span>{reminderError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReminderError(null)}
                          className="p-1 hover:bg-rose-500/20 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {reminderSuccess && (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>{reminderSuccess}</span>
                      </div>
                    )}

                    {/* No Due Date Warning */}
                    {!task.dueDate && reminderType !== 'CUSTOM_DATE' && (
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs flex items-center gap-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>
                          This task has no <strong>Due Date</strong> set. Due-date-relative reminders require a due date to calculate delivery timing. You can pick a <strong>Specific Date & Time</strong> or set a due date in the right inspector rail.
                        </span>
                      </div>
                    )}

                    {/* Reminder Configuration Builder Card */}
                    {!isArchived && (
                      <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
                              <CalendarClock className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-100">Schedule Task Reminder</h3>
                              <p className="text-[11px] text-slate-400">
                                Automated multi-channel notification before, on, or after the task due date.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Quick Preset Chips */}
                        <div className="space-y-1.5 pt-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Quick Presets
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setReminderType('BEFORE_DUE');
                                setReminderValue(15);
                                setReminderUnit('MINUTES');
                              }}
                              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 rounded-lg text-[11px] text-slate-300 transition-colors cursor-pointer"
                            >
                              ⚡ 15 mins before due
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReminderType('BEFORE_DUE');
                                setReminderValue(1);
                                setReminderUnit('HOURS');
                              }}
                              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 rounded-lg text-[11px] text-slate-300 transition-colors cursor-pointer"
                            >
                              ⏰ 1 hour before due
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReminderType('BEFORE_DUE');
                                setReminderValue(1);
                                setReminderUnit('DAYS');
                                setReminderTimeOfDay('09:00');
                              }}
                              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 rounded-lg text-[11px] text-slate-300 transition-colors cursor-pointer"
                            >
                              📅 1 day before due (9:00 AM)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReminderType('ON_DUE');
                                setReminderTimeOfDay('09:00');
                              }}
                              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 rounded-lg text-[11px] text-slate-300 transition-colors cursor-pointer"
                            >
                              🎯 On due date (9:00 AM)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReminderType('AFTER_DUE');
                                setReminderValue(1);
                                setReminderUnit('DAYS');
                                setReminderRepeatOverdue(true);
                              }}
                              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-rose-500/40 rounded-lg text-[11px] text-slate-300 transition-colors cursor-pointer"
                            >
                              🚨 1 day overdue (Daily repeat)
                            </button>
                          </div>
                        </div>

                        {/* Config Form Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                          {/* Reminder Trigger Type */}
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Reminder Trigger *
                            </label>
                            <select
                              value={reminderType}
                              onChange={(e) => setReminderType(e.target.value as any)}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="BEFORE_DUE">Before Due Date</option>
                              <option value="ON_DUE">On Due Date</option>
                              <option value="AFTER_DUE">After Due Date (Overdue Alert)</option>
                              <option value="CUSTOM_DATE">Specific Date & Time</option>
                            </select>
                          </div>

                          {/* Relative Timing Parameters */}
                          {(reminderType === 'BEFORE_DUE' || reminderType === 'AFTER_DUE') && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Offset Amount
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={reminderValue}
                                  onChange={(e) => setReminderValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Unit
                                </label>
                                <select
                                  value={reminderUnit}
                                  onChange={(e) => setReminderUnit(e.target.value as any)}
                                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                                >
                                  <option value="MINUTES">Minutes</option>
                                  <option value="HOURS">Hours</option>
                                  <option value="DAYS">Days</option>
                                </select>
                              </div>
                            </div>
                          )}

                          {/* Time of Day Picker for Days or ON_DUE */}
                          {(reminderType === 'ON_DUE' || ((reminderType === 'BEFORE_DUE' || reminderType === 'AFTER_DUE') && reminderUnit === 'DAYS')) && (
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Time of Day (24-Hour)
                              </label>
                              <input
                                type="time"
                                value={reminderTimeOfDay}
                                onChange={(e) => setReminderTimeOfDay(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                              />
                            </div>
                          )}

                          {/* Specific Custom Date & Time Picker */}
                          {reminderType === 'CUSTOM_DATE' && (
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Alert Date & Time *
                              </label>
                              <input
                                type="datetime-local"
                                value={reminderCustomDateTime}
                                onChange={(e) => setReminderCustomDateTime(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                              />
                            </div>
                          )}

                          {/* Recipient Routing */}
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Notify Recipient *
                            </label>
                            <select
                              value={reminderRecipientType}
                              onChange={(e) => setReminderRecipientType(e.target.value as any)}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="ASSIGNEE">Task Assignee</option>
                              <option value="REPORTER">Task Creator / Reporter</option>
                              <option value="WATCHERS">All Watchers</option>
                              <option value="ALL_STAKEHOLDERS">All Stakeholders (Assignee + Reporter + Watchers)</option>
                              <option value="CUSTOM_USER">Specific Team Member...</option>
                            </select>
                          </div>

                          {/* Custom User Picker */}
                          {reminderRecipientType === 'CUSTOM_USER' && (
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Select Team Member *
                              </label>
                              <select
                                value={reminderCustomUserId}
                                onChange={(e) => setReminderCustomUserId(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                              >
                                <option value="">-- Choose member --</option>
                                {task.project?.members?.map((m: any) => (
                                  <option key={m.user.id} value={m.user.id}>
                                    {m.user.firstName ? `${m.user.firstName} ${m.user.lastName || ''}` : m.user.email} ({m.role})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Overdue Daily Repeat Option */}
                        {reminderType === 'AFTER_DUE' && (
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                            <input
                              type="checkbox"
                              id="reminder-repeat-overdue"
                              checked={reminderRepeatOverdue}
                              onChange={(e) => setReminderRepeatOverdue(e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-0 cursor-pointer"
                            />
                            <label htmlFor="reminder-repeat-overdue" className="text-xs text-slate-300 cursor-pointer select-none">
                              Repeat reminder daily (+24h) until the task is completed (Zoho Overdue Escalation)
                            </label>
                          </div>
                        )}

                        {/* Add Reminder Action */}
                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            disabled={
                              createReminderMutation.isPending ||
                              (reminderType === 'CUSTOM_DATE' && !reminderCustomDateTime) ||
                              (reminderRecipientType === 'CUSTOM_USER' && !reminderCustomUserId) ||
                              (reminderType !== 'CUSTOM_DATE' && !task.dueDate)
                            }
                            onClick={() => {
                              createReminderMutation.mutate({
                                type: reminderType,
                                value: reminderType === 'BEFORE_DUE' || reminderType === 'AFTER_DUE' ? Number(reminderValue) : undefined,
                                unit: reminderType === 'BEFORE_DUE' || reminderType === 'AFTER_DUE' ? reminderUnit : undefined,
                                timeOfDay: reminderTimeOfDay,
                                customDateTime: reminderType === 'CUSTOM_DATE' && reminderCustomDateTime ? new Date(reminderCustomDateTime).toISOString() : undefined,
                                recipientType: reminderRecipientType,
                                customUserId: reminderRecipientType === 'CUSTOM_USER' ? reminderCustomUserId : undefined,
                                repeatOverdue: reminderType === 'AFTER_DUE' ? reminderRepeatOverdue : false,
                              });
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {createReminderMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <Plus className="w-4 h-4" />
                            <span>Add Reminder</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Active & Historical Reminders List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <Bell className="w-4 h-4 text-indigo-400" />
                          <span>Configured Reminders ({taskReminders.length})</span>
                        </h4>
                      </div>

                      {isLoadingReminders ? (
                        <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                          Loading task reminders...
                        </div>
                      ) : taskReminders.length > 0 ? (
                        <div className="divide-y divide-slate-850/60 bg-slate-950/40 border border-slate-850 rounded-2xl overflow-hidden">
                          {taskReminders.map((rem: any) => {
                            let typeLabel = 'Reminder';
                            if (rem.type === 'BEFORE_DUE') {
                              typeLabel = `${rem.value || 1} ${rem.unit?.toLowerCase() || 'days'} before due date${rem.unit === 'DAYS' ? ` (${rem.timeOfDay || '09:00'})` : ''}`;
                            } else if (rem.type === 'ON_DUE') {
                              typeLabel = `On due date at ${rem.timeOfDay || '09:00'}`;
                            } else if (rem.type === 'AFTER_DUE') {
                              typeLabel = `${rem.value || 1} ${rem.unit?.toLowerCase() || 'days'} overdue${rem.repeatOverdue ? ' • repeats daily' : ''}`;
                            } else if (rem.type === 'CUSTOM_DATE') {
                              typeLabel = 'Specific date & time alert';
                            }

                            let recipientLabel = 'Assignee';
                            if (rem.recipientType === 'ASSIGNEE') {
                              recipientLabel = `Assignee: ${task.assignee?.firstName || 'Assigned User'}`;
                            } else if (rem.recipientType === 'REPORTER') {
                              recipientLabel = `Reporter: ${task.reporter?.firstName || 'Reporter'}`;
                            } else if (rem.recipientType === 'WATCHERS') {
                              recipientLabel = `All Watchers (${task.watchers?.length || 0})`;
                            } else if (rem.recipientType === 'ALL_STAKEHOLDERS') {
                              recipientLabel = 'All Stakeholders';
                            } else if (rem.recipientType === 'CUSTOM_USER') {
                              recipientLabel = `Member: ${rem.customUser?.firstName ? `${rem.customUser.firstName} ${rem.customUser.lastName || ''}` : rem.customUser?.email || 'Custom User'}`;
                            }

                            const isPending = rem.status === 'PENDING';
                            const isSent = rem.status === 'SENT';
                            const isDismissed = rem.status === 'DISMISSED';

                            return (
                              <div
                                key={rem.id}
                                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-900/30 transition-colors"
                              >
                                <div className="flex items-start sm:items-center gap-3 min-w-0">
                                  <div className={`p-2 rounded-xl border shrink-0 ${
                                    rem.type === 'AFTER_DUE'
                                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                      : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                                  }`}>
                                    <Bell className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                                      <span>{typeLabel}</span>
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                          isPending
                                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                            : isSent
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : isDismissed
                                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                        }`}
                                      >
                                        {rem.status}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
                                      <span className="font-mono text-slate-300">
                                        Trigger: {rem.remindAt ? new Date(rem.remindAt).toLocaleString() : 'Pending due date'}
                                      </span>
                                      <span>•</span>
                                      <span className="text-slate-400">{recipientLabel}</span>
                                    </div>
                                  </div>
                                </div>

                                {!isArchived && (
                                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                    <button
                                      type="button"
                                      disabled={deleteReminderMutation.isPending}
                                      onClick={() => {
                                        if (confirm('Delete this reminder?')) {
                                          deleteReminderMutation.mutate(rem.id);
                                        }
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-850 transition-colors cursor-pointer disabled:opacity-50"
                                      title="Delete reminder"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-8 text-center bg-slate-950/20 border border-slate-850 rounded-2xl space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-500 mx-auto">
                            <Bell className="w-5 h-5" />
                          </div>
                          <p className="text-xs font-semibold text-slate-300">No Reminders Configured</p>
                          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                            Configure automated alerts before or on the due date to ensure timely completion.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 5: STATUS & HISTORY */}
                {activeTab === 'history' && (
                  <div className="space-y-6">
                    {/* Status Stepper Progression */}
                    <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl space-y-3">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Status Lifecycle Pipeline
                      </span>

                      <div className="grid grid-cols-4 gap-2">
                        {['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'].map((st) => {
                          const isActive = task.status === st;
                          const isDonePast = 
                            (st === 'TODO') ||
                            (st === 'IN_PROGRESS' && (task.status === 'IN_PROGRESS' || task.status === 'REVIEW' || task.status === 'DONE')) ||
                            (st === 'REVIEW' && (task.status === 'REVIEW' || task.status === 'DONE')) ||
                            (st === 'DONE' && task.status === 'DONE');

                          return (
                            <button
                              key={st}
                              disabled={isArchived}
                              onClick={() => updateStatusMutation.mutate(st)}
                              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-md'
                                  : isDonePast
                                  ? 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                                  : 'bg-slate-950 text-slate-500 border-slate-850 opacity-60'
                              }`}
                            >
                              <div className="text-[10px] font-bold uppercase">{st.replace('_', ' ')}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Task Activity Audit Trail */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-indigo-400" />
                        Audit Stream Timeline ({task.activities?.length || 0})
                      </h4>

                      <ul className="relative border-l border-slate-800 ml-3 pl-5 space-y-4 text-xs">
                        {task.activities && task.activities.length > 0 ? (
                          task.activities.map((act: any) => {
                            const activityUser = act.user?.firstName
                              ? `${act.user.firstName} ${act.user.lastName || ''}`
                              : act.user?.email || 'System';

                            let descriptionText = act.action;
                            if (act.action === 'TASK_CREATED') {
                              descriptionText = 'created this task';
                            } else if (act.action === 'STATUS_CHANGED') {
                              descriptionText = `changed status from ${act.oldValue} to ${act.newValue}`;
                            } else if (act.action === 'PROGRESS_CHANGED') {
                              descriptionText = `updated progress completion to ${act.newValue} (was ${act.oldValue})`;
                            } else if (act.action === 'PRIORITY_CHANGED') {
                              descriptionText = `changed priority from ${act.oldValue} to ${act.newValue}`;
                            } else if (act.action === 'BILLING_TYPE_CHANGED') {
                              descriptionText = `changed billing type from ${act.oldValue} to ${act.newValue}`;
                            } else if (act.action === 'TAGS_CHANGED') {
                              descriptionText = `updated task tags`;
                            } else if (act.action === 'CUSTOM_FIELDS_CHANGED') {
                              descriptionText = `modified custom fields`;
                            } else if (act.action === 'TITLE_CHANGED') {
                              descriptionText = `changed title to "${act.newValue}"`;
                            } else if (act.action === 'DESCRIPTION_CHANGED') {
                              descriptionText = `updated description`;
                            } else if (act.action === 'START_DATE_CHANGED') {
                              descriptionText = `changed start date to ${act.newValue}`;
                            } else if (act.action === 'DUE_DATE_CHANGED') {
                              descriptionText = `changed due date to ${act.newValue}`;
                            } else if (act.action === 'ESTIMATION_CHANGED') {
                              descriptionText = `set estimated effort to ${act.newValue}`;
                            } else if (act.action === 'ASSIGNEE_CHANGED') {
                              if (!act.newValue || act.newValue === 'Unassigned') {
                                descriptionText = `unassigned this task (was ${act.oldValue || 'assigned'})`;
                              } else if (!act.oldValue || act.oldValue === 'Unassigned') {
                                descriptionText = `assigned task to ${act.newValue}`;
                              } else {
                                descriptionText = `reassigned task from ${act.oldValue} to ${act.newValue}`;
                              }
                            } else if (act.action === 'TASK_LIST_CHANGED') {
                              descriptionText = `moved task to another task list`;
                            } else if (act.action === 'TASK_LINKED_TO_MILESTONE') {
                              descriptionText = `associated task with milestone`;
                            } else if (act.action === 'TASK_UNLINKED_FROM_MILESTONE') {
                              descriptionText = `dissociated task from milestone`;
                            } else if (act.action === 'COMMENT_ADDED') {
                              descriptionText = `added a comment`;
                            } else if (act.action === 'ATTACHMENT_UPLOADED') {
                              descriptionText = `uploaded attachment: ${act.newValue}`;
                            } else if (act.action === 'TASK_ARCHIVED') {
                              descriptionText = `archived this task`;
                            } else if (act.action === 'TASK_DELETED') {
                              descriptionText = `deleted this task`;
                            } else if (act.action === 'TASK_UPDATED') {
                              descriptionText = `updated task properties`;
                            }

                            return (
                              <li key={act.id} className="relative group">
                                <div className="absolute -left-[27px] top-[3px] bg-slate-950 border border-slate-700 text-indigo-400 w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                </div>

                                <div className="flex justify-between gap-4">
                                  <div>
                                    <span className="font-bold text-slate-300">{activityUser}</span>{' '}
                                    <span className="text-slate-400">{descriptionText}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                                    {formatDate(act.createdAt)}
                                  </span>
                                </div>
                              </li>
                            );
                          })
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">No activity recorded yet.</p>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

              </div>

              {/* Right Properties Rail Inspector (4 Cols) */}
              <div className="lg:col-span-4 space-y-4 bg-slate-900/30 border border-slate-855 rounded-2xl p-4 md:p-5 h-fit">
                
                {/* Status Selection */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Task Status
                  </label>
                  
                  {statusError && (
                    <div className="bg-rose-950/30 border border-rose-900 text-rose-400 text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{statusError}</span>
                    </div>
                  )}

                  <select
                    disabled={isArchived}
                    value={task.status}
                    onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer ${getStatusColor(
                      task.status
                    )}`}
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </div>

                {/* Progress % Completion Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Completion %
                    </label>
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {task.progress ?? 0}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    disabled={isArchived}
                    value={task.progress ?? 0}
                    onChange={(e) => updateTaskMutation.mutate({ progress: parseInt(e.target.value) })}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Priority Selection */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Priority
                  </label>
                  <select
                    disabled={isArchived}
                    value={task.priority}
                    onChange={(e) => updateTaskMutation.mutate({ priority: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer ${getPriorityColor(
                      task.priority
                    )}`}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                {/* Type Selection */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Task Type
                  </label>
                  <select
                    disabled={isArchived}
                    value={task.type}
                    onChange={(e) => updateTaskMutation.mutate({ type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                    <option value="STORY">Story</option>
                    <option value="IMPROVEMENT">Improvement</option>
                  </select>
                </div>

                {/* Assignee Selection */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Assignee
                  </label>
                  <select
                    disabled={isArchived}
                    value={task.assigneeId || ''}
                    onChange={(e) => updateTaskMutation.mutate({ assigneeId: e.target.value || null })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {task.project?.members?.map((m: any) => {
                      const isClient = m.role === 'CLIENT';
                      const isDisabled = isClient && !isExternal;
                      const userName = m.user.firstName ? `${m.user.firstName} ${m.user.lastName || ''}` : m.user.email;
                      return (
                        <option key={m.user.id} value={m.user.id} disabled={isDisabled}>
                          {userName} {isClient ? (isDisabled ? '(Client - External only)' : '(Client)') : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Billing Type Selection */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Billing Type
                  </label>
                  <select
                    disabled={isArchived}
                    value={task.billingType || 'BILLABLE'}
                    onChange={(e) => updateTaskMutation.mutate({ billingType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="BILLABLE">Billable</option>
                    <option value="NON_BILLABLE">Non-Billable</option>
                  </select>
                </div>

                {/* Start Date */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Start Date
                  </label>
                  <input
                    type="date"
                    disabled={isArchived}
                    value={task.startDate ? task.startDate.split('T')[0] : ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      updateTaskMutation.mutate({ startDate: val });
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Due Date
                    </label>
                    {task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE' && (
                      <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Overdue
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    disabled={isArchived}
                    value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      updateTaskMutation.mutate({ dueDate: val });
                    }}
                    className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark] ${
                      task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                        ? 'border-rose-500/40 text-rose-300'
                        : 'border-slate-800'
                    }`}
                  />
                </div>

                {/* Calculated Duration */}
                {task.startDate && task.dueDate && (
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">Calculated Duration:</span>
                    <span className="font-semibold text-indigo-400 font-mono text-[11px]">
                      {Math.max(
                        1,
                        Math.round(
                          (new Date(task.dueDate).getTime() - new Date(task.startDate).getTime()) /
                            (1000 * 60 * 60 * 24)
                        ) + 1
                      )}{' '}
                      days
                    </span>
                  </div>
                )}

                {/* Estimation Hours */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Estimation (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    disabled={isArchived}
                    value={task.estimatedHours ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseFloat(e.target.value) : null;
                      updateTaskMutation.mutate({ estimatedHours: val });
                    }}
                    placeholder="E.g. 4.5"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Task Hierarchy / Parent Relation */}
                {task.parentTask && (
                  <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                        <FolderTree className="w-3.5 h-3.5" />
                        Hierarchy
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/30">
                        Subtask
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-slate-300 font-medium truncate">
                        Subtask of:{' '}
                        <button
                          type="button"
                          onClick={() => onSelectTask && onSelectTask(task.parentTask.id)}
                          className="font-bold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                        >
                          {task.parentTask.title}
                        </button>
                      </div>

                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Convert "${task.title}" to a standalone task?`)) {
                              convertSubtaskMutation.mutate(task.id);
                            }
                          }}
                          disabled={convertSubtaskMutation.isPending}
                          className="w-full mt-2 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-indigo-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Convert to Standalone Task</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Milestone Selector */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Milestone / Phase
                  </label>
                  <select
                    disabled={isArchived}
                    value={task.milestoneId || ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      updateTaskMutation.mutate({ milestoneId: val });
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">None</option>
                    {milestones?.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Task List Selector */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Task List
                  </label>
                  <select
                    disabled={isArchived}
                    value={task.taskListId || ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      updateTaskMutation.mutate({ taskListId: val });
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">General / None</option>
                    {taskLists?.map((tl: any) => (
                      <option key={tl.id} value={tl.id}>
                        {tl.name} ({tl.flag})
                      </option>
                    ))}
                  </select>
                </div>

                {/* System Audit Metadata */}
                <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Reporter:</span>
                    <span className="font-semibold text-slate-400">
                      {task.reporter?.firstName
                        ? `${task.reporter.firstName} ${task.reporter.lastName || ''}`
                        : task.reporter?.email || 'System'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="font-semibold text-slate-400">{formatDate(task.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Modified:</span>
                    <span className="font-semibold text-slate-400">{formatDate(task.updatedAt)}</span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>

      {/* Add Dependency Modal */}
      {isAddDepModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {depDirection === 'PREDECESSOR' ? 'Add Predecessor Task' : 'Add Successor Task'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {depDirection === 'PREDECESSOR'
                      ? `Select a prerequisite task that #${task?.taskNumber} depends on`
                      : `Select a dependent task that relies on #${task?.taskNumber}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDepModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {depModalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{depModalError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Select Target Task *
                </label>
                <select
                  value={selectedTargetTaskId}
                  onChange={(e) => setSelectedTargetTaskId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- Select a project task --</option>
                  {projectTasks
                    .filter((t: any) => t.id !== taskId)
                    .map((t: any) => (
                      <option key={t.id} value={t.id}>
                        #{t.taskNumber} - {t.title} ({t.status})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Dependency Type
                </label>
                <select
                  value={selectedDepType}
                  onChange={(e) => setSelectedDepType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="FINISH_TO_START">Finish-to-Start (FS) - Successor starts after Predecessor finishes (Default)</option>
                  <option value="START_TO_START">Start-to-Start (SS) - Successor starts when Predecessor starts</option>
                  <option value="FINISH_TO_FINISH">Finish-to-Finish (FF) - Successor finishes when Predecessor finishes</option>
                  <option value="START_TO_FINISH">Start-to-Finish (SF) - Successor finishes when Predecessor starts</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Lag / Lead (Working Days)
                  </label>
                  <input
                    type="number"
                    value={selectedDepLag}
                    onChange={(e) => setSelectedDepLag(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500">+N: Delay, -N: Lead</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Link Mode
                  </label>
                  <select
                    value={selectedDepLinkType}
                    onChange={(e) => setSelectedDepLinkType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="HARD">Hard Link (Auto-Reschedule)</option>
                    <option value="SOFT">Soft Link (Manual Tracking)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setIsAddDepModalOpen(false)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedTargetTaskId || createDependencyMutation.isPending}
                onClick={() => {
                  createDependencyMutation.mutate({
                    predecessorId: depDirection === 'PREDECESSOR' ? selectedTargetTaskId : taskId,
                    successorId: depDirection === 'PREDECESSOR' ? taskId : selectedTargetTaskId,
                    type: selectedDepType,
                    lag: Number(selectedDepLag),
                    linkType: selectedDepLinkType,
                  });
                }}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {createDependencyMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Add Dependency</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dependency Modal */}
      {editingDep && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Edit Dependency Settings</h3>
                  <p className="text-xs text-slate-400">Modify CPM type, lag, and link mode</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDep(null)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Dependency Type
                </label>
                <select
                  value={editingDep.type}
                  onChange={(e) => setEditingDep({ ...editingDep, type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="FINISH_TO_START">Finish-to-Start (FS)</option>
                  <option value="START_TO_START">Start-to-Start (SS)</option>
                  <option value="FINISH_TO_FINISH">Finish-to-Finish (FF)</option>
                  <option value="START_TO_FINISH">Start-to-Finish (SF)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Lag / Lead (Days)
                  </label>
                  <input
                    type="number"
                    value={editingDep.lag}
                    onChange={(e) => setEditingDep({ ...editingDep, lag: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Link Mode
                  </label>
                  <select
                    value={editingDep.linkType}
                    onChange={(e) => setEditingDep({ ...editingDep, linkType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="HARD">Hard Link</option>
                    <option value="SOFT">Soft Link</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setEditingDep(null)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateDependencyMutation.isPending}
                onClick={() => {
                  updateDependencyMutation.mutate({
                    id: editingDep.id,
                    data: {
                      type: editingDep.type,
                      lag: Number(editingDep.lag),
                      linkType: editingDep.linkType,
                    },
                  });
                }}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {updateDependencyMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold">Delete Task?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete task{' '}
              <span className="font-bold text-indigo-400">
                [{task?.project?.projectCode}-{task?.taskNumber}] {task?.title}
              </span>
              ? All associated subtasks will also be deleted.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteTaskMutation.isPending}
                onClick={() => deleteTaskMutation.mutate()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleteTaskMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Task</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Attachment In-App Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl shrink-0">
                  {getFileBadge(previewAttachment.mimeType, previewAttachment.fileName).icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-100 truncate" title={previewAttachment.fileName}>
                    {previewAttachment.fileName}
                  </h3>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span>{formatFileSize(previewAttachment.fileSize)}</span>
                    {previewAttachment.version && (
                      <>
                        <span>•</span>
                        <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded font-bold">
                          v{previewAttachment.version}
                        </span>
                      </>
                    )}
                    {previewAttachment.uploadedBy && (
                      <>
                        <span>•</span>
                        <span>by {previewAttachment.uploadedBy.firstName || previewAttachment.uploadedBy.email}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewAttachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </a>
                <a
                  href={previewAttachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={previewAttachment.fileName}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Dynamic Format Visual Preview Frame */}
            <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center bg-slate-950/40 min-h-[300px]">
              {previewAttachment.mimeType?.includes('image') ||
              ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].some((ext) =>
                previewAttachment.fileName?.toLowerCase().endsWith(ext)
              ) ? (
                <img
                  src={previewAttachment.fileUrl}
                  alt={previewAttachment.fileName}
                  className="max-h-[500px] w-auto max-w-full object-contain rounded-xl border border-slate-800 shadow-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : previewAttachment.mimeType?.includes('pdf') ||
                previewAttachment.fileName?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewAttachment.fileUrl}
                  className="w-full h-[450px] border border-slate-800 rounded-xl"
                  title={previewAttachment.fileName}
                />
              ) : previewAttachment.mimeType?.includes('text') ||
                previewAttachment.mimeType?.includes('json') ||
                ['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'py', 'sh', 'sql'].some((ext) =>
                  previewAttachment.fileName?.toLowerCase().endsWith(ext)
                ) ? (
                <iframe
                  src={previewAttachment.fileUrl}
                  className="w-full h-[400px] border border-slate-800 rounded-xl bg-slate-950 p-3 font-mono text-xs text-slate-300"
                  title={previewAttachment.fileName}
                />
              ) : (
                <div className="p-8 text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
                    {getFileBadge(previewAttachment.mimeType, previewAttachment.fileName).icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">{previewAttachment.fileName}</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatFileSize(previewAttachment.fileSize)} • Direct in-browser preview not supported for this format.
                    </p>
                  </div>
                  <a
                    href={previewAttachment.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={previewAttachment.fileName}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
                  >
                    <Download className="w-4 h-4" /> Download File to View
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attach from Project Documents Modal */}
      {isAttachDocModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                  <Folder className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Attach from Project Documents</h3>
                  <p className="text-xs text-slate-400">Link existing project documents directly to this task</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAttachDocModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/30">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={attachDocSearch}
                  onChange={(e) => setAttachDocSearch(e.target.value)}
                  placeholder="Search project documents..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Document list body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[400px]">
              {isLoadingProjectDocs ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  Loading project documents...
                </div>
              ) : (() => {
                const filteredDocs = (projectDocuments || []).filter(
                  (d: any) =>
                    !attachDocSearch ||
                    d.name?.toLowerCase().includes(attachDocSearch.toLowerCase()) ||
                    d.tags?.toLowerCase().includes(attachDocSearch.toLowerCase()) ||
                    d.folder?.name?.toLowerCase().includes(attachDocSearch.toLowerCase())
                );

                if (filteredDocs.length === 0) {
                  return (
                    <div className="py-10 text-center text-xs text-slate-500 italic">
                      {attachDocSearch ? 'No project documents match your search.' : 'No project documents available in this project.'}
                    </div>
                  );
                }

                return filteredDocs.map((doc: any) => {
                  const badge = getFileBadge(doc.mimeType, doc.name);
                  const isAlreadyLinked = doc.taskId === taskId;

                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-850 hover:border-slate-800 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg border shrink-0 ${badge.bg}`}>
                          {badge.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-200 truncate" title={doc.name}>
                            {doc.name}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>{formatFileSize(doc.fileSize)}</span>
                            <span>•</span>
                            <span>v{doc.version || '1.0'}</span>
                            <span>•</span>
                            <span>{doc.folder?.name ? `📁 ${doc.folder.name}` : 'Root'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 ml-3">
                        {isAlreadyLinked ? (
                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-lg">
                            Already Linked
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={linkDocumentMutation.isPending}
                            onClick={() => linkDocumentMutation.mutate(doc.id)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Link to Task</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsAttachDocModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
