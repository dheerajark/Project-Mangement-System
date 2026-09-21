'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Users } from 'lucide-react';

interface AssigneeWorkloadItem {
  userId: string | null;
  name: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  progress: number;
}

interface AssigneeWorkloadChartProps {
  data: AssigneeWorkloadItem[];
  title?: string;
  emptyMessage?: string;
}

export default function AssigneeWorkloadChart({
  data = [],
  title = 'Tasks by Assignee (Workload Distribution)',
  emptyMessage = 'No assignees found matching current filters',
}: AssigneeWorkloadChartProps) {
  const hasData = data.some((d) => d.totalTasks > 0);
  // Show top 8 assignees with most tasks if list is large
  const displayData = data.slice(0, 8).map((d) => ({
    name: d.name.length > 14 ? `${d.name.slice(0, 12)}...` : d.name,
    fullName: d.name,
    Completed: d.completedTasks,
    'In Progress': d.inProgressTasks,
    Pending: Math.max(0, d.pendingTasks - d.inProgressTasks - d.overdueTasks),
    Overdue: d.overdueTasks,
    Total: d.totalTasks,
  }));

  return (
    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-lg flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>{title}</span>
        </h4>
        <span className="text-[11px] font-semibold text-slate-400">
          {data.length} Members
        </span>
      </div>

      <div className="h-64 flex flex-col justify-center">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={displayData}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  fontSize: '11px',
                  color: '#f8fafc',
                }}
                formatter={(val: any, name: any) => [`${val} tasks`, name]}
                labelFormatter={(_, items) => {
                  if (items && items.length > 0) {
                    return items[0].payload.fullName;
                  }
                  return '';
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="circle"
                iconSize={8}
              />
              <Bar dataKey="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="In Progress" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Pending" stackId="a" fill="#64748b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Overdue" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-slate-500 text-xs py-12 text-center">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}
