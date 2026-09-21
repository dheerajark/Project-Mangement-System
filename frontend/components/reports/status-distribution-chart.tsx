'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { Activity } from 'lucide-react';

interface StatusDistributionItem {
  status: string;
  label: string;
  count: number;
  percentage: number;
  color?: string;
}

interface StatusDistributionChartProps {
  data: StatusDistributionItem[];
  title?: string;
  emptyMessage?: string;
}

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  TODO: '#64748b', // Slate
  IN_PROGRESS: '#3b82f6', // Blue
  REVIEW: '#f59e0b', // Amber
  DONE: '#10b981', // Emerald
  BLOCKED: '#f43f5e', // Rose
};

export default function StatusDistributionChart({
  data = [],
  title = 'Tasks by Status',
  emptyMessage = 'No tasks found matching current filters',
}: StatusDistributionChartProps) {
  const hasData = data.some((d) => d.count > 0);
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-lg flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <span>{title}</span>
        </h4>
        <span className="text-[11px] font-semibold text-slate-400">
          {totalCount} Total
        </span>
      </div>

      <div className="h-64 flex flex-col sm:flex-row items-center justify-center gap-4">
        {hasData ? (
          <>
            <div className="w-full sm:w-[55%] h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.filter((d) => d.count > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={78}
                    paddingAngle={4}
                    dataKey="count"
                    nameKey="label"
                  >
                    {data
                      .filter((d) => d.count > 0)
                      .map((entry) => (
                        <Cell
                          key={entry.status}
                          fill={entry.color || DEFAULT_STATUS_COLORS[entry.status] || '#6366f1'}
                        />
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
                    formatter={(val: any, name: any, item: any) => [
                      `${val} tasks (${item.payload.percentage}%)`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col gap-2 shrink-0 max-h-56 overflow-y-auto pr-1 w-full sm:w-auto">
              {data.map((d) => (
                <div
                  key={d.status}
                  className="flex items-center justify-between sm:justify-start gap-2.5 text-xs py-1 px-2 rounded-lg hover:bg-slate-950/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          d.color || DEFAULT_STATUS_COLORS[d.status] || '#6366f1',
                      }}
                    />
                    <span className="text-slate-400 capitalize font-medium">
                      {(d.label || d.status || '').toLowerCase().replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <span>{d.count}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({d.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
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
