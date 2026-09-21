'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Loader2, X, AlertTriangle } from 'lucide-react';

interface GlobalIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GlobalIssueModal({ isOpen, onClose, onSuccess }: GlobalIssueModalProps) {
  const queryClient = useQueryClient();

  // Form states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'BUG' | 'FEATURE_REQUEST' | 'IMPROVEMENT' | 'SUPPORT'>('BUG');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [environment, setEnvironment] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [taskId, setTaskId] = useState('');

  // Fetch active projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isOpen,
  });

  const activeProjects = projects.filter(
    (p: any) => p.status !== 'ARCHIVED' && p.settings?.allowIssueTracking !== false
  );

  // Fetch project details for members
  const { data: projectDetails, isLoading: isLoadingProjectDetails } = useQuery({
    queryKey: ['project-details-global-issue-modal', selectedProjectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${selectedProjectId}`);
      return res.data;
    },
    enabled: isOpen && !!selectedProjectId,
  });

  // Fetch project tasks to link
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks-global-issue-modal', selectedProjectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${selectedProjectId}/tasks`);
      return res.data;
    },
    enabled: isOpen && !!selectedProjectId,
  });

  // Reset dependent fields when project changes
  useEffect(() => {
    setAssigneeId('');
    setTaskId('');
  }, [selectedProjectId]);

  // Reset entire form when modal closes/opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId('');
      setTitle('');
      setDescription('');
      setType('BUG');
      setPriority('MEDIUM');
      setSeverity('MEDIUM');
      setEnvironment('');
      setReproductionSteps('');
      setAssigneeId('');
      setTaskId('');
    }
  }, [isOpen]);

  const reportIssueMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(`/projects/${selectedProjectId}/issues`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-issues'] });
      queryClient.invalidateQueries({ queryKey: ['project-issues'] });
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] });
      }
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to report issue');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert('Please select a project.');
      return;
    }
    if (!title.trim()) {
      alert('Please enter an issue title.');
      return;
    }

    reportIssueMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      type,
      priority,
      severity,
      environment: environment.trim() || null,
      reproductionSteps: reproductionSteps.trim() || null,
      assigneeId: assigneeId || null,
      taskId: taskId || null,
    });
  };

  if (!isOpen) return null;

  const projectMembers = projectDetails?.members || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4 h-full flex flex-col animate-in slide-in-from-right duration-300">
        <header className="flex justify-between items-center border-b border-slate-800 pb-3 flex-shrink-0">
          <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Report Global Issue
          </h4>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
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

            {/* Issue Title */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Issue Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g., Production API returns 500 error on payment webhook"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Detailed explanation, impact analysis, or expected vs actual behavior..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Type & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="BUG">Bug</option>
                  <option value="FEATURE_REQUEST">Feature Request</option>
                  <option value="IMPROVEMENT">Improvement</option>
                  <option value="SUPPORT">Support</option>
                </select>
              </div>

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
            </div>

            {/* Severity & Assignee */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Severity
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
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
                  Assignee
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={!selectedProjectId || isLoadingProjectDetails}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map((m: any) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.firstName ? `${m.user.firstName} ${m.user.lastName || ''}` : m.user.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Environment */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Environment
              </label>
              <input
                type="text"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                placeholder="E.g., Production, Staging, Safari 17, iOS 17.2"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Steps to Reproduce */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Steps to Reproduce
              </label>
              <textarea
                value={reproductionSteps}
                onChange={(e) => setReproductionSteps(e.target.value)}
                rows={3}
                placeholder="1. Go to checkout page&#10;2. Enter valid card detail&#10;3. Click pay now button"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none font-mono text-[11px]"
              />
            </div>

            {/* Linked Task */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Linked Task (Optional)
              </label>
              {isLoadingTasks ? (
                <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Loading project tasks...</span>
                </div>
              ) : (
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  disabled={!selectedProjectId}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">None</option>
                  {tasks.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {projectDetails?.projectCode}-{t.taskNumber} ({t.title})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Fixed Footer at drawer bottom */}
          <div className="flex justify-end gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-950 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-400 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reportIssueMutation.isPending}
              className="px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-500/20"
            >
              {reportIssueMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Report Issue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
