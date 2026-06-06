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
          projectId={projectId}
          projectMembers={projectMembers}
          projectTasks={projectTasks}
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

// ─────────────────────────────────────────────────────────────────────────────
// Issue Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────

interface IssueDetailDrawerProps {
  issueId: string;
  projectId: string;
  projectMembers: any[];
  projectTasks: any[];
  onClose: () => void;
  canEdit: boolean;
}

function IssueDetailDrawer({
  issueId,
  projectId,
  projectMembers,
  projectTasks,
  onClose,
  canEdit,
}: IssueDetailDrawerProps) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);

  const { data: issue, isLoading } = useQuery({
    queryKey: ['issue', issueId],
    queryFn: async () => {
      const res = await api.get(`/issues/${issueId}`);
      return res.data;
    },
    enabled: !!issueId,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch(`/issues/${issueId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
      queryClient.invalidateQueries({ queryKey: ['issue-stats', projectId] });
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/issues/${issueId}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
      queryClient.invalidateQueries({ queryKey: ['issue-stats', projectId] });
      onClose();
    },
  });

  // Comment mutation
  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(`/issues/${issueId}/comments`, { content });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      setCommentText('');
      setCommentError(null);
    },
    onError: (err: any) => {
      setCommentError(err.response?.data?.message || 'Failed to post comment');
    },
  });

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    commentMutation.mutate(commentText.trim());
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMemberName = (member: any) => {
    if (!member) return 'Unassigned';
    return member.firstName ? `${member.firstName} ${member.lastName || ''}`.trim() : member.email;
  };

  const getActivityLabel = (action: string) => {
    const labels: Record<string, string> = {
      ISSUE_CREATED: 'Created this issue',
      STATUS_CHANGED: 'Changed status',
      PRIORITY_CHANGED: 'Changed priority',
      SEVERITY_CHANGED: 'Changed severity',
      ASSIGNEE_CHANGED: 'Changed assignee',
      TYPE_CHANGED: 'Changed type',
      COMMENT_ADDED: 'Added a comment',
      ISSUE_ARCHIVED: 'Archived this issue',
    };
    return labels[action] || action.replace(/_/g, ' ').toLowerCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {isLoading || !issue ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Drawer Header */}
            <div className="border-b border-slate-800 px-6 py-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-semibold text-indigo-400/70">
                    {issue.project?.projectCode}-ISSUE-{issue.issueNumber}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${SEVERITY_COLORS[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_COLORS[issue.status]}`}>
                    {issue.status.replace('_', ' ')}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-100 leading-snug">{issue.title}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col lg:flex-row h-full">
                {/* Main Content */}
                <div className="flex-1 p-6 space-y-6 border-r border-slate-800/50">
                  {/* Description */}
                  {issue.description && (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</h3>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{issue.description}</p>
                    </div>
                  )}

                  {/* Environment */}
                  {issue.environment && (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Environment</h3>
                      <p className="text-xs text-slate-400 bg-slate-950/50 border border-slate-800 px-3 py-2 rounded-lg font-mono">
                        {issue.environment}
                      </p>
                    </div>
                  )}

                  {/* Steps to Reproduce */}
                  {issue.reproductionSteps && (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Steps to Reproduce</h3>
                      <pre className="text-xs text-slate-400 bg-slate-950/50 border border-slate-800 px-3 py-2 rounded-lg whitespace-pre-wrap font-sans leading-relaxed">
                        {issue.reproductionSteps}
                      </pre>
                    </div>
                  )}

                  {/* Resolution Notes */}
                  {issue.resolutionNotes && (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resolution Notes</h3>
                      <p className="text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-800/30 px-3 py-2 rounded-lg leading-relaxed">
                        {issue.resolutionNotes}
                      </p>
                    </div>
                  )}

                  {/* Comments */}
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      Discussion
                      <span className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[9px] text-slate-400">
                        {issue.comments?.length || 0}
                      </span>
                    </h3>

                    <div className="space-y-3">
                      {issue.comments?.map((comment: any) => (
                        <div key={comment.id} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-300 flex-shrink-0 mt-0.5">
                            {(comment.user?.firstName?.[0] || comment.user?.email?.[0] || '?').toUpperCase()}
                          </div>
                          <div className="flex-1 bg-slate-950/50 border border-slate-800 rounded-xl p-3 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-300">
                                {getMemberName(comment.user)}
                              </span>
                              <span className="text-[10px] text-slate-600">{formatDate(comment.createdAt)}</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {hasPermission('COMMENT_ISSUE') && (
                      <form onSubmit={handlePostComment} className="space-y-2">
                        {commentError && (
                          <p className="text-xs text-rose-400">{commentError}</p>
                        )}
                        <textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Add a comment..."
                          rows={2}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={!commentText.trim() || commentMutation.isPending}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-all"
                          >
                            {commentMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                            Post Comment
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Activity Feed */}
                  {issue.activities && issue.activities.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Activity</h3>
                      <div className="space-y-2">
                        {issue.activities.map((activity: any) => (
                          <div key={activity.id} className="flex items-start gap-2.5 text-xs">
                            <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-400 flex-shrink-0 mt-0.5">
                              {(activity.user?.firstName?.[0] || '?').toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-slate-400">
                                <span className="text-slate-300 font-medium">{getMemberName(activity.user)}</span>
                                {' '}{getActivityLabel(activity.action)}
                                {activity.oldValue && activity.newValue && (
                                  <span className="text-slate-500">
                                    {' '}from <span className="text-rose-400/80">{activity.oldValue}</span> to{' '}
                                    <span className="text-emerald-400/80">{activity.newValue}</span>
                                  </span>
                                )}
                              </span>
                              <span className="block text-[10px] text-slate-600 mt-0.5">
                                {formatDate(activity.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sidebar Properties */}
                <div className="w-full lg:w-56 p-4 space-y-4 bg-slate-950/30 flex-shrink-0">
                  {/* Status */}
                  {canEdit && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
                      <select
                        value={issue.status}
                        onChange={(e) => updateMutation.mutate({ status: e.target.value })}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Priority */}
                  {canEdit && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Priority</label>
                      <select
                        value={issue.priority}
                        onChange={(e) => updateMutation.mutate({ priority: e.target.value })}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                      >
                        {PRIORITY_OPTIONS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Severity */}
                  {canEdit && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Severity</label>
                      <select
                        value={issue.severity}
                        onChange={(e) => updateMutation.mutate({ severity: e.target.value })}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                      >
                        {SEVERITY_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Assignee */}
                  {canEdit && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assignee</label>
                      <select
                        value={issue.assigneeId || ''}
                        onChange={(e) => updateMutation.mutate({ assigneeId: e.target.value || null })}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
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
                  )}

                  {/* Reporter */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reporter</label>
                    <p className="text-xs text-slate-400">
                      {getMemberName(issue.reporter)}
                    </p>
                  </div>

                  {/* Type */}
                  {canEdit && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</label>
                      <select
                        value={issue.type}
                        onChange={(e) => updateMutation.mutate({ type: e.target.value })}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                      >
                        {TYPE_OPTIONS.map((t) => (
                          <option key={t} value={t}>{TYPE_LABELS[t]?.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Linked Task */}
                  {issue.task && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Linked Task</label>
                      <p className="text-xs text-indigo-400 font-mono">
                        #{issue.task.taskNumber} — {issue.task.title}
                      </p>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Created</label>
                    <p className="text-[10px] text-slate-500">{formatDate(issue.createdAt)}</p>
                  </div>

                  {issue.resolvedAt && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resolved</label>
                      <p className="text-[10px] text-emerald-400">{formatDate(issue.resolvedAt)}</p>
                    </div>
                  )}

                  {/* Archive */}
                  {hasPermission('ARCHIVE_ISSUE') && (
                    <div className="pt-2 border-t border-slate-800">
                      <button
                        onClick={() => {
                          if (confirm('Archive this issue? It will be hidden from active lists.')) {
                            archiveMutation.mutate();
                          }
                        }}
                        disabled={archiveMutation.isPending}
                        className="w-full px-3 py-2 bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-900/60 text-slate-400 hover:text-rose-400 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                      >
                        {archiveMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        Archive Issue
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
