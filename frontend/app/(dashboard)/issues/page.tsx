'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
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
  Search,
  Circle,
  UserCircle2,
  ArrowUpRight,
  Sliders,
  LogOut,
  Settings,
} from 'lucide-react';
import GlobalIssueModal from '@/components/global-issue-modal';
import IssueDetailDrawer from '@/components/issue-detail-drawer';
import NotificationBell from '@/components/notification-bell';
import Header from '@/components/header';
import Link from 'next/link';
import { useFormatDate } from '@/hooks/useFormatDate';

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
  HIGH: 'bg-amber-500/15 text-amber-450 border border-amber-500/25',
  MEDIUM: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  LOW: 'bg-slate-700/30 text-slate-400 border border-slate-700/50',
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  BUG: { label: 'Bug', color: 'text-rose-400' },
  FEATURE_REQUEST: { label: 'Feature', color: 'text-violet-400' },
  IMPROVEMENT: { label: 'Improvement', color: 'text-emerald-400' },
  SUPPORT: { label: 'Support', color: 'text-amber-400' },
};

export default function IssuesPage() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const customFormatDate = useFormatDate();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Dropdown filter states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [searchText, setSearchText] = useState('');

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Queries: Projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const activeProjects = projects.filter((p: any) => p.status !== 'ARCHIVED');

  // Queries: Organization Members
  const { data: orgMembers = [] } = useQuery({
    queryKey: ['orgMembers'],
    queryFn: async () => {
      const res = await api.get('/organization/members');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // Queries: All Issues with filters
  const { data: issues = [], isLoading: isLoadingIssues } = useQuery({
    queryKey: [
      'global-issues',
      selectedProjectId,
      selectedAssigneeId,
      selectedStatus,
      selectedSeverity,
      selectedType,
      searchText,
    ],
    queryFn: async () => {
      const params: any = {};
      if (selectedProjectId) params.projectId = selectedProjectId;
      if (selectedAssigneeId) params.assigneeId = selectedAssigneeId;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedSeverity) params.severity = selectedSeverity;
      if (selectedType) params.type = selectedType;
      if (searchText.trim()) params.search = searchText.trim();

      const res = await api.get('/issues', { params });
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const handleLogout = async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  // Status aggregation calculations
  const openCount = issues.filter((i: any) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'].includes(i.status)).length;
  const resolvedCount = issues.filter((i: any) => ['RESOLVED', 'CLOSED'].includes(i.status)).length;
  const criticalCount = issues.filter((i: any) => i.severity === 'CRITICAL').length;
  const highCount = issues.filter((i: any) => i.severity === 'HIGH').length;

  const getMemberName = (member: any) => {
    if (!member) return 'Unassigned';
    return member.firstName ? `${member.firstName} ${member.lastName || ''}`.trim() : member.email;
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return customFormatDate(date);
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const canCreate = hasPermission('CREATE_ISSUE');
  const canEdit = hasPermission('EDIT_ISSUE');

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Header */}
      <Header title="Issues Dashboard" subtitle="Issues Portal" />

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Metric Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Active Open</span>
              <Circle className="w-4 h-4 text-blue-400" />
            </div>
            <div className="font-mono text-xl font-bold text-blue-400 mt-2">{openCount}</div>
          </div>

          <div className="bg-slate-900/35 border border-slate-900/80 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-slate-800 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Resolved</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="font-mono text-xl font-bold text-emerald-400 mt-2">{resolvedCount}</div>
          </div>

          <div className="bg-rose-950/15 border border-rose-900/30 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-rose-900/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-rose-500/70 uppercase tracking-wider">Critical</span>
              <Flame className="w-4 h-4 text-rose-455" />
            </div>
            <div className="font-mono text-xl font-bold text-rose-400 mt-2">{criticalCount}</div>
          </div>

          <div className="bg-amber-955/10 border border-amber-900/20 rounded-2xl p-4 flex flex-col justify-between min-h-[90px] hover:border-amber-900/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-amber-500/70 uppercase tracking-wider">High</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="font-mono text-xl font-bold text-amber-405 mt-2">{highCount}</div>
          </div>
        </section>

        {/* Filters and Search toolbar */}
        <section className="bg-slate-900/20 border border-slate-900 p-5 rounded-2xl space-y-4 backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search issues by title or description..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Create Button */}
            {canCreate && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4.5 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-655/15 cursor-pointer self-start md:self-auto"
              >
                <Plus className="w-4 h-4" /> Report Issue
              </button>
            )}
          </div>

          <div className="h-px bg-slate-900/60 w-full" />

          {/* Filters Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Project Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Projects</option>
                {activeProjects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Assignee</label>
              <select
                value={selectedAssigneeId}
                onChange={(e) => setSelectedAssigneeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">Everyone</option>
                {orgMembers.map((om: any) => (
                  <option key={om.userId} value={om.userId}>
                    {om.user.firstName ? `${om.user.firstName} ${om.user.lastName || ''}` : om.user.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
                <option value="REOPENED">Reopened</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Severity</label>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Severity</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Types</option>
                <option value="BUG">Bug</option>
                <option value="FEATURE_REQUEST">Feature Request</option>
                <option value="IMPROVEMENT">Improvement</option>
                <option value="SUPPORT">Support</option>
              </select>
            </div>
          </div>
        </section>

        {/* Issues List Grid */}
        <section className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden">
          {isLoadingIssues ? (
            <div className="py-16 flex flex-col justify-center items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-400">Loading issues...</span>
            </div>
          ) : issues.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-6 py-4 w-28">ID</th>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Project</th>
                    <th className="px-6 py-4 w-24">Type</th>
                    <th className="px-6 py-4 w-24">Severity</th>
                    <th className="px-6 py-4 w-28">Status</th>
                    <th className="px-6 py-4 w-32">Assignee</th>
                    <th className="px-6 py-4 text-center">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {issues.map((issue: any) => (
                    <tr
                      key={issue.id}
                      onClick={() => setSelectedIssueId(issue.id)}
                      className="hover:bg-slate-900/25 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-3.5">
                        <span className="font-mono text-indigo-400/70 text-[10px] font-semibold">
                          {issue.project?.projectCode}-ISSUE-{issue.issueNumber}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-slate-200 group-hover:text-white transition-colors">
                          {issue.title}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-400 font-medium">
                        {issue.project?.name}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`text-[10px] font-semibold ${TYPE_LABELS[issue.type]?.color}`}>
                          {TYPE_LABELS[issue.type]?.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${SEVERITY_COLORS[issue.severity]}`}>
                          {issue.severity}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_COLORS[issue.status]}`}>
                          {issue.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        {issue.assignee ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5.5 h-5.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold flex items-center justify-center shrink-0 text-[8px] uppercase">
                              {(issue.assignee.firstName?.[0] || issue.assignee.email[0]).toUpperCase()}
                            </div>
                            <span className="text-slate-400 font-semibold truncate max-w-[80px]">
                              {getMemberName(issue.assignee)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 flex items-center gap-1 text-[10px] italic">
                            <UserCircle2 className="w-3.5 h-3.5" /> Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors mx-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-20">
              <Bug className="w-12 h-12 text-slate-700 mx-auto mb-3.5" />
              <h3 className="text-sm font-bold text-slate-250">No issues found</h3>
              <p className="text-xs text-slate-500 mt-1">Adjust filters or report a new issue to get started.</p>
            </div>
          )}
        </section>
      </main>

      {/* Global Report Modal */}
      <GlobalIssueModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Issue Detail Drawer */}
      {selectedIssueId && (
        <IssueDetailDrawer
          issueId={selectedIssueId}
          onClose={() => {
            setSelectedIssueId(null);
            queryClient.invalidateQueries({ queryKey: ['global-issues'] });
          }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
