'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Flag,
  Calendar,
  Plus,
  Edit2,
  Archive,
  Loader2,
  AlertCircle,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Shield,
  User,
  Globe,
  Lock,
  X,
  Search,
  CheckCircle2,
  FolderPlus,
} from 'lucide-react';
import CreateTaskListModal from '@/components/create-task-list-modal';
import { useFormatDate } from '@/hooks/useFormatDate';

interface MilestonesTabProps {
  projectId: string;
  onOpenCreateTaskModal?: (milestoneId?: string) => void;
  autoOpenCreateModal?: boolean;
  onResetAutoOpenCreateModal?: () => void;
}

export default function MilestonesTab({
  projectId,
  onOpenCreateTaskModal,
  autoOpenCreateModal,
  onResetAutoOpenCreateModal,
}: MilestonesTabProps) {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const formatDate = useFormatDate();

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any | null>(null);
  const [activeMilestoneForTaskList, setActiveMilestoneForTaskList] = useState<any | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'PLANNED' | 'IN_PROGRESS' | 'ACHIEVED' | 'MISSED'>('PLANNED');
  const [flag, setFlag] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [ownerId, setOwnerId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Handle auto open create milestone modal if requested
  useEffect(() => {
    if (autoOpenCreateModal) {
      resetForm();
      setShowCreateModal(true);
      if (onResetAutoOpenCreateModal) {
        onResetAutoOpenCreateModal();
      }
    }
  }, [autoOpenCreateModal]);

  // Query: Project Details for Members
  const { data: projectDetails } = useQuery({
    queryKey: ['project-details-milestones-tab', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
  });
  const projectMembers = projectDetails?.members || [];

  // Query: Project Milestones
  const { data: milestones = [], isLoading: isLoadingMilestones } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/milestones`);
      return res.data;
    },
  });

  // Mutation: Create Milestone
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(`/projects/${projectId}/milestones`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to create milestone');
    },
  });

  // Mutation: Update Milestone
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.patch(`/milestones/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setEditingMilestone(null);
      resetForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to update milestone');
    },
  });

  // Mutation: Reorder Milestone position
  const reorderMutation = useMutation({
    mutationFn: async ({ id, position }: { id: string; position: number }) => {
      const res = await api.patch(`/milestones/${id}`, { position });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
    },
  });

  // Mutation: Archive Milestone
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/milestones/${id}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to archive milestone');
    },
  });

  const handleMoveMilestone = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= milestones.length) return;

    const updated = [...milestones];
    const movedItem = updated.splice(index, 1)[0];
    updated.splice(targetIndex, 0, movedItem);

    queryClient.setQueryData(['milestones', projectId], updated);

    updated.forEach((m: any, idx: number) => {
      reorderMutation.mutate({ id: m.id, position: idx });
    });
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartDate('');
    setDueDate('');
    setStatus('PLANNED');
    setFlag('INTERNAL');
    setOwnerId('');
    setErrorMsg(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title,
      description: description || undefined,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      status,
      flag,
      ownerId: ownerId || undefined,
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMilestone) return;
    updateMutation.mutate({
      id: editingMilestone.id,
      data: {
        title,
        description: description || null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        status,
        flag,
        ownerId: ownerId || null,
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
    setFlag(milestone.flag || 'INTERNAL');
    setOwnerId(milestone.ownerId || '');
    setErrorMsg(null);
  };

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

  const filteredMilestones = milestones.filter((ms: any) => {
    const matchesStatus = statusFilter === 'ALL' || ms.status === statusFilter;
    const titleMatch = ms.title.toLowerCase().includes(searchQuery.toLowerCase().trim());
    const descMatch = (ms.description || '').toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesStatus && (titleMatch || descMatch);
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/30 border border-slate-900 p-5 rounded-2xl">
        <div>
          <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
            <Flag className="w-5 h-5 text-indigo-400" />
            Project Milestones / Phases ({milestones.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Track major deliverables, phase targets, and task completion metrics
          </p>
        </div>

        {hasPermission('CREATE_MILESTONE') && (
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Milestone
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-950/40 border border-slate-900 p-4 rounded-xl">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {['ALL', 'PLANNED', 'IN_PROGRESS', 'ACHIEVED', 'MISSED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                statusFilter === st
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st === 'ALL' ? 'All Statuses' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="w-full md:w-72 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search milestones by title..."
            className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* Content */}
      {isLoadingMilestones ? (
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : milestones.length === 0 ? (
        <div className="bg-slate-900/10 border border-slate-900 rounded-3xl py-14 px-4 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
            <Flag className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="font-extrabold text-base text-slate-200">No Milestones Defined</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Milestones help you map deadlines, schedule phases, and track progress metrics. Create your first milestone to get started.
            </p>
          </div>
          {hasPermission('CREATE_MILESTONE') && (
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Milestone</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredMilestones.map((ms: any, index: number) => {
            const targetUrl = `/projects/${projectId}/milestones/${ms.id}`;
            const isExternal = ms.flag === 'EXTERNAL';
            const ownerName = ms.owner?.firstName
              ? `${ms.owner.firstName} ${ms.owner.lastName || ''}`
              : ms.owner?.email;

            return (
              <div
                key={ms.id}
                onClick={() => router.push(targetUrl)}
                className="bg-slate-900/30 border border-slate-900 hover:border-slate-800 hover:bg-slate-900/50 rounded-2xl p-5 sm:p-6 transition-all duration-200 cursor-pointer group flex flex-col lg:flex-row gap-5 items-start lg:items-center justify-between"
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Reorder Controls */}
                  {hasPermission('EDIT_MILESTONE') && milestones.length > 1 && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex flex-col gap-1 pt-0.5 shrink-0"
                    >
                      <button
                        disabled={index === 0}
                        onClick={() => handleMoveMilestone(index, 'up')}
                        className="p-1 rounded bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                        title="Move Milestone Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={index === milestones.length - 1}
                        onClick={() => handleMoveMilestone(index, 'down')}
                        className="p-1 rounded bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                        title="Move Milestone Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 group-hover:scale-105 transition-transform">
                        <Flag className="w-4 h-4" />
                      </div>
                      <Link
                        href={targetUrl}
                        onClick={(e) => e.stopPropagation()}
                        className="font-bold text-sm text-slate-100 group-hover:text-indigo-400 transition-colors truncate hover:underline"
                      >
                        {ms.title}
                      </Link>

                      {/* Status Badge */}
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getMilestoneStatusColor(ms.status)}`}>
                        {ms.status.replace('_', ' ')}
                      </span>

                      {/* Flag Badge (Internal vs External) */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold border ${
                          isExternal
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700/50'
                        }`}
                      >
                        {isExternal ? (
                          <>
                            <Globe className="w-3 h-3 text-amber-400" />
                            EXTERNAL
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-slate-400" />
                            INTERNAL
                          </>
                        )}
                      </span>
                    </div>

                    {ms.description && (
                      <p className="text-xs text-slate-400 leading-relaxed max-w-2xl line-clamp-2">
                        {ms.description}
                      </p>
                    )}

                    {/* Milestone Owner & Dates */}
                    <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center">
                      {ownerName && (
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <User className="w-3.5 h-3.5 text-indigo-400" />
                          Owner: <span className="text-slate-200">{ownerName}</span>
                        </span>
                      )}

                      {ms.startDate && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          Start: <span className="text-slate-350">{formatDate(ms.startDate)}</span>
                        </span>
                      )}

                      {ms.dueDate ? (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          Due: <span className="text-slate-350">{formatDate(ms.dueDate)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-600">No due date</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Indicator & Actions */}
                <div className="flex flex-row sm:flex-row lg:flex-col items-start lg:items-end justify-between w-full lg:w-auto gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-900/60">
                  <div className="space-y-1.5 w-full sm:w-48">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>Progress</span>
                      <span className="font-mono text-indigo-400 font-black">{ms.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 border border-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${ms.progress}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 text-right flex items-center justify-end gap-1.5">
                      {ms.taskLists && ms.taskLists.length > 0 && (
                        <span className="text-indigo-400 font-medium">
                          {ms.taskLists.length} list{ms.taskLists.length > 1 ? 's' : ''} •
                        </span>
                      )}
                      <span>{ms.completedTasks} / {ms.totalTasks} tasks done</span>
                    </div>
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2"
                  >
                    {hasPermission('CREATE_TASK') && (
                      <button
                        onClick={() => setActiveMilestoneForTaskList(ms)}
                        className="p-1.5 rounded-lg border border-transparent hover:border-indigo-500/30 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 active:scale-95 transition-all cursor-pointer"
                        title="Add Task List to Milestone"
                      >
                        <FolderPlus className="w-4 h-4" />
                      </button>
                    )}

                    {hasPermission('EDIT_MILESTONE') && (
                      <button
                        onClick={() => openEditModal(ms)}
                        className="p-1.5 rounded-lg border border-transparent hover:border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 active:scale-95 transition-all cursor-pointer"
                        title="Edit Milestone"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {hasPermission('ARCHIVE_MILESTONE') && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to archive this milestone? All linked tasks will be unlinked.')) {
                            archiveMutation.mutate(ms.id);
                          }
                        }}
                        disabled={archiveMutation.isPending}
                        className="p-1.5 rounded-lg border border-transparent hover:border-rose-900/20 text-slate-500 hover:text-rose-450 hover:bg-rose-500/5 active:scale-95 transition-all cursor-pointer"
                        title="Archive Milestone"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => window.open(targetUrl, '_blank')}
                      className="p-1.5 rounded-lg border border-slate-850 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 active:scale-95 transition-all cursor-pointer"
                      title="Open in New Window/Tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => router.push(targetUrl)}
                      className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Open Milestone</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE SLIDE-OVER DRAWER */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end transition-all">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Flag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100">Create Milestone / Phase</h2>
                  <p className="text-xs text-slate-400">Define milestone target, owner, and visibility flag</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3.5 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-200 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form Body (Scrollable) */}
            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Milestone Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Phase 1 Alpha Release"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    placeholder="Milestone goals, deliverables, or target details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                {/* Milestone Owner & Visibility Flag */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Milestone Owner */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      Milestone Owner
                    </label>
                    <select
                      value={ownerId}
                      onChange={(e) => setOwnerId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Unassigned</option>
                      {projectMembers.map((m: any) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.firstName
                            ? `${m.user.firstName} ${m.user.lastName || ''}`
                            : m.user.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Flag (Internal vs External) */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      Visibility Flag
                    </label>
                    <select
                      value={flag}
                      onChange={(e) => setFlag(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="INTERNAL">Internal (Team Only)</option>
                      <option value="EXTERNAL">External (Team & Client Users)</option>
                    </select>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Initial Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ACHIEVED">Achieved</option>
                    <option value="MISSED">Missed</option>
                  </select>
                </div>
              </div>

              {/* Pinned Bottom Footer */}
              <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SLIDE-OVER DRAWER */}
      {editingMilestone && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end transition-all">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Flag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100">Edit Milestone / Phase</h2>
                  <p className="text-xs text-slate-400 truncate max-w-xs">{editingMilestone.title}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingMilestone(null)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3.5 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-200 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form Body (Scrollable) */}
            <form onSubmit={handleUpdateSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Milestone Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Phase 1 Release"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    placeholder="Milestone goals or details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                {/* Milestone Owner & Visibility Flag */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Milestone Owner */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      Milestone Owner
                    </label>
                    <select
                      value={ownerId}
                      onChange={(e) => setOwnerId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Unassigned</option>
                      {projectMembers.map((m: any) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.firstName
                            ? `${m.user.firstName} ${m.user.lastName || ''}`
                            : m.user.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Flag (Internal vs External) */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      Visibility Flag
                    </label>
                    <select
                      value={flag}
                      onChange={(e) => setFlag(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="INTERNAL">Internal (Team Only)</option>
                      <option value="EXTERNAL">External (Team & Client Users)</option>
                    </select>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Milestone Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ACHIEVED">Achieved</option>
                    <option value="MISSED">Missed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingMilestone(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Task List for Milestone Modal */}
      {activeMilestoneForTaskList && (
        <CreateTaskListModal
          isOpen={!!activeMilestoneForTaskList}
          onClose={() => setActiveMilestoneForTaskList(null)}
          projectId={projectId}
          milestones={milestones}
          defaultMilestoneId={activeMilestoneForTaskList.id}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
            queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
            queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
          }}
        />
      )}

    </div>
  );
}
