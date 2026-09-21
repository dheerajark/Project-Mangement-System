'use client';

import React from 'react';
import WidgetCard from './widgets/widget-card';
import KpiWidget from './widgets/kpi-widget';
import ChartWidget from './widgets/chart-widget';
import TableWidget from './widgets/table-widget';

export interface WidgetRendererProps {
  widget: {
    id: string;
    title: string;
    type: string;
    position: number;
    width: string; // 'FULL' | 'HALF' | 'THIRD' | 'QUARTER'
    config?: any;
  };
  data?: {
    widgetId?: string;
    type?: string;
    title?: string;
    data?: any;
    isEmpty?: boolean;
    error?: string | null;
  } | null;
  isLoading?: boolean;
  isEditMode: boolean;
  canEdit: boolean;
  onRefresh?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onResize?: (newWidth: string) => void;
  onEditConfig?: () => void;
  onDelete?: () => void;
  onSelectTask?: (taskId: string) => void;
}

export default function WidgetRenderer({
  widget,
  data,
  isLoading = false,
  isEditMode,
  canEdit,
  onRefresh,
  onMoveLeft,
  onMoveRight,
  onResize,
  onEditConfig,
  onDelete,
  onSelectTask,
}: WidgetRendererProps) {
  const isKPI = widget.type.startsWith('KPI_');
  const isChart = widget.type.startsWith('CHART_');
  const isTable = widget.type.startsWith('TABLE_');

  const isEmpty = data?.isEmpty || !data || data.data === null || (Array.isArray(data.data) && data.data.length === 0);
  const error = data?.error || null;

  return (
    <WidgetCard
      widget={widget}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      isEditMode={isEditMode}
      canEdit={canEdit}
      onRefresh={onRefresh}
      onMoveLeft={onMoveLeft}
      onMoveRight={onMoveRight}
      onResize={onResize}
      onEditConfig={onEditConfig}
      onDelete={onDelete}
    >
      {isKPI && <KpiWidget type={widget.type} data={data?.data} />}
      {isChart && <ChartWidget type={widget.type} data={data?.data} config={widget.config} />}
      {isTable && (
        <TableWidget
          type={widget.type}
          data={data?.data}
          onSelectTask={onSelectTask}
        />
      )}
    </WidgetCard>
  );
}
