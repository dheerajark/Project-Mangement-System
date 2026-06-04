'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Play, Square, Loader2, Clock, X } from 'lucide-react';

export default function FloatingTimer() {
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState<number>(0);
  const [showStopModal, setShowStopModal] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');

  // Fetch active timer
  const { data: activeTimer, isLoading } = useQuery({
    queryKey: ['active-timer'],
    queryFn: async () => {
      const res = await api.get('/time-entries/active');
      return res.data;
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Calculate elapsed time when active timer is running
  useEffect(() => {
    if (!activeTimer || !activeTimer.isTimerRunning || !activeTimer.timerStartedAt) {
      setElapsed(0);
      return;
    }

    const startMs = new Date(activeTimer.timerStartedAt).getTime();
    
    // Initial calculation
    const initialElapsed = Math.floor((Date.now() - startMs) / 1000);
    setElapsed(initialElapsed > 0 ? initialElapsed : 0);

    const interval = setInterval(() => {
      const currentElapsed = Math.floor((Date.now() - startMs) / 1000);
      setElapsed(currentElapsed > 0 ? currentElapsed : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  // Stop Timer Mutation
  const stopTimerMutation = useMutation({
    mutationFn: async (desc: string) => {
      const res = await api.post('/time-entries/timer/stop', { description: desc });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      setShowStopModal(false);
      setDescription('');
    },
  });

  const handleStopTimer = (e: React.FormEvent) => {
    e.preventDefault();
    stopTimerMutation.mutate(description);
  };

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading || !activeTimer || !activeTimer.isTimerRunning) {
    return null;
  }

  return (
    <>
      {/* Floating Timer Widget */}
      <div className="fixed bottom-6 right-6 z-40 bg-slate-900/90 border border-indigo-500/30 backdrop-blur-md rounded-full pl-5 pr-3 py-2.5 flex items-center gap-4 shadow-2xl animate-bounce-slow">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timer</span>
        </div>

        <div className="font-mono font-bold text-xs text-indigo-400">
          {formatTime(elapsed)}
        </div>

        <div className="text-[11px] font-semibold text-slate-350 max-w-[150px] truncate" title={activeTimer.task?.title || activeTimer.project?.name}>
          {activeTimer.task ? `${activeTimer.project.projectCode}-${activeTimer.task.taskNumber}` : activeTimer.project.name}
        </div>

        <button
          onClick={() => setShowStopModal(true)}
          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-350 border border-rose-500/20 rounded-full transition-all"
          title="Stop Timer"
        >
          <Square className="w-3.5 h-3.5 fill-rose-400" />
        </button>
      </div>

      {/* Stop Description Prompt Modal */}
      {showStopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setShowStopModal(false)}
          />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Stop Active Timer
              </h4>
              <button
                onClick={() => setShowStopModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStopTimer} className="space-y-4">
              <div className="text-xs text-slate-400 leading-relaxed">
                You logged <span className="font-mono text-indigo-400 font-bold">{formatTime(elapsed)}</span> against{' '}
                <span className="font-semibold text-slate-200">
                  {activeTimer.task
                    ? `${activeTimer.project.projectCode}-${activeTimer.task.taskNumber} (${activeTimer.task.title})`
                    : activeTimer.project.name}
                </span>
                .
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Work Description / Notes
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What did you work on?"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStopModal(false)}
                  className="px-4 py-2.5 bg-slate-950 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stopTimerMutation.isPending}
                  className="px-4.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {stopTimerMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Stop & Log Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
