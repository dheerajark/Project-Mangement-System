'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Flag,
  Calendar,
  Plus,
  Edit2,
  Archive,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Inbox,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

interface MilestonesTabProps {
  projectId: string;
}

export default function MilestonesTab({ projectId }: MilestonesTabProps) {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Expanded milestones states
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'PLANNED' | 'IN_PROGRESS' | 'ACHIEVED' | 'MISSED'>('PLANNED');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Query: Project Milestones
  const { data: milestones = [], isLoading: isLoadingMilestones } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/milestones`);
      return res.data;
    },
  });

  // Query: Tasks (to show tasks inside milestones)
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/tasks`);
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

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartDate('');
    setDueDate('');
    setStatus('PLANNED');
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

  const toggleExpand = (id: string) => {
    setExpandedMilestones((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
    <div className="space-y-6">
      {/* Tab Control / Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-200">Milestone Progress Tracking</h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Group tasks into key project milestones and track deliverables status.
          </p>
        </div>

        {hasPermission('CREATE_MILESTONE') && (
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="w-full sm:w-auto px-4.5 py-2.5 bg-indigo-650 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-650/15"
          >
            <Plus className="w-4 h-4" />
            Add Milestone
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoadingMilestones ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : milestones.length === 0 ? (
        <div className="bg-slate-900/10 border border-slate-900 rounded-2xl py-14 px-4 flex flex-col items-center justify-center text-center">
          <div className="p-4 bg-slate-900/50 border border-slate-850 rounded-2xl text-slate-500 mb-4">
            <Flag className="w-8 h-8" />
          </div>
          <h4 className="font-bold text-sm text-slate-300">No Milestones Defined</h4>
          <p className="text-xs text-slate-500 mt-1.5 max-w-sm">
            Milestones help you map deadlines, schedule versions, and track progress metrics. Create your first milestone to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {milestones.map((ms: any) => {
            const isExpanded = !!expandedMilestones[ms.id];
            // Filter project tasks associated with this milestone
            const milestoneTasks = tasks.filter((t: any) => t.milestoneId === ms.id);
            
            return (
              <div
                key={ms.id}
                className="bg-slate-900/30 border border-slate-900 hover:border-slate-850 rounded-2xl overflow-hidden transition-all duration-200"
              >
                {/* Milestone Summary Header Card */}
                <div className="p-5 sm:p-6 flex flex-col lg:flex-row gap-5 items-start lg:items-center justify-between">
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="p-1.5 bg-indigo-550/10 border border-indigo-500/10 rounded-lg text-indigo-400">
                        <Flag className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-sm text-slate-100 truncate">{ms.title}</h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getMilestoneStatusColor(ms.status)}`}>
                        {ms.status.replace('_', ' ')}
                      </span>
                    </div>

                    {ms.description && (
                      <p className="text-xs text-slate-400 leading-relaxed max-w-2xl line-clamp-2">
                        {ms.description}
                      </p>
                    )}

                    {/* Timeline dates */}
                    <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {ms.startDate && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          Start: <span className="text-slate-350">{new Date(ms.startDate).toLocaleDateString()}</span>
                        </span>
                      )}
                      {ms.dueDate ? (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          Due: <span className="text-slate-350">{new Date(ms.dueDate).toLocaleDateString()}</span>
                        </span>
                      ) : (
                        <span className="text-slate-600">No due date</span>
                      )}
                    </div>
                  </div>

                  {/* Progress Indicator and Action Controls */}
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
                      <div className="text-[9px] text-slate-500 text-right">
                        {ms.completedTasks} / {ms.totalTasks} tasks done
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasPermission('EDIT_MILESTONE') && (
                        <button
                          onClick={() => openEditModal(ms)}
                          className="p-1.5 rounded-lg border border-transparent hover:border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 active:scale-95 transition-all"
                          title="Edit Milestone"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}

                      {hasPermission('ARCHIVE_MILESTONE') && (
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to archive this milestone? All linked tasks will be unlinked, and historical timeline logs will record this action.')) {
                              archiveMutation.mutate(ms.id);
                            }
                          }}
                          disabled={archiveMutation.isPending}
                          className="p-1.5 rounded-lg border border-transparent hover:border-rose-900/20 text-slate-500 hover:text-rose-450 hover:bg-rose-500/5 active:scale-95 transition-all"
                          title="Archive Milestone"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => toggleExpand(ms.id)}
                        className="p-1.5 rounded-lg border border-transparent hover:border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 active:scale-95 transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                      >
                        Tasks
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable associated tasks section */}
                {isExpanded && (
                  <div className="border-t border-slate-900/80 bg-slate-950/20 p-5 space-y-3">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Inbox className="w-3.5 h-3.5 text-slate-500" /> Linked Deliverables ({milestoneTasks.length})
                    </h5>

                    {milestoneTasks.length === 0 ? (
                      <div className="text-slate-650 text-xs italic py-2">
                        No tasks currently linked to this milestone. Assign tasks to this milestone from the task detail drawer.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {milestoneTasks.map((t: any) => (
                          <div
                            key={t.id}
                            className="bg-slate-950/50 border border-slate-900/60 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[9px] font-bold bg-slate-950 border border-slate-850 px-1.5 py-0.5 rounded text-indigo-400">
                                  {t.taskNumber}
                                </span>
                                <span className="font-bold text-slate-200 truncate">{t.title}</span>
                              </div>
                              {t.assignee && (
                                <div className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                                  <span>Assignee:</span>
                                  <span className="text-slate-400">
                                    {t.assignee.firstName ? `${t.assignee.firstName} ${t.assignee.lastName || ''}` : t.assignee.email}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${getTaskStatusBadgeColor(t.status)}`}>
                              {t.status.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-slate-250 flex items-center gap-2">
                <Flag className="w-4 h-4 text-indigo-400" /> Create Milestone
              </h4>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-850 transition-all"
              >
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-950/40 border border-rose-900 text-rose-200 text-xs p-3.5 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-450 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Phase 1 Release"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Milestone release details..."
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
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-900 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-slate-250 flex items-center gap-2">
                <Flag className="w-4 h-4 text-indigo-400" /> Edit Milestone
              </h4>
              <button
                onClick={() => setEditingMilestone(null)}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-850 transition-all"
              >
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-950/40 border border-rose-900 text-rose-200 text-xs p-3.5 rounded-xl flex items-start gap-2">
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
                  placeholder="e.g. Phase 1 Release"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Milestone release details..."
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
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5"
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
