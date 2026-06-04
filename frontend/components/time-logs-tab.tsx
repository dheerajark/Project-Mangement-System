'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Clock,
  Plus,
  Archive,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Check,
  X,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';

interface TimeLogsTabProps {
  projectId: string;
}

export default function TimeLogsTab({ projectId }: TimeLogsTabProps) {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Tab State: "logs" or "timesheets"
  const [currentSubTab, setCurrentSubTab] = useState<'logs' | 'timesheets'>('logs');

  // Form States
  const [showLogModal, setShowLogModal] = useState(false);
  const [hours, setHours] = useState('');
  const [loggedAt, setLoggedAt] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);
  const [taskId, setTaskId] = useState('');

  // Timesheet submission form states
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [tsStartDate, setTsStartDate] = useState('');
  const [tsEndDate, setTsEndDate] = useState('');

  // Manager approval state
  const [approvalModalTimesheetId, setApprovalModalTimesheetId] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalAction, setApprovalAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');

  // Query: Project Details (to calculate project-level estimations)
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
  });

  // Query: Project Tasks (for dropdown & total estimations)
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/tasks`);
      return res.data;
    },
  });

  // Query: Project Time Entries
  const { data: logs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ['time-entries', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/time-entries`);
      return res.data;
    },
  });

  // Query: All Timesheets (scoped by role in backend, showing user's own or all to manager)
  const { data: timesheets = [], isLoading: isLoadingTimesheets } = useQuery({
    queryKey: ['timesheets'],
    queryFn: async () => {
      const res = await api.get('/timesheets');
      return res.data;
    },
  });

  // Mutation: Log Manual Time
  const logManualMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/time-entries', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      setShowLogModal(false);
      setHours('');
      setDescription('');
      setTaskId('');
      setBillable(true);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to log manual time');
    },
  });

  // Mutation: Soft Archive Entry
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/time-entries/${id}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to archive time entry');
    },
  });

  // Mutation: Submit Timesheet
  const submitTimesheetMutation = useMutation({
    mutationFn: async (data: { startDate: string; endDate: string }) => {
      const res = await api.post('/timesheets/submit', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries', projectId] });
      setShowSubmitModal(false);
      setTsStartDate('');
      setTsEndDate('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to submit timesheet');
    },
  });

  // Mutation: Approve/Reject Timesheet
  const approveTimesheetMutation = useMutation({
    mutationFn: async ({ id, action, approvalComment }: { id: string; action: 'APPROVE' | 'REJECT'; approvalComment: string }) => {
      const res = await api.patch(`/timesheets/${id}/approve`, { action, approvalComment });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries', projectId] });
      setApprovalModalTimesheetId(null);
      setApprovalComment('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to approve/reject timesheet');
    },
  });

  // Calculate Metrics
  const totalLoggedHours = logs.reduce((acc: number, log: any) => acc + log.hours, 0);
  const billableHours = logs.reduce((acc: number, log: any) => acc + (log.billable ? log.hours : 0), 0);
  const nonBillableHours = totalLoggedHours - billableHours;
  const estimatedHours = tasks.reduce((acc: number, t: any) => acc + (t.estimatedHours || 0), 0);
  const remainingHours = Math.max(0, estimatedHours - totalLoggedHours);

  // Variance configuration
  let varianceText = 'On Target';
  let varianceColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  let VarianceIcon = Minus;

  if (estimatedHours > 0) {
    if (totalLoggedHours < estimatedHours) {
      varianceText = 'Under Budget';
      varianceColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      VarianceIcon = TrendingDown;
    } else if (totalLoggedHours > estimatedHours) {
      varianceText = 'Over Budget';
      varianceColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      VarianceIcon = TrendingUp;
    }
  }

  const handleLogTimeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      projectId,
      taskId: taskId || undefined,
    });
  };

  const handleTimesheetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tsStartDate || !tsEndDate) {
      alert('Please enter both start and end dates.');
      return;
    }
    submitTimesheetMutation.mutate({
      startDate: new Date(tsStartDate).toISOString(),
      endDate: new Date(tsEndDate).toISOString(),
    });
  };

  const handleApproveRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvalModalTimesheetId) return;
    approveTimesheetMutation.mutate({
      id: approvalModalTimesheetId,
      action: approvalAction,
      approvalComment,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Sub-Tabs & Action Button */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex bg-slate-900 border border-slate-850 p-1 rounded-xl gap-1">
          <button
            onClick={() => setCurrentSubTab('logs')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              currentSubTab === 'logs' ? 'bg-indigo-650 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Time Entries
          </button>
          <button
            onClick={() => setCurrentSubTab('timesheets')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              currentSubTab === 'timesheets' ? 'bg-indigo-650 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Timesheets
          </button>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          {currentSubTab === 'logs' && hasPermission('LOG_TIME_ENTRY') && (
            <button
              onClick={() => setShowLogModal(true)}
              className="w-full sm:w-auto px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-650/15"
            >
              <Plus className="w-4 h-4" />
              Log Time Manually
            </button>
          )}

          {currentSubTab === 'timesheets' && hasPermission('SUBMIT_TIMESHEET') && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full sm:w-auto px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-650/15"
            >
              <Calendar className="w-4 h-4" />
              Submit Timesheet
            </button>
          )}
        </div>
      </div>

      {/* Overview Totals Panel */}
      {currentSubTab === 'logs' && (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Logged Hours</span>
            <div className="font-mono text-xl font-black text-indigo-400 mt-2">{totalLoggedHours.toFixed(1)}h</div>
          </div>

          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
            <span className="text-[10px] font-bold text-slate-400/80 uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Billable
            </span>
            <div className="font-mono text-xl font-black text-emerald-400 mt-2">{billableHours.toFixed(1)}h</div>
          </div>

          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Non-Billable</span>
            <div className="font-mono text-xl font-semibold text-slate-400 mt-2">{nonBillableHours.toFixed(1)}h</div>
          </div>

          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estimated Hours</span>
            <div className="font-mono text-xl font-semibold text-indigo-300 mt-2">{estimatedHours.toFixed(1)}h</div>
          </div>

          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remaining Hours</span>
            <div className="font-mono text-xl font-semibold text-slate-350 mt-2">{remainingHours.toFixed(1)}h</div>
          </div>

          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Variance Status</span>
            <div className={`mt-2 py-1 px-2.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 w-max ${varianceColor}`}>
              <VarianceIcon className="w-3.5 h-3.5" />
              {varianceText}
            </div>
          </div>
        </section>
      )}

      {/* Main Subtab views */}
      {currentSubTab === 'logs' ? (
        <article className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden">
          {isLoadingLogs ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Task</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Billable</th>
                    <th className="px-6 py-4 text-right">Hours</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {logs.map((log: any) => {
                    const isLinkedToSubmittedOrApprovedTimesheet =
                      log.timesheet && (log.timesheet.status === 'SUBMITTED' || log.timesheet.status === 'APPROVED');
                    return (
                      <tr key={log.id} className="hover:bg-slate-900/25 transition-colors group">
                        <td className="px-6 py-3.5">
                          <span className="font-semibold text-slate-200">
                            {log.user.firstName ? `${log.user.firstName} ${log.user.lastName || ''}` : log.user.email}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-slate-400 font-medium">
                          {new Date(log.loggedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5">
                          {log.task ? (
                            <span className="font-mono text-[10px] bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-indigo-400 font-bold">
                              {project?.projectCode}-{log.task.taskNumber}
                            </span>
                          ) : (
                            <span className="text-slate-600 italic">Project Level</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-slate-300 max-w-[200px] truncate" title={log.description}>
                          {log.description || <span className="text-slate-600 italic">No notes</span>}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
                              log.billable
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700/50'
                            }`}
                          >
                            {log.billable ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-200">
                          {log.hours.toFixed(2)}h
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {hasPermission('ARCHIVE_TIME_ENTRY') && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to archive this time log?')) {
                                  archiveMutation.mutate(log.id);
                                }
                              }}
                              disabled={isLinkedToSubmittedOrApprovedTimesheet || archiveMutation.isPending}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isLinkedToSubmittedOrApprovedTimesheet
                                  ? 'text-slate-600 border-transparent cursor-not-allowed opacity-50'
                                  : 'text-slate-500 hover:text-rose-400 border-transparent hover:border-rose-900/30 hover:bg-rose-500/5 active:scale-95'
                              }`}
                              title={
                                isLinkedToSubmittedOrApprovedTimesheet
                                  ? 'Locked in a submitted or approved timesheet'
                                  : 'Archive time log'
                              }
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16">
              <Clock className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-200">No time logged yet</h3>
              <p className="text-xs text-slate-500 mt-1">Get started by logging manual time or starting a stopwatch.</p>
            </div>
          )}
        </article>
      ) : (
        /* Timesheets view */
        <article className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden">
          {isLoadingTimesheets ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : timesheets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-6 py-4">Submitter</th>
                    <th className="px-6 py-4">Period Start</th>
                    <th className="px-6 py-4">Period End</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Total Hours</th>
                    <th className="px-6 py-4">Approval Comment</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {timesheets.map((ts: any) => {
                    const tsTotalHours = ts.timeEntries?.reduce((sum: number, e: any) => sum + e.hours, 0) || 0;
                    const canApproveThis = hasPermission('APPROVE_TIMESHEET') && ts.status === 'SUBMITTED';
                    
                    let statusColor = 'bg-slate-800 text-slate-400 border-slate-700/50';
                    let StatusIcon = AlertCircle;
                    
                    if (ts.status === 'APPROVED') {
                      statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                      StatusIcon = CheckCircle2;
                    } else if (ts.status === 'REJECTED') {
                      statusColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                      StatusIcon = XCircle;
                    } else if (ts.status === 'SUBMITTED') {
                      statusColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                      StatusIcon = Clock;
                    }

                    return (
                      <tr key={ts.id} className="hover:bg-slate-900/25 transition-colors">
                        <td className="px-6 py-3.5">
                          <span className="font-semibold text-slate-200">
                            {ts.user.firstName ? `${ts.user.firstName} ${ts.user.lastName || ''}` : ts.user.email}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-slate-400 font-medium">
                          {new Date(ts.startDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5 text-slate-400 font-medium">
                          {new Date(ts.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase flex items-center gap-1 w-max ${statusColor}`}>
                            <StatusIcon className="w-3 h-3" />
                            {ts.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-mono font-bold text-slate-200">
                          {tsTotalHours.toFixed(1)}h
                        </td>
                        <td className="px-6 py-3.5 text-slate-350 max-w-[200px] truncate" title={ts.approvalComment}>
                          {ts.approvalComment || <span className="text-slate-650 italic">—</span>}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {canApproveThis ? (
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => {
                                  setApprovalModalTimesheetId(ts.id);
                                  setApprovalAction('APPROVE');
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  setApprovalModalTimesheetId(ts.id);
                                  setApprovalAction('REJECT');
                                }}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Reject
                              </button>
                            </div>
                          ) : ts.status === 'APPROVED' ? (
                            <span className="text-slate-600 text-[10px]">
                              Approved by {ts.approvedBy?.firstName || ts.approvedBy?.email}
                            </span>
                          ) : (
                            <span className="text-slate-650 text-[10px] italic">No actions pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-200">No timesheets submitted</h3>
              <p className="text-xs text-slate-500 mt-1">Submit your timesheet periods for manager approval.</p>
            </div>
          )}
        </article>
      )}

      {/* Modal: Log Manual Time */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setShowLogModal(false)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4">
            <header className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Log Manual Time
              </h4>
              <button onClick={() => setShowLogModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </header>

            <form onSubmit={handleLogTimeSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Duration (Hours) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="E.g., 2.5"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

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

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Associated Task (Optional)
                </label>
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Project Level (General)</option>
                  {tasks.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {project?.projectCode}-{t.taskNumber} ({t.title})
                    </option>
                  ))}
                </select>
              </div>

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

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2.5 bg-slate-950 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-400"
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
      )}

      {/* Modal: Submit Timesheet */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setShowSubmitModal(false)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4">
            <header className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                Submit Weekly/Monthly Timesheet
              </h4>
              <button onClick={() => setShowSubmitModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </header>

            <form onSubmit={handleTimesheetSubmit} className="space-y-4">
              <div className="bg-slate-950/40 border border-slate-900 p-3.5 rounded-xl text-[10px] text-slate-400 leading-relaxed">
                Submitting a timesheet links all active, unarchived time entries within the range. While under review or approved, these entries are locked and cannot be edited or archived.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={tsStartDate}
                    onChange={(e) => setTsStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={tsEndDate}
                    onChange={(e) => setTsEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2.5 bg-slate-950 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitTimesheetMutation.isPending}
                  className="px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {submitTimesheetMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Timesheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Approve/Reject Timesheet */}
      {approvalModalTimesheetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setApprovalModalTimesheetId(null)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4">
            <header className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                {approvalAction === 'APPROVE' ? 'Approve Timesheet' : 'Reject Timesheet'}
              </h4>
              <button onClick={() => setApprovalModalTimesheetId(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </header>

            <form onSubmit={handleApproveRejectSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Approval/Rejection Reason or Comment (Optional)
                </label>
                <textarea
                  rows={3}
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder="Explain details of approval or corrections required..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setApprovalModalTimesheetId(null)}
                  className="px-4 py-2.5 bg-slate-950 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approveTimesheetMutation.isPending}
                  className={`px-4.5 py-2.5 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 ${
                    approvalAction === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {approveTimesheetMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm {approvalAction === 'APPROVE' ? 'Approval' : 'Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
