'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Settings2, Sliders } from 'lucide-react';

interface EditWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  widget: {
    id: string;
    title: string;
    type: string;
    width: string;
    config?: any;
  } | null;
  onUpdateWidget: (widgetId: string, data: {
    title?: string;
    width?: string;
    config?: any;
  }) => Promise<void>;
}

export default function EditWidgetModal({
  isOpen,
  onClose,
  widget,
  onUpdateWidget,
}: EditWidgetModalProps) {
  const [title, setTitle] = useState('');
  const [width, setWidth] = useState('HALF');
  const [dateRange, setDateRange] = useState('30d');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [chartType, setChartType] = useState<string>('');
  const [tableLimit, setTableLimit] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (widget) {
      setTitle(widget.title || '');
      setWidth(widget.width || 'HALF');
      setDateRange(widget.config?.dateRange || '30d');
      setStatusFilter(widget.config?.status || 'ALL');
      setPriorityFilter(widget.config?.priority || 'ALL');
      setChartType(widget.config?.chartType || '');
      setTableLimit(widget.config?.limit || 5);
      setError(null);
    }
  }, [widget]);

  if (!isOpen || !widget) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for the widget.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onUpdateWidget(widget.id, {
        title: title.trim(),
        width,
        config: {
          ...(widget.config || {}),
          dateRange,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
          chartType: chartType || undefined,
          limit: widget.type.startsWith('TABLE_') ? tableLimit : undefined,
        },
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to update widget');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTable = widget.type.startsWith('TABLE_');
  const isChart = widget.type.startsWith('CHART_');
  const isTaskWidget = widget.type.includes('TASK');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Configure Widget</h3>
              <p className="text-xs text-slate-400">Customize appearance and parameters</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Widget Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Width / Grid Columns */}
          <div className="space-y-1">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Column Span Width
            </label>
            <select
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="QUARTER">Quarter Width (1/4 - 3 columns)</option>
              <option value="THIRD">Third Width (1/3 - 4 columns)</option>
              <option value="HALF">Half Width (1/2 - 6 columns)</option>
              <option value="FULL">Full Width (1/1 - 12 columns)</option>
            </select>
          </div>

          {/* Date Range Option */}
          <div className="space-y-1">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Date Range Filter
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="7d">Last 7 Days</option>
              <option value="14d">Last 14 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Status Filter (when applicable) */}
          {isTaskWidget && (
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Workflow Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEW">Review</option>
                <option value="DONE">Done</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>
          )}

          {/* Priority Filter */}
          {isTaskWidget && (
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Priority Filter
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          )}

          {/* Table Row Limit */}
          {isTable && (
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Max Records Displayed
              </label>
              <input
                type="number"
                min={1}
                max={25}
                value={tableLimit}
                onChange={(e) => setTableLimit(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 active:scale-95 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4.5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-xs active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
