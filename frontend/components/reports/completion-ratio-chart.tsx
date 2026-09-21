'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { CheckCircle2 } from 'lucide-react';

interface CompletionRatioChartProps {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks?: number;
  overdueTasks?: number;
  completionPercentage: number;
  title?: string;
  emptyMessage?: string;
}

export default function CompletionRatioChart({
  totalTasks = 0,
  completedTasks = 0,
  pendingTasks = 0,
  inProgressTasks = 0,
  overdueTasks = 0,
  completionPercentage = 0,
  title = 'Completed vs Pending Tasks',
  emptyMessage = 'No tasks found matching current filters',
}: CompletionRatioChartProps) {
  const hasData = totalTasks > 0;

  const data = [
    {
      name: 'Completed',
      value: completedTasks,
      color: '#10b981', // Emerald
    },
    {
      name: 'In Progress',
      value: inProgressTasks,
      color: '#3b82f6', // Blue
    },
    {
      name: 'Remaining Pending',
      value: Math.max(0, pendingTasks - inProgressTasks - overdueTasks),
      color: '#64748b', // Slate
    },
    {
      name: 'Overdue',
      value: overdueTasks,
      color: '#f43f5e', // Rose
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-lg flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{title}</span>
        </h4>
        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
          {completionPercentage}% Done
        </span>
      </div>

      <div className="h-64 flex flex-col sm:flex-row items-center justify-center gap-4">
        {hasData ? (
          <>
            <div className="w-full sm:w-[50%] h-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {data.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
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
                    formatter={(val: any, name: any) => [
                      `${val} tasks (${totalTasks > 0 ? Math.round(((val as number) / totalTasks) * 100) : 0}%)`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Ratio Metric */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-100">
                  {completionPercentage}%
                </span>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  Progress
                </span>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="flex flex-col gap-2 shrink-0 w-full sm:w-[50%]">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-900">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-300 font-medium">Completed</span>
                </div>
                <span className="text-xs font-bold text-emerald-400">
                  {completedTasks} <span className="text-[10px] text-slate-500 font-normal">({totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-900">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-xs text-slate-300 font-medium">In Progress</span>
                </div>
                <span className="text-xs font-bold text-blue-400">
                  {inProgressTasks} <span className="text-[10px] text-slate-500 font-normal">({totalTasks > 0 ? Math.round((inProgressTasks / totalTasks) * 100) : 0}%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-900">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                  <span className="text-xs text-slate-300 font-medium">Pending Remaining</span>
                </div>
                <span className="text-xs font-bold text-slate-300">
                  {pendingTasks} <span className="text-[10px] text-slate-500 font-normal">({totalTasks > 0 ? Math.round((pendingTasks / totalTasks) * 100) : 0}%)</span>
                </span>
              </div>

              {overdueTasks > 0 && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-xs text-rose-300 font-medium">Overdue (Late)</span>
                  </div>
                  <span className="text-xs font-bold text-rose-400">
                    {overdueTasks} <span className="text-[10px] text-rose-400/70 font-normal">({totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0}%)</span>
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-slate-500 text-xs py-12 text-center">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}
