'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Loader2, X, Calendar } from 'lucide-react';

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

  // Reset entire form when modal closes/opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId('');
      setTitle('');
      setDescription('');
      setStartDate('');
      setDueDate('');
      setStatus('PLANNED');
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
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4 max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center border-b border-slate-800 pb-3 flex-shrink-0">
          <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            Add Global Milestone
          </h4>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1 scrollbar-thin">
          {/* Project Selection */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Project *
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
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Milestone Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Beta Release 1.0"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the scope of this milestone..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Start Date & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Status
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

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-950 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMilestoneMutation.isPending}
              className="px-4.5 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5"
            >
              {createMilestoneMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Milestone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
