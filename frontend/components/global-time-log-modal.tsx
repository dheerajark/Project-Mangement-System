'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Loader2, X, Calendar, Clock } from 'lucide-react';

interface GlobalTimeLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GlobalTimeLogModal({ isOpen, onClose, onSuccess }: GlobalTimeLogModalProps) {
  const queryClient = useQueryClient();

  // Form states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [hours, setHours] = useState('');
  const [loggedAt, setLoggedAt] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);
  const [taskId, setTaskId] = useState('');

  // Fetch Projects that support time tracking
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isOpen,
  });

  const activeProjects = projects.filter(
    (p: any) => p.status !== 'ARCHIVED' && p.settings?.allowTimeTracking !== false
  );

  // Fetch Tasks for the selected project
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks', selectedProjectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${selectedProjectId}/tasks`);
      return res.data;
    },
    enabled: isOpen && !!selectedProjectId,
  });

  // Reset task whenever selected project changes
  useEffect(() => {
    setTaskId('');
  }, [selectedProjectId]);

  // Reset entire form when modal closes or opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId('');
      setHours('');
      setLoggedAt(new Date().toISOString().split('T')[0]);
      setDescription('');
      setBillable(true);
      setTaskId('');
    }
  }, [isOpen]);

  // Mutation: Log Time
  const logManualMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/time-entries', data);
      return res.data;
    },
    onSuccess: () => {
      // Invalidate queries to reload time logs in dashboard views
      queryClient.invalidateQueries({ queryKey: ['global-time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      }
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to log manual time');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert('Please select a project.');
      return;
    }
    const hrsVal = parseFloat(hours);
    if (isNaN(hrsVal) || hrsVal <= 0) {
      alert('Please enter a valid duration greater than 0.');
      return;
    }
    logManualMutation.mutate({
      hours: hrsVal,
      loggedAt: new Date(loggedAt).toISOString(),
      description,
      billable,
      projectId: selectedProjectId,
      taskId: taskId || undefined,
    });
  };

  if (!isOpen) return null;

  const selectedProjectObj = activeProjects.find((p: any) => p.id === selectedProjectId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4 h-full flex flex-col animate-in slide-in-from-right duration-300">
        <header className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            New Time Log
          </h4>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-950 border border-slate-900/60 p-3 rounded-xl text-[10px] text-slate-400 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span>Submit a manual time entry for any active project.</span>
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            {/* Hours */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Hours Worked *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0.0"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Date Worked */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Date Worked *
              </label>
              <input
                type="date"
                required
                value={loggedAt}
                onChange={(e) => setLoggedAt(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Associated Task */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Associated Task (Optional)
            </label>
            {isLoadingTasks ? (
              <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Loading tasks...</span>
              </div>
            ) : (
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                disabled={!selectedProjectId}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Project Level (General)</option>
                {selectedProjectId &&
                  tasks.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {selectedProjectObj?.projectCode}-{t.taskNumber} ({t.title})
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Work Notes / Description *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what work was done..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Billable Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-900 rounded-xl">
            <div>
              <h5 className="font-bold text-xs text-slate-200">Billable Entry</h5>
              <p className="text-[10px] text-slate-500 mt-0.5">Toggle if this logged duration is billable to clients.</p>
            </div>
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
              className="h-4.5 w-8 rounded-full bg-slate-800 border-slate-700 checked:bg-indigo-650 focus:ring-0 cursor-pointer appearance-none checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all checked:after:border-indigo-650 relative transition-colors duration-200"
              style={{
                backgroundColor: billable ? '#4f46e5' : '#1e293b',
                borderRadius: '9999px',
              }}
            />
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-950 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={logManualMutation.isPending}
              className="px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5"
            >
              {logManualMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
