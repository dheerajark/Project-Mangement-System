'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  Calendar,
  Plus,
  Loader2,
  Sliders,
  LogOut,
  Settings,
  Search,
  Flag,
  Edit2,
  Archive,
  AlertCircle,
} from 'lucide-react';
import GlobalMilestoneModal from '@/components/global-milestone-modal';
import NotificationBell from '@/components/notification-bell';
import Header from '@/components/header';
import Link from 'next/link';
import { useFormatDate } from '@/hooks/useFormatDate';

export default function MilestonesPage() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const customFormatDate = useFormatDate();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Dropdown filter states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchText, setSearchText] = useState('');

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any | null>(null);

  // Form states for Editing Milestone
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'PLANNED' | 'IN_PROGRESS' | 'ACHIEVED' | 'MISSED'>('PLANNED');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Queries: All Milestones with filters
  const { data: milestones = [], isLoading: isLoadingMilestones } = useQuery({
    queryKey: [
      'global-milestones',
      selectedProjectId,
      selectedStatus,
      searchText,
    ],
    queryFn: async () => {
      const params: any = {};
      if (selectedProjectId) params.projectId = selectedProjectId;
      if (selectedStatus) params.status = selectedStatus;
      if (searchText.trim()) params.search = searchText.trim();

      const res = await api.get('/milestones', { params });
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // Mutation: Update Milestone
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.patch(`/milestones/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      setEditingMilestone(null);
      resetForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to update milestone');
    },
  });

  // Mutation: Archive Milestone
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/milestones/${id}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to archive milestone');
    },
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartDate('');
    setDueDate('');
    setStatus('PLANNED');
    setErrorMsg(null);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMilestone) return;
    if (!title.trim()) return;

    updateMutation.mutate({
      id: editingMilestone.id,
      data: {
        title: title.trim(),
        description: description.trim() || null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        status,
      },
    });
  };

  const openEditModal = (milestone: any) => {
    setEditingMilestone(milestone);
    setTitle(milestone.title);
    setDescription(milestone.description || '');
    setStartDate(milestone.startDate ? milestone.startDate.split('T')[0] : '');
    setDueDate(milestone.dueDate ? milestone.dueDate.split('T')[0] : '');
    setStatus(milestone.status);
    setErrorMsg(null);
  };

  const handleLogout = async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  // Status aggregation calculations
  const totalCount = milestones.length;
  const plannedCount = milestones.filter((m: any) => m.status === 'PLANNED').length;
  const inProgressCount = milestones.filter((m: any) => m.status === 'IN_PROGRESS').length;
  const achievedCount = milestones.filter((m: any) => m.status === 'ACHIEVED').length;
  const missedCount = milestones.filter((m: any) => m.status === 'MISSED').length;

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
        return 'bg-slate-700 text-slate-350 border border-slate-650';
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return customFormatDate(date);
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-955 flex flex-col text-slate-100">
      {/* Header */}
      <Header title="Milestones Dashboard" subtitle="Milestones Portal" />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Status Metrics Section */}
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total Milestones</span>
            <div className="font-mono text-xl font-bold text-indigo-400 mt-1">{totalCount}</div>
          </div>
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Planned</span>
            <div className="font-mono text-xl font-bold text-slate-400 mt-1">{plannedCount}</div>
          </div>
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-semibold">In Progress</span>
            <div className="font-mono text-xl font-bold text-blue-400 mt-1">{inProgressCount}</div>
          </div>
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Achieved</span>
            <div className="font-mono text-xl font-bold text-emerald-400 mt-1">{achievedCount}</div>
          </div>
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Missed</span>
            <div className="font-mono text-xl font-bold text-rose-400 mt-1">{missedCount}</div>
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
                placeholder="Search milestones by title..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Create Button */}
            {hasPermission('CREATE_MILESTONE') && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4.5 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-650/15 cursor-pointer self-start md:self-auto"
              >
                <Plus className="w-4 h-4" /> Add Milestone
              </button>
            )}
          </div>

          <div className="h-px bg-slate-900/60 w-full" />

          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
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

            {/* Status Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ACHIEVED">Achieved</option>
                <option value="MISSED">Missed</option>
              </select>
            </div>
          </div>
        </section>

        {/* Milestones Grid */}
        <section>
          {isLoadingMilestones ? (
            <div className="py-16 flex flex-col justify-center items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-400">Loading milestones...</span>
            </div>
          ) : milestones.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {milestones.map((ms: any) => (
                <div
                  key={ms.id}
                  className="bg-slate-900/30 border border-slate-900 hover:border-slate-850 hover:bg-slate-900/50 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between space-y-4 group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-[20%] h-[20%] rounded-full bg-indigo-500/[0.01] group-hover:bg-indigo-500/[0.03] blur-[25px] transition-all" />

                  {/* Header Row: Title and status */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-slate-955/40 border border-slate-800/50 rounded text-slate-400 shrink-0">
                          <Flag className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                        </div>
                        <h4 className="font-extrabold text-xs text-slate-100 leading-snug group-hover:text-indigo-300 transition-colors truncate" title={ms.title}>
                          {ms.title}
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium truncate max-w-[150px] ml-7" title={ms.project?.name}>
                        {ms.project?.name}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase shrink-0 tracking-wider ${getMilestoneStatusColor(ms.status)}`}>
                      {ms.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Description Row */}
                  {ms.description && (
                    <p className="text-[10px] text-slate-450 line-clamp-2 leading-relaxed ml-7">
                      {ms.description}
                    </p>
                  )}

                  {/* Dates Row */}
                  <div className="flex flex-wrap gap-4 text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-7">
                    {ms.startDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        Start: <span className="text-slate-350">{formatDate(ms.startDate)}</span>
                      </span>
                    )}
                    {ms.dueDate ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        Due: <span className="text-slate-350">{formatDate(ms.dueDate)}</span>
                      </span>
                    ) : (
                      <span className="text-slate-650">No due date</span>
                    )}
                  </div>

                  {/* Progress Row */}
                  <div className="space-y-1.5 ml-7 pt-3.5 border-t border-slate-900/60">
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>Progress</span>
                      <span className="font-mono text-indigo-400 font-black">{ms.progress}%</span>
                    </div>
                    <div className="w-full h-1 bg-slate-950 border border-slate-900/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${ms.progress}%` }}
                      />
                    </div>
                    <div className="text-[8px] text-slate-500 text-right">
                      {ms.completedTasks} / {ms.totalTasks} tasks done
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-900/30">
                    {hasPermission('EDIT_MILESTONE') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(ms);
                        }}
                        className="p-1.5 rounded-lg border border-transparent hover:border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 active:scale-95 transition-all"
                        title="Edit Milestone"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {hasPermission('ARCHIVE_MILESTONE') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to archive this milestone? All linked tasks will be unlinked.')) {
                            archiveMutation.mutate(ms.id);
                          }
                        }}
                        disabled={archiveMutation.isPending}
                        className="p-1.5 rounded-lg border border-transparent hover:border-rose-900/20 text-slate-500 hover:text-rose-450 hover:bg-rose-500/5 active:scale-95 transition-all"
                        title="Archive Milestone"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-905 border border-slate-900 rounded-2xl">
              <Flag className="w-12 h-12 text-slate-700 mx-auto mb-3.5" />
              <h3 className="text-sm font-bold text-slate-250">No milestones found</h3>
              <p className="text-xs text-slate-500 mt-1">Adjust filters or create a new milestone to get started.</p>
            </div>
          )}
        </section>
      </main>

      {/* Global Create Modal */}
      <GlobalMilestoneModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Global Edit Modal */}
      {editingMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-slate-250 flex items-center gap-2">
                <Flag className="w-4 h-4 text-indigo-400" /> Edit Milestone
              </h4>
              <button
                onClick={() => setEditingMilestone(null)}
                className="text-slate-500 hover:text-slate-350 p-1.5 rounded-lg hover:bg-slate-850 transition-all font-semibold text-lg"
              >
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-950/40 border border-rose-905 text-rose-200 text-xs p-3.5 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-450 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Beta Release 1.0"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Explain the scope of this milestone..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
                  <input
                     type="date"
                     value={startDate}
                     onChange={(e) => setStartDate(e.target.value)}
                     className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="PLANNED">Planned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="ACHIEVED">Achieved</option>
                  <option value="MISSED">Missed</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMilestone(null)}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-900 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4.5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
