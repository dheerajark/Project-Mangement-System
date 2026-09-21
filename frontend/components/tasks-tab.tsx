'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useFormatDate } from '@/hooks/useFormatDate';
import {
  Plus,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  FolderTree,
  Table as TableIcon,
  Kanban,
  Lock,
  Globe,
  Flag,
  MoreVertical,
  CheckCircle2,
  Clock,
  User,
  Bug,
  BookOpen,
  Sparkles,
  CheckSquare,
  AlertTriangle,
  Loader2,
  FolderEdit,
  CornerDownRight,
  Check,
  Layers,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  BookmarkPlus,
  MessageSquare,
  Workflow,
  Link as LinkIcon,
  Repeat,
  SlidersHorizontal,
  X,
  Calendar,
  CheckCheck,
  ChevronsUpDown,
  ArrowUpDown,
  MoveRight,
  UserCheck,
} from 'lucide-react';
import KanbanBoard, { KanbanGroupBy } from '@/components/kanban-board';
import GanttChart from '@/components/gantt-chart';
import CreateTaskListModal from '@/components/create-task-list-modal';
import EditTaskListModal from '@/components/edit-task-list-modal';
import CompleteTaskListModal from '@/components/complete-task-list-modal';
import TaskListDiscussionDrawer from '@/components/task-list-discussion-drawer';
import { CustomFieldDefinition } from '@/components/dynamic-custom-fields';

interface TasksTabProps {
  project: any;
  tasks: any[];
  isLoadingTasks: boolean;
  milestones: any[];
  canCreateTask: boolean;
  canEditTask: boolean;
  onTaskClick: (taskId: string) => void;
  onOpenCreateTaskModal: (defaultTaskListId?: string, defaultMilestoneId?: string) => void;
  onOpenCreateMilestoneModal?: () => void;
}

type SortField =
  | 'taskNumber'
  | 'title'
  | 'status'
  | 'priority'
  | 'type'
  | 'assignee'
  | 'estimatedHours'
  | 'startDate'
  | 'dueDate'
  | 'progress';
type SortOrder = 'asc' | 'desc';

export default function TasksTab({
  project,
  tasks = [],
  isLoadingTasks,
  milestones = [],
  canCreateTask,
  canEditTask,
  onTaskClick,
  onOpenCreateTaskModal,
  onOpenCreateMilestoneModal,
}: TasksTabProps) {
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();
  const projectId = project?.id;

  // View state: 'classic' (Grouped by Task List) | 'plain' (Flat Table) | 'kanban' (Cards) | 'gantt' (CPM Timeline)
  const [viewMode, setViewMode] = useState<'classic' | 'plain' | 'kanban' | 'gantt'>('classic');

  // Kanban grouping mode: 'status' | 'taskList' | 'priority' | 'assignee'
  const [kanbanGroupBy, setKanbanGroupBy] = useState<KanbanGroupBy>('status');

  // Filters state
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL');
  const [filterTaskList, setFilterTaskList] = useState<string>('ALL');
  const [filterMilestone, setFilterMilestone] = useState<string>('ALL');
  const [filterDatePreset, setFilterDatePreset] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'my' | 'overdue' | 'high' | 'active' | 'completed'>('all');

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('taskNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Column Customization state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    key: true,
    title: true,
    taskList: true,
    milestone: true,
    status: true,
    priority: true,
    type: true,
    assignee: true,
    estimatedHours: true,
    schedule: true,
    progress: true,
  });
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  // Multi-Selection for Bulk Actions
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Accordion collapsed state for Classic View
  const [collapsedLists, setCollapsedLists] = useState<Record<string, boolean>>({});

  // Expanded subtasks state
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});

  // Modals & Drawers
  const [isCreateTaskListModalOpen, setIsCreateTaskListModalOpen] = useState(false);
  const [editingTaskList, setEditingTaskList] = useState<any | null>(null);
  const [completingTaskList, setCompletingTaskList] = useState<any | null>(null);
  const [activeMenuTaskListId, setActiveMenuTaskListId] = useState<string | null>(null);
  const [discussionTaskListId, setDiscussionTaskListId] = useState<string | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const searchParams = useSearchParams();
  useEffect(() => {
    const tListId = searchParams.get('taskListId');
    if (tListId) {
      setDiscussionTaskListId(tListId);
    }
  }, [searchParams]);

  // Fetch Task Lists Query
  const { data: taskLists = [], isLoading: isLoadingTaskLists } = useQuery({
    queryKey: ['task-lists', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/task-lists`);
      return res.data;
    },
    enabled: !!projectId,
  });

  // Fetch Project Custom Fields
  const { data: customFields = [] } = useQuery<CustomFieldDefinition[]>({
    queryKey: ['custom-fields', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await api.get(`/custom-fields?projectId=${projectId}`);
      return res.data;
    },
    enabled: !!projectId,
  });

  // Fetch Project Members Query
  const projectMembers = project?.members || [];

  // Mutation: Quick toggle task list status
  const toggleTaskListStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const res = await api.patch(`/task-lists/${id}`, { status: newStatus });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      setActiveMenuTaskListId(null);
    },
  });

  // Mutation: Reorder Task Lists
  const reorderTaskListsMutation = useMutation({
    mutationFn: async (listIds: string[]) => {
      const res = await api.patch(`/projects/${projectId}/task-lists/reorder`, { listIds });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      setActiveMenuTaskListId(null);
    },
  });

  const makeTaskListTemplateMutation = useMutation({
    mutationFn: async (taskListId: string) =>
      (await api.post(`/task-lists/${taskListId}/templates`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-list-templates'] });
      setActiveMenuTaskListId(null);
    },
  });

  const handleMoveTaskList = (index: number, direction: 'up' | 'down') => {
    const currentIds = taskLists.map((tl: any) => tl.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentIds.length) return;
    const temp = currentIds[index];
    currentIds[index] = currentIds[targetIndex];
    currentIds[targetIndex] = temp;
    reorderTaskListsMutation.mutate(currentIds);
  };

  // Mutation: Quick update task inline
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: any }) => {
      const res = await api.patch(`/tasks/${taskId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
    },
  });

  // Mutation: Reorder task in Kanban
  const reorderTaskMutation = useMutation({
    mutationFn: async (payload: {
      taskId: string;
      status?: string;
      taskListId?: string | null;
      priority?: string;
      assigneeId?: string | null;
      position: number;
    }) => {
      const res = await api.patch(`/tasks/${payload.taskId}/reorder`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
    },
  });

  // Mutation: Bulk task operations
  const bulkTaskActionMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/tasks/bulk', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      setSelectedTaskIds(new Set());
      setIsBulkDeleteModalOpen(false);
    },
  });

  const toggleListCollapse = (listId: string) => {
    setCollapsedLists((prev) => ({
      ...prev,
      [listId]: !prev[listId],
    }));
  };

  const toggleSubtaskExpand = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubtasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const toggleSelectTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleSelectAllInList = (listTaskIds: string[]) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      const allSelected = listTaskIds.every((id) => next.has(id));
      if (allSelected) {
        listTaskIds.forEach((id) => next.delete(id));
      } else {
        listTaskIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAllTasks = (allTaskIds: string[]) => {
    setSelectedTaskIds((prev) => {
      if (prev.size === allTaskIds.length) {
        return new Set();
      }
      return new Set(allTaskIds);
    });
  };

  // Toggle sorting field
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter tasks based on search, selectors, and quick pills
  const filteredTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));

    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    return tasks.filter((t: any) => {
      // 1. Dropdown Filters
      const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
      const matchPriority = filterPriority === 'ALL' || t.priority === filterPriority;
      const matchType = filterType === 'ALL' || t.type === filterType;
      const matchAssignee =
        filterAssignee === 'ALL' ||
        (filterAssignee === 'UNASSIGNED' ? !t.assigneeId : t.assigneeId === filterAssignee);
      const matchTaskList =
        filterTaskList === 'ALL' ||
        (filterTaskList === 'UNASSIGNED' ? !t.taskListId : t.taskListId === filterTaskList);
      const matchMilestone =
        filterMilestone === 'ALL' ||
        (filterMilestone === 'UNASSIGNED' ? !t.milestoneId : t.milestoneId === filterMilestone);

      // 2. Date Presets
      let matchDate = true;
      if (filterDatePreset === 'OVERDUE') {
        matchDate = !!t.dueDate && new Date(t.dueDate) < today && t.status !== 'DONE';
      } else if (filterDatePreset === 'DUE_TODAY') {
        if (!t.dueDate) matchDate = false;
        else {
          const d = new Date(t.dueDate);
          d.setHours(0, 0, 0, 0);
          matchDate = d.getTime() === today.getTime();
        }
      } else if (filterDatePreset === 'DUE_THIS_WEEK') {
        if (!t.dueDate) matchDate = false;
        else {
          const d = new Date(t.dueDate);
          matchDate = d >= today && d <= endOfWeek;
        }
      } else if (filterDatePreset === 'DUE_THIS_MONTH') {
        if (!t.dueDate) matchDate = false;
        else {
          const d = new Date(t.dueDate);
          matchDate = d >= today && d <= endOfMonth;
        }
      } else if (filterDatePreset === 'NO_DUE_DATE') {
        matchDate = !t.dueDate;
      }

      // 3. Quick Filter Pills
      let matchQuick = true;
      if (quickFilter === 'overdue') {
        matchQuick = !!t.dueDate && new Date(t.dueDate) < today && t.status !== 'DONE';
      } else if (quickFilter === 'high') {
        matchQuick = t.priority === 'HIGH' || t.priority === 'CRITICAL';
      } else if (quickFilter === 'active') {
        matchQuick = t.status !== 'DONE';
      } else if (quickFilter === 'completed') {
        matchQuick = t.status === 'DONE';
      }

      // 4. Instant Search
      const matchSearch =
        !searchQuery.trim() ||
        t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${project?.projectCode}-${t.taskNumber}`.toLowerCase().includes(searchQuery.toLowerCase());

      return (
        matchStatus &&
        matchPriority &&
        matchType &&
        matchAssignee &&
        matchTaskList &&
        matchMilestone &&
        matchDate &&
        matchQuick &&
        matchSearch
      );
    });
  }, [
    tasks,
    filterStatus,
    filterPriority,
    filterType,
    filterAssignee,
    filterTaskList,
    filterMilestone,
    filterDatePreset,
    quickFilter,
    searchQuery,
    project,
  ]);

  // Sort tasks
  const sortedFilteredTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'assignee') {
        valA = a.assignee?.firstName || a.assignee?.email || '';
        valB = b.assignee?.firstName || b.assignee?.email || '';
      } else if (sortField === 'dueDate' || sortField === 'startDate') {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTasks, sortField, sortOrder]);

  // Group root tasks by task list for Classic View
  const groupedTasks = useMemo(() => {
    const rootTasks = sortedFilteredTasks.filter((t: any) => !t.parentTaskId);

    const map: Record<string, any[]> = {};
    for (const tl of taskLists) {
      map[tl.id] = rootTasks.filter((t: any) => t.taskListId === tl.id);
    }
    map['unassigned'] = rootTasks.filter((t: any) => !t.taskListId);

    return map;
  }, [sortedFilteredTasks, taskLists]);

  const resetAllFilters = () => {
    setFilterStatus('ALL');
    setFilterPriority('ALL');
    setFilterType('ALL');
    setFilterAssignee('ALL');
    setFilterTaskList('ALL');
    setFilterMilestone('ALL');
    setFilterDatePreset('ALL');
    setSearchQuery('');
    setQuickFilter('all');
  };

  const isAnyFilterActive =
    filterStatus !== 'ALL' ||
    filterPriority !== 'ALL' ||
    filterType !== 'ALL' ||
    filterAssignee !== 'ALL' ||
    filterTaskList !== 'ALL' ||
    filterMilestone !== 'ALL' ||
    filterDatePreset !== 'ALL' ||
    searchQuery.trim() !== '' ||
    quickFilter !== 'all';

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
      default:
        return 'bg-slate-800 text-slate-400 border border-slate-700/50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
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

  const allFilteredTaskIds = useMemo(
    () => sortedFilteredTasks.map((t: any) => t.id),
    [sortedFilteredTasks],
  );

  return (
    <div className="space-y-6">
      {/* Top Filter & View Controls Toolbar */}
      <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 md:p-5 flex flex-col gap-4">
        {/* Row 1: View Switcher, Search, and Primary Actions */}
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* View Switcher: Classic | Plain | Kanban | Gantt */}
            <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setViewMode('classic')}
                title="Classic View (Grouped by Task List)"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'classic'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Classic</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('plain')}
                title="Plain View (Flat Table)"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'plain'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Plain</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                title="Kanban Board View"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Kanban</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('gantt')}
                title="Interactive Gantt Timeline & Dependency Flow"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'gantt'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>Gantt</span>
              </button>
            </div>

            {/* Instant Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Kanban Group By Switcher (only in Kanban view) */}
            {viewMode === 'kanban' && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">Group by:</span>
                <select
                  value={kanbanGroupBy}
                  onChange={(e) => setKanbanGroupBy(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="status">Status</option>
                  <option value="taskList">Task List</option>
                  <option value="priority">Priority</option>
                  <option value="assignee">Assignee</option>
                </select>
              </div>
            )}
          </div>

          {/* Right Action Buttons: Add Task List, Add Task, Columns Picker */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            {/* Column Picker Modal Toggle (for List Views) */}
            {(viewMode === 'classic' || viewMode === 'plain') && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Customize table columns"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Columns</span>
                </button>

                {isColumnPickerOpen && (
                  <div className="absolute right-0 top-10 w-52 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-3 z-40 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-850">
                      <span className="text-xs font-bold text-slate-200">Visible Columns</span>
                      <button
                        onClick={() => setIsColumnPickerOpen(false)}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                      {Object.keys(visibleColumns).map((colKey) => (
                        <label
                          key={colKey}
                          className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns[colKey]}
                            onChange={(e) =>
                              setVisibleColumns((prev) => ({
                                ...prev,
                                [colKey]: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="capitalize">{colKey.replace(/([A-Z])/g, ' $1')}</span>
                        </label>
                      ))}

                      {customFields.length > 0 && (
                        <div className="pt-2 border-t border-slate-850 space-y-1.5">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                            Custom Fields
                          </span>
                          {customFields.map((cf) => (
                            <label
                              key={cf.id}
                              className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={visibleColumns[cf.apiName] ?? cf.showInList}
                                onChange={(e) =>
                                  setVisibleColumns((prev) => ({
                                    ...prev,
                                    [cf.apiName]: e.target.checked,
                                  }))
                                }
                                className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="truncate">{cf.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {canCreateTask && (
              <>
                <button
                  type="button"
                  onClick={() => setIsCreateTaskListModalOpen(true)}
                  className="px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                >
                  <FolderPlus className="w-4 h-4 text-indigo-400" />
                  <span>Add Task List</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenCreateTaskModal()}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Task</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Shared Multi-Dimensional Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-850/80">
          {/* Status Filter */}
          <select
            value={filterStatus}
            disabled={viewMode === 'kanban' && kanbanGroupBy === 'status'}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer ${
              viewMode === 'kanban' && kanbanGroupBy === 'status' ? 'opacity-40 cursor-not-allowed' : ''
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
            disabled={viewMode === 'kanban' && kanbanGroupBy === 'priority'}
            onChange={(e) => setFilterPriority(e.target.value)}
            className={`px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer ${
              viewMode === 'kanban' && kanbanGroupBy === 'priority' ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="CRITICAL">Critical Priority</option>
          </select>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="TASK">Task</option>
            <option value="BUG">Bug</option>
            <option value="STORY">Story</option>
            <option value="IMPROVEMENT">Improvement</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={filterAssignee}
            disabled={viewMode === 'kanban' && kanbanGroupBy === 'assignee'}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className={`px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer ${
              viewMode === 'kanban' && kanbanGroupBy === 'assignee' ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <option value="ALL">All Assignees</option>
            <option value="UNASSIGNED">Unassigned</option>
            {projectMembers.map((m: any) => {
              const u = m.user || m;
              return (
                <option key={u.id} value={u.id}>
                  {u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.email}
                </option>
              );
            })}
          </select>

          {/* Task List Filter */}
          <select
            value={filterTaskList}
            disabled={viewMode === 'kanban' && kanbanGroupBy === 'taskList'}
            onChange={(e) => setFilterTaskList(e.target.value)}
            className={`px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer ${
              viewMode === 'kanban' && kanbanGroupBy === 'taskList' ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <option value="ALL">All Task Lists</option>
            <option value="UNASSIGNED">General / Unassigned</option>
            {taskLists.map((tl: any) => (
              <option key={tl.id} value={tl.id}>
                {tl.name}
              </option>
            ))}
          </select>

          {/* Milestone Filter */}
          <select
            value={filterMilestone}
            onChange={(e) => setFilterMilestone(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Milestones</option>
            <option value="UNASSIGNED">No Milestone</option>
            {milestones.map((ms: any) => (
              <option key={ms.id} value={ms.id}>
                {ms.title}
              </option>
            ))}
          </select>

          {/* Date Presets Filter */}
          <select
            value={filterDatePreset}
            onChange={(e) => setFilterDatePreset(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Dates</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DUE_TODAY">Due Today</option>
            <option value="DUE_THIS_WEEK">Due This Week</option>
            <option value="DUE_THIS_MONTH">Due This Month</option>
            <option value="NO_DUE_DATE">No Due Date</option>
          </select>

          {/* Clear Filters Button */}
          {isAnyFilterActive && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl flex items-center gap-1 transition-all cursor-pointer font-semibold"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Row 3: Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-850/60">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick Filters:</span>
          {[
            { key: 'all', label: `All Tasks (${tasks.length})` },
            {
              key: 'active',
              label: `Active (${tasks.filter((t) => t.status !== 'DONE').length})`,
            },
            {
              key: 'overdue',
              label: `Overdue (${
                tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE').length
              })`,
            },
            {
              key: 'high',
              label: `High & Critical (${
                tasks.filter((t) => t.priority === 'HIGH' || t.priority === 'CRITICAL').length
              })`,
            },
            {
              key: 'completed',
              label: `Completed (${tasks.filter((t) => t.status === 'DONE').length})`,
            },
          ].map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setQuickFilter(pill.key as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                quickFilter === pill.key
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-sm'
                  : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sticky Floating Bulk Action Bar */}
      {selectedTaskIds.size > 0 && canEditTask && (
        <div className="sticky top-20 z-40 bg-slate-900 border border-indigo-500/40 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold font-mono">
              {selectedTaskIds.size} Selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedTaskIds(new Set())}
              className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
            >
              Deselect All
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk Status Picker */}
            <select
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                bulkTaskActionMutation.mutate({
                  taskIds: Array.from(selectedTaskIds),
                  action: 'UPDATE_STATUS',
                  status: e.target.value,
                });
                e.target.value = '';
              }}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="" disabled>Change Status...</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="REVIEW">In Review</option>
              <option value="DONE">Done</option>
              <option value="BLOCKED">Blocked</option>
            </select>

            {/* Bulk Priority Picker */}
            <select
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                bulkTaskActionMutation.mutate({
                  taskIds: Array.from(selectedTaskIds),
                  action: 'UPDATE_PRIORITY',
                  priority: e.target.value,
                });
                e.target.value = '';
              }}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="" disabled>Change Priority...</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>

            {/* Bulk Assignee Picker */}
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value === '') return;
                bulkTaskActionMutation.mutate({
                  taskIds: Array.from(selectedTaskIds),
                  action: 'UPDATE_ASSIGNEE',
                  assigneeId: e.target.value === 'UNASSIGN' ? null : e.target.value,
                });
                e.target.value = '';
              }}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="" disabled>Assign To...</option>
              <option value="UNASSIGN">Unassign</option>
              {projectMembers.map((m: any) => {
                const u = m.user || m;
                return (
                  <option key={u.id} value={u.id}>
                    {u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.email}
                  </option>
                );
              })}
            </select>

            {/* Bulk Move Task List */}
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value === '') return;
                bulkTaskActionMutation.mutate({
                  taskIds: Array.from(selectedTaskIds),
                  action: 'MOVE_TASK_LIST',
                  taskListId: e.target.value === 'GENERAL' ? null : e.target.value,
                });
                e.target.value = '';
              }}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="" disabled>Move to Task List...</option>
              <option value="GENERAL">General / Unassigned</option>
              {taskLists.map((tl: any) => (
                <option key={tl.id} value={tl.id}>
                  {tl.name}
                </option>
              ))}
            </select>

            {/* Bulk Move Milestone */}
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value === '') return;
                bulkTaskActionMutation.mutate({
                  taskIds: Array.from(selectedTaskIds),
                  action: 'MOVE_MILESTONE',
                  milestoneId: e.target.value === 'UNASSIGN' ? null : e.target.value,
                });
                e.target.value = '';
              }}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="" disabled>Associate Milestone...</option>
              <option value="UNASSIGN">No Milestone</option>
              {milestones.map((ms: any) => (
                <option key={ms.id} value={ms.id}>
                  {ms.title}
                </option>
              ))}
            </select>

            {/* Bulk Mark Complete */}
            <button
              type="button"
              onClick={() =>
                bulkTaskActionMutation.mutate({
                  taskIds: Array.from(selectedTaskIds),
                  action: 'MARK_COMPLETED',
                })
              }
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark Done</span>
            </button>

            {/* Bulk Delete */}
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Areas */}
      {isLoadingTasks || isLoadingTaskLists ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-xs text-slate-400">Loading tasks and views...</p>
        </div>
      ) : tasks.length === 0 ? (
        /* Empty State */
        <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-10 md:p-14 text-center space-y-6 max-w-2xl mx-auto my-6 relative overflow-hidden">
          <div className="w-16 h-16 mx-auto bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
            <FolderTree className="w-8 h-8 text-indigo-400" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-xl font-bold text-slate-100">No tasks created yet</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Create your first Task List to structure deliverables into phases, then add tasks and subtasks to collaborate across List, Kanban, and Gantt views.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {canCreateTask && (
              <>
                <button
                  type="button"
                  onClick={() => setIsCreateTaskListModalOpen(true)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <FolderPlus className="w-4 h-4 text-indigo-400" />
                  <span>Create Task List</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenCreateTaskModal()}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Task</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : viewMode === 'gantt' ? (
        /* ================= 4. GANTT VIEW ================= */
        <GanttChart
          projectId={projectId}
          tasks={sortedFilteredTasks}
          milestones={milestones}
          canEditTask={canEditTask}
          onTaskClick={onTaskClick}
          onOpenCreateTaskModal={onOpenCreateTaskModal}
        />
      ) : viewMode === 'kanban' ? (
        /* ================= 3. KANBAN VIEW ================= */
        <KanbanBoard
          projectId={projectId}
          projectCode={project?.projectCode}
          tasks={sortedFilteredTasks}
          taskLists={taskLists}
          projectMembers={projectMembers}
          groupBy={kanbanGroupBy}
          isReadOnly={project?.status === 'ARCHIVED' || !canEditTask}
          onCardClick={(taskId) => onTaskClick(taskId)}
          onReorder={async (taskId, payload) => {
            await reorderTaskMutation.mutateAsync({
              taskId,
              ...payload,
            });
          }}
          onQuickStatusChange={async (taskId, newStatus) => {
            await updateTaskMutation.mutateAsync({
              taskId,
              data: { status: newStatus },
            });
          }}
        />
      ) : viewMode === 'classic' ? (
        /* ================= 1. CLASSIC VIEW (Grouped by Task List) ================= */
        <div className="space-y-5">
          {taskLists.map((taskList: any, index: number) => {
            const listTasks = groupedTasks[taskList.id] || [];
            const isCollapsed = collapsedLists[taskList.id];
            const isCompleted = taskList.status === 'COMPLETED';
            const listTaskIds = listTasks.map((t) => t.id);
            const isAllListSelected =
              listTaskIds.length > 0 && listTaskIds.every((id) => selectedTaskIds.has(id));

            return (
              <div
                key={taskList.id}
                className={`bg-slate-900/40 border rounded-2xl overflow-hidden transition-all shadow-xl ${
                  isCompleted ? 'border-slate-800/60 opacity-90' : 'border-slate-850'
                }`}
              >
                {/* Task List Header */}
                <div className="p-4 md:px-6 bg-slate-950/70 border-b border-slate-850/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* List Checkbox for Bulk Selection */}
                    {canEditTask && listTasks.length > 0 && (
                      <input
                        type="checkbox"
                        checked={isAllListSelected}
                        onChange={() => handleSelectAllInList(listTaskIds)}
                        className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Select all tasks in this list"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => toggleListCollapse(taskList.id)}
                      className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-all cursor-pointer"
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        onClick={() => toggleListCollapse(taskList.id)}
                        className="font-bold text-sm text-slate-100 hover:text-indigo-300 transition-colors cursor-pointer"
                      >
                        {taskList.name}
                      </h3>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}
                      >
                        {taskList.status}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 ${
                          taskList.flag === 'EXTERNAL'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {taskList.flag === 'EXTERNAL' ? (
                          <Globe className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Lock className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{taskList.flag}</span>
                      </span>

                      {taskList.milestone && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                          <Flag className="w-3 h-3 text-amber-400" />
                          <span>{taskList.milestone.title}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Header Actions */}
                  <div className="flex items-center gap-4 ml-7 md:ml-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] text-slate-400 font-medium">
                        <strong className="text-slate-200">{taskList.completedTasks}</strong> of{' '}
                        <strong className="text-slate-200">{taskList.totalTasks}</strong> completed
                      </span>
                      <div className="w-20 h-1.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${taskList.progress || 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-indigo-400 font-semibold">
                        {taskList.progress || 0}%
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDiscussionTaskListId(taskList.id)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Discussion</span>
                      {(taskList._count?.comments || 0) > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {taskList._count.comments}
                        </span>
                      )}
                    </button>

                    {canCreateTask && (
                      <button
                        type="button"
                        onClick={() => onOpenCreateTaskModal(taskList.id, taskList.milestoneId)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-indigo-400" />
                        <span>Add Task</span>
                      </button>
                    )}

                    {canEditTask && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuTaskListId(
                              activeMenuTaskListId === taskList.id ? null : taskList.id,
                            )
                          }
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-all cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenuTaskListId === taskList.id && (
                          <div className="absolute right-0 top-8 w-48 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTaskList(taskList);
                                setActiveMenuTaskListId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-900 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <FolderEdit className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Edit Task List</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuTaskListId(null);
                                if (isCompleted) {
                                  toggleTaskListStatusMutation.mutate({
                                    id: taskList.id,
                                    newStatus: 'ACTIVE',
                                  });
                                } else {
                                  toggleTaskListStatusMutation.mutate({
                                    id: taskList.id,
                                    newStatus: 'COMPLETED',
                                  });
                                }
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-900 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{isCompleted ? 'Reopen List' : 'Mark as Complete'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Table Body */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    {listTasks.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No tasks match criteria.{' '}
                        {canCreateTask && (
                          <button
                            type="button"
                            onClick={() => onOpenCreateTaskModal(taskList.id, taskList.milestoneId)}
                            className="text-indigo-400 hover:underline font-semibold ml-1 cursor-pointer"
                          >
                            + Add a task now
                          </button>
                        )}
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse min-w-[950px]">
                        <thead>
                          <tr className="bg-slate-950/80 border-b border-slate-900 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            {canEditTask && <th className="py-3 px-4 w-10"></th>}
                            {visibleColumns.key && (
                              <th
                                onClick={() => handleSort('taskNumber')}
                                className="py-3 px-4 w-28 cursor-pointer hover:text-indigo-400 select-none"
                              >
                                <div className="flex items-center gap-1">
                                  <span>Key</span>
                                  {sortField === 'taskNumber' && (
                                    <ArrowUpDown className="w-3 h-3 text-indigo-400" />
                                  )}
                                </div>
                              </th>
                            )}
                            {visibleColumns.title && (
                              <th
                                onClick={() => handleSort('title')}
                                className="py-3 px-4 min-w-[260px] cursor-pointer hover:text-indigo-400 select-none"
                              >
                                <div className="flex items-center gap-1">
                                  <span>Task Name</span>
                                  {sortField === 'title' && (
                                    <ArrowUpDown className="w-3 h-3 text-indigo-400" />
                                  )}
                                </div>
                              </th>
                            )}
                            {visibleColumns.status && (
                              <th
                                onClick={() => handleSort('status')}
                                className="py-3 px-4 cursor-pointer hover:text-indigo-400 select-none"
                              >
                                <span>Status</span>
                              </th>
                            )}
                            {visibleColumns.priority && (
                              <th
                                onClick={() => handleSort('priority')}
                                className="py-3 px-4 cursor-pointer hover:text-indigo-400 select-none"
                              >
                                <span>Priority</span>
                              </th>
                            )}
                            {visibleColumns.type && <th className="py-3 px-4">Type</th>}
                            {visibleColumns.assignee && (
                              <th
                                onClick={() => handleSort('assignee')}
                                className="py-3 px-4 cursor-pointer hover:text-indigo-400 select-none"
                              >
                                <span>Assignee</span>
                              </th>
                            )}
                            {visibleColumns.estimatedHours && (
                              <th
                                onClick={() => handleSort('estimatedHours')}
                                className="py-3 px-4 cursor-pointer hover:text-indigo-400 select-none"
                              >
                                <span>Est. Hours</span>
                              </th>
                            )}
                            {visibleColumns.schedule && (
                              <th
                                onClick={() => handleSort('dueDate')}
                                className="py-3 px-4 cursor-pointer hover:text-indigo-400 select-none"
                              >
                                <span>Schedule</span>
                              </th>
                            )}
                            {customFields.map((cf) => {
                              const isVis = visibleColumns[cf.apiName] ?? cf.showInList;
                              if (!isVis) return null;
                              return (
                                <th key={cf.id} className="py-3 px-4 select-none">
                                  <span>{cf.name}</span>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/80 text-xs">
                          {listTasks.map((t: any) => {
                            const hasSubtasks = t.subtasks && t.subtasks.length > 0;
                            const isExpanded = expandedSubtasks[t.id];
                            const isSelected = selectedTaskIds.has(t.id);

                            return (
                              <React.Fragment key={t.id}>
                                <tr
                                  onClick={() => onTaskClick(t.id)}
                                  className={`hover:bg-indigo-950/20 transition-colors cursor-pointer group ${
                                    isSelected ? 'bg-indigo-950/30' : ''
                                  }`}
                                >
                                  {canEditTask && (
                                    <td className="py-3.5 px-4" onClick={(e) => toggleSelectTask(t.id, e)}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {}}
                                        className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      />
                                    </td>
                                  )}

                                  {visibleColumns.key && (
                                    <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-indigo-400">
                                      {project?.projectCode}-{t.taskNumber}
                                    </td>
                                  )}

                                  {visibleColumns.title && (
                                    <td className="py-3.5 px-4 font-bold text-slate-100 group-hover:text-indigo-300 max-w-[320px]">
                                      <div className="flex items-center gap-2">
                                        {hasSubtasks ? (
                                          <button
                                            type="button"
                                            onClick={(e) => toggleSubtaskExpand(t.id, e)}
                                            className="p-0.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-all cursor-pointer"
                                          >
                                            {isExpanded ? (
                                              <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                                            ) : (
                                              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                            )}
                                          </button>
                                        ) : (
                                          <div className="w-3.5" />
                                        )}
                                        <div className="truncate" title={t.title}>
                                          {t.title}
                                        </div>
                                        {(t.recurringTaskId || t.recurringTask) && (
                                          <span className="px-1.5 py-0.2 bg-violet-500/10 border border-violet-500/20 rounded font-mono text-[9px] text-violet-400 flex items-center gap-1 shrink-0">
                                            <Repeat className="w-2.5 h-2.5 text-violet-400" />
                                            <span>Recurring</span>
                                          </span>
                                        )}
                                        {hasSubtasks && (
                                          <span className="px-1.5 py-0.2 bg-slate-900 border border-slate-800 rounded font-mono text-[9px] text-slate-400">
                                            {t.subtasks.length} subtasks
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  )}

                                  {visibleColumns.status && (
                                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                                      {canEditTask ? (
                                        <select
                                          value={t.status}
                                          onChange={(e) =>
                                            updateTaskMutation.mutate({
                                              taskId: t.id,
                                              data: { status: e.target.value },
                                            })
                                          }
                                          className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider bg-slate-950 cursor-pointer focus:outline-none focus:border-indigo-500 ${getStatusColor(
                                            t.status,
                                          )}`}
                                        >
                                          <option value="TODO">To Do</option>
                                          <option value="IN_PROGRESS">In Progress</option>
                                          <option value="REVIEW">In Review</option>
                                          <option value="DONE">Done</option>
                                          <option value="BLOCKED">Blocked</option>
                                        </select>
                                      ) : (
                                        <span
                                          className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider inline-block ${getStatusColor(
                                            t.status,
                                          )}`}
                                        >
                                          {t.status.replace('_', ' ')}
                                        </span>
                                      )}
                                    </td>
                                  )}

                                  {visibleColumns.priority && (
                                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                                      {canEditTask ? (
                                        <select
                                          value={t.priority}
                                          onChange={(e) =>
                                            updateTaskMutation.mutate({
                                              taskId: t.id,
                                              data: { priority: e.target.value },
                                            })
                                          }
                                          className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase bg-slate-950 cursor-pointer focus:outline-none focus:border-indigo-500 ${getPriorityColor(
                                            t.priority,
                                          )}`}
                                        >
                                          <option value="LOW">Low</option>
                                          <option value="MEDIUM">Medium</option>
                                          <option value="HIGH">High</option>
                                          <option value="CRITICAL">Critical</option>
                                        </select>
                                      ) : (
                                        <span
                                          className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase inline-block ${getPriorityColor(
                                            t.priority,
                                          )}`}
                                        >
                                          {t.priority}
                                        </span>
                                      )}
                                    </td>
                                  )}

                                  {visibleColumns.type && (
                                    <td className="py-3.5 px-4">
                                      <div className="flex items-center gap-1.5 text-slate-300 font-medium capitalize">
                                        <div className="p-1 bg-slate-950 border border-slate-800 rounded">
                                          {getTypeIcon(t.type)}
                                        </div>
                                        <span className="text-[11px]">{t.type.toLowerCase()}</span>
                                      </div>
                                    </td>
                                  )}

                                  {visibleColumns.assignee && (
                                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                                      {canEditTask ? (
                                        <select
                                          value={t.assigneeId || ''}
                                          onChange={(e) =>
                                            updateTaskMutation.mutate({
                                              taskId: t.id,
                                              data: { assigneeId: e.target.value || null },
                                            })
                                          }
                                          className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[120px]"
                                        >
                                          <option value="">Unassigned</option>
                                          {projectMembers.map((m: any) => {
                                            const u = m.user || m;
                                            return (
                                              <option key={u.id} value={u.id}>
                                                {u.firstName || u.email.split('@')[0]}
                                              </option>
                                            );
                                          })}
                                        </select>
                                      ) : t.assignee ? (
                                        <span className="text-slate-300 font-medium">
                                          {t.assignee.firstName || t.assignee.email.split('@')[0]}
                                        </span>
                                      ) : (
                                        <span className="text-slate-600 italic text-[11px]">Unassigned</span>
                                      )}
                                    </td>
                                  )}

                                  {visibleColumns.estimatedHours && (
                                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                                      {t.estimatedHours ? `${t.estimatedHours}h` : '-'}
                                    </td>
                                  )}

                                  {visibleColumns.schedule && (
                                    <td className="py-3.5 px-4 text-slate-300 font-medium text-[11px]">
                                      {(() => {
                                        const isOverdue =
                                          t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE';
                                        if (t.startDate && t.dueDate) {
                                          return (
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className={isOverdue ? 'text-rose-400 font-semibold' : ''}>
                                                {formatDate(t.startDate)} – {formatDate(t.dueDate)}
                                              </span>
                                              {isOverdue && (
                                                <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold">
                                                  Overdue
                                                </span>
                                              )}
                                            </div>
                                          );
                                        } else if (t.dueDate) {
                                          return (
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className={isOverdue ? 'text-rose-400 font-semibold' : ''}>
                                                Due {formatDate(t.dueDate)}
                                              </span>
                                              {isOverdue && (
                                                <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold">
                                                  Overdue
                                                </span>
                                              )}
                                            </div>
                                          );
                                        } else if (t.startDate) {
                                          return <span>Starts {formatDate(t.startDate)}</span>;
                                        }
                                        return <span className="text-slate-600">-</span>;
                                      })()}
                                    </td>
                                  )}
                                </tr>

                                {/* Nested Subtask Rows */}
                                {hasSubtasks &&
                                  isExpanded &&
                                  t.subtasks.map((st: any) => (
                                    <tr
                                      key={st.id}
                                      onClick={() => onTaskClick(st.id)}
                                      className="bg-slate-950/40 hover:bg-indigo-950/20 transition-colors cursor-pointer"
                                    >
                                      {canEditTask && <td className="py-2.5 px-4"></td>}
                                      {visibleColumns.key && (
                                        <td className="py-2.5 px-4 pl-8 font-mono text-[10px] text-slate-500">
                                          {project?.projectCode}-{st.taskNumber}
                                        </td>
                                      )}
                                      {visibleColumns.title && (
                                        <td className="py-2.5 px-4 pl-8">
                                          <div className="flex items-center gap-2 text-slate-300 text-xs">
                                            <CornerDownRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                            <span className="font-medium">{st.title}</span>
                                          </div>
                                        </td>
                                      )}
                                      {visibleColumns.status && (
                                        <td className="py-2.5 px-4">
                                          <span
                                            className={`px-2 py-0.5 rounded-full text-[8px] font-bold border uppercase ${getStatusColor(
                                              st.status,
                                            )}`}
                                          >
                                            {st.status.replace('_', ' ')}
                                          </span>
                                        </td>
                                      )}
                                      {visibleColumns.priority && (
                                        <td className="py-2.5 px-4">
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase ${getPriorityColor(
                                              st.priority,
                                            )}`}
                                          >
                                            {st.priority}
                                          </span>
                                        </td>
                                      )}
                                      {visibleColumns.type && (
                                        <td className="py-2.5 px-4">
                                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                            {getTypeIcon(st.type)}
                                            <span>{st.type.toLowerCase()}</span>
                                          </div>
                                        </td>
                                      )}
                                      {visibleColumns.assignee && (
                                        <td className="py-2.5 px-4 text-[10px] text-slate-400">
                                          {st.assignee?.firstName || st.assignee?.email?.split('@')[0] || '-'}
                                        </td>
                                      )}
                                      {visibleColumns.estimatedHours && (
                                        <td className="py-2.5 px-4 text-[10px] text-slate-400">
                                          {st.estimatedHours ? `${st.estimatedHours}h` : '-'}
                                        </td>
                                      )}
                                      {visibleColumns.schedule && (
                                        <td className="py-2.5 px-4 text-[10px] text-slate-400">
                                          {st.dueDate ? formatDate(st.dueDate) : '-'}
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned / General Tasks Section */}
          {groupedTasks['unassigned'] && groupedTasks['unassigned'].length > 0 && (
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 md:px-6 bg-slate-950/60 border-b border-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {canEditTask && (
                    <input
                      type="checkbox"
                      checked={groupedTasks['unassigned'].every((t) => selectedTaskIds.has(t.id))}
                      onChange={() =>
                        handleSelectAllInList(groupedTasks['unassigned'].map((t) => t.id))
                      }
                      className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => toggleListCollapse('unassigned')}
                    className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-all cursor-pointer"
                  >
                    {collapsedLists['unassigned'] ? (
                      <ChevronRight className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-200">General / Unassigned Tasks</h3>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-950 text-slate-400 border border-slate-800">
                      {groupedTasks['unassigned'].length} tasks
                    </span>
                  </div>
                </div>
              </div>

              {!collapsedLists['unassigned'] && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[950px]">
                    <thead>
                      <tr className="bg-slate-950/80 border-b border-slate-900 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {canEditTask && <th className="py-3 px-4 w-10"></th>}
                        <th className="py-3 px-4 w-28">Key</th>
                        <th className="py-3 px-4 min-w-[260px]">Task Name</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Priority</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Assignee</th>
                        <th className="py-3 px-4">Est. Hours</th>
                        <th className="py-3 px-4">Schedule</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/80 text-xs">
                      {groupedTasks['unassigned'].map((t: any) => {
                        const isSelected = selectedTaskIds.has(t.id);
                        return (
                          <tr
                            key={t.id}
                            onClick={() => onTaskClick(t.id)}
                            className={`hover:bg-indigo-950/20 transition-colors cursor-pointer group ${
                              isSelected ? 'bg-indigo-950/30' : ''
                            }`}
                          >
                            {canEditTask && (
                              <td className="py-3.5 px-4" onClick={(e) => toggleSelectTask(t.id, e)}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>
                            )}
                            <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-indigo-400">
                              {project?.projectCode}-{t.taskNumber}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-100 group-hover:text-indigo-300 max-w-[320px]">
                              <div className="truncate">{t.title}</div>
                            </td>
                            <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider inline-block ${getStatusColor(
                                  t.status,
                                )}`}
                              >
                                {t.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase inline-block ${getPriorityColor(
                                  t.priority,
                                )}`}
                              >
                                {t.priority}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 text-slate-300 font-medium capitalize">
                                <div className="p-1 bg-slate-950 border border-slate-800 rounded">
                                  {getTypeIcon(t.type)}
                                </div>
                                <span className="text-[11px]">{t.type.toLowerCase()}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300">
                              {t.assignee?.firstName || t.assignee?.email?.split('@')[0] || '-'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-300 font-medium">
                              {t.estimatedHours ? `${t.estimatedHours}h` : '-'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-300 font-medium text-[11px]">
                              {t.dueDate ? formatDate(t.dueDate) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ================= 2. PLAIN VIEW (Flat Unified Table) ================= */
        <div className="bg-slate-900/40 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-850 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {canEditTask && (
                    <th className="py-3.5 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={
                          allFilteredTaskIds.length > 0 &&
                          allFilteredTaskIds.every((id) => selectedTaskIds.has(id))
                        }
                        onChange={() => handleSelectAllTasks(allFilteredTaskIds)}
                        className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Select all tasks"
                      />
                    </th>
                  )}
                  {visibleColumns.key && (
                    <th
                      onClick={() => handleSort('taskNumber')}
                      className="py-3.5 px-4 w-28 cursor-pointer hover:text-indigo-400 select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Key</span>
                        {sortField === 'taskNumber' && (
                          <ArrowUpDown className="w-3 h-3 text-indigo-400" />
                        )}
                      </div>
                    </th>
                  )}
                  {visibleColumns.title && (
                    <th
                      onClick={() => handleSort('title')}
                      className="py-3.5 px-4 min-w-[220px] cursor-pointer hover:text-indigo-400 select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Task Name</span>
                        {sortField === 'title' && (
                          <ArrowUpDown className="w-3 h-3 text-indigo-400" />
                        )}
                      </div>
                    </th>
                  )}
                  {visibleColumns.taskList && <th className="py-3.5 px-4">Task List</th>}
                  {visibleColumns.milestone && <th className="py-3.5 px-4">Milestone</th>}
                  {visibleColumns.status && (
                    <th
                      onClick={() => handleSort('status')}
                      className="py-3.5 px-4 cursor-pointer hover:text-indigo-400 select-none"
                    >
                      <span>Status</span>
                    </th>
                  )}
                  {visibleColumns.priority && (
                    <th
                      onClick={() => handleSort('priority')}
                      className="py-3.5 px-4 cursor-pointer hover:text-indigo-400 select-none"
                    >
                      <span>Priority</span>
                    </th>
                  )}
                  {visibleColumns.type && <th className="py-3.5 px-4">Type</th>}
                  {visibleColumns.assignee && (
                    <th
                      onClick={() => handleSort('assignee')}
                      className="py-3.5 px-4 cursor-pointer hover:text-indigo-400 select-none"
                    >
                      <span>Assignee</span>
                    </th>
                  )}
                  {visibleColumns.estimatedHours && (
                    <th
                      onClick={() => handleSort('estimatedHours')}
                      className="py-3.5 px-4 cursor-pointer hover:text-indigo-400 select-none"
                    >
                      <span>Est. Hours</span>
                    </th>
                  )}
                  {visibleColumns.schedule && (
                    <th
                      onClick={() => handleSort('dueDate')}
                      className="py-3.5 px-4 cursor-pointer hover:text-indigo-400 select-none"
                    >
                      <span>Schedule</span>
                    </th>
                  )}
                  {customFields.map((cf) => {
                    const isVis = visibleColumns[cf.apiName] ?? cf.showInList;
                    if (!isVis) return null;
                    return (
                      <th key={cf.id} className="py-3.5 px-4 select-none">
                        <span>{cf.name}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/80 text-xs">
                {sortedFilteredTasks.map((t: any) => {
                  const isSelected = selectedTaskIds.has(t.id);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => onTaskClick(t.id)}
                      className={`hover:bg-indigo-950/20 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-indigo-950/30' : ''
                      }`}
                    >
                      {canEditTask && (
                        <td className="py-3.5 px-4" onClick={(e) => toggleSelectTask(t.id, e)}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                      )}
                      {visibleColumns.key && (
                        <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-indigo-400">
                          {project?.projectCode}-{t.taskNumber}
                        </td>
                      )}
                      {visibleColumns.title && (
                        <td className="py-3.5 px-4 font-bold text-slate-100 group-hover:text-indigo-300 max-w-[260px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {t.parentTask && (
                              <CornerDownRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            )}
                            <span className="truncate" title={t.title}>
                              {t.title}
                            </span>
                            {(t.recurringTaskId || t.recurringTask) && (
                              <span className="px-1.5 py-0.2 bg-violet-500/10 border border-violet-500/20 rounded font-mono text-[9px] text-violet-400 flex items-center gap-1 shrink-0">
                                <Repeat className="w-2.5 h-2.5 text-violet-400" />
                                <span>Recurring</span>
                              </span>
                            )}
                          </div>
                          {t.parentTask ? (
                            <div className="text-[10px] text-indigo-400/80 font-normal truncate mt-0.5">
                              Subtask of: {project?.projectCode}-{t.parentTask.taskNumber}
                            </div>
                          ) : null}
                        </td>
                      )}
                      {visibleColumns.taskList && (
                        <td className="py-3.5 px-4">
                          {t.taskList ? (
                            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium text-[11px] truncate max-w-[130px] inline-block">
                              {t.taskList.name}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px] italic">General</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.milestone && (
                        <td className="py-3.5 px-4 text-slate-400">
                          {t.milestone?.title ? (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-medium text-amber-400/90 truncate max-w-[120px] inline-block">
                              {t.milestone.title}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">-</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          {canEditTask ? (
                            <select
                              value={t.status}
                              onChange={(e) =>
                                updateTaskMutation.mutate({
                                  taskId: t.id,
                                  data: { status: e.target.value },
                                })
                              }
                              className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider bg-slate-950 cursor-pointer focus:outline-none focus:border-indigo-500 ${getStatusColor(
                                t.status,
                              )}`}
                            >
                              <option value="TODO">To Do</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="REVIEW">In Review</option>
                              <option value="DONE">Done</option>
                              <option value="BLOCKED">Blocked</option>
                            </select>
                          ) : (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider inline-block ${getStatusColor(
                                t.status,
                              )}`}
                            >
                              {t.status.replace('_', ' ')}
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.priority && (
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          {canEditTask ? (
                            <select
                              value={t.priority}
                              onChange={(e) =>
                                updateTaskMutation.mutate({
                                  taskId: t.id,
                                  data: { priority: e.target.value },
                                })
                              }
                              className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase bg-slate-950 cursor-pointer focus:outline-none focus:border-indigo-500 ${getPriorityColor(
                                t.priority,
                              )}`}
                            >
                              <option value="LOW">Low</option>
                              <option value="MEDIUM">Medium</option>
                              <option value="HIGH">High</option>
                              <option value="CRITICAL">Critical</option>
                            </select>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase inline-block ${getPriorityColor(
                                t.priority,
                              )}`}
                            >
                              {t.priority}
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.type && (
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-300 font-medium capitalize">
                            <div className="p-1 bg-slate-950 border border-slate-800 rounded">
                              {getTypeIcon(t.type)}
                            </div>
                            <span className="text-[11px]">{t.type.toLowerCase()}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.assignee && (
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          {canEditTask ? (
                            <select
                              value={t.assigneeId || ''}
                              onChange={(e) =>
                                updateTaskMutation.mutate({
                                  taskId: t.id,
                                  data: { assigneeId: e.target.value || null },
                                })
                              }
                              className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[120px]"
                            >
                              <option value="">Unassigned</option>
                              {projectMembers.map((m: any) => {
                                const u = m.user || m;
                                return (
                                  <option key={u.id} value={u.id}>
                                    {u.firstName || u.email.split('@')[0]}
                                  </option>
                                );
                              })}
                            </select>
                          ) : t.assignee ? (
                            <span className="text-slate-300 font-medium">
                              {t.assignee.firstName || t.assignee.email.split('@')[0]}
                            </span>
                          ) : (
                            <span className="text-slate-600 italic text-[11px]">Unassigned</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.estimatedHours && (
                        <td className="py-3.5 px-4 text-slate-300 font-medium">
                          {t.estimatedHours ? `${t.estimatedHours}h` : '-'}
                        </td>
                      )}
                      {visibleColumns.schedule && (
                        <td className="py-3.5 px-4 text-slate-300 font-medium text-[11px]">
                          {(() => {
                            const isOverdue =
                              t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE';
                            if (t.startDate && t.dueDate) {
                              return (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={isOverdue ? 'text-rose-400 font-semibold' : ''}>
                                    {formatDate(t.startDate)} – {formatDate(t.dueDate)}
                                  </span>
                                  {isOverdue && (
                                    <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold">
                                      Overdue
                                    </span>
                                  )}
                                </div>
                              );
                            } else if (t.dueDate) {
                              return (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={isOverdue ? 'text-rose-400 font-semibold' : ''}>
                                    Due {formatDate(t.dueDate)}
                                  </span>
                                  {isOverdue && (
                                    <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold">
                                      Overdue
                                    </span>
                                  )}
                                </div>
                              );
                            } else if (t.startDate) {
                              return <span>Starts {formatDate(t.startDate)}</span>;
                            }
                            return <span className="text-slate-600">-</span>;
                          })()}
                        </td>
                      )}
                      {/* Plain View Custom Field Cells */}
                      {customFields.map((cf) => {
                        const isVis = visibleColumns[cf.apiName] ?? cf.showInList;
                        if (!isVis) return null;
                        let val: any = '';
                        try {
                          const parsed = JSON.parse(t.customFields || '{}');
                          val = parsed[cf.apiName];
                        } catch {}
                        return (
                          <td key={cf.id} className="py-3.5 px-4 text-slate-300 truncate max-w-[140px] text-xs">
                            {val !== undefined && val !== null && val !== '' ? (
                              Array.isArray(val) ? (
                                val.join(', ')
                              ) : typeof val === 'boolean' ? (
                                val ? 'Yes' : 'No'
                              ) : (
                                String(val)
                              )
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Task List Modal */}
      <CreateTaskListModal
        isOpen={isCreateTaskListModalOpen}
        onClose={() => setIsCreateTaskListModalOpen(false)}
        projectId={projectId}
        milestones={milestones}
      />

      {/* Edit Task List Modal */}
      {editingTaskList && (
        <EditTaskListModal
          isOpen={!!editingTaskList}
          onClose={() => setEditingTaskList(null)}
          taskList={editingTaskList}
          projectId={projectId}
          milestones={milestones}
        />
      )}

      {/* Complete Task List Modal */}
      {completingTaskList && (
        <CompleteTaskListModal
          isOpen={!!completingTaskList}
          onClose={() => setCompletingTaskList(null)}
          taskList={completingTaskList}
          projectId={projectId}
          otherTaskLists={taskLists}
        />
      )}

      {/* Task List Discussion Drawer */}
      <TaskListDiscussionDrawer
        taskListId={discussionTaskListId}
        projectId={projectId}
        project={project}
        onClose={() => setDiscussionTaskListId(null)}
      />

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Delete Selected Tasks?</h3>
                <p className="text-xs text-slate-400">
                  Are you sure you want to delete {selectedTaskIds.size} task(s)? Their subtasks will also be deleted.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  bulkTaskActionMutation.mutate({
                    taskIds: Array.from(selectedTaskIds),
                    action: 'DELETE',
                  })
                }
                disabled={bulkTaskActionMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {bulkTaskActionMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
