'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  Loader2,
  X,
  CheckSquare,
  Plus,
  AlertCircle,
  CheckCircle2,
  Repeat,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import DynamicCustomFields from '@/components/dynamic-custom-fields';

interface GlobalTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GlobalTaskModal({ isOpen, onClose, onSuccess }: GlobalTaskModalProps) {
  const queryClient = useQueryClient();

  // Form states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [type, setType] = useState<'TASK' | 'BUG' | 'STORY' | 'IMPROVEMENT'>('TASK');
  const [assigneeId, setAssigneeId] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [taskListId, setTaskListId] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Recurrence States
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('WEEKLY');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>([1]); // 1=Mon
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number>(1);
  const [recurrenceNonWorkingDay, setRecurrenceNonWorkingDay] = useState<'NEXT_WORKING_DAY' | 'PREVIOUS_WORKING_DAY' | 'EXACT_DATE'>('NEXT_WORKING_DAY');
  const [recurrenceEndType, setRecurrenceEndType] = useState<'NEVER' | 'ON_DATE' | 'AFTER_OCCURRENCES'>('NEVER');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceMaxOccurrences, setRecurrenceMaxOccurrences] = useState(10);

  // Fetch active projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isOpen,
  });

  const activeProjects = projects.filter((p: any) => p.status !== 'ARCHIVED');

  // Fetch project details for members
  const { data: projectDetails, isLoading: isLoadingProjectDetails } = useQuery({
    queryKey: ['project-details-global-modal', selectedProjectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${selectedProjectId}`);
      return res.data;
    },
    enabled: isOpen && !!selectedProjectId,
  });

  // Fetch milestones
  const { data: milestones = [], isLoading: isLoadingMilestones } = useQuery({
    queryKey: ['milestones-global-modal', selectedProjectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${selectedProjectId}/milestones`);
      return res.data;
    },
    enabled: isOpen && !!selectedProjectId,
  });

  // Fetch task lists
  const { data: taskLists = [], isLoading: isLoadingTaskLists } = useQuery({
    queryKey: ['task-lists-global-modal', selectedProjectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${selectedProjectId}/task-lists`);
      return res.data;
    },
    enabled: isOpen && !!selectedProjectId,
  });

  // Filter task lists based on selected milestone (if any selected)
  const filteredTaskLists = React.useMemo(() => {
    if (!milestoneId) return taskLists;
    return taskLists.filter((tl: any) => !tl.milestoneId || tl.milestoneId === milestoneId);
  }, [taskLists, milestoneId]);

  // Reset dependent fields when project changes
  useEffect(() => {
    setAssigneeId('');
    setMilestoneId('');
    setTaskListId('');
    setCustomFieldValues({});
    setFormError(null);
  }, [selectedProjectId]);

  // Reset entire form when modal closes/opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId('');
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setType('TASK');
      setAssigneeId('');
      setEstimatedHours('');
      setStartDate('');
      setDueDate('');
      setMilestoneId('');
      setTaskListId('');
      setFormError(null);
      setSuccessMessage(null);
      setIsRecurring(false);
      setRecurrenceFrequency('WEEKLY');
      setRecurrenceInterval(1);
      setRecurrenceDaysOfWeek([1]);
      setRecurrenceDayOfMonth(1);
      setRecurrenceNonWorkingDay('NEXT_WORKING_DAY');
      setRecurrenceEndType('NEVER');
      setRecurrenceEndDate('');
      setRecurrenceMaxOccurrences(10);
    }
  }, [isOpen]);

  const recurrenceSummaryText = useMemo(() => {
    if (!isRecurring) return '';
    let freqText = '';
    if (recurrenceFrequency === 'DAILY') {
      freqText = recurrenceInterval === 1 ? 'Repeats daily' : `Repeats every ${recurrenceInterval} days`;
    } else if (recurrenceFrequency === 'WEEKLY') {
      const dayNames: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
      const selected = recurrenceDaysOfWeek.map((d) => dayNames[d]).filter(Boolean).join(', ');
      freqText = recurrenceInterval === 1
        ? `Repeats weekly on ${selected || 'selected days'}`
        : `Repeats every ${recurrenceInterval} weeks on ${selected || 'selected days'}`;
    } else if (recurrenceFrequency === 'MONTHLY') {
      freqText = recurrenceInterval === 1
        ? `Repeats monthly on day ${recurrenceDayOfMonth === -1 ? 'last' : recurrenceDayOfMonth}`
        : `Repeats every ${recurrenceInterval} months on day ${recurrenceDayOfMonth === -1 ? 'last' : recurrenceDayOfMonth}`;
    } else if (recurrenceFrequency === 'YEARLY') {
      freqText = recurrenceInterval === 1 ? 'Repeats annually' : `Repeats every ${recurrenceInterval} years`;
    }

    let endText = '';
    if (recurrenceEndType === 'ON_DATE' && recurrenceEndDate) {
      endText = ` until ${recurrenceEndDate}`;
    } else if (recurrenceEndType === 'AFTER_OCCURRENCES') {
      endText = ` for ${recurrenceMaxOccurrences} occurrences`;
    }

    return `${freqText}${endText}`;
  }, [
    isRecurring,
    recurrenceFrequency,
    recurrenceInterval,
    recurrenceDaysOfWeek,
    recurrenceDayOfMonth,
    recurrenceEndType,
    recurrenceEndDate,
    recurrenceMaxOccurrences,
  ]);

  const createTaskMutation = useMutation({
    mutationFn: async ({ payload, addAnother }: { payload: any; addAnother: boolean }) => {
      const res = await api.post('/tasks', payload);
      return { data: res.data, addAnother };
    },
    onSuccess: ({ addAnother }) => {
      queryClient.invalidateQueries({ queryKey: ['global-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
        queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] });
        queryClient.invalidateQueries({ queryKey: ['board', selectedProjectId] });
        queryClient.invalidateQueries({ queryKey: ['milestones', selectedProjectId] });
      }

      if (addAnother) {
        // Fast batch entry: reset task-specific fields while keeping project/container context
        setTitle('');
        setDescription('');
        setEstimatedHours('');
        setStartDate('');
        setDueDate('');
        setFormError(null);
        setSuccessMessage('Task created successfully! Ready for the next task.');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        onSuccess?.();
        onClose();
      }
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to create task');
    },
  });

  const handleFormSubmit = (e: React.FormEvent, addAnother: boolean = false) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProjectId) {
      setFormError('Please select a project.');
      return;
    }
    if (!title.trim()) {
      setFormError('Please enter a task title.');
      return;
    }
    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      setFormError('Start date cannot be after due date.');
      return;
    }

    const estHrsVal = estimatedHours ? parseFloat(estimatedHours) : null;

    const recurrencePayload = isRecurring
      ? {
          frequency: recurrenceFrequency,
          interval: Number(recurrenceInterval) || 1,
          daysOfWeek:
            recurrenceFrequency === 'WEEKLY' ? recurrenceDaysOfWeek.join(',') : undefined,
          dayOfMonth:
            recurrenceFrequency === 'MONTHLY' ? Number(recurrenceDayOfMonth) : undefined,
          nonWorkingDayAction: recurrenceNonWorkingDay,
          startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
          endType: recurrenceEndType,
          endDate:
            recurrenceEndType === 'ON_DATE' && recurrenceEndDate
              ? new Date(recurrenceEndDate).toISOString()
              : undefined,
          maxOccurrences:
            recurrenceEndType === 'AFTER_OCCURRENCES'
              ? Number(recurrenceMaxOccurrences)
              : undefined,
          cloneSubtasks: true,
        }
      : undefined;

    createTaskMutation.mutate({
      payload: {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        type,
        assigneeId: assigneeId || null,
        estimatedHours: estHrsVal,
        startDate: startDate || null,
        dueDate: dueDate || null,
        projectId: selectedProjectId,
        milestoneId: milestoneId || null,
        taskListId: taskListId || null,
        customFields:
          Object.keys(customFieldValues).length > 0
            ? JSON.stringify(customFieldValues)
            : null,
        recurrence: recurrencePayload,
      },
      addAnother,
    });
  };

  if (!isOpen) return null;

  const projectMembers = projectDetails?.members || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl overflow-hidden text-slate-100 h-full flex flex-col animate-in slide-in-from-right duration-300">
        <header className="flex justify-between items-center border-b border-slate-800 p-6 pb-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-400" />
              Create Task
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Quickly create and assign tasks across projects</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={(e) => handleFormSubmit(e, false)} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Feedback Messages */}
          {formError && (
            <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-xs p-3.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4.5 h-4.5 text-rose-400 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs p-3.5 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Project Selection */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Project *
            </label>
            <select
              required
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">Select project...</option>
              {activeProjects.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.projectCode})
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Task Name / Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Design UI components"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Add details, criteria or context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs resize-none"
            />
          </div>

          {/* Priority & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Task Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="TASK">Task</option>
                <option value="BUG">Bug</option>
                <option value="STORY">Story</option>
                <option value="IMPROVEMENT">Improvement</option>
              </select>
            </div>
          </div>

          {/* Task List & Milestone (Cascading) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Task List
              </label>
              {isLoadingTaskLists ? (
                <div className="text-[10px] text-slate-500 py-2">Loading task lists...</div>
              ) : (
                <select
                  value={taskListId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTaskListId(val);
                    if (val) {
                      const selectedList = taskLists.find((tl: any) => tl.id === val);
                      if (selectedList?.milestoneId) {
                        setMilestoneId(selectedList.milestoneId);
                      }
                    }
                  }}
                  disabled={!selectedProjectId}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <option value="">General / None</option>
                  {filteredTaskLists.map((tl: any) => (
                    <option key={tl.id} value={tl.id}>
                      {tl.name} ({tl.flag})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Milestone
              </label>
              {isLoadingMilestones ? (
                <div className="text-[10px] text-slate-500 py-2">Loading milestones...</div>
              ) : (
                <select
                  value={milestoneId}
                  onChange={(e) => setMilestoneId(e.target.value)}
                  disabled={!selectedProjectId}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <option value="">None</option>
                  {milestones.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Assignee & Estimates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Assignee
              </label>
              {isLoadingProjectDetails ? (
                <div className="text-[10px] text-slate-500 py-2">Loading members...</div>
              ) : (
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={!selectedProjectId}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map((m: any) => {
                    const isClient = m.role === 'CLIENT';
                    const selectedList = taskLists.find((tl: any) => tl.id === taskListId);
                    const selectedMs = milestones.find((ms: any) => ms.id === milestoneId);
                    const isTargetExternal = (selectedList && selectedList.flag === 'EXTERNAL') || (!selectedList && selectedMs && selectedMs.flag === 'EXTERNAL');
                    const isDisabled = isClient && !isTargetExternal;
                    const userName = m.user.firstName ? `${m.user.firstName} ${m.user.lastName || ''}` : m.user.email;
                    return (
                      <option key={m.userId} value={m.userId} disabled={isDisabled}>
                        {userName} {isClient ? (isDisabled ? '(Client - External only)' : '(Client)') : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Work Hours (Est.)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="0.0"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Start Date & Due Date (Zoho Projects Standard) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Recurring Task Configuration (Zoho Projects Spec) */}
          <div className="border border-slate-800/80 bg-slate-950/40 rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl transition-colors ${isRecurring ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">Recurring Task (Repeat)</div>
                  <div className="text-[10px] text-slate-400">Automatically generate repeated occurrences on schedule</div>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {isRecurring && (
              <div className="space-y-4 pt-2 border-t border-slate-800/60 animate-in fade-in duration-200">
                {/* Frequency & Interval */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Frequency
                    </label>
                    <select
                      value={recurrenceFrequency}
                      onChange={(e) => setRecurrenceFrequency(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Repeat Every
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={recurrenceInterval}
                        onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 text-center"
                      />
                      <span className="text-xs text-slate-400">
                        {recurrenceFrequency === 'DAILY' && (recurrenceInterval > 1 ? 'Days' : 'Day')}
                        {recurrenceFrequency === 'WEEKLY' && (recurrenceInterval > 1 ? 'Weeks' : 'Week')}
                        {recurrenceFrequency === 'MONTHLY' && (recurrenceInterval > 1 ? 'Months' : 'Month')}
                        {recurrenceFrequency === 'YEARLY' && (recurrenceInterval > 1 ? 'Years' : 'Year')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Weekly Days of Week Picker */}
                {recurrenceFrequency === 'WEEKLY' && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Repeat on Weekdays
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[
                        { day: 1, label: 'M', title: 'Monday' },
                        { day: 2, label: 'T', title: 'Tuesday' },
                        { day: 3, label: 'W', title: 'Wednesday' },
                        { day: 4, label: 'T', title: 'Thursday' },
                        { day: 5, label: 'F', title: 'Friday' },
                        { day: 6, label: 'S', title: 'Saturday' },
                        { day: 7, label: 'S', title: 'Sunday' },
                      ].map((item) => {
                        const isSelected = recurrenceDaysOfWeek.includes(item.day);
                        return (
                          <button
                            key={item.day}
                            type="button"
                            title={item.title}
                            onClick={() => {
                              if (isSelected) {
                                if (recurrenceDaysOfWeek.length > 1) {
                                  setRecurrenceDaysOfWeek(recurrenceDaysOfWeek.filter((d) => d !== item.day));
                                }
                              } else {
                                setRecurrenceDaysOfWeek([...recurrenceDaysOfWeek, item.day].sort());
                              }
                            }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Monthly Day Picker */}
                {recurrenceFrequency === 'MONTHLY' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Day of Month
                      </label>
                      <select
                        value={recurrenceDayOfMonth}
                        onChange={(e) => setRecurrenceDayOfMonth(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            {d}th day
                          </option>
                        ))}
                        <option value={-1}>Last day of month</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Weekend Action
                      </label>
                      <select
                        value={recurrenceNonWorkingDay}
                        onChange={(e) => setRecurrenceNonWorkingDay(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="NEXT_WORKING_DAY">Next working day</option>
                        <option value="PREVIOUS_WORKING_DAY">Previous working day</option>
                        <option value="EXACT_DATE">Exact calendar date</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* End Condition */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    End Condition
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'NEVER', label: 'Never' },
                      { type: 'ON_DATE', label: 'On Date' },
                      { type: 'AFTER_OCCURRENCES', label: 'After N Occurrences' },
                    ].map((cond) => (
                      <button
                        key={cond.type}
                        type="button"
                        onClick={() => setRecurrenceEndType(cond.type as any)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center ${
                          recurrenceEndType === cond.type
                            ? 'bg-indigo-600/20 border border-indigo-500/50 text-indigo-300'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cond.label}
                      </button>
                    ))}
                  </div>

                  {recurrenceEndType === 'ON_DATE' && (
                    <input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      className="w-full mt-2 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
                  )}

                  {recurrenceEndType === 'AFTER_OCCURRENCES' && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={recurrenceMaxOccurrences}
                        onChange={(e) => setRecurrenceMaxOccurrences(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-24 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 text-center"
                      />
                      <span className="text-xs text-slate-400">Total occurrences</span>
                    </div>
                  )}
                </div>

                {/* Recurrence Summary Banner */}
                {recurrenceSummaryText && (
                  <div className="bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 text-xs p-3 rounded-xl flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-indigo-400 shrink-0 animate-spin-slow" />
                    <span className="font-medium">{recurrenceSummaryText}</span>
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Custom Fields Section */}
            {selectedProjectId && (
              <DynamicCustomFields
                projectId={selectedProjectId}
                values={customFieldValues}
                onChange={setCustomFieldValues}
                members={projectMembers}
              />
            )}
          </div>

          {/* Fixed Footer at drawer bottom with Save and Save & Add Another */}
          <div className="flex items-center justify-between gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-950 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => handleFormSubmit(e, true)}
                disabled={createTaskMutation.isPending}
                className="px-4 py-2 bg-slate-900 border border-slate-750 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Create this task and keep the form open for another entry"
              >
                {createTaskMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Plus className="w-3.5 h-3.5" />
                Save & Add Another
              </button>

              <button
                type="submit"
                disabled={createTaskMutation.isPending}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/20 disabled:opacity-50"
              >
                {createTaskMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Task
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
