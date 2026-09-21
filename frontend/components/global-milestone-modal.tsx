'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Loader2, X, Calendar, Flag, Shield, User } from 'lucide-react';

interface GlobalMilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GlobalMilestoneModal({ isOpen, onClose, onSuccess }: GlobalMilestoneModalProps) {
  const queryClient = useQueryClient();

  // Form states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'PLANNED' | 'IN_PROGRESS' | 'ACHIEVED' | 'MISSED'>('PLANNED');
  const [flag, setFlag] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [ownerId, setOwnerId] = useState('');

  // Fetch active projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isOpen,
  });

  const activeProjects = projects.filter((p: any) => p.status !== 'ARCHIVED');

  // Fetch project details for members when project selected
  const { data: projectDetails, isLoading: isLoadingProjectDetails } = useQuery({
    queryKey: ['project-details-global-milestone-modal', selectedProjectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${selectedProjectId}`);
      return res.data;
    },
    enabled: isOpen && !!selectedProjectId,
  });

  const projectMembers = projectDetails?.members || [];

  // Reset entire form when modal closes/opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId('');
      setTitle('');
      setDescription('');
      setStartDate('');
      setDueDate('');
      setStatus('PLANNED');
      setFlag('INTERNAL');
      setOwnerId('');
    }
  }, [isOpen]);

  const createMilestoneMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(`/projects/${selectedProjectId}/milestones`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: ['milestones', selectedProjectId] });
        queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] });
      }
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to create milestone');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert('Please select a project.');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a milestone title.');
      return;
    }

    createMilestoneMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      status,
      flag,
      ownerId: ownerId || null,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end transition-all">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Add Global Milestone / Phase</h2>
              <p className="text-xs text-slate-400">Define milestone target, owner, and visibility flag across any project</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Project Selection */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Target Project <span className="text-rose-400">*</span>
              </label>
              {isLoadingProjects ? (
                <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Loading projects...</span>
                </div>
              ) : (
                <select
                  required
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select Project</option>
                  {activeProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.projectCode})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Milestone Title */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Milestone Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Phase 1 Beta Release"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the goals, deliverables, or target details of this milestone..."
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
                  disabled={!selectedProjectId || isLoadingProjectDetails}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Start Date & Due Date */}
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

          {/* Pinned Bottom Footer (Always Fixed at Bottom) */}
          <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMilestoneMutation.isPending}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              {createMilestoneMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Milestone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
