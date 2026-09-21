'use client';

import React from 'react';
import { useFormatDate } from '@/hooks/useFormatDate';
import { Calendar, User, Clock, AlertCircle, ArrowUpRight } from 'lucide-react';

export interface TableWidgetProps {
  type: string;
  data: any[];
  onSelectTask?: (taskId: string) => void;
}

export default function TableWidget({ type, data, onSelectTask }: TableWidgetProps) {
  const formatDate = useFormatDate();

  if (!data || data.length === 0) {
    return null;
  }

  // Helper for priority badge classes
  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'LOW':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700/50';
    }
  };

  // Helper for status badge classes
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'DONE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'REVIEW':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'BLOCKED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700/50';
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-900 mt-1">
      {type === 'TABLE_RECENT_TIME_LOGS' ? (
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-900">
            <tr>
              <th className="px-3.5 py-2.5">Team Member</th>
              <th className="px-3.5 py-2.5">Task / Note</th>
              <th className="px-3.5 py-2.5">Date</th>
              <th className="px-3.5 py-2.5 text-right">Hours</th>
              <th className="px-3.5 py-2.5 text-right">Billing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/60 bg-slate-900/10">
            {data.map((row: any) => (
              <tr
                key={row.id}
                className="hover:bg-slate-900/40 transition-colors"
              >
                <td className="px-3.5 py-2.5 font-medium text-slate-200">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                      {row.user?.firstName ? row.user.firstName[0] : (row.userName ? row.userName[0] : 'U')}
                    </div>
                    <span className="truncate max-w-[120px]">
                      {row.user ? `${row.user.firstName || ''} ${row.user.lastName || ''}`.trim() : (row.userName || 'Unknown')}
                    </span>
                  </div>
                </td>
                <td className="px-3.5 py-2.5 max-w-[180px] truncate text-slate-300">
                  <span className="font-medium text-slate-200">
                    {row.task ? row.task.title : (row.taskTitle || 'General entry')}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-[10px] text-slate-400 font-mono">
                  {row.loggedAt ? formatDate(row.loggedAt) : '-'}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-400">
                  {row.hours}h
                </td>
                <td className="px-3.5 py-2.5 text-right">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                      row.billable
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700/50'
                    }`}
                  >
                    {row.billable ? 'Billable' : 'Non-Billable'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-900">
            <tr>
              <th className="px-3.5 py-2.5">Task</th>
              <th className="px-3.5 py-2.5">Assignee</th>
              <th className="px-3.5 py-2.5">Priority</th>
              {type !== 'TABLE_OVERDUE_TASKS' && <th className="px-3.5 py-2.5">Status</th>}
              <th className="px-3.5 py-2.5 text-right">
                {type === 'TABLE_OVERDUE_TASKS' ? 'Overdue' : 'Due Date'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/60 bg-slate-900/10">
            {data.map((task: any) => (
              <tr
                key={task.id}
                onClick={() => onSelectTask && onSelectTask(task.id)}
                className={`hover:bg-slate-900/40 transition-colors group ${
                  onSelectTask ? 'cursor-pointer' : ''
                }`}
              >
                <td className="px-3.5 py-2.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] px-1.5 py-0.5 bg-slate-950 border border-slate-850 rounded text-slate-400 shrink-0">
                      {task.taskNumber || 'TASK'}
                    </span>
                    <span className="font-medium text-slate-200 truncate max-w-[150px] sm:max-w-[200px] group-hover:text-indigo-400 transition-colors">
                      {task.title}
                    </span>
                    {onSelectTask && (
                      <ArrowUpRight className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                  </div>
                </td>
                <td className="px-3.5 py-2.5 text-slate-400 text-[11px] truncate max-w-[110px]">
                  {task.assignee?.name || 'Unassigned'}
                </td>
                <td className="px-3.5 py-2.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${getPriorityBadge(
                      task.priority,
                    )}`}
                  >
                    {task.priority || 'NORMAL'}
                  </span>
                </td>
                {type !== 'TABLE_OVERDUE_TASKS' && (
                  <td className="px-3.5 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${getStatusBadge(
                        task.status,
                      )}`}
                    >
                      {task.status || 'TODO'}
                    </span>
                  </td>
                )}
                <td className="px-3.5 py-2.5 text-right font-mono text-[10px]">
                  {type === 'TABLE_OVERDUE_TASKS' ? (
                    <span className="inline-flex items-center gap-1 text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                      <AlertCircle className="w-3 h-3" />
                      {task.daysOverdue ?? 1}d late
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      {task.dueDate ? formatDate(task.dueDate) : '-'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
