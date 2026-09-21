'use client';

import React from 'react';
import { TrendingUp, AlertTriangle, CheckCircle2, Clock, FolderKanban, Flag } from 'lucide-react';

export interface KpiWidgetProps {
  type: string;
  data: {
    value: number | string;
    unit?: string;
    label?: string;
    subtext?: string;
    isWarning?: boolean;
    trend?: {
      direction: 'up' | 'down' | 'neutral';
      value?: string;
    };
  } | null;
}

export default function KpiWidget({ type, data }: KpiWidgetProps) {
  if (!data) return null;

  const isWarning = data.isWarning || (type === 'KPI_OVERDUE_TASKS' && Number(data.value) > 0);
  const isCompleteMetric = type === 'KPI_COMPLETED_TASKS' || type === 'KPI_COMPLETED_MILESTONES';
  const isProgressMetric = type === 'KPI_PROJECT_PROGRESS';
  const isHourMetric = type === 'KPI_LOGGED_HOURS' || type === 'KPI_BILLABLE_HOURS' || type === 'KPI_NON_BILLABLE_HOURS';

  return (
    <div className="flex flex-col justify-center space-y-2 py-2">
      {/* Primary Value and Unit */}
      <div className="flex items-baseline gap-2.5">
        <span
          className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tight ${
            isWarning
              ? 'text-rose-500'
              : isCompleteMetric
              ? 'text-emerald-400'
              : 'text-slate-100 bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent'
          }`}
        >
          {data.value ?? 0}
        </span>
        {data.unit && (
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
            {data.unit}
          </span>
        )}
      </div>

      {/* Progress Bar (if Project Progress) */}
      {isProgressMetric && typeof data.value === 'number' && (
        <div className="w-full bg-slate-950 border border-slate-850 rounded-full h-2 overflow-hidden my-1">
          <div
            className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, data.value))}%` }}
          />
        </div>
      )}

      {/* Subtext and Contextual Badges */}
      {data.subtext && (
        <div className="flex items-center gap-2 pt-0.5">
          {isWarning ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
              <AlertTriangle className="w-3 h-3" />
              {data.subtext}
            </span>
          ) : isCompleteMetric ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3" />
              {data.subtext}
            </span>
          ) : (
            <p className="text-[11px] text-slate-400 font-medium">
              {data.subtext}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
