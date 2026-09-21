'use client';

import React, { useState } from 'react';
import {
  X,
  Plus,
  TrendingUp,
  BarChart2,
  PieChart,
  ListTodo,
  Clock,
  FolderKanban,
  CheckCircle2,
  Calendar,
  Layers,
  Flag,
  ArrowRight,
  Sliders,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (data: {
    title: string;
    type: string;
    width: string;
    config?: any;
  }) => Promise<void>;
  dashboardProjectId?: string | null;
}

const WIDGET_CATALOG = [
  // ─── TASKS CATEGORY ────────────────────────────────────────────────────────
  {
    category: 'tasks',
    type: 'KPI_TOTAL_TASKS',
    title: 'Total Tasks Count',
    description: 'Summary card of total tasks with completion ratio.',
    icon: TrendingUp,
    defaultWidth: 'QUARTER',
  },
  {
    category: 'tasks',
    type: 'KPI_COMPLETED_TASKS',
    title: 'Completed Tasks',
    description: 'Summary card showing number of achieved tasks.',
    icon: CheckCircle2,
    defaultWidth: 'QUARTER',
  },
  {
    category: 'tasks',
    type: 'KPI_PENDING_TASKS',
    title: 'Pending Tasks',
    description: 'Number of active/open tasks remaining in project.',
    icon: TrendingUp,
    defaultWidth: 'QUARTER',
  },
  {
    category: 'tasks',
    type: 'KPI_OVERDUE_TASKS',
    title: 'Overdue Tasks Alert',
    description: 'Prominent warning card for tasks that passed their due date.',
    icon: Calendar,
    defaultWidth: 'QUARTER',
  },
  {
    category: 'tasks',
    type: 'CHART_TASK_STATUS',
    title: 'Tasks by Status',
    description: 'Interactive donut/bar chart breaking down tasks by status.',
    icon: PieChart,
    defaultWidth: 'HALF',
  },
  {
    category: 'tasks',
    type: 'CHART_TASK_PRIORITY',
    title: 'Tasks by Priority',
    description: 'Color-coded bar/donut chart displaying tasks by urgency (Critical to Low).',
    icon: BarChart2,
    defaultWidth: 'HALF',
  },
  {
    category: 'tasks',
    type: 'CHART_TASK_ASSIGNEE',
    title: 'Tasks by Assignee',
    description: 'Workload distribution bar chart showing tasks per team member.',
    icon: BarChart2,
    defaultWidth: 'HALF',
  },
  {
    category: 'tasks',
    type: 'CHART_TASK_LIST',
    title: 'Tasks by Task List',
    description: 'Visual distribution of tasks organized under task lists.',
    icon: Layers,
    defaultWidth: 'HALF',
  },
  {
    category: 'tasks',
    type: 'CHART_TASK_MILESTONE',
    title: 'Tasks by Milestone',
    description: 'Distribution of tasks mapped across project milestone phases.',
    icon: Calendar,
    defaultWidth: 'HALF',
  },
  {
    category: 'tasks',
    type: 'CHART_TASK_COMPLETION_TREND',
    title: 'Task Completion Trend',
    description: 'Velocity trend chart tracking task completions over time.',
    icon: TrendingUp,
    defaultWidth: 'HALF',
  },
  {
    category: 'tasks',
    type: 'TABLE_OVERDUE_TASKS',
    title: 'Overdue Tasks Table',
    description: 'Actionable table of overdue tasks with days overdue and assignees.',
    icon: ListTodo,
    defaultWidth: 'HALF',
  },
  {
    category: 'tasks',
    type: 'TABLE_UPCOMING_TASKS',
    title: 'Upcoming Tasks Table',
    description: 'Chronological table of upcoming tasks due soon.',
    icon: ListTodo,
    defaultWidth: 'HALF',
  },
  {
    category: 'tasks',
    type: 'TABLE_RECENT_TASKS',
    title: 'Recent Tasks Table',
    description: 'Live table of recently created or modified tasks.',
    icon: ListTodo,
    defaultWidth: 'HALF',
  },

  // ─── PROJECT CATEGORY ──────────────────────────────────────────────────────
  {
    category: 'project',
    type: 'KPI_PROJECT_PROGRESS',
    title: 'Overall Project Progress',
    description: 'Percentage progress KPI calculated from closed tasks.',
    icon: FolderKanban,
    defaultWidth: 'QUARTER',
  },
  {
    category: 'project',
    type: 'KPI_TOTAL_MILESTONES',
    title: 'Total Milestones Count',
    description: 'Summary card showing total milestone target count.',
    icon: Flag,
    defaultWidth: 'QUARTER',
  },
  {
    category: 'project',
    type: 'KPI_COMPLETED_MILESTONES',
    title: 'Achieved Milestones',
    description: 'Summary card showing number of achieved milestone phases.',
    icon: CheckCircle2,
    defaultWidth: 'QUARTER',
  },

  // ─── TIMESHEET CATEGORY ────────────────────────────────────────────────────
  {
    category: 'timesheet',
    type: 'KPI_LOGGED_HOURS',
    title: 'Total Logged Hours',
    description: 'Total time spent across all project tasks in selected range.',
    icon: Clock,
    defaultWidth: 'QUARTER',
  },
  {
    category: 'timesheet',
    type: 'KPI_BILLABLE_HOURS',
    title: 'Billable Hours',
    description: 'Total billable time logged for client invoicing.',
    icon: Clock,
    defaultWidth: 'QUARTER',
  },
  {
    category: 'timesheet',
    type: 'KPI_NON_BILLABLE_HOURS',
    title: 'Non-Billable Hours',
    description: 'Total non-billable overhead time tracked.',
    icon: Clock,
    defaultWidth: 'QUARTER',
  },
  {
    category: 'timesheet',
    type: 'CHART_BILLABLE_VS_NON_BILLABLE',
    title: 'Billable vs Non-Billable Hours',
    description: 'Donut chart comparing billable vs non-billable time ratios.',
    icon: PieChart,
    defaultWidth: 'HALF',
  },
  {
    category: 'timesheet',
    type: 'CHART_HOURS_LOGGED',
    title: 'Daily Logged Hours Trend',
    description: 'Smooth area chart graphing daily tracked time logs.',
    icon: TrendingUp,
    defaultWidth: 'HALF',
  },
  {
    category: 'timesheet',
    type: 'TABLE_RECENT_TIME_LOGS',
    title: 'Recent Time Entries Table',
    description: 'Detailed stream of recent user time logs with hours and task names.',
    icon: ListTodo,
    defaultWidth: 'HALF',
  },
];

export default function AddWidgetModal({
  isOpen,
  onClose,
  onAddWidget,
  dashboardProjectId,
}: AddWidgetModalProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'project' | 'timesheet'>('tasks');
  const [selectedWidgetType, setSelectedWidgetType] = useState<string | null>(null);
  const [widgetTitle, setWidgetTitle] = useState('');
  const [widgetWidth, setWidgetWidth] = useState('HALF');
  const [targetProjectId, setTargetProjectId] = useState(dashboardProjectId || '');
  const [dateRange, setDateRange] = useState('30d');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [tableLimit, setTableLimit] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Projects for Scope selection
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const handleSelectCatalogItem = (item: any) => {
    setSelectedWidgetType(item.type);
    setWidgetTitle(item.title);
    setWidgetWidth(item.defaultWidth);
    setError(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWidgetType || !widgetTitle.trim()) {
      setError('Please select a widget and enter a title.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onAddWidget({
        title: widgetTitle.trim(),
        type: selectedWidgetType,
        width: widgetWidth,
        config: {
          projectId: targetProjectId || undefined,
          dateRange,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
          limit: selectedWidgetType.startsWith('TABLE_') ? tableLimit : undefined,
        },
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to add widget');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCatalog = WIDGET_CATALOG.filter((w) => w.category === activeTab);
  const selectedItem = WIDGET_CATALOG.find((w) => w.type === selectedWidgetType);
  const isTable = selectedWidgetType?.startsWith('TABLE_');
  const isTaskWidget = selectedWidgetType?.includes('TASK');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Add Dashboard Widget</h3>
              <p className="text-xs text-slate-400">
                Choose from KPIs, interactive charts, and data tables
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split 2 Columns */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left Column: Catalog (7 cols) */}
          <div className="md:col-span-7 p-6 border-r border-slate-800 flex flex-col space-y-4 overflow-y-auto">
            {/* Category Tabs */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('tasks')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'tasks'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tasks ({WIDGET_CATALOG.filter((w) => w.category === 'tasks').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('project')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'project'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Project ({WIDGET_CATALOG.filter((w) => w.category === 'project').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('timesheet')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'timesheet'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Timesheet ({WIDGET_CATALOG.filter((w) => w.category === 'timesheet').length})
              </button>
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1">
              {filteredCatalog.map((item) => {
                const IconComponent = item.icon;
                const isSelected = selectedWidgetType === item.type;
                return (
                  <div
                    key={item.type}
                    onClick={() => handleSelectCatalogItem(item)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 text-left group ${
                      isSelected
                        ? 'bg-indigo-600/10 border-indigo-500 ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-850 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg group-hover:border-slate-700 transition-colors">
                        <IconComponent className="w-4 h-4 text-indigo-400" />
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">
                        {item.defaultWidth}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Parameters & Config (5 cols) */}
          <div className="md:col-span-5 p-6 flex flex-col justify-between space-y-4 overflow-y-auto bg-slate-950/30">
            {selectedItem ? (
              <form onSubmit={handleAdd} className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div className="pb-2 border-b border-slate-800">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                      Selected Widget
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 mt-0.5">
                      {selectedItem.title}
                    </h4>
                  </div>

                  {error && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                      {error}
                    </div>
                  )}

                  {/* Widget Custom Title */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Widget Display Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={widgetTitle}
                      onChange={(e) => setWidgetTitle(e.target.value)}
                      placeholder="e.g. Critical Open Tasks"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Column Span Width */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Grid Column Width
                    </label>
                    <select
                      value={widgetWidth}
                      onChange={(e) => setWidgetWidth(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="QUARTER">Quarter Width (1/4 - 3 columns)</option>
                      <option value="THIRD">Third Width (1/3 - 4 columns)</option>
                      <option value="HALF">Half Width (1/2 - 6 columns)</option>
                      <option value="FULL">Full Width (1/1 - 12 columns)</option>
                    </select>
                  </div>

                  {/* Project Filter (if not fixed to single project) */}
                  {!dashboardProjectId && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Project Scope
                      </label>
                      <select
                        value={targetProjectId}
                        onChange={(e) => setTargetProjectId(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Organization Wide / Default</option>
                        {projects.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.projectCode} - {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Date Range */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Date Range Scope
                    </label>
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="7d">Last 7 Days</option>
                      <option value="14d">Last 14 Days</option>
                      <option value="30d">Last 30 Days</option>
                      <option value="90d">Last 90 Days</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>

                  {/* Status Filter (for task widgets) */}
                  {isTaskWidget && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Workflow Status Filter
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="REVIEW">Review</option>
                        <option value="DONE">Done</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                    </div>
                  )}

                  {/* Priority Filter */}
                  {isTaskWidget && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Priority Level
                      </label>
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="ALL">All Priorities</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                    </div>
                  )}

                  {/* Table Record Limit */}
                  {isTable && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Max Records Displayed
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={25}
                        value={tableLimit}
                        onChange={(e) => setTableLimit(Number(e.target.value))}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 active:scale-95 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-xs active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {isSubmitting ? 'Adding...' : 'Add to Dashboard'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <Sliders className="w-8 h-8 opacity-40 text-indigo-400" />
                <p className="text-xs font-medium">
                  Select a widget from the catalog on the left to configure its parameters.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
