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
  Cell,
} from 'recharts';
import { Layers } from 'lucide-react';

interface PriorityDistributionItem {
  priority: string;
  label: string;
  count: number;
  percentage: number;
  color?: string;
}

interface PriorityDistributionChartProps {
  data: PriorityDistributionItem[];
  title?: string;
  emptyMessage?: string;
}

const DEFAULT_PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#f43f5e', // Rose
  HIGH: '#f97316', // Orange
  MEDIUM: '#3b82f6', // Blue
  LOW: '#10b981', // Emerald
};

export default function PriorityDistributionChart({
  data = [],
  title = 'Tasks by Priority',
  emptyMessage = 'No tasks found matching current filters',
}: PriorityDistributionChartProps) {
  const hasData = data.some((d) => d.count > 0);
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-lg flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-orange-400" />
          <span>{title}</span>
        </h4>
        <span className="text-[11px] font-semibold text-slate-400">
          {totalCount} Total
        </span>
      </div>

      <div className="h-64 flex flex-col justify-center">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
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
                formatter={(val: any, name: any, item: any) => [
                  `${val} tasks (${item.payload.percentage}%)`,
                  item.payload.label,
                ]}
              />
              <Bar dataKey="count" name="Tasks" radius={[6, 6, 0, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={entry.priority}
                    fill={
                      entry.color ||
                      DEFAULT_PRIORITY_COLORS[entry.priority] ||
                      '#3b82f6'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-slate-500 text-xs py-12 text-center">
            {emptyMessage}
          </div>
        )}
      </div>

      {/* Footer Breakdown Row */}
      {hasData && (
        <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-900 mt-2 text-center">
          {data.map((d) => (
            <div key={d.priority} className="space-y-0.5">
              <span className="text-[10px] text-slate-500 font-semibold block capitalize">
                {d.label.toLowerCase()}
              </span>
              <span className="text-xs font-bold text-slate-200">
                {d.count} ({d.percentage}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
