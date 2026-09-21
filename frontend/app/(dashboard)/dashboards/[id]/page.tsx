'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Layout,
  Plus,
  Sliders,
  Share2,
  Copy,
  Trash2,
  Calendar,
  FolderKanban,
  Printer,
  RefreshCw,
  Globe,
  User,
  AlertCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import Header from '@/components/header';
import WidgetRenderer from '@/components/dashboards/widget-renderer';
import AddWidgetModal from '@/components/dashboards/add-widget-modal';
import EditWidgetModal from '@/components/dashboards/edit-widget-modal';
import ShareDashboardModal from '@/components/dashboards/share-dashboard-modal';
import { useFormatDate } from '@/hooks/useFormatDate';

export default function DashboardDetailsPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const dashboardId = params.id as string;
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();

  // Mode & Modals State
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<any | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Live Filter State
  const [dateRange, setDateRange] = useState('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Fetch Dashboard Metadata & Permissions
  const {
    data: dashboard,
    isLoading: isLoadingDashboard,
    error: dashboardError,
  } = useQuery({
    queryKey: ['dashboard', dashboardId],
    queryFn: async () => {
      const res = await api.get(`/dashboards/${dashboardId}`);
      return res.data;
    },
    enabled: isAuthenticated && !!dashboardId,
  });

  // Fetch Projects list for Project Filter
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // Fetch Live Aggregated Widget Data
  const {
    data: widgetDataResponse,
    isLoading: isLoadingData,
    isRefetching: isRefetchingData,
    refetch: refetchData,
  } = useQuery({
    queryKey: [
      'dashboard-data',
      dashboardId,
      dateRange,
      customStartDate,
      customEndDate,
      projectFilter,
      statusFilter,
    ],
    queryFn: async () => {
      const queryParams: Record<string, string> = {
        dateRange,
      };
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        queryParams.startDate = customStartDate;
        queryParams.endDate = customEndDate;
      }
      if (projectFilter !== 'ALL') {
        queryParams.projectId = projectFilter;
      }
      if (statusFilter !== 'ALL') {
        queryParams.status = statusFilter;
      }
      const res = await api.get(`/dashboards/${dashboardId}/data`, {
        params: queryParams,
      });
      return res.data;
    },
    enabled: isAuthenticated && !!dashboardId,
  });

  // Add Widget Mutation
  const addWidgetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(`/dashboards/${dashboardId}/widgets`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', dashboardId] });
    },
  });

  // Update Widget Mutation
  const updateWidgetMutation = useMutation({
    mutationFn: async ({ widgetId, data }: { widgetId: string; data: any }) => {
      const res = await api.patch(
        `/dashboards/${dashboardId}/widgets/${widgetId}`,
        data,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', dashboardId] });
    },
  });

  // Delete Widget Mutation
  const deleteWidgetMutation = useMutation({
    mutationFn: async (widgetId: string) => {
      const res = await api.delete(
        `/dashboards/${dashboardId}/widgets/${widgetId}`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', dashboardId] });
    },
  });

  // Update Layout Mutation
  const updateLayoutMutation = useMutation({
    mutationFn: async (layoutData: any) => {
      const res = await api.put(`/dashboards/${dashboardId}/layout`, layoutData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
      setIsEditMode(false);
    },
  });

  // Update Visibility Mutation
  const updateVisibilityMutation = useMutation({
    mutationFn: async (visibility: string) => {
      const res = await api.patch(`/dashboards/${dashboardId}`, { visibility });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
    },
  });

  // Share Mutation
  const shareMutation = useMutation({
    mutationFn: async ({ userId, accessLevel }: { userId: string; accessLevel: string }) => {
      const res = await api.post(`/dashboards/${dashboardId}/shares`, {
        userId,
        accessLevel,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
    },
  });

  // Remove Share Mutation
  const removeShareMutation = useMutation({
    mutationFn: async (shareUserId: string) => {
      const res = await api.delete(
        `/dashboards/${dashboardId}/shares/${shareUserId}`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
    },
  });

  // Duplicate Dashboard Mutation
  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/dashboards/${dashboardId}/duplicate`);
      return res.data;
    },
    onSuccess: (cloned) => {
      router.push(`/dashboards/${cloned.id}`);
    },
  });

  // Delete Dashboard Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/dashboards/${dashboardId}`);
      return res.data;
    },
    onSuccess: () => {
      router.push('/dashboards');
    },
  });

  if (isLoading || !isAuthenticated || isLoadingDashboard) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (dashboardError || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
        <Header title="Dashboard" subtitle="Custom Dashboards" backHref="/dashboards" />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-rose-950/20 border border-rose-900/60 p-8 rounded-2xl text-center space-y-4 max-w-lg mx-auto">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-lg font-bold text-slate-100">Dashboard Unavailable</h3>
            <p className="text-xs text-slate-400">
              The requested dashboard does not exist or you do not have permission to view it.
            </p>
            <Link
              href="/dashboards"
              className="inline-flex px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Back to Dashboards
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const widgetsList = dashboard.widgets || [];
  const widgetDataMap = new Map<string, any>(
    (widgetDataResponse?.widgets || []).map((w: any) => [w.widgetId, w]),
  );

  // Layout reordering helpers in edit mode
  const handleMoveWidget = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= widgetsList.length) return;

    const newWidgets = [...widgetsList];
    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[targetIndex];
    newWidgets[targetIndex] = temp;

    const payload = {
      widgets: newWidgets.map((w, idx) => ({
        id: w.id,
        position: idx,
        width: w.width,
      })),
    };

    updateLayoutMutation.mutate(payload);
  };

  const handleResizeWidget = (widgetId: string, newWidth: string) => {
    updateWidgetMutation.mutate({
      widgetId,
      data: { width: newWidth },
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSelectTask = (taskId: string) => {
    if (dashboard.projectId) {
      router.push(`/projects/${dashboard.projectId}?tab=tasks&taskId=${taskId}`);
    } else {
      router.push(`/projects`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Top Header */}
      <Header
        title={dashboard.name}
        subtitle="Custom Dashboard"
        backHref="/dashboards"
        activeNav="dashboards"
      >
        <div className="flex items-center gap-2">
          {dashboard.permissions.canEdit && (
            <button
              type="button"
              onClick={() => setIsAddWidgetModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-md active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Widget
            </button>
          )}

          {dashboard.permissions.canEdit && (
            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-3 py-1.5 border rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer ${
                isEditMode
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow'
                  : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              {isEditMode ? 'Done Customizing' : 'Customize Layout'}
            </button>
          )}

          {dashboard.permissions.canShare && (
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white active:scale-95 cursor-pointer transition-colors"
              title="Share Dashboard"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white active:scale-95 cursor-pointer transition-colors"
            title="Export / Print Dashboard"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => duplicateMutation.mutate()}
            className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white active:scale-95 cursor-pointer transition-colors"
            title="Duplicate Dashboard"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {dashboard.permissions.canDelete && (
            <button
              type="button"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="p-2 bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/40 rounded-xl text-rose-400 active:scale-95 cursor-pointer transition-colors"
              title="Delete Dashboard"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </Header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Dashboard Metadata Banner */}
        <section className="bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-blue-950/30 border border-slate-900 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">{dashboard.name}</h2>
              {dashboard.project ? (
                <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                  <FolderKanban className="w-3 h-3" />
                  {dashboard.project.name} ({dashboard.project.projectCode})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700/50 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Portal-Wide Dashboard
                </span>
              )}

              <span className="px-2 py-0.5 rounded-md text-[9px] font-semibold bg-slate-900 text-slate-400 border border-slate-850">
                {dashboard.visibility}
              </span>
            </div>
            {dashboard.description && (
              <p className="text-xs text-slate-400 max-w-2xl">{dashboard.description}</p>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Created by {dashboard.creator.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Updated {formatDate(dashboard.updatedAt)}</span>
            </div>
          </div>
        </section>

        {/* Dashboard Filters Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/20 p-4 border border-slate-900 rounded-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Range Preset Selector */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Range:</span>
            </div>

            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
              {['7d', '14d', '30d', '90d', 'custom'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDateRange(opt)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer ${
                    dateRange === opt
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt === 'custom'
                    ? 'Custom'
                    : opt === '7d'
                    ? '7D'
                    : opt === '14d'
                    ? '14D'
                    : opt === '30d'
                    ? '30D'
                    : '90D'}
                </button>
              ))}
            </div>

            {/* Custom Date Inputs */}
            {dateRange === 'custom' && (
              <div className="flex items-center gap-2 animate-in fade-in duration-150">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                />
                <span className="text-slate-500 text-xs">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                />
              </div>
            )}

            {/* Project Filter (if portal-wide) */}
            {!dashboard.projectId && (
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Projects</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status Quick Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="REVIEW">Review</option>
              <option value="DONE">Done</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => refetchData()}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetchingData ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Edit Mode Notification Banner */}
        {isEditMode && (
          <div className="p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100">Layout Customization Active</h4>
                <p className="text-[11px] text-slate-400">
                  Use the widget headers to reorder (Move Left/Right), resize (1/4, 1/3, 1/2, Full), configure, or delete widgets.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditMode(false)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 cursor-pointer shadow"
            >
              Done Customizing
            </button>
          </div>
        )}

        {/* Dynamic Canvas Grid */}
        {widgetsList.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/20 border border-slate-900 rounded-2xl space-y-4">
            <div className="h-16 w-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
              <Layout className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-200">No Widgets on Dashboard</h3>
              <p className="text-xs text-slate-400">
                Add KPI cards, charts, or tables to start tracking your project metrics.
              </p>
            </div>
            {dashboard.permissions.canEdit && (
              <button
                type="button"
                onClick={() => setIsAddWidgetModalOpen(true)}
                className="px-4.5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Add First Widget
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {widgetsList.map((widget: any, index: number) => {
              const widgetData = widgetDataMap.get(widget.id);
              return (
                <WidgetRenderer
                  key={widget.id}
                  widget={widget}
                  data={widgetData}
                  isLoading={isLoadingData || isRefetchingData}
                  isEditMode={isEditMode}
                  canEdit={dashboard.permissions.canEdit}
                  onRefresh={() => refetchData()}
                  onMoveLeft={index > 0 ? () => handleMoveWidget(index, 'left') : undefined}
                  onMoveRight={
                    index < widgetsList.length - 1
                      ? () => handleMoveWidget(index, 'right')
                      : undefined
                  }
                  onResize={(newWidth) => handleResizeWidget(widget.id, newWidth)}
                  onEditConfig={() => setEditingWidget(widget)}
                  onDelete={() => deleteWidgetMutation.mutate(widget.id)}
                  onSelectTask={handleSelectTask}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Add Widget Modal */}
      <AddWidgetModal
        isOpen={isAddWidgetModalOpen}
        onClose={() => setIsAddWidgetModalOpen(false)}
        dashboardProjectId={dashboard.projectId}
        onAddWidget={async (data) => {
          await addWidgetMutation.mutateAsync(data);
        }}
      />

      {/* Edit Widget Modal */}
      <EditWidgetModal
        isOpen={!!editingWidget}
        widget={editingWidget}
        onClose={() => setEditingWidget(null)}
        onUpdateWidget={async (widgetId, data) => {
          await updateWidgetMutation.mutateAsync({ widgetId, data });
        }}
      />

      {/* Share Dashboard Modal */}
      <ShareDashboardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        dashboard={dashboard}
        onUpdateVisibility={async (visibility) => {
          await updateVisibilityMutation.mutateAsync(visibility);
        }}
        onAddShare={async (userId, accessLevel) => {
          await shareMutation.mutateAsync({ userId, accessLevel });
        }}
        onRemoveShare={async (userId) => {
          await removeShareMutation.mutateAsync(userId);
        }}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 bg-rose-500/10 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Delete Dashboard?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete this custom dashboard? This will remove the
              dashboard widgets configuration. Underlying projects, tasks, and timesheets will
              NOT be affected.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(false)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold active:scale-95 cursor-pointer"
              >
                Delete Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
