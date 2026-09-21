'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  X,
  Check,
  Loader2,
  CheckCircle2,
  CheckSquare,
  FolderInput,
  Trash2,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface CompleteTaskListModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskList: any;
  projectId: string;
  otherTaskLists: any[];
}

export default function CompleteTaskListModal({
  isOpen,
  onClose,
  taskList,
  projectId,
  otherTaskLists = [],
}: CompleteTaskListModalProps) {
  const queryClient = useQueryClient();

  const [resolveAction, setResolveAction] = useState<'MARK_DONE' | 'MOVE' | 'DELETE' | 'KEEP'>('MARK_DONE');
  const [targetTaskListId, setTargetTaskListId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const completeMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        status: 'COMPLETED',
        resolveOpenTasks: resolveAction,
      };
      if (resolveAction === 'MOVE') {
        payload.targetTaskListId = targetTaskListId || null;
      }
      const res = await api.patch(`/task-lists/${taskList.id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestone'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board', projectId] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to complete task list');
    },
  });

  if (!isOpen || !taskList) return null;

  const totalTasks = taskList.totalTasks || 0;
  const completedTasks = taskList.completedTasks || 0;
  const openTasksCount = Math.max(0, totalTasks - completedTasks);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    completeMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Mark Task List as Complete</h3>
              <p className="text-[11px] text-slate-400">
                {taskList.name}
              </p>
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

            {/* Zoho Open Tasks Notice */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 text-amber-300 text-xs">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Open tasks detected ({openTasksCount} incomplete of {totalTasks})</span>
              </div>
              <p className="text-[11px] text-slate-400 pl-5.5 leading-relaxed">
                In Zoho Projects, when completing a task list with active tasks, you choose how to resolve the remaining open deliverables.
              </p>
            </div>

            {/* Resolution Options */}
            <div className="space-y-2.5 pt-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                How would you like to handle remaining open tasks?
              </label>

              {/* Option 1: Mark all open tasks as complete */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  resolveAction === 'MARK_DONE'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-100 ring-1 ring-emerald-500/20'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="resolveAction"
                  checked={resolveAction === 'MARK_DONE'}
                  onChange={() => setResolveAction('MARK_DONE')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-300">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Mark all open tasks as complete</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Automatically updates all {openTasksCount} open task(s) to Done. Task list progress will reach 100% and project progress will increase.
                  </p>
                </div>
              </label>

              {/* Option 2: Move open tasks to another list */}
              <label
                className={`flex flex-col gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                  resolveAction === 'MOVE'
                    ? 'bg-blue-500/10 border-blue-500/30 text-slate-100 ring-1 ring-blue-500/20'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="resolveAction"
                    checked={resolveAction === 'MOVE'}
                    onChange={() => setResolveAction('MOVE')}
                    className="mt-1 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-blue-300">
                      <FolderInput className="w-3.5 h-3.5" />
                      <span>Move open tasks to another task list or General Tasks</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Transfers the {openTasksCount} open task(s) to another container. This task list retains only completed work.
                    </p>
                  </div>
                </div>

                {resolveAction === 'MOVE' && (
                  <div className="pl-7 pt-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Target Destination
                    </label>
                    <select
                      value={targetTaskListId}
                      onChange={(e) => setTargetTaskListId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">General / Unassigned Tasks</option>
                      {otherTaskLists
                        .filter((tl: any) => tl.id !== taskList.id && tl.status !== 'COMPLETED')
                        .map((tl: any) => (
                          <option key={tl.id} value={tl.id}>
                            {tl.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </label>

              {/* Option 3: Delete open tasks */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  resolveAction === 'DELETE'
                    ? 'bg-rose-500/10 border-rose-500/30 text-slate-100 ring-1 ring-rose-500/20'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="resolveAction"
                  checked={resolveAction === 'DELETE'}
                  onChange={() => setResolveAction('DELETE')}
                  className="mt-1 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-rose-300">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete open tasks</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Removes the {openTasksCount} incomplete task(s) from the project. Only completed tasks remain in this list.
                  </p>
                </div>
              </label>

              {/* Option 4: Keep open tasks as-is */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  resolveAction === 'KEEP'
                    ? 'bg-amber-500/10 border-amber-500/30 text-slate-100 ring-1 ring-amber-500/20'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="resolveAction"
                  checked={resolveAction === 'KEEP'}
                  onChange={() => setResolveAction('KEEP')}
                  className="mt-1 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-300">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Keep open tasks as-is</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Marks the task list as completed, but leaves the {openTasksCount} open task(s) in their current status.
                  </p>
                </div>
              </label>
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
              disabled={completeMutation.isPending}
              className="px-4.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {completeMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Completing...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Complete Task List</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
