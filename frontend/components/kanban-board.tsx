'use client';

import React, { useState, useMemo } from 'react';
import {
  Bug,
  BookOpen,
  Sparkles,
  CheckSquare,
  Clock,
  User,
  AlertTriangle,
  Repeat,
  Folder,
  ChevronDown,
  Layers,
  Paperclip,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';

export type KanbanGroupBy = 'status' | 'taskList' | 'priority' | 'assignee';

interface KanbanBoardProps {
  projectId: string;
  projectCode: string;
  tasks: any[];
  taskLists?: any[];
  projectMembers?: any[];
  groupBy: KanbanGroupBy;
  isReadOnly: boolean;
  onCardClick: (taskId: string) => void;
  onReorder: (
    taskId: string,
    payload: {
      status?: string;
      taskListId?: string | null;
      priority?: string;
      assigneeId?: string | null;
      position: number;
    },
  ) => Promise<void>;
  onQuickStatusChange?: (taskId: string, newStatus: string) => Promise<void>;
}

const STATUS_COLUMNS = [
  { key: 'TODO', title: 'To Do', color: 'border-slate-850 bg-slate-950/40', badge: 'bg-slate-800 text-slate-400 border-slate-700/50' },
  { key: 'IN_PROGRESS', title: 'In Progress', color: 'border-blue-500/20 bg-blue-500/[0.02]', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { key: 'REVIEW', title: 'In Review', color: 'border-amber-500/20 bg-amber-500/[0.02]', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { key: 'DONE', title: 'Done', color: 'border-emerald-500/20 bg-emerald-500/[0.02]', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { key: 'BLOCKED', title: 'Blocked', color: 'border-rose-500/20 bg-rose-500/[0.02]', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
];

const PRIORITY_COLUMNS = [
  { key: 'CRITICAL', title: 'Critical Priority', color: 'border-rose-500/20 bg-rose-500/[0.02]', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  { key: 'HIGH', title: 'High Priority', color: 'border-amber-500/20 bg-amber-500/[0.02]', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { key: 'MEDIUM', title: 'Medium Priority', color: 'border-blue-500/20 bg-blue-500/[0.02]', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { key: 'LOW', title: 'Low Priority', color: 'border-slate-850 bg-slate-950/40', badge: 'bg-slate-800 text-slate-400 border-slate-700/50' },
];

export default function KanbanBoard({
  projectId,
  projectCode,
  tasks = [],
  taskLists = [],
  projectMembers = [],
  groupBy = 'status',
  isReadOnly,
  onCardClick,
  onReorder,
  onQuickStatusChange,
}: KanbanBoardProps) {
  const [activeDropCol, setActiveDropCol] = useState<string | null>(null);

  // Derive dynamic columns based on groupBy
  const columns = useMemo(() => {
    if (groupBy === 'status') {
      return STATUS_COLUMNS;
    }
    if (groupBy === 'priority') {
      return PRIORITY_COLUMNS;
    }
    if (groupBy === 'taskList') {
      const listCols = taskLists.map((tl) => ({
        key: tl.id,
        title: tl.name,
        color: 'border-slate-850 bg-slate-950/40',
        badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      }));
      listCols.push({
        key: 'unassigned',
        title: 'General / Unassigned',
        color: 'border-slate-850 bg-slate-950/40',
        badge: 'bg-slate-800 text-slate-400 border-slate-700/50',
      });
      return listCols;
    }
    if (groupBy === 'assignee') {
      const memberCols = projectMembers.map((m) => {
        const u = m.user || m;
        const name = u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.email.split('@')[0];
        return {
          key: u.id,
          title: name,
          color: 'border-slate-850 bg-slate-950/40',
          badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          user: u,
        };
      });
      memberCols.push({
        key: 'unassigned',
        title: 'Unassigned Tasks',
        color: 'border-slate-850 bg-slate-950/40',
        badge: 'bg-slate-800 text-slate-400 border-slate-700/50',
        user: undefined,
      });
      return memberCols;
    }
    return STATUS_COLUMNS;
  }, [groupBy, taskLists, projectMembers]);

  // Partition tasks into columns
  const columnTasksMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    columns.forEach((c) => {
      map[c.key] = [];
    });

    tasks.forEach((t) => {
      if (groupBy === 'status') {
        const key = t.status || 'TODO';
        if (map[key]) map[key].push(t);
        else map['TODO']?.push(t);
      } else if (groupBy === 'priority') {
        const key = t.priority || 'MEDIUM';
        if (map[key]) map[key].push(t);
        else map['MEDIUM']?.push(t);
      } else if (groupBy === 'taskList') {
        const key = t.taskListId || 'unassigned';
        if (map[key]) map[key].push(t);
        else map['unassigned']?.push(t);
      } else if (groupBy === 'assignee') {
        const key = t.assigneeId || 'unassigned';
        if (map[key]) map[key].push(t);
        else map['unassigned']?.push(t);
      }
    });

    return map;
  }, [tasks, columns, groupBy]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      default:
        return 'bg-slate-900 text-slate-400 border border-slate-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'BUG':
        return <Bug className="w-3.5 h-3.5 text-rose-400" />;
      case 'STORY':
        return <BookOpen className="w-3.5 h-3.5 text-emerald-400" />;
      case 'IMPROVEMENT':
        return <Sparkles className="w-3.5 h-3.5 text-violet-400" />;
      default:
        return <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const getDragAfterElement = (container: HTMLDivElement, y: number): HTMLElement | null => {
    const draggableElements = Array.from(
      container.querySelectorAll('.kanban-card:not(.dragging)')
    ) as HTMLElement[];

    return draggableElements.reduce<{ offset: number; element: HTMLElement | null }>(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  };

  const handleDragStart = (e: React.DragEvent, taskId: string, isTaskArchived: boolean) => {
    if (isReadOnly || isTaskArchived) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    const target = e.currentTarget as HTMLElement;
    target.classList.add('dragging', 'opacity-50');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('dragging', 'opacity-50');
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    if (isReadOnly) return;
    setActiveDropCol(colKey);
  };

  const handleDragLeave = () => {
    setActiveDropCol(null);
  };

  const handleDrop = async (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setActiveDropCol(null);
    if (isReadOnly) return;

    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const container = e.currentTarget as HTMLDivElement;
    const y = e.clientY;
    const columnTasks = columnTasksMap[colKey] || [];
    const dragAfterElement = getDragAfterElement(container, y);

    let targetPosition = columnTasks.length;
    if (dragAfterElement) {
      const indexAttr = dragAfterElement.getAttribute('data-index');
      if (indexAttr !== null) {
        targetPosition = parseInt(indexAttr, 10);
      }
    }

    const payload: any = { position: targetPosition };
    if (groupBy === 'status') {
      payload.status = colKey;
    } else if (groupBy === 'priority') {
      payload.priority = colKey;
    } else if (groupBy === 'taskList') {
      payload.taskListId = colKey === 'unassigned' ? null : colKey;
    } else if (groupBy === 'assignee') {
      payload.assigneeId = colKey === 'unassigned' ? null : colKey;
    }

    await onReorder(taskId, payload);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar min-h-[600px] items-start">
      {columns.map((col) => {
        const colTasks = columnTasksMap[col.key] || [];
        const isOver = activeDropCol === col.key;

        return (
          <div
            key={col.key}
            className={`w-80 min-w-[20rem] shrink-0 flex flex-col rounded-2xl border min-h-[550px] max-h-[850px] overflow-hidden transition-all duration-200 ${
              col.color
            } ${
              isOver ? 'border-indigo-500/50 ring-2 ring-indigo-500/20 bg-indigo-950/20' : 'border-slate-850'
            }`}
          >
            {/* Column Header */}
            <div className="p-4 border-b border-slate-850 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="font-bold text-xs text-slate-100 truncate">{col.title}</span>
                <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${col.badge} shrink-0`}>
                  {colTasks.length}
                </span>
              </div>
            </div>

            {/* Drop Zone Area / Cards container */}
            <div
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
              className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar"
            >
              {colTasks.length > 0 ? (
                colTasks.map((task, index) => {
                  const isTaskArchived = !!task.deletedAt;
                  const draggable = !isReadOnly && !isTaskArchived;
                  const isOverdue =
                    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

                  return (
                    <div
                      key={task.id}
                      data-index={index}
                      draggable={draggable}
                      onDragStart={(e) => handleDragStart(e, task.id, isTaskArchived)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onCardClick(task.id)}
                      className={`kanban-card bg-slate-900/40 border border-slate-850 hover:border-slate-750 hover:bg-slate-900/80 rounded-xl p-4 transition-all duration-150 flex flex-col gap-3 group relative overflow-hidden shadow-lg ${
                        draggable
                          ? 'cursor-grab active:cursor-grabbing hover:translate-y-[-2px] hover:shadow-indigo-500/10'
                          : 'cursor-not-allowed opacity-90'
                      }`}
                    >
                      {/* Top Row: Task Code, Type, Priority */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-950 border border-slate-850 rounded text-slate-400 font-semibold group-hover:text-indigo-400 transition-colors">
                            {projectCode}-{task.taskNumber}
                          </span>
                          <div className="p-1 bg-slate-950 border border-slate-850 rounded" title={task.type}>
                            {getTypeIcon(task.type)}
                          </div>
                          {(task.recurringTaskId || task.recurringTask) && (
                            <div
                              className="p-1 bg-violet-500/10 border border-violet-500/20 rounded text-violet-400 flex items-center gap-0.5"
                              title={
                                task.recurringTask?.frequency
                                  ? `Recurring: ${task.recurringTask.frequency.toLowerCase()} (Occurrence #${task.recurrenceIndex || 1})`
                                  : `Recurring task #${task.recurrenceIndex || 1}`
                              }
                            >
                              <Repeat className="w-3 h-3 text-violet-400" />
                              {task.recurrenceIndex ? (
                                <span className="font-mono text-[8px] font-bold">#{task.recurrenceIndex}</span>
                              ) : null}
                            </div>
                          )}
                        </div>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wide ${getPriorityColor(
                            task.priority,
                          )}`}
                        >
                          {task.priority}
                        </span>
                      </div>

                      {/* Middle: Title & Description */}
                      <div>
                        <h4 className="font-bold text-xs text-slate-100 leading-snug group-hover:text-indigo-300 transition-colors line-clamp-2">
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-[10px] text-slate-500 line-clamp-1 mt-1 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                      </div>

                      {/* Task List & Milestone & Subtasks Metas */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {task.taskList && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium truncate max-w-[130px]">
                            {task.taskList.name}
                          </span>
                        )}
                        {task.milestone && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium truncate max-w-[120px]">
                            {task.milestone.title}
                          </span>
                        )}
                        {task.subtasks && task.subtasks.length > 0 && (
                          <span className="text-[9px] font-mono text-slate-400 flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                            <CheckSquare className="w-2.5 h-2.5 text-indigo-400" />
                            <span>
                              {task.subtasks.filter((st: any) => st.status === 'DONE').length}/{task.subtasks.length}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Progress Bar (if task has progress) */}
                      {task.progress !== undefined && task.progress > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-mono text-slate-400">
                            <span>Progress</span>
                            <span className="text-indigo-400 font-bold">{task.progress}%</span>
                          </div>
                          <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Bottom Row: Due Date, Hours Estimate, Quick Status, Assignee */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-850/80 text-[10px]">
                        <div className="flex items-center gap-2">
                          {task.dueDate && (
                            <div
                              className={`flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded ${
                                isOverdue
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold'
                                  : 'text-slate-400'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            </div>
                          )}

                          {task.estimatedHours !== null && task.estimatedHours !== undefined && (
                            <span className="text-[9px] text-slate-500 font-mono">
                              {task.estimatedHours}h
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Quick Status Pill (only when not grouped by status) */}
                          {groupBy !== 'status' && onQuickStatusChange && !isReadOnly && (
                            <select
                              value={task.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onQuickStatusChange(task.id, e.target.value)}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="TODO">To Do</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="REVIEW">In Review</option>
                              <option value="DONE">Done</option>
                              <option value="BLOCKED">Blocked</option>
                            </select>
                          )}

                          {/* Assignee Avatar */}
                          {task.assignee ? (
                            <div
                              className="flex items-center gap-1 min-w-0"
                              title={`Assignee: ${task.assignee.firstName ? `${task.assignee.firstName} ${task.assignee.lastName || ''}` : task.assignee.email}`}
                            >
                              <div className="w-5 h-5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-[8px] uppercase">
                                {task.assignee.firstName ? task.assignee.firstName[0] : task.assignee.email[0]}
                              </div>
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-950 border border-slate-800 text-slate-600 flex items-center justify-center text-[8px]" title="Unassigned">
                              <User className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-600 text-[11px] italic border border-dashed border-slate-850 rounded-xl">
                  No tasks in this column
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
