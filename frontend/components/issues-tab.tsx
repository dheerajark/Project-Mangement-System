'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'next/navigation';
import {
  Bug,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ChevronDown,
  Search,
  Circle,
  UserCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { useFormatDate } from '@/hooks/useFormatDate';
import IssueDetailDrawer from './issue-detail-drawer';

interface IssuesTabProps {
  projectId: string;
  projectMembers?: any[];
  projectTasks?: any[];
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  ASSIGNED: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  RESOLVED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  CLOSED: 'bg-slate-700/30 text-slate-400 border border-slate-700/50',
  REOPENED: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-rose-500/15 text-rose-400 border border-rose-500/25',
  HIGH: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  MEDIUM: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  LOW: 'bg-slate-700/30 text-slate-400 border border-slate-700/50',
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'text-rose-400',
  HIGH: 'text-amber-400',
  MEDIUM: 'text-blue-400',
  LOW: 'text-slate-400',
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  BUG: { label: 'Bug', color: 'text-rose-400' },
  FEATURE_REQUEST: { label: 'Feature', color: 'text-violet-400' },
  IMPROVEMENT: { label: 'Improvement', color: 'text-emerald-400' },
  SUPPORT: { label: 'Support', color: 'text-amber-400' },
};

const STATUS_OPTIONS = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'];
const SEVERITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const TYPE_OPTIONS = ['BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'SUPPORT'];

export default function IssuesTab({ projectId, projectMembers = [], projectTasks = [] }: IssuesTabProps) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const customFormatDate = useFormatDate();

  // Filter state
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected issue for drawer
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;
    const issueId = searchParams.get('issueId');
    if (issueId) {
      setSelectedIssueId(issueId);
    }
  }, [searchParams]);

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createType, setCreateType] = useState('BUG');
  const [createPriority, setCreatePriority] = useState('MEDIUM');
  const [createSeverity, setCreateSeverity] = useState('MEDIUM');
  const [createAssigneeId, setCreateAssigneeId] = useState('');
  const [createTaskId, setCreateTaskId] = useState('');
  const [createEnvironment, setCreateEnvironment] = useState('');
  const [createReproductionSteps, setCreateReproductionSteps] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch issues
  const { data: issues = [], isLoading: isLoadingIssues } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/issues`);
      return res.data;
    },
    enabled: !!projectId,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['issue-stats', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/issues/stats`);
      return res.data;
    },
    enabled: !!projectId,
  });

  // Create issue mutation
  const createIssueMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(`/projects/${projectId}/issues`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
      queryClient.invalidateQueries({ queryKey: ['issue-stats', projectId] });
      resetCreateForm();
    },
    onError: (err: any) => {
      setCreateError(err.response?.data?.message || 'Failed to create issue');
    },
  });

  const resetCreateForm = () => {
    setIsCreateOpen(false);
    setCreateTitle('');
    setCreateDescription('');
    setCreateType('BUG');
    setCreatePriority('MEDIUM');
    setCreateSeverity('MEDIUM');
    setCreateAssigneeId('');
    setCreateTaskId('');
    setCreateEnvironment('');
    setCreateReproductionSteps('');
    setCreateError(null);
  };

  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      setCreateError('Title is required');
      return;
    }
    createIssueMutation.mutate({
      title: createTitle.trim(),
      description: createDescription.trim() || null,
      type: createType,
      priority: createPriority,
      severity: createSeverity,
      assigneeId: createAssigneeId || null,
      taskId: createTaskId || null,
      environment: createEnvironment.trim() || null,
      reproductionSteps: createReproductionSteps.trim() || null,
    });
  };

  // Filter issues client-side
  const filteredIssues = issues.filter((issue: any) => {
    const matchStatus = filterStatus === 'ALL' || issue.status === filterStatus;
    const matchSeverity = filterSeverity === 'ALL' || issue.severity === filterSeverity;
    const matchType = filterType === 'ALL' || issue.type === filterType;
    const matchSearch =
      !searchQuery ||
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.issueNumber.toString().includes(searchQuery);
    return matchStatus && matchSeverity && matchType && matchSearch;
  });

  const canCreate = hasPermission('CREATE_ISSUE');
  const canEdit = hasPermission('EDIT_ISSUE');

  const getMemberName = (member: any) => {
    if (!member) return 'Unassigned';
    return member.firstName ? `${member.firstName} ${member.lastName || ''}`.trim() : member.email;
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Open</span>
            <Circle className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-2xl font-bold text-blue-400">{stats?.open ?? '—'}</span>
          <span className="text-[10px] text-slate-500">active issues</span>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-emerald-400">{stats?.resolved ?? '—'}</span>
          <span className="text-[10px] text-slate-500">closed + resolved</span>
        </div>

        <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-500/70 uppercase tracking-wider">Critical</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <span className="text-2xl font-bold text-rose-400">{stats?.critical ?? '—'}</span>
          <span className="text-[10px] text-rose-500/60">severity critical</span>
        </div>

        <div className="bg-amber-950/10 border border-amber-900/30 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-500/70 uppercase tracking-wider">High</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-bold text-amber-400">{stats?.high ?? '—'}</span>
          <span className="text-[10px] text-amber-500/60">high severity</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 w-44"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Severity</option>
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Types</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]?.label}</option>
            ))}
          </select>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            New Issue
          </button>
        )}
      </div>

      {/* Issues Table */}
      {isLoadingIssues ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="text-center py-16 space-y-4 bg-slate-900/30 border border-slate-900 rounded-2xl">
          <Bug className="w-10 h-10 text-slate-700 mx-auto" />
          <div>
            <p className="text-slate-400 font-medium text-sm">No issues found</p>
            <p className="text-slate-600 text-xs mt-1">
              {canCreate ? 'Create your first issue to start tracking bugs and requests.' : 'No issues match the selected filters.'}
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> New Issue
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-900">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-28">ID</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24 hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">Severity</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-28">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32 hidden md:table-cell">Assignee</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60">
              {filteredIssues.map((issue: any) => (
                <tr
                  key={issue.id}
                  onClick={() => setSelectedIssueId(issue.id)}
                  className="hover:bg-slate-900/40 cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-indigo-400/70 text-[10px] font-semibold">
                      {issue.project?.projectCode}-ISSUE-{issue.issueNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-slate-200 group-hover:text-white transition-colors">
                      {issue.title}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <span className={`text-[10px] font-semibold ${TYPE_LABELS[issue.type]?.color}`}>
                      {TYPE_LABELS[issue.type]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${SEVERITY_COLORS[issue.severity]}`}>
                      {issue.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_COLORS[issue.status]}`}>
                      {issue.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    {issue.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/20 flex items-center justify-center text-[9px] font-bold text-indigo-300">
                          {(issue.assignee.firstName?.[0] || issue.assignee.email[0]).toUpperCase()}
                        </div>
                        <span className="text-slate-400">
                          {getMemberName(issue.assignee)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-600 flex items-center gap-1">
                        <UserCircle2 className="w-3.5 h-3.5" /> Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Issue Detail Drawer */}
      {selectedIssueId && (
        <IssueDetailDrawer
          issueId={selectedIssueId}
          onClose={() => setSelectedIssueId(null)}
          canEdit={canEdit}
        />
      )}

      {/* Create Issue Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <Bug className="w-4 h-4 text-rose-400" />
                </div>
                <h2 className="text-sm font-bold text-slate-100">Create New Issue</h2>
              </div>
              <button
                onClick={resetCreateForm}
                className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIssue} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {createError && (
                <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  {createError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Title *</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Describe the issue briefly..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Detailed description of the issue..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</label>
                  <select
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]?.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Severity</label>
                  <select
                    value={createSeverity}
                    onChange={(e) => setCreateSeverity(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    {SEVERITY_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assignee</label>
                  <select
                    value={createAssigneeId}
                    onChange={(e) => setCreateAssigneeId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {projectMembers.map((m: any) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user?.firstName
                          ? `${m.user.firstName} ${m.user.lastName || ''}`.trim()
                          : m.user?.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Environment</label>
                <input
                  type="text"
                  value={createEnvironment}
                  onChange={(e) => setCreateEnvironment(e.target.value)}
                  placeholder="e.g., Production, Staging, macOS 14..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Steps to Reproduce</label>
                <textarea
                  value={createReproductionSteps}
                  onChange={(e) => setCreateReproductionSteps(e.target.value)}
                  placeholder="1. Go to...\n2. Click on...\n3. See error..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {projectTasks.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Linked Task</label>
                  <select
                    value={createTaskId}
                    onChange={(e) => setCreateTaskId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">No linked task</option>
                    {projectTasks.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        #{t.taskNumber} — {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={resetCreateForm}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createIssueMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  {createIssueMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  Create Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
