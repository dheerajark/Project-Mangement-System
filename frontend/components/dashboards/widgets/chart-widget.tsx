'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts';
import { PieChart as PieIcon, BarChart2, TrendingUp } from 'lucide-react';

export interface ChartWidgetProps {
  type: string;
  data: any[];
  config?: any;
}

const PALETTE = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function ChartWidget({ type, data, config }: ChartWidgetProps) {
  // Determine default chart mode based on widget type
  const isDefaultDonut =
    type === 'CHART_TASK_STATUS' ||
    type === 'CHART_BILLABLE_VS_NON_BILLABLE';
  const isDefaultArea =
    type === 'CHART_HOURS_LOGGED' ||
    type === 'CHART_TASK_COMPLETION_TREND';

  const [chartMode, setChartMode] = useState<'donut' | 'bar' | 'area'>(
    config?.chartType || (isDefaultDonut ? 'donut' : isDefaultArea ? 'area' : 'bar')
  );

  if (!data || data.length === 0) {
    return null;
  }

  // Value key resolution
  const getValueKey = () => {
    if (type === 'CHART_TASK_STATUS') return 'count';
    if (type === 'CHART_BILLABLE_VS_NON_BILLABLE') return 'hours';
    if (type === 'CHART_HOURS_LOGGED') return 'totalHours';
    if (type === 'CHART_TASK_COMPLETION_TREND') return 'completedTasks';
    if (type === 'CHART_TASK_ASSIGNEE' || type === 'CHART_TASK_LIST' || type === 'CHART_TASK_MILESTONE') {
      return 'totalTasks';
    }
    return 'count';
  };

  // Name / label key resolution
  const getNameKey = () => {
    if (type === 'CHART_TASK_STATUS') return 'label';
    if (type === 'CHART_BILLABLE_VS_NON_BILLABLE') return 'name';
    if (type === 'CHART_HOURS_LOGGED') return 'date';
    if (type === 'CHART_TASK_COMPLETION_TREND') return 'week';
    if (type === 'CHART_TASK_ASSIGNEE' || type === 'CHART_TASK_LIST') return 'name';
    if (type === 'CHART_TASK_MILESTONE') return 'title';
    return 'label';
  };

  const valueKey = getValueKey();
  const nameKey = getNameKey();

  // Custom Dark Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
          <p className="font-semibold text-slate-200">{label || item.name}</p>
          <p className="text-slate-400 font-mono">
            <span className="font-bold text-indigo-400">{item.value}</span>{' '}
            {type.includes('HOURS') ? 'hours' : 'tasks'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full flex flex-col space-y-2 pt-1">
      {/* Chart View Switcher Toolbar */}
      <div className="flex justify-end items-center gap-1 pb-1">
        {(isDefaultDonut || type === 'CHART_TASK_PRIORITY') && (
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
            <button
              type="button"
              onClick={() => setChartMode('donut')}
              title="Donut Chart View"
              className={`p-1 rounded-md text-xs cursor-pointer transition-colors ${
                chartMode === 'donut'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              title="Bar Chart View"
              className={`p-1 rounded-md text-xs cursor-pointer transition-colors ${
                chartMode === 'bar'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isDefaultArea && (
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
            <button
              type="button"
              onClick={() => setChartMode('area')}
              title="Area Trend View"
              className={`p-1 rounded-md text-xs cursor-pointer transition-colors ${
                chartMode === 'area'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              title="Bar Chart View"
              className={`p-1 rounded-md text-xs cursor-pointer transition-colors ${
                chartMode === 'bar'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="h-56 sm:h-64 w-full">
        {chartMode === 'donut' ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey={valueKey}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={4}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || PALETTE[index % PALETTE.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={32}
                formatter={(val) => (
                  <span className="text-[10px] text-slate-300 font-medium">
                    {val}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : chartMode === 'area' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey={nameKey}
                stroke="#475569"
                fontSize={9}
                tickLine={false}
                tickFormatter={(tick) => (typeof tick === 'string' && tick.includes('-') ? tick.substring(5) : tick)}
              />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={valueKey}
                name={type.includes('HOURS') ? 'Hours' : 'Completed Tasks'}
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#chartAreaGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey={nameKey}
                stroke="#475569"
                fontSize={9}
                tickLine={false}
              />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey={valueKey}
                name={type.includes('HOURS') ? 'Hours' : 'Tasks'}
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`bar-${index}`}
                    fill={entry.color || PALETTE[index % PALETTE.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
