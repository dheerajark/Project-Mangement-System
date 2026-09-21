'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  X,
  Check,
  Loader2,
  FolderEdit,
  Flag,
  Lock,
  Globe,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FolderInput,
} from 'lucide-react';

interface EditTaskListModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskList: any;
  projectId: string;
  milestones: any[];
}

export default function EditTaskListModal({
  isOpen,
  onClose,
  taskList,
  projectId,
  milestones = [],
}: EditTaskListModalProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [targetProjectId, setTargetProjectId] = useState(projectId);
  const [flag, setFlag] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [status, setStatus] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [resolveOpenTasks, setResolveOpenTasks] = useState<'MARK_DONE' | 'MOVE' | 'DELETE' | 'KEEP'>('MARK_DONE');
  const [targetTaskListId, setTargetTaskListId] = useState<string>('');
  const [deleteTaskAction, setDeleteTaskAction] = useState<'keep' | 'delete'>('keep');
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Fetch projects for cross-project relocation
  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isOpen,
  });

  // Fetch task lists in current project for relocation target
  const { data: projectTaskLists = [] } = useQuery({
    queryKey: ['task-lists', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/task-lists`);
      return res.data;
    },
    enabled: isOpen,
  });

  const availableProjects = (Array.isArray(allProjects) ? allProjects : []).filter(
    (p: any) => p.status !== 'ARCHIVED'
  );

  useEffect(() => {
    if (taskList) {
      setName(taskList.name || '');
      setDescription(taskList.description || '');
      setMilestoneId(taskList.milestoneId || '');
      setTargetProjectId(taskList.projectId || projectId);
      setFlag(taskList.flag || 'INTERNAL');
      setStatus(taskList.status || 'ACTIVE');
      setResolveOpenTasks('MARK_DONE');
      setTargetTaskListId('');
      setDeleteTaskAction('keep');
      setError(null);
      setIsConfirmingDelete(false);
    }
  }, [taskList, projectId]);

  const isMovingProject = targetProjectId !== projectId;
  const selectedMilestone = milestones.find((m: any) => m.id === milestoneId);

  const handleMilestoneChange = (newMilestoneId: string) => {
    setMilestoneId(newMilestoneId);
    const m = milestones.find((item: any) => item.id === newMilestoneId);
    if (m && m.flag) {
      setFlag(m.flag);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.patch(`/task-lists/${taskList.id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestone'] });
      if (isMovingProject) {
        queryClient.invalidateQueries({ queryKey: ['task-lists', targetProjectId] });
        queryClient.invalidateQueries({ queryKey: ['tasks', targetProjectId] });
        queryClient.invalidateQueries({ queryKey: ['project', targetProjectId] });
        queryClient.invalidateQueries({ queryKey: ['milestones', targetProjectId] });
      }
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to update task list');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const shouldUnassign = deleteTaskAction === 'keep';
      const res = await api.delete(`/task-lists/${taskList.id}?unassignTasks=${shouldUnassign}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestone'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to delete task list');
    },
  });

  if (!isOpen || !taskList) return null;

  const openTasksCount = Math.max(0, (taskList?.totalTasks || 0) - (taskList?.completedTasks || 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Task list name is required');
      return;
    }
    setError(null);
    const payload: any = {
      name: name.trim(),
      description: description.trim() || undefined,
      status,
    };
    if (status === 'COMPLETED' && taskList.status === 'ACTIVE' && openTasksCount > 0) {
      payload.resolveOpenTasks = resolveOpenTasks;
      if (resolveOpenTasks === 'MOVE') {
        payload.targetTaskListId = targetTaskListId || null;
      }
    }
    if (isMovingProject) {
      payload.targetProjectId = targetProjectId;
    } else {
      payload.milestoneId = milestoneId || null;
      payload.flag = flag;
    }
    updateMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <FolderEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Edit Task List</h3>
              <p className="text-[11px] text-slate-400">Update configuration, milestone, or visibility</p>
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

        {/* Body */}
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
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Task List Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
              />
            </div>

            {/* Relocate / Move to Project */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Project
              </label>
              <div className="relative">
                <select
                  value={targetProjectId}
                  onChange={(e) => setTargetProjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs cursor-pointer appearance-none"
                >
                  {availableProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.id === projectId ? '(Current Project)' : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <FolderInput className="w-3.5 h-3.5 text-indigo-400" />
                </div>
              </div>

              {isMovingProject && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-amber-300 text-[11px] leading-relaxed mt-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    Moving to another project will detach this task list from the current milestone and transfer all member tasks. Assignees not in the target project will be unassigned.
                  </span>
                </div>
              )}
            </div>

            {/* Related Milestone */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Associated Milestone
              </label>
              <div className="relative">
                <select
                  disabled={isMovingProject}
                  value={isMovingProject ? '' : milestoneId}
                  onChange={(e) => handleMilestoneChange(e.target.value)}
                  className={`w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs appearance-none ${
                    isMovingProject ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
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
              {!isMovingProject && taskList.milestoneId !== (milestoneId || null) && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-amber-300 text-[11px] leading-relaxed mt-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    Moving this task list will also move all of its active tasks to the selected milestone (or unlink them if "None" is chosen), keeping milestone deliverables synchronized.
                  </span>
                </div>
              )}
            </div>

            {/* Status Selector (ACTIVE vs COMPLETED) */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Task List Status
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('ACTIVE')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    status === 'ACTIVE'
                      ? 'bg-blue-600/10 border-blue-500/40 text-blue-300 ring-1 ring-blue-500/20'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400 mt-1.5" />
                  <div>
                    <span className="block text-xs font-bold">Active</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Tasks in progress</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('COMPLETED')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    status === 'COMPLETED'
                      ? 'bg-emerald-600/10 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/20'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="block text-xs font-bold">Completed</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Mark phase as done</span>
                  </div>
                </button>
              </div>

              {/* Zoho-style open tasks resolution when switching to COMPLETED */}
              {status === 'COMPLETED' && taskList.status === 'ACTIVE' && openTasksCount > 0 && (
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5 animate-in fade-in duration-150 mt-2">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Resolve {openTasksCount} Incomplete Task(s)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Choose how to handle open tasks when completing this task list:
                  </p>
                  <div className="space-y-1.5 pt-1 text-xs">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="resolveOpenTasksEdit"
                        checked={resolveOpenTasks === 'MARK_DONE'}
                        onChange={() => setResolveOpenTasks('MARK_DONE')}
                        className="text-emerald-500 cursor-pointer"
                      />
                      <span>Mark all open tasks as complete (100% progress)</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="resolveOpenTasksEdit"
                        checked={resolveOpenTasks === 'MOVE'}
                        onChange={() => setResolveOpenTasks('MOVE')}
                        className="text-blue-500 cursor-pointer"
                      />
                      <span>Move open tasks to another task list or General Tasks</span>
                    </label>
                    {resolveOpenTasks === 'MOVE' && (
                      <div className="pl-5 pt-1">
                        <select
                          value={targetTaskListId}
                          onChange={(e) => setTargetTaskListId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                        >
                          <option value="">General / Unassigned Tasks</option>
                          {(Array.isArray(projectTaskLists) ? projectTaskLists : [])
                            .filter((tl: any) => tl.id !== taskList.id && tl.status !== 'COMPLETED')
                            .map((tl: any) => (
                              <option key={tl.id} value={tl.id}>
                                {tl.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="resolveOpenTasksEdit"
                        checked={resolveOpenTasks === 'DELETE'}
                        onChange={() => setResolveOpenTasks('DELETE')}
                        className="text-rose-500 cursor-pointer"
                      />
                      <span>Delete open tasks</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="resolveOpenTasksEdit"
                        checked={resolveOpenTasks === 'KEEP'}
                        onChange={() => setResolveOpenTasks('KEEP')}
                        className="text-amber-500 cursor-pointer"
                      />
                      <span>Keep open tasks as-is in completed list</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Flag / Visibility (Internal vs External) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Visibility Flag
                </label>
                {selectedMilestone && !isMovingProject && (
                  <span className="text-[10px] text-amber-400/90 font-medium flex items-center gap-1">
                    Inherited from milestone ({selectedMilestone.flag})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!!selectedMilestone && !isMovingProject}
                  onClick={() => setFlag('INTERNAL')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                    selectedMilestone && !isMovingProject ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    flag === 'INTERNAL'
                      ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-300 ring-1 ring-indigo-500/20'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Lock className="w-4 h-4 mt-0.5 text-indigo-400 flex-shrink-0" />
                  <div>
                    <span className="block text-xs font-bold">Internal</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5 leading-tight">Team members only</span>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!!selectedMilestone && !isMovingProject}
                  onClick={() => setFlag('EXTERNAL')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                    selectedMilestone && !isMovingProject ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    flag === 'EXTERNAL'
                      ? 'bg-emerald-600/10 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/20'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Globe className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="block text-xs font-bold">External</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5 leading-tight">Visible to client users</span>
                  </div>
                </button>
              </div>

              {selectedMilestone && !isMovingProject && (
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
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs resize-none"
              />
            </div>

            {/* Delete Zone */}
            <div className="pt-4 border-t border-slate-800/80">
              {isConfirmingDelete ? (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-3">
                  <div className="flex items-start gap-2 text-rose-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold">Delete Task List</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Choose what should happen to existing tasks in this task list:
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                      <input
                        type="radio"
                        name="deleteTaskAction"
                        checked={deleteTaskAction === 'keep'}
                        onChange={() => setDeleteTaskAction('keep')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="block text-xs font-semibold text-slate-200">Keep tasks (Unassign from list)</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">Tasks will move to "General / Unassigned Tasks" and remain intact.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-rose-900/50 transition-colors">
                      <input
                        type="radio"
                        name="deleteTaskAction"
                        checked={deleteTaskAction === 'delete'}
                        onChange={() => setDeleteTaskAction('delete')}
                        className="mt-0.5 text-rose-600 focus:ring-rose-500"
                      />
                      <div>
                        <span className="block text-xs font-semibold text-rose-300">Delete all tasks with this list</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">All tasks within this task list will also be deleted.</span>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate()}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="px-3.5 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs hover:bg-slate-700 cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete this task list</span>
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
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
              disabled={updateMutation.isPending || !name.trim()}
              className="px-4.5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
