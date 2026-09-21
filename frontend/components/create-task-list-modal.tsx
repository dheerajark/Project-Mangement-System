'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  X,
  Plus,
  Loader2,
  FolderPlus,
  Flag,
  Lock,
  Globe,
  Layers,
  AlertCircle,
  CopyPlus,
} from 'lucide-react';

interface CreateTaskListModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  milestones: any[];
  defaultMilestoneId?: string;
  onSuccess?: (newTaskList: any) => void;
}

export default function CreateTaskListModal({
  isOpen,
  onClose,
  projectId,
  milestones = [],
  defaultMilestoneId,
  onSuccess,
}: CreateTaskListModalProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [milestoneId, setMilestoneId] = useState(defaultMilestoneId || '');
  const [flag, setFlag] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [status, setStatus] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedMilestone = milestones.find((m: any) => m.id === milestoneId);
  const { data: templates = [] } = useQuery({
    queryKey: ['task-list-templates'],
    queryFn: async () => (await api.get('/task-list-templates')).data,
    enabled: isOpen,
  });

  React.useEffect(() => {
    if (isOpen) {
      const initialMilestoneId = defaultMilestoneId || '';
      setMilestoneId(initialMilestoneId);
      const initialMilestone = milestones.find((m: any) => m.id === initialMilestoneId);
      if (initialMilestone && initialMilestone.flag) {
        setFlag(initialMilestone.flag);
      } else {
        setFlag('INTERNAL');
      }
      setError(null);
    }
  }, [isOpen, defaultMilestoneId, milestones]);

  const handleMilestoneChange = (newMilestoneId: string) => {
    setMilestoneId(newMilestoneId);
    const m = milestones.find((item: any) => item.id === newMilestoneId);
    if (m && m.flag) {
      setFlag(m.flag);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = payload.templateId
        ? await api.post(`/projects/${projectId}/task-list-templates/${payload.templateId}/apply`, { milestoneId: payload.milestoneId || undefined })
        : await api.post(`/projects/${projectId}/task-lists`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setName('');
      setDescription('');
      setMilestoneId('');
      setFlag('INTERNAL');
      setStatus('ACTIVE');
      setTemplateId('');
      setError(null);
      if (onSuccess) onSuccess(data);
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to create task list');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId && !name.trim()) {
      setError('Task list name is required');
      return;
    }
    setError(null);
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      milestoneId: milestoneId || undefined,
      flag,
      status,
      templateId: templateId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Create Task List</h3>
              <p className="text-[11px] text-slate-400">Group tasks into sprints, milestones, or work phases</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Task List Name */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start from Template (Optional)</label>
              <div className="relative">
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs cursor-pointer appearance-none">
                  <option value="">Blank task list</option>
                  {templates.map((template: any) => <option key={template.id} value={template.id}>{template.name} ({Array.isArray(template.tasks) ? template.tasks.length : 0} tasks)</option>)}
                </select>
                <CopyPlus className="w-3.5 h-3.5 text-violet-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {templateId && <p className="text-[10px] text-slate-500">The saved tasks and subtasks will be added. Assignees are not copied.</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Task List Name *
              </label>
              <input
                type="text"
                required={!templateId}
                disabled={!!templateId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={templateId ? 'Template name will be used' : 'e.g. Planning & Discovery, Sprint 1, UI Components...'}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs disabled:opacity-50"
              />
            </div>

            {/* Related Milestone */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Associate with Milestone (Optional)
              </label>
              <div className="relative">
                <select
                  value={milestoneId}
                  onChange={(e) => handleMilestoneChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs cursor-pointer appearance-none"
                >
                  <option value="">None / General Task List</option>
                  {milestones.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.flag ? m.flag.toLowerCase() : 'internal'}, {m.status})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <Flag className="w-3.5 h-3.5 text-amber-400" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                Tasks inside this list will contribute to the selected milestone's completion.
              </p>
            </div>

            {/* Flag / Visibility (Internal vs External) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Visibility Flag *
                </label>
                {selectedMilestone && (
                  <span className="text-[10px] text-amber-400/90 font-medium flex items-center gap-1">
                    Inherited from milestone ({selectedMilestone.flag})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!!selectedMilestone}
                  onClick={() => setFlag('INTERNAL')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                    selectedMilestone ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    flag === 'INTERNAL'
                      ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-300 ring-1 ring-indigo-500/20'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Lock className="w-4 h-4 mt-0.5 text-indigo-400 flex-shrink-0" />
                  <div>
                    <span className="block text-xs font-bold">Internal</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Visible only to your team members
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!!selectedMilestone}
                  onClick={() => setFlag('EXTERNAL')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                    selectedMilestone ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    flag === 'EXTERNAL'
                      ? 'bg-emerald-600/10 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/20'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Globe className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="block text-xs font-bold">External</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Visible to both team & client users
                    </span>
                  </div>
                </button>
              </div>

              {selectedMilestone && (
                <p className="text-[10px] text-slate-500 italic">
                  In Zoho Projects, task lists associated with a milestone strictly inherit the milestone's visibility flag ({selectedMilestone.flag.toLowerCase()}).
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Description (Optional)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add notes, goals, or instructions for this task list..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs resize-none"
              />
            </div>
          </div>

          {/* Footer with Pinned Buttons */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-all cursor-pointer active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || (!templateId && !name.trim())}
              className="px-4.5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>{templateId ? 'Apply Template' : 'Create Task List'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
