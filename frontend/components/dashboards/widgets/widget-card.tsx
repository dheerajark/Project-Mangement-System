'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Settings2,
  Trash2,
  RefreshCw,
  AlertCircle,
  FileText,
  Loader2,
  TrendingUp,
  BarChart2,
  ListTodo,
} from 'lucide-react';

export interface WidgetCardProps {
  widget: {
    id: string;
    title: string;
    type: string;
    position: number;
    width: string; // 'FULL' | 'HALF' | 'THIRD' | 'QUARTER'
    config?: any;
  };
  isLoading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  isEditMode?: boolean;
  canEdit?: boolean;
  onRefresh?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onResize?: (newWidth: string) => void;
  onEditConfig?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}

export default function WidgetCard({
  widget,
  isLoading = false,
  error = null,
  isEmpty = false,
  isEditMode = false,
  canEdit = false,
  onRefresh,
  onMoveLeft,
  onMoveRight,
  onResize,
  onEditConfig,
  onDelete,
  children,
}: WidgetCardProps) {
  // Determine responsive Tailwind column span
  const getWidthClass = (width: string) => {
    switch (width) {
      case 'FULL':
        return 'col-span-12';
      case 'THIRD':
        return 'col-span-12 md:col-span-4';
      case 'QUARTER':
        return 'col-span-12 sm:col-span-6 md:col-span-3';
      case 'HALF':
      default:
        return 'col-span-12 md:col-span-6';
    }
  };

  const isKPI = widget.type.startsWith('KPI_');
  const isChart = widget.type.startsWith('CHART_');
  const isTable = widget.type.startsWith('TABLE_');

  return (
    <div
      className={`${getWidthClass(
        widget.width,
      )} bg-slate-900/30 border border-slate-900 hover:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-all relative group overflow-hidden ${
        isEditMode ? 'ring-1 ring-indigo-500/40 bg-slate-900/50' : ''
      }`}
    >
      {/* Widget Header Toolbar */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-900/70 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider truncate">
            {widget.title}
          </span>
          {widget.config?.status && widget.config.status !== 'ALL' && (
            <span className="text-[9px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full font-mono">
              {widget.config.status}
            </span>
          )}
          {widget.config?.priority && widget.config.priority !== 'ALL' && (
            <span className="text-[9px] px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full font-mono">
              {widget.config.priority}
            </span>
          )}
        </div>

        {/* Edit Toolbar Controls (When in Edit Mode) */}
        {isEditMode && canEdit ? (
          <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 p-1 rounded-xl shadow-lg">
            {onMoveLeft && (
              <button
                type="button"
                onClick={onMoveLeft}
                title="Move Left / Earlier"
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {onMoveRight && (
              <button
                type="button"
                onClick={onMoveRight}
                title="Move Right / Later"
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Resize Width Selector */}
            {onResize && (
              <div className="flex items-center gap-0.5 border-l border-r border-slate-850 px-1">
                {(['QUARTER', 'THIRD', 'HALF', 'FULL'] as const).map((w) => {
                  const label = w === 'QUARTER' ? '1/4' : w === 'THIRD' ? '1/3' : w === 'HALF' ? '1/2' : 'Full';
                  const isCurrent = widget.width === w;
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => onResize(w)}
                      title={`Set width to ${label}`}
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {onEditConfig && (
              <button
                type="button"
                onClick={onEditConfig}
                title="Configure Widget Parameters"
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg cursor-pointer transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                title="Remove Widget"
                className="p-1 hover:bg-rose-900/30 text-rose-400 hover:text-rose-300 rounded-lg cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          /* Normal Mode Action Buttons */
          <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Refresh Widget Data"
                className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
            )}
            <div className="text-slate-600">
              {isKPI && <TrendingUp className="w-4 h-4 text-indigo-400" />}
              {isChart && <BarChart2 className="w-4 h-4 text-blue-400" />}
              {isTable && <ListTodo className="w-4 h-4 text-emerald-400" />}
            </div>
          </div>
        )}
      </div>

      {/* Widget Body Container with Error/Loading/Empty Boundaries */}
      <div className="flex-1 flex flex-col justify-center min-h-[140px] w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-2">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            <span className="text-[11px] text-slate-500 font-medium">Updating data...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-xs text-rose-300 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        ) : isEmpty ? (
          <div className="text-center py-8 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
            <FileText className="w-6 h-6 text-slate-600 opacity-50" />
            <span>No data available for this widget filter</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
