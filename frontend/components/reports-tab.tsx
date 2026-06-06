'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  TrendingUp,
  Download,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Flag,
  ChevronUp,
  ChevronDown,
  Activity,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';

interface ReportsTabProps {
  projectId: string;
}

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#475569'];

export default function ReportsTab({ projectId }: ReportsTabProps) {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<string>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [velocityView, setVelocityView] = useState<'weekly' | 'monthly'>('weekly');
  const [sortField, setSortField] = useState<string>('assignedTasks');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Handle mounting state to avoid hydration issues with Recharts
  useEffect(() => {
    setMounted(true);
  }, []);

  // Set default dates for custom date picker
  useEffect(() => {
    if (range === 'custom') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [range]);

  // Fetch report data
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['project-reports', projectId, range, startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = { range };
      if (range === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      const res = await api.get(`/projects/${projectId}/reports/summary`, { params });
      return res.data;
    },
    enabled: mounted && (range !== 'custom' || (!!startDate && !!endDate)),
  });

  const handleExportCSV = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/reports/export`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project-report-${projectId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export CSV', err);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto" />
          <p className="text-slate-400 text-sm">Loading Project Reports & Analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="bg-rose-950/20 border border-rose-900/60 text-rose-200 p-6 rounded-2xl flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-rose-500 shrink-0" />
        <div>
          <h4 className="font-bold text-sm">Failed to load reports</h4>
          <p className="text-rose-450/80 text-xs mt-1">
            An error occurred while compiling reporting metrics. Please ensure you have permission to view project reports.
          </p>
        </div>
      </div>
    );
  }

  const { metrics, distributions, productivity, velocity, trends, topOverdueTasks } = report;

  // Sorting productivity table data
  const sortedProductivity = [...(productivity || [])].sort((a: any, b: any) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 inline ml-1 text-indigo-400" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 inline ml-1 text-indigo-400" />
    );
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      default:
        return 'bg-slate-900 text-slate-400 border border-slate-800';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/20 p-4 border border-slate-900 rounded-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Reporting Window:</span>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
            {['7d', '30d', '90d', 'custom'].map((opt) => (
              <button
                key={opt}
                onClick={() => setRange(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${range === opt
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {opt === 'custom' ? 'Custom' : opt === '7d' ? '7 Days' : opt === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div className="flex items-center gap-2 animate-fade-in">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-250 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-250 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4.5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-100 rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          <Download className="w-4 h-4 text-indigo-400" />
          Export CSV Summary
        </button>
      </div>

      {/* Summary Ribbon Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tasks Card */}
        <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 md:p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Task Progress</span>
            <div className="p-1.5 bg-indigo-500/10 rounded-lg">
              <CheckCircle2 className="w-4.5 h-4.5 text-indigo-400" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-50">{metrics.completedTasks}</span>
              <span className="text-xs text-slate-500">/ {metrics.totalTasks} Done</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-3 border border-slate-900">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${metrics.progress}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase mt-2">
              <span>{Math.round(metrics.progress)}% Complete</span>
              <span className="text-rose-450">{metrics.overdueTasks} Overdue</span>
            </div>
          </div>
        </article>

        {/* Time Logs Card */}
        <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 md:p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Time Logs</span>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg">
              <Clock className="w-4.5 h-4.5 text-emerald-400" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-50">{metrics.totalHoursLogged.toFixed(1)}h</span>
              <span className="text-xs text-slate-500">Logged</span>
            </div>
            <div className="text-[10px] font-semibold text-slate-450 mt-1.5">
              Estimated: <span className="font-mono text-slate-300">{metrics.totalEstimatedHours}h total</span>
            </div>
            <span className="text-[9px] font-bold text-emerald-400 uppercase bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 inline-block mt-3">
              Read-Only Logs
            </span>
          </div>
        </article>

        {/* Issues Card */}
        <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 md:p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Issues Analytics</span>
            <div className="p-1.5 bg-rose-500/10 rounded-lg">
              <AlertCircle className="w-4.5 h-4.5 text-rose-400" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-50">{metrics.openIssues}</span>
              <span className="text-xs text-slate-500">Active Issues</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-semibold text-slate-450 mt-1">
              <span>Resolved: {metrics.resolvedIssues}</span>
              <span className="text-rose-400 font-bold">Critical: {metrics.criticalIssues}</span>
            </div>
            <div className="text-[9px] font-semibold text-slate-500 mt-2">
              Avg resolution: <span className="text-slate-350">{metrics.avgResolutionTimeHours.toFixed(1)}h</span>
            </div>
          </div>
        </article>

        {/* Milestones Card */}
        <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 md:p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Milestones</span>
            <div className="p-1.5 bg-violet-500/10 rounded-lg">
              <Flag className="w-4.5 h-4.5 text-violet-400" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-50">{metrics.achievedMilestones}</span>
              <span className="text-xs text-slate-500">/ {metrics.totalMilestones} Achieved</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase mt-2.5">
              <span className="text-indigo-400">Planned: {metrics.plannedMilestones}</span>
              <span className="text-emerald-400">Active: {metrics.inProgressMilestones}</span>
              <span className="text-rose-400 col-span-2">Missed Target: {metrics.missedMilestones}</span>
            </div>
          </div>
        </article>
      </div>

      {/* Distributions (Donuts) Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Status Distribution */}
        <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
          <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Task Status Distribution
          </h3>
          <div className="h-64 flex flex-col sm:flex-row items-center justify-center gap-4">
            {distributions.taskStatus.some((d: any) => d.count > 0) ? (
              <>
                <div className="w-full sm:w-[60%] h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributions.taskStatus.filter((d: any) => d.count > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="count"
                        nameKey="status"
                      >
                        {distributions.taskStatus.filter((d: any) => d.count > 0).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #1e293b',
                          borderRadius: '12px',
                          fontSize: '11px',
                          color: '#f8fafc',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {distributions.taskStatus.map((d: any, idx: number) => (
                    <div key={d.status} className="flex items-center gap-2.5 text-xs">
                      <div
                        className="w-3 h-3 rounded-full border border-white/10"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-slate-400 capitalize">{d.status.toLowerCase().replace('_', ' ')}</span>
                      <span className="font-bold text-slate-200">({d.count})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-xs py-12">No tasks available in this project</div>
            )}
          </div>
        </article>

        {/* Issue Status Distribution */}
        <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
          <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-450" />
            Issue Status Distribution
          </h3>
          <div className="h-64 flex flex-col sm:flex-row items-center justify-center gap-4">
            {distributions.issueStatus.some((d: any) => d.count > 0) ? (
              <>
                <div className="w-full sm:w-[60%] h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributions.issueStatus.filter((d: any) => d.count > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="count"
                        nameKey="status"
                      >
                        {distributions.issueStatus.filter((d: any) => d.count > 0).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #1e293b',
                          borderRadius: '12px',
                          fontSize: '11px',
                          color: '#f8fafc',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {distributions.issueStatus.map((d: any, idx: number) => (
                    <div key={d.status} className="flex items-center gap-2.5 text-xs">
                      <div
                        className="w-3 h-3 rounded-full border border-white/10"
                        style={{ backgroundColor: COLORS[(idx + 2) % COLORS.length] }}
                      />
                      <span className="text-slate-400 capitalize">{d.status.toLowerCase()}</span>
                      <span className="font-bold text-slate-200">({d.count})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-xs py-12">No issues registered in this project</div>
            )}
          </div>
        </article>
      </div>

      {/* Task Velocity and Overdue Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Velocity */}
        <article className="lg:col-span-2 bg-slate-900/30 border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Task Delivery Velocity
            </h3>
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
              <button
                onClick={() => setVelocityView('weekly')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${velocityView === 'weekly' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-350'
                  }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setVelocityView('monthly')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${velocityView === 'monthly' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-350'
                  }`}
              >
                Monthly
              </button>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={velocityView === 'weekly' ? velocity.weekly : velocity.monthly}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey={velocityView === 'weekly' ? 'week' : 'month'}
                  stroke="#475569"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#f8fafc',
                  }}
                />
                <Bar dataKey="completedTasks" name="Completed Tasks" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Overdue Task Trend */}
        <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
          <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Overdue Tasks Trend
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends.overdue} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  stroke="#475569"
                  fontSize={9}
                  tickLine={false}
                  tickFormatter={(tick) => tick.substring(5)}
                />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#f8fafc',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Overdue Tasks"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      {/* Daily Tracked Hours Area Chart */}
      <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
        <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          Hours Tracked Timeline
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends.hoursLogged} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                stroke="#475569"
                fontSize={9}
                tickLine={false}
                tickFormatter={(tick) => tick.substring(5)}
              />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  fontSize: '11px',
                  color: '#f8fafc',
                }}
              />
              <Area
                type="monotone"
                dataKey="hours"
                name="Hours Tracked"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorHours)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      {/* Top 5 Overdue Tasks and Member Productivity Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Overdue Tasks Table */}
        <article className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 flex flex-col justify-between overflow-hidden">
          <div>
            <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-4 h-4 text-rose-450" />
              Top 5 Overdue Tasks
            </h3>
            {topOverdueTasks.length > 0 ? (
              <div className="space-y-3.5 mt-2">
                {topOverdueTasks.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-3.5 bg-slate-950/60 border border-slate-900 rounded-xl flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] px-1.5 py-0.5 bg-slate-900 border border-slate-850 rounded text-slate-400 font-semibold shrink-0">
                          {t.taskNumber}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[7.5px] font-bold border uppercase tracking-wider shrink-0 ${getSeverityBadgeColor(t.priority)}`}>
                          {t.priority}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-200 line-clamp-1 leading-snug">{t.title}</h4>
                      <p className="text-[9px] text-slate-500 truncate">Assignee: {t.assignee}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-rose-400 bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10">
                        {t.daysOverdue}d late
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-40 mb-2" />
                <p className="text-slate-500 text-xs">No overdue tasks in this project!</p>
              </div>
            )}
          </div>
        </article>

        {/* Member Productivity Table */}
        <article className="lg:col-span-2 bg-slate-900/30 border border-slate-900 rounded-2xl p-6 overflow-hidden">
          <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Member Productivity Metrics
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th
                    onClick={() => handleSort('name')}
                    className="pb-3.5 cursor-pointer hover:text-slate-300 transition-colors"
                  >
                    Team Member {getSortIcon('name')}
                  </th>
                  <th
                    onClick={() => handleSort('assignedTasks')}
                    className="pb-3.5 cursor-pointer hover:text-slate-300 text-right transition-colors"
                  >
                    Assigned {getSortIcon('assignedTasks')}
                  </th>
                  <th
                    onClick={() => handleSort('completedTasks')}
                    className="pb-3.5 cursor-pointer hover:text-slate-300 text-right transition-colors"
                  >
                    Completed {getSortIcon('completedTasks')}
                  </th>
                  <th
                    onClick={() => handleSort('openTasks')}
                    className="pb-3.5 cursor-pointer hover:text-slate-300 text-right transition-colors"
                  >
                    Open {getSortIcon('openTasks')}
                  </th>
                  <th
                    onClick={() => handleSort('hoursLogged')}
                    className="pb-3.5 cursor-pointer hover:text-slate-300 text-right transition-colors"
                  >
                    Hours Logged {getSortIcon('hoursLogged')}
                  </th>
                  <th
                    onClick={() => handleSort('issuesResolved')}
                    className="pb-3.5 cursor-pointer hover:text-slate-300 text-right transition-colors"
                  >
                    Issues Resolved {getSortIcon('issuesResolved')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60">
                {sortedProductivity.map((m: any) => (
                  <tr key={m.userId} className="hover:bg-slate-950/20 transition-colors group">
                    <td className="py-3.5 flex items-center gap-2.5 font-bold text-slate-200">
                      <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0 text-[9px] uppercase">
                        {m.name ? m.name[0] : '?'}
                      </div>
                      <span className="truncate max-w-[150px]">{m.name}</span>
                    </td>
                    <td className="py-3.5 text-right font-semibold text-slate-300">{m.assignedTasks}</td>
                    <td className="py-3.5 text-right font-semibold text-emerald-400">{m.completedTasks}</td>
                    <td className="py-3.5 text-right font-semibold text-indigo-400">{m.openTasks}</td>
                    <td className="py-3.5 text-right font-semibold font-mono text-slate-300">{m.hoursLogged.toFixed(1)}h</td>
                    <td className="py-3.5 text-right font-semibold text-emerald-400">{m.issuesResolved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </div>
  );
}
