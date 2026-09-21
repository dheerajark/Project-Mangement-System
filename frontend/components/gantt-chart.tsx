'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useFormatDate } from '@/hooks/useFormatDate';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Plus,
  Layers,
  ArrowRight,
  Trash2,
  Edit2,
  X,
  AlertTriangle,
  Clock,
  User,
  CheckCircle2,
  Info,
  Link as LinkIcon,
  Unlink,
  Activity,
  Flame,
  Flag,
} from 'lucide-react';

interface GanttChartProps {
  projectId: string;
  tasks: any[];
  milestones?: any[];
  canEditTask: boolean;
  onTaskClick: (taskId: string) => void;
  onOpenCreateTaskModal?: () => void;
}

export default function GanttChart({
  projectId,
  tasks = [],
  milestones = [],
  canEditTask,
  onTaskClick,
  onOpenCreateTaskModal,
}: GanttChartProps) {
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Time View mode: 'day' | 'week' | 'month'
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month'>('day');

  // Critical Path mode toggle
  const [showCriticalPath, setShowCriticalPath] = useState(false);

  // Interactive dependency drawing state
  const [linkingSourceTaskId, setLinkingSourceTaskId] = useState<string | null>(null);
  const [selectedDependency, setSelectedDependency] = useState<any | null>(null);
  const [isDependencyModalOpen, setIsDependencyModalOpen] = useState(false);
  const [newDepType, setNewDepType] = useState<string>('FINISH_TO_START');
  const [newDepLag, setNewDepLag] = useState<number>(0);
  const [newDepLinkType, setNewDepLinkType] = useState<string>('HARD');
  const [targetSuccessorId, setTargetSuccessorId] = useState<string | null>(null);
  const [dependencyError, setDependencyError] = useState<string | null>(null);

  // Drag & Rescheduling state
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<'move' | 'resize-left' | 'resize-right' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragDeltaDays, setDragDeltaDays] = useState<number>(0);

  // Fetch Project Dependencies for Gantt arrows
  const { data: dependencies = [], isLoading: isLoadingDeps } = useQuery({
    queryKey: ['project-dependencies', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/dependencies`);
      return res.data;
    },
    enabled: !!projectId,
  });

  // Create dependency mutation
  const createDependencyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(`/tasks/${data.successorId}/dependencies`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-dependencies', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
      setIsDependencyModalOpen(false);
      setLinkingSourceTaskId(null);
      setTargetSuccessorId(null);
      setDependencyError(null);
    },
    onError: (err: any) => {
      setDependencyError(err?.response?.data?.message || 'Failed to create dependency');
    },
  });

  // Delete dependency mutation
  const deleteDependencyMutation = useMutation({
    mutationFn: async (dependencyId: string) => {
      const res = await api.delete(`/tasks/dependencies/${dependencyId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-dependencies', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
      setSelectedDependency(null);
    },
  });

  // Update task dates mutation (for drag / resize)
  const updateTaskDatesMutation = useMutation({
    mutationFn: async ({
      taskId,
      startDate,
      dueDate,
    }: {
      taskId: string;
      startDate: string;
      dueDate: string;
    }) => {
      const res = await api.patch(`/tasks/${taskId}`, { startDate, dueDate });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
      setDraggingTaskId(null);
      setDragMode(null);
      setDragDeltaDays(0);
    },
    onError: () => {
      setDraggingTaskId(null);
      setDragMode(null);
      setDragDeltaDays(0);
    },
  });

  // Compute timeline boundaries
  const { timelineStart, timelineEnd, totalDays, dayList } = useMemo(() => {
    let minDate = new Date();
    let maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);

    const validDates: Date[] = [];
    tasks.forEach((t) => {
      if (t.startDate) validDates.push(new Date(t.startDate));
      if (t.dueDate) validDates.push(new Date(t.dueDate));
    });

    if (validDates.length > 0) {
      const minTimestamp = Math.min(...validDates.map((d) => d.getTime()));
      const maxTimestamp = Math.max(...validDates.map((d) => d.getTime()));
      minDate = new Date(minTimestamp);
      maxDate = new Date(maxTimestamp);
    }

    // Add padding: 5 days before min and 10 days after max
    const start = new Date(minDate);
    start.setDate(start.getDate() - 5);
    start.setHours(0, 0, 0, 0);

    const end = new Date(maxDate);
    end.setDate(end.getDate() + 10);
    end.setHours(0, 0, 0, 0);

    const daysCount = Math.max(
      15,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const days: Date[] = [];
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }

    return {
      timelineStart: start,
      timelineEnd: end,
      totalDays: daysCount,
      dayList: days,
    };
  }, [tasks]);

  const columnWidth = zoomLevel === 'day' ? 44 : zoomLevel === 'week' ? 24 : 14;
  const totalTimelineWidth = totalDays * columnWidth;
  const rowHeight = 48;

  // Critical Path calculation (CPM algorithm)
  const criticalTaskIds = useMemo(() => {
    if (!showCriticalPath || tasks.length === 0) return new Set<string>();

    const taskMap = new Map<string, any>();
    tasks.forEach((t) => taskMap.set(t.id, t));

    // Calculate duration in days for each task
    const durationMap = new Map<string, number>();
    tasks.forEach((t) => {
      const start = t.startDate ? new Date(t.startDate).getTime() : new Date().getTime();
      const due = t.dueDate ? new Date(t.dueDate).getTime() : start;
      const days = Math.max(1, Math.ceil((due - start) / (1000 * 60 * 60 * 24)) + 1);
      durationMap.set(t.id, days);
    });

    // Graph representation
    const outgoing = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();
    tasks.forEach((t) => {
      outgoing.set(t.id, []);
      incoming.set(t.id, []);
    });

    dependencies.forEach((dep: any) => {
      if (taskMap.has(dep.predecessorId) && taskMap.has(dep.successorId)) {
        outgoing.get(dep.predecessorId)?.push(dep.successorId);
        incoming.get(dep.successorId)?.push(dep.predecessorId);
      }
    });

    // Forward pass: Earliest Finish (EF)
    const efMap = new Map<string, number>();
    const esMap = new Map<string, number>();

    const getES = (taskId: string, visited = new Set<string>()): number => {
      if (visited.has(taskId)) return 0;
      visited.add(taskId);
      const preds = incoming.get(taskId) || [];
      if (preds.length === 0) return 0;
      let maxPredEF = 0;
      preds.forEach((pId) => {
        const pES = esMap.has(pId) ? esMap.get(pId)! : getES(pId, visited);
        const pEF = pES + (durationMap.get(pId) || 1);
        if (pEF > maxPredEF) maxPredEF = pEF;
      });
      return maxPredEF;
    };

    tasks.forEach((t) => {
      const es = getES(t.id);
      esMap.set(t.id, es);
      efMap.set(t.id, es + (durationMap.get(t.id) || 1));
    });

    let projectDuration = 0;
    efMap.forEach((ef) => {
      if (ef > projectDuration) projectDuration = ef;
    });

    // Backward pass: Latest Start (LS)
    const lfMap = new Map<string, number>();
    const lsMap = new Map<string, number>();

    const getLF = (taskId: string, visited = new Set<string>()): number => {
      if (visited.has(taskId)) return projectDuration;
      visited.add(taskId);
      const succs = outgoing.get(taskId) || [];
      if (succs.length === 0) return projectDuration;
      let minSuccLS = projectDuration;
      succs.forEach((sId) => {
        const sLF = lfMap.has(sId) ? lfMap.get(sId)! : getLF(sId, visited);
        const sLS = sLF - (durationMap.get(sId) || 1);
        if (sLS < minSuccLS) minSuccLS = sLS;
      });
      return minSuccLS;
    };

    tasks.forEach((t) => {
      const lf = getLF(t.id);
      lfMap.set(t.id, lf);
      lsMap.set(t.id, lf - (durationMap.get(t.id) || 1));
    });

    // Critical tasks have Total Slack (LS - ES) == 0
    const criticalSet = new Set<string>();
    tasks.forEach((t) => {
      const es = esMap.get(t.id) || 0;
      const ls = lsMap.get(t.id) || 0;
      const slack = Math.abs(ls - es);
      if (slack <= 0.001) {
        criticalSet.add(t.id);
      }
    });

    return criticalSet;
  }, [showCriticalPath, tasks, dependencies]);

  // Map task ID to row geometry on canvas
  const taskGeometryMap = useMemo(() => {
    const map = new Map<
      string,
      {
        rowIndex: number;
        left: number;
        width: number;
        top: number;
        height: number;
        startX: number;
        endX: number;
        centerY: number;
        startDate: Date;
        dueDate: Date;
      }
    >();

    tasks.forEach((task, index) => {
      let taskStart = task.startDate ? new Date(task.startDate) : new Date();
      let taskDue = task.dueDate ? new Date(task.dueDate) : taskStart;
      if (taskDue < taskStart) taskDue = taskStart;

      // Apply dynamic drag delta if actively dragging
      if (draggingTaskId === task.id && dragDeltaDays !== 0) {
        if (dragMode === 'move') {
          const s = new Date(taskStart);
          s.setDate(s.getDate() + dragDeltaDays);
          const d = new Date(taskDue);
          d.setDate(d.getDate() + dragDeltaDays);
          taskStart = s;
          taskDue = d;
        } else if (dragMode === 'resize-left') {
          const s = new Date(taskStart);
          s.setDate(s.getDate() + dragDeltaDays);
          if (s <= taskDue) taskStart = s;
        } else if (dragMode === 'resize-right') {
          const d = new Date(taskDue);
          d.setDate(d.getDate() + dragDeltaDays);
          if (d >= taskStart) taskDue = d;
        }
      }

      const offsetDays =
        (taskStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
      const durationDays = Math.max(
        1,
        (taskDue.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24) + 1,
      );

      const left = Math.max(0, offsetDays * columnWidth);
      const width = Math.max(28, durationDays * columnWidth);
      const top = index * rowHeight + 10;
      const height = 28;

      map.set(task.id, {
        rowIndex: index,
        left,
        width,
        top,
        height,
        startX: left,
        endX: left + width,
        centerY: top + height / 2,
        startDate: taskStart,
        dueDate: taskDue,
      });
    });

    return map;
  }, [tasks, timelineStart, columnWidth, rowHeight, draggingTaskId, dragMode, dragDeltaDays]);

  // Compute SVG arrow paths for dependencies
  const dependencyPaths = useMemo(() => {
    return dependencies
      .map((dep: any) => {
        const fromGeo = taskGeometryMap.get(dep.predecessorId);
        const toGeo = taskGeometryMap.get(dep.successorId);

        if (!fromGeo || !toGeo) return null;

        let startX = fromGeo.endX;
        let startY = fromGeo.centerY;
        let endX = toGeo.startX;
        let endY = toGeo.centerY;

        if (dep.type === 'START_TO_START') {
          startX = fromGeo.startX;
          endX = toGeo.startX;
        } else if (dep.type === 'FINISH_TO_FINISH') {
          startX = fromGeo.endX;
          endX = toGeo.endX;
        } else if (dep.type === 'START_TO_FINISH') {
          startX = fromGeo.startX;
          endX = toGeo.endX;
        }

        const midX = startX + (endX - startX) / 2;
        let d = '';

        if (endX >= startX + 16) {
          d = `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
        } else {
          const padY = fromGeo.rowIndex < toGeo.rowIndex ? 12 : -12;
          const turnY = fromGeo.top + fromGeo.height + padY;
          d = `M ${startX} ${startY} H ${startX + 12} V ${turnY} H ${endX - 12} V ${endY} H ${endX}`;
        }

        const isCritical =
          showCriticalPath &&
          criticalTaskIds.has(dep.predecessorId) &&
          criticalTaskIds.has(dep.successorId);

        return {
          id: dep.id,
          dependency: dep,
          d,
          startX,
          startY,
          endX,
          endY,
          type: dep.type,
          lag: dep.lag,
          linkType: dep.linkType,
          isCritical,
        };
      })
      .filter(Boolean);
  }, [dependencies, taskGeometryMap, showCriticalPath, criticalTaskIds]);

  // Mouse drag listeners for Rescheduling and Resizing task bars
  const handleBarMouseDown = (
    e: React.MouseEvent,
    taskId: string,
    mode: 'move' | 'resize-left' | 'resize-right',
  ) => {
    if (!canEditTask || linkingSourceTaskId) return;
    e.stopPropagation();
    setDraggingTaskId(taskId);
    setDragMode(mode);
    setDragStartX(e.clientX);
    setDragDeltaDays(0);
  };

  useEffect(() => {
    if (!draggingTaskId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - dragStartX;
      const days = Math.round(deltaPx / columnWidth);
      setDragDeltaDays(days);
    };

    const handleMouseUp = () => {
      if (draggingTaskId && dragDeltaDays !== 0) {
        const geo = taskGeometryMap.get(draggingTaskId);
        if (geo) {
          updateTaskDatesMutation.mutate({
            taskId: draggingTaskId,
            startDate: geo.startDate.toISOString(),
            dueDate: geo.dueDate.toISOString(),
          });
          return;
        }
      }
      setDraggingTaskId(null);
      setDragMode(null);
      setDragDeltaDays(0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingTaskId, dragStartX, dragDeltaDays, columnWidth, taskGeometryMap, updateTaskDatesMutation]);

  const handleStartLinking = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLinkingSourceTaskId(taskId);
  };

  const handleTargetTaskClick = (targetId: string) => {
    if (!linkingSourceTaskId || linkingSourceTaskId === targetId) {
      setLinkingSourceTaskId(null);
      return;
    }
    setTargetSuccessorId(targetId);
    setNewDepType('FINISH_TO_START');
    setNewDepLag(0);
    setNewDepLinkType('HARD');
    setDependencyError(null);
    setIsDependencyModalOpen(true);
  };

  const handleConfirmCreateDependency = () => {
    if (!linkingSourceTaskId || !targetSuccessorId) return;
    createDependencyMutation.mutate({
      predecessorId: linkingSourceTaskId,
      successorId: targetSuccessorId,
      type: newDepType,
      lag: Number(newDepLag),
      linkType: newDepLinkType,
    });
  };

  const getStatusColor = (status: string, isCritical = false) => {
    if (isCritical) {
      return 'bg-gradient-to-r from-rose-600 to-rose-500 border-rose-400 shadow-rose-500/30';
    }
    switch (status) {
      case 'DONE':
        return 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500';
      case 'IN_PROGRESS':
        return 'bg-blue-600 hover:bg-blue-500 border-blue-500';
      case 'REVIEW':
        return 'bg-amber-600 hover:bg-amber-500 border-amber-500';
      case 'BLOCKED':
        return 'bg-rose-600 hover:bg-rose-500 border-rose-500';
      default:
        return 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Gantt Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/40 border border-slate-850 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Interactive Gantt & CPM Flow
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {dependencies.length} Links
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Drag bars to reschedule, resize edges for duration, click connection points to link
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Critical Path Toggle */}
          <button
            type="button"
            onClick={() => setShowCriticalPath(!showCriticalPath)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
              showCriticalPath
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-lg shadow-rose-500/10'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${showCriticalPath ? 'text-rose-400 animate-bounce' : 'text-slate-500'}`} />
            <span>Critical Path ({criticalTaskIds.size})</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
            <button
              onClick={() => setZoomLevel('day')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                zoomLevel === 'day' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setZoomLevel('week')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                zoomLevel === 'week' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setZoomLevel('month')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                zoomLevel === 'month' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Month
            </button>
          </div>

          {linkingSourceTaskId && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs animate-pulse">
              <LinkIcon className="w-3.5 h-3.5" />
              Click target task to link
              <button onClick={() => setLinkingSourceTaskId(null)} className="ml-2 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Gantt Split Container */}
      <div className="bg-slate-900/40 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="flex overflow-x-auto" ref={containerRef}>
          {/* Left: Task Names Column */}
          <div className="w-80 min-w-[20rem] shrink-0 bg-slate-950/95 border-r border-slate-850 z-20 sticky left-0 shadow-lg">
            <div className="h-12 border-b border-slate-850 px-4 flex items-center justify-between font-semibold text-xs text-slate-400 uppercase tracking-wider bg-slate-950">
              <span>Tasks ({tasks.length})</span>
              {showCriticalPath && (
                <span className="text-[10px] text-rose-400 font-mono lowercase flex items-center gap-1">
                  <Flame className="w-3 h-3 text-rose-400" /> CPM active
                </span>
              )}
            </div>
            <div className="divide-y divide-slate-850/60">
              {tasks.map((task) => {
                const isCritical = criticalTaskIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      if (linkingSourceTaskId) {
                        handleTargetTaskClick(task.id);
                      } else {
                        onTaskClick(task.id);
                      }
                    }}
                    className={`h-12 px-4 flex items-center justify-between transition-colors cursor-pointer group ${
                      linkingSourceTaskId === task.id
                        ? 'bg-indigo-950/60 border-l-4 border-indigo-500'
                        : linkingSourceTaskId
                        ? 'hover:bg-amber-950/30 hover:border-l-4 hover:border-amber-500'
                        : isCritical
                        ? 'bg-rose-950/15 border-l-2 border-rose-500/80 hover:bg-rose-950/30'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="text-[11px] font-mono font-bold text-indigo-400 shrink-0">
                        #{task.taskNumber}
                      </span>
                      <span
                        className={`text-xs font-medium truncate ${
                          isCritical ? 'text-rose-300 font-semibold' : 'text-slate-200 group-hover:text-indigo-300'
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {canEditTask && (
                        <button
                          title="Link as Predecessor"
                          onClick={(e) => handleStartLinking(task.id, e)}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span
                        className={`w-2 h-2 rounded-full ${
                          task.status === 'DONE'
                            ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-blue-400'
                            : 'bg-slate-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Gantt Timeline & SVG Layer */}
          <div
            className="flex-1 relative overflow-hidden bg-slate-950/40"
            style={{ minWidth: `${totalTimelineWidth}px` }}
          >
            {/* Header Dates Bar */}
            <div className="h-12 border-b border-slate-850 flex bg-slate-950/80 sticky top-0 z-10">
              {dayList.map((day, idx) => {
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const isToday = day.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={idx}
                    style={{ width: `${columnWidth}px` }}
                    className={`h-full border-r border-slate-850/50 flex flex-col items-center justify-center text-[10px] shrink-0 ${
                      isWeekend ? 'bg-slate-900/20 text-slate-600' : 'text-slate-400'
                    } ${isToday ? 'bg-indigo-500/10 text-indigo-400 font-bold' : ''}`}
                  >
                    <span>{day.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                    <span className="font-mono">{day.getDate()}</span>
                  </div>
                );
              })}
            </div>

            {/* Grid Lines & Task Bars Container */}
            <div className="relative" style={{ height: `${tasks.length * rowHeight}px` }}>
              {/* Vertical Grid Day Lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {dayList.map((day, idx) => {
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday = day.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={idx}
                      style={{ width: `${columnWidth}px` }}
                      className={`h-full border-r border-slate-850/30 shrink-0 ${
                        isWeekend ? 'bg-slate-900/10' : ''
                      } ${isToday ? 'border-r-2 border-indigo-500/50 bg-indigo-500/5' : ''}`}
                    />
                  );
                })}
              </div>

              {/* Horizontal Row Separators */}
              {tasks.map((_, idx) => (
                <div
                  key={idx}
                  style={{ top: `${(idx + 1) * rowHeight}px` }}
                  className="absolute left-0 right-0 border-b border-slate-850/40 pointer-events-none"
                />
              ))}

              {/* SVG Layer for Dependency Connectors */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
                style={{ width: `${totalTimelineWidth}px`, height: `${tasks.length * rowHeight}px` }}
              >
                <defs>
                  <marker
                    id="gantt-arrow-hard"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#818cf8" />
                  </marker>
                  <marker
                    id="gantt-arrow-soft"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
                  </marker>
                  <marker
                    id="gantt-arrow-critical"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f43f5e" />
                  </marker>
                </defs>

                {dependencyPaths.map((p: any) => (
                  <g key={p.id} className="cursor-pointer pointer-events-auto group">
                    <path
                      d={p.d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="12"
                      onClick={() => setSelectedDependency(p.dependency)}
                    />
                    <path
                      d={p.d}
                      fill="none"
                      stroke={
                        p.isCritical
                          ? '#f43f5e'
                          : p.linkType === 'HARD'
                          ? '#818cf8'
                          : '#94a3b8'
                      }
                      strokeWidth={p.isCritical ? '2.5' : p.linkType === 'HARD' ? '2' : '1.5'}
                      strokeDasharray={p.linkType === 'SOFT' ? '4 3' : undefined}
                      markerEnd={`url(#gantt-arrow-${
                        p.isCritical ? 'critical' : p.linkType === 'HARD' ? 'hard' : 'soft'
                      })`}
                      className="group-hover:stroke-amber-400 group-hover:stroke-[3] transition-all"
                      onClick={() => setSelectedDependency(p.dependency)}
                    />
                  </g>
                ))}
              </svg>

              {/* Task Bars */}
              {tasks.map((task) => {
                const geo = taskGeometryMap.get(task.id);
                if (!geo) return null;

                const isLinkingSource = linkingSourceTaskId === task.id;
                const isCritical = criticalTaskIds.has(task.id);
                const isBeingDragged = draggingTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    style={{
                      left: `${geo.left}px`,
                      top: `${geo.top}px`,
                      width: `${geo.width}px`,
                      height: `${geo.height}px`,
                    }}
                    onMouseDown={(e) => handleBarMouseDown(e, task.id, 'move')}
                    onClick={() => {
                      if (linkingSourceTaskId) {
                        handleTargetTaskClick(task.id);
                      } else if (!isBeingDragged) {
                        onTaskClick(task.id);
                      }
                    }}
                    className={`absolute rounded-lg border shadow-md flex items-center px-2.5 text-xs text-white font-medium select-none group z-10 transition-shadow ${
                      canEditTask ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${getStatusColor(task.status, isCritical)} ${
                      isLinkingSource
                        ? 'ring-4 ring-amber-400 animate-pulse'
                        : isCritical
                        ? 'ring-2 ring-rose-500/80 shadow-lg shadow-rose-500/30'
                        : 'hover:scale-[1.01] hover:shadow-indigo-500/20'
                    }`}
                  >
                    {/* Left Resize Handle (Start Date) */}
                    {canEditTask && (
                      <div
                        onMouseDown={(e) => handleBarMouseDown(e, task.id, 'resize-left')}
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-white/40 rounded-l-lg z-20"
                        title="Drag to change start date"
                      />
                    )}

                    {/* Progress Fill Background */}
                    <div
                      className="absolute inset-0 bg-black/25 rounded-lg pointer-events-none"
                      style={{ width: `${task.progress || 0}%` }}
                    />

                    {/* Task Title & Code inside Bar */}
                    <span className="relative z-10 truncate text-[11px] font-semibold drop-shadow-sm flex items-center gap-1.5 pointer-events-none">
                      #{task.taskNumber} {task.title}
                    </span>

                    {/* Right Resize Handle (Due Date) */}
                    {canEditTask && (
                      <div
                        onMouseDown={(e) => handleBarMouseDown(e, task.id, 'resize-right')}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/40 rounded-r-lg z-20"
                        title="Drag to change due date"
                      />
                    )}

                    {/* Interactive Linking Handle (Right Dot) */}
                    {canEditTask && (
                      <button
                        title="Click to establish dependency link"
                        onClick={(e) => handleStartLinking(task.id, e)}
                        className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900 opacity-0 group-hover:opacity-100 transition-opacity z-30 cursor-crosshair"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Dependency Info / Delete Modal */}
      {selectedDependency && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Task Dependency Link</h3>
                  <p className="text-xs text-slate-400">CPM Link between Tasks</p>
                </div>
              </div>
              <button onClick={() => setSelectedDependency(null)} className="p-1 text-slate-400 hover:text-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-850">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Predecessor:</span>
                <span className="font-semibold text-slate-200">
                  #{selectedDependency.predecessor?.taskNumber} {selectedDependency.predecessor?.title}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Successor:</span>
                <span className="font-semibold text-slate-200">
                  #{selectedDependency.successor?.taskNumber} {selectedDependency.successor?.title}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Dependency Type:</span>
                <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {selectedDependency.type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Lag Duration:</span>
                <span className="font-medium text-slate-300">{selectedDependency.lag} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Link Mode:</span>
                <span className="font-medium text-slate-300">
                  {selectedDependency.linkType === 'HARD' ? 'Hard Link (Auto-Reschedules)' : 'Soft Link'}
                </span>
              </div>
            </div>

            {canEditTask && (
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDependency(null)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => deleteDependencyMutation.mutate(selectedDependency.id)}
                  disabled={deleteDependencyMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleteDependencyMutation.isPending ? 'Removing...' : 'Remove Link'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Dependency Modal from Gantt Linker */}
      {isDependencyModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Create Task Dependency</h3>
                  <p className="text-xs text-slate-400">Configure CPM relationship & lag</p>
                </div>
              </div>
              <button onClick={() => setIsDependencyModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {dependencyError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{dependencyError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Dependency Type
                </label>
                <select
                  value={newDepType}
                  onChange={(e) => setNewDepType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="FINISH_TO_START">Finish-to-Start (FS) - Successor starts after Predecessor finishes (Default)</option>
                  <option value="START_TO_START">Start-to-Start (SS) - Successor starts when Predecessor starts</option>
                  <option value="FINISH_TO_FINISH">Finish-to-Finish (FF) - Successor finishes when Predecessor finishes</option>
                  <option value="START_TO_FINISH">Start-to-Finish (SF) - Successor finishes when Predecessor starts</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Lag / Lead (Days)
                  </label>
                  <input
                    type="number"
                    value={newDepLag}
                    onChange={(e) => setNewDepLag(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">+N: Delay, -N: Lead time</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Link Mode
                  </label>
                  <select
                    value={newDepLinkType}
                    onChange={(e) => setNewDepLinkType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="HARD">Hard Link (Auto-Reschedule)</option>
                    <option value="SOFT">Soft Link (Manual Only)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setIsDependencyModalOpen(false)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateDependency}
                disabled={createDependencyMutation.isPending}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                {createDependencyMutation.isPending ? 'Linking...' : 'Establish Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
