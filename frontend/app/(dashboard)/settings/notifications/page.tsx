'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  ArrowLeft,
  Loader2,
  Check,
  Save,
  Sliders,
} from 'lucide-react';
import Link from 'next/link';

export default function NotificationPreferencesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Preferences States
  const [taskAssignment, setTaskAssignment] = useState(true);
  const [taskComment, setTaskComment] = useState(true);
  const [issueAssignment, setIssueAssignment] = useState(true);
  const [issueComment, setIssueComment] = useState(true);
  const [milestoneUpdate, setMilestoneUpdate] = useState(true);
  const [timesheetSubmitted, setTimesheetSubmitted] = useState(true);
  const [timesheetApproved, setTimesheetApproved] = useState(true);
  const [timesheetRejected, setTimesheetRejected] = useState(true);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch Preferences
  const { data: preferences, isLoading: isLoadingPrefs } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await api.get('/notifications/preferences');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // Populate States when Loaded
  useEffect(() => {
    if (preferences) {
      setTaskAssignment(preferences.taskAssignment ?? true);
      setTaskComment(preferences.taskComment ?? true);
      setIssueAssignment(preferences.issueAssignment ?? true);
      setIssueComment(preferences.issueComment ?? true);
      setMilestoneUpdate(preferences.milestoneUpdate ?? true);
      setTimesheetSubmitted(preferences.timesheetSubmitted ?? true);
      setTimesheetApproved(preferences.timesheetApproved ?? true);
      setTimesheetRejected(preferences.timesheetRejected ?? true);
    }
  }, [preferences]);

  // Update Preferences Mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch('/notifications/preferences', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to update preferences');
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updatePreferencesMutation.mutate({
      taskAssignment,
      taskComment,
      issueAssignment,
      issueComment,
      milestoneUpdate,
      timesheetSubmitted,
      timesheetApproved,
      timesheetRejected,
    });
  };

  if (isLoading || isLoadingPrefs) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
              Notification Preferences
            </span>
          </div>
          <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-full flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" /> User Settings
          </div>
        </div>
      </header>

      {/* Main Form */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-900 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-400" /> Subscription Settings
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure which actions trigger in-app notifications on your dashboard.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                <span>{errorMsg}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4" /> Preferences updated successfully!
              </div>
            )}

            <div className="space-y-5 divide-y divide-slate-800/40">
              {/* Tasks */}
              <div className="pt-2 space-y-4">
                <h3 className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Tasks</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-200 block">Task Assignment</label>
                    <span className="text-xs text-slate-400">Receive alerts when tasks are assigned to you</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={taskAssignment}
                    onChange={(e) => setTaskAssignment(e.target.checked)}
                    className="w-10 h-5 bg-slate-950 border-slate-800 rounded-full appearance-none checked:bg-indigo-600 checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer border shadow transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-200 block">Task Comments</label>
                    <span className="text-xs text-slate-400">Receive alerts when someone comments on your tasks</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={taskComment}
                    onChange={(e) => setTaskComment(e.target.checked)}
                    className="w-10 h-5 bg-slate-950 border-slate-800 rounded-full appearance-none checked:bg-indigo-600 checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer border shadow transition-colors"
                  />
                </div>
              </div>

              {/* Issues */}
              <div className="pt-5 space-y-4">
                <h3 className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Issues & Bugs</h3>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-200 block">Issue Assignment</label>
                    <span className="text-xs text-slate-400">Receive alerts when issues are assigned to you</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={issueAssignment}
                    onChange={(e) => setIssueAssignment(e.target.checked)}
                    className="w-10 h-5 bg-slate-950 border-slate-800 rounded-full appearance-none checked:bg-indigo-600 checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer border shadow transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-200 block">Issue Comments</label>
                    <span className="text-xs text-slate-400">Receive alerts when someone comments on your issues</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={issueComment}
                    onChange={(e) => setIssueComment(e.target.checked)}
                    className="w-10 h-5 bg-slate-950 border-slate-800 rounded-full appearance-none checked:bg-indigo-600 checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer border shadow transition-colors"
                  />
                </div>
              </div>

              {/* Milestones */}
              <div className="pt-5 space-y-4">
                <h3 className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Milestones</h3>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-200 block">Milestone Status Updates</label>
                    <span className="text-xs text-slate-400">Receive alerts when milestones are completed or missed</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={milestoneUpdate}
                    onChange={(e) => setMilestoneUpdate(e.target.checked)}
                    className="w-10 h-5 bg-slate-950 border-slate-800 rounded-full appearance-none checked:bg-indigo-600 checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer border shadow transition-colors"
                  />
                </div>
              </div>

              {/* Timesheets */}
              <div className="pt-5 space-y-4">
                <h3 className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Timesheet Events</h3>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-200 block">Timesheet Submission</label>
                    <span className="text-xs text-slate-400">Notify me when members submit timesheets for review (Managers/Admins)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={timesheetSubmitted}
                    onChange={(e) => setTimesheetSubmitted(e.target.checked)}
                    className="w-10 h-5 bg-slate-950 border-slate-800 rounded-full appearance-none checked:bg-indigo-600 checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer border shadow transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-200 block">Timesheet Approvals</label>
                    <span className="text-xs text-slate-400">Notify me when my timesheet has been approved</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={timesheetApproved}
                    onChange={(e) => setTimesheetApproved(e.target.checked)}
                    className="w-10 h-5 bg-slate-950 border-slate-800 rounded-full appearance-none checked:bg-indigo-600 checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer border shadow transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-200 block">Timesheet Rejections</label>
                    <span className="text-xs text-slate-400">Notify me when my timesheet has been rejected</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={timesheetRejected}
                    onChange={(e) => setTimesheetRejected(e.target.checked)}
                    className="w-10 h-5 bg-slate-950 border-slate-800 rounded-full appearance-none checked:bg-indigo-600 checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer border shadow transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-slate-300 font-semibold rounded-xl text-sm transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={updatePreferencesMutation.isPending}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/10 flex items-center gap-1.5 disabled:opacity-50"
            >
              {updatePreferencesMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Preferences
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
