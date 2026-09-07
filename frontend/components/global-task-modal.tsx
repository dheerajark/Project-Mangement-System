'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Loader2, X, CheckSquare } from 'lucide-react';

interface GlobalTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GlobalTaskModal({ isOpen, onClose, onSuccess }: GlobalTaskModalProps) {
  const queryClient = useQueryClient();

  // Form states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [type, setType] = useState<'TASK' | 'BUG' | 'STORY' | 'IMPROVEMENT'>('TASK');
  const [assigneeId, setAssigneeId] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [milestoneId, setMilestoneId] = useState('');

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

  // Fetch project details for members
  const { data: projectDetails, isLoading: isLoadingProjectDetails } = useQuery({
    queryKey: ['project-details-global-modal', selectedProjectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${selectedProjectId}`);
      return res.data;
    },
    enabled: isOpen && !!selectedProjectId,
  });

  // Fetch milestones
  const { data: milestones = [], isLoading: isLoadingMilestones } = useQuery({
    queryKey: ['milestones-global-modal', selectedProjectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${selectedProjectId}/milestones`);
      return res.data;
    },
    enabled: isOpen && !!selectedProjectId,
  });

  // Reset dependent fields when project changes
  useEffect(() => {
    setAssigneeId('');
    setMilestoneId('');
  }, [selectedProjectId]);

  // Reset entire form when modal closes/opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId('');
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setType('TASK');
      setAssigneeId('');
      setEstimatedHours('');
      setDueDate('');
      setMilestoneId('');
    }
  }, [isOpen]);

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/tasks', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
        queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] });
        queryClient.invalidateQueries({ queryKey: ['board', selectedProjectId] });
      }
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to create task');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert('Please select a project.');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a task title.');
      return;
    }

    const estHrsVal = estimatedHours ? parseFloat(estimatedHours) : null;

    createTaskMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      type,
      assigneeId: assigneeId || null,
      estimatedHours: estHrsVal,
      dueDate: dueDate || null,
      projectId: selectedProjectId,
      milestoneId: milestoneId || null,
    });
  };

  if (!isOpen) return null;

  const projectMembers = projectDetails?.members || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4 max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center border-b border-slate-800 pb-3 flex-shrink-0">
          <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-400" />
            Create Global Task
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

          {/* Task Title */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement API route"
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
              placeholder="Provide context or instructions..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Priority & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="TASK">Task</option>
                <option value="BUG">Bug</option>
                <option value="STORY">Story</option>
                <option value="IMPROVEMENT">Improvement</option>
              </select>
            </div>
          </div>

          {/* Assignee & Milestone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Assignee
              </label>
              {isLoadingProjectDetails ? (
                <div className="text-[10px] text-slate-550 py-2">Loading members...</div>
              ) : (
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={!selectedProjectId}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map((m: any) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.firstName ? `${m.user.firstName} ${m.user.lastName || ''}` : m.user.email}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Milestone
              </label>
              {isLoadingMilestones ? (
                <div className="text-[10px] text-slate-550 py-2">Loading milestones...</div>
              ) : (
                <select
                  value={milestoneId}
                  onChange={(e) => setMilestoneId(e.target.value)}
                  disabled={!selectedProjectId}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">None</option>
                  {milestones.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Estimates & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Estimate (Hours)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="0.0"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
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
              disabled={createTaskMutation.isPending}
              className="px-4.5 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5"
            >
              {createTaskMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
