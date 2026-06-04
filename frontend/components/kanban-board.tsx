'use client';

import React, { useState } from 'react';
import {
  Bug,
  BookOpen,
  Sparkles,
  CheckSquare,
  Clock,
  User,
  AlertTriangle,
} from 'lucide-react';

interface KanbanBoardProps {
  projectId: string;
  projectCode: string;
  boardData: {
    todo: any[];
    inProgress: any[];
    review: any[];
    done: any[];
    blocked: any[];
  };
  isReadOnly: boolean;
  onCardClick: (taskId: string) => void;
  onReorder: (taskId: string, targetStatus: string, targetPosition: number) => Promise<void>;
}

const COLUMNS = [
  { key: 'todo', title: 'To Do', status: 'TODO', color: 'border-slate-900 bg-slate-950/20' },
  { key: 'inProgress', title: 'In Progress', status: 'IN_PROGRESS', color: 'border-blue-500/10 bg-blue-500/[0.01]' },
  { key: 'review', title: 'In Review', status: 'REVIEW', color: 'border-amber-500/10 bg-amber-500/[0.01]' },
  { key: 'done', title: 'Done', status: 'DONE', color: 'border-emerald-500/10 bg-emerald-500/[0.01]' },
  { key: 'blocked', title: 'Blocked', status: 'BLOCKED', color: 'border-rose-500/10 bg-rose-500/[0.01]' },
];

export default function KanbanBoard({
  projectId,
  projectCode,
  boardData,
  isReadOnly,
  onCardClick,
  onReorder,
}: KanbanBoardProps) {
  const [activeDropCol, setActiveDropCol] = useState<string | null>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-450 border border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-450 border border-amber-500/20';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-450 border border-blue-500/20';
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
    
    // Add opacity or dragging styles via inline class
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

  const handleDrop = async (e: React.DragEvent, colKey: string, colStatus: string) => {
    e.preventDefault();
    setActiveDropCol(null);
    if (isReadOnly) return;

    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const container = e.currentTarget as HTMLDivElement;
    const y = e.clientY;

    const columnTasks = boardData[colKey as keyof typeof boardData] || [];
    const dragAfterElement = getDragAfterElement(container, y);

    let targetPosition = columnTasks.length;
    if (dragAfterElement) {
      const indexAttr = dragAfterElement.getAttribute('data-index');
      if (indexAttr !== null) {
        targetPosition = parseInt(indexAttr, 10);
      }
    }

    await onReorder(taskId, colStatus, targetPosition);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 h-full items-start">
      {COLUMNS.map((col) => {
        const tasks = boardData[col.key as keyof typeof boardData] || [];
        const isOver = activeDropCol === col.key;

        return (
          <div
            key={col.key}
            className={`flex flex-col rounded-2xl border min-h-[500px] max-h-[800px] overflow-hidden transition-all duration-200 ${col.color} ${
              isOver ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-slate-900/60'
            }`}
          >
            {/* Column Header */}
            <div className="p-4 border-b border-slate-900/80 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-200">{col.title}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-850 font-mono text-[9px] text-slate-400 font-semibold">
                  {tasks.length}
                </span>
              </div>
            </div>

            {/* Drop Zone Area / Cards container */}
            <div
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key, col.status)}
              className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar"
            >
              {tasks.length > 0 ? (
                tasks.map((task, index) => {
                  const isTaskArchived = !!task.deletedAt;
                  const draggable = !isReadOnly && !isTaskArchived;

                  return (
                    <div
                      key={task.id}
                      data-index={index}
                      draggable={draggable}
                      onDragStart={(e) => handleDragStart(e, task.id, isTaskArchived)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onCardClick(task.id)}
                      className={`kanban-card bg-slate-900/30 border border-slate-900 hover:border-slate-850 hover:bg-slate-900/50 rounded-xl p-4 transition-all duration-150 flex flex-col gap-3 group relative overflow-hidden ${
                        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-90'
                      }`}
                    >
                      {/* Top Row: Task Code & Priority */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-950 border border-slate-850 rounded text-slate-400 font-semibold group-hover:text-indigo-400 transition-colors">
                            {projectCode}-{task.taskNumber}
                          </span>
                          <div className="p-1 bg-slate-950/40 border border-slate-850 rounded" title={task.type}>
                            {getTypeIcon(task.type)}
                          </div>
                        </div>

                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wide ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>

                      {/* Middle: Title */}
                      <h4 className="font-bold text-xs text-slate-100 leading-snug group-hover:text-indigo-300 transition-colors line-clamp-2">
                        {task.title}
                      </h4>

                      {/* Bottom Row: Hours Estimate & Assignee */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-900/60 text-[10px]">
                        {task.estimatedHours !== null && task.estimatedHours !== undefined ? (
                          <div className="flex items-center gap-1 text-[9px] text-slate-500 font-medium" title="Estimation">
                            <Clock className="w-3 h-3 text-slate-600" />
                            <span>{task.estimatedHours}h</span>
                          </div>
                        ) : (
                          <div />
                        )}

                        {task.assignee ? (
                          <div className="flex items-center gap-1.5 min-w-0" title={`Assignee: ${task.assignee.firstName || task.assignee.email}`}>
                            <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold flex items-center justify-center shrink-0 text-[8px] uppercase">
                              {task.assignee.firstName ? task.assignee.firstName[0] : task.assignee.email[0]}
                            </div>
                            <span className="text-slate-400 font-semibold truncate max-w-[70px] text-[9px]">
                              {task.assignee.firstName || task.assignee.email.split('@')[0]}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-slate-600 italic text-[9px]">
                            <User className="w-3 h-3 text-slate-700" />
                            <span>Unassigned</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-600 text-[10px] italic border border-dashed border-slate-900/60 rounded-xl">
                  Empty column
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
