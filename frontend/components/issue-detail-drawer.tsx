'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import {
  X,
  Loader2,
  AlertCircle,
  Bug,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Search,
  Circle,
  UserCircle2,
  ArrowUpRight,
  Send,
} from 'lucide-react';
import { useFormatDate } from '@/hooks/useFormatDate';

interface IssueDetailDrawerProps {
  issueId: string;
  onClose: () => void;
  canEdit: boolean;
  onSuccess?: () => void;
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

export default function IssueDetailDrawer({
  issueId,
  onClose,
  canEdit,
  onSuccess,
}: IssueDetailDrawerProps) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const customFormatDate = useFormatDate();

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

  // Fetch Project details for members
  const { data: projectDetails } = useQuery({
    queryKey: ['project-members-drawer', issue?.projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${issue.projectId}`);
      return res.data;
    },
    enabled: !!issue?.projectId,
  });

  const projectMembers = projectDetails?.members || [];

  // Fetch Project Tasks to link
  const { data: projectTasks = [] } = useQuery({
    queryKey: ['project-tasks-drawer', issue?.projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${issue.projectId}/tasks`);
      return res.data;
    },
    enabled: !!issue?.projectId,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch(`/issues/${issueId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['global-issues'] });
      if (issue?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['issues', issue.projectId] });
        queryClient.invalidateQueries({ queryKey: ['issue-stats', issue.projectId] });
      }
      onSuccess?.();
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/issues/${issueId}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['global-issues'] });
      if (issue?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['issues', issue.projectId] });
        queryClient.invalidateQueries({ queryKey: ['issue-stats', issue.projectId] });
      }
      onSuccess?.();
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
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    const dateStr = customFormatDate(date);
    const timeStr = date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dateStr} ${timeStr}`;
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

  const isArchived = issue?.deletedAt || issue?.project?.status === 'ARCHIVED';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

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
                              <span className="text-[10px] text-slate-655">{formatDate(comment.createdAt)}</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {hasPermission('COMMENT_ISSUE') && !isArchived && (
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
                  {canEdit && !isArchived && (
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
                  {canEdit && !isArchived && (
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
                  {canEdit && !isArchived && (
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
                  {canEdit && !isArchived && (
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
                  {canEdit && !isArchived && (
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
                    <p className="text-[10px] text-slate-505">{formatDate(issue.createdAt)}</p>
                  </div>

                  {issue.resolvedAt && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resolved</label>
                      <p className="text-[10px] text-emerald-450">{formatDate(issue.resolvedAt)}</p>
                    </div>
                  )}

                  {/* Archive */}
                  {hasPermission('ARCHIVE_ISSUE') && !isArchived && (
                    <div className="pt-2 border-t border-slate-800">
                      <button
                        onClick={() => {
                          if (confirm('Archive this issue? It will be hidden from active lists.')) {
                            archiveMutation.mutate();
                          }
                        }}
                        disabled={archiveMutation.isPending}
                        className="w-full px-3 py-2 bg-slate-800 hover:bg-rose-955/40 border border-slate-700 hover:border-rose-900/60 text-slate-400 hover:text-rose-450 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
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
