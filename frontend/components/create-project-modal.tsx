'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useRouter } from 'next/navigation';
import {
  X,
  Plus,
  Loader2,
  Lock,
  Globe,
  DollarSign,
  Tag,
  Copy,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Layers,
  FolderPlus,
  UserCheck,
  Calendar,
  Briefcase,
  AlertTriangle,
  Save,
} from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: any;
}

export default function CreateProjectModal({ isOpen, onClose, project }: CreateProjectModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const isEditMode = !!project;

  // Form States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'ORGANIZATION'>('PRIVATE');
  const [isTemplate, setIsTemplate] = useState(false);

  // Group & Owner
  const [groupId, setGroupId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [isStrict, setIsStrict] = useState(false);

  // Quick Group Creation Modal State
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#6366f1');

  // Template / Baseline Cloning State
  const [templateProjectId, setTemplateProjectId] = useState<string>('');
  const [copyMilestones, setCopyMilestones] = useState(true);
  const [copyTasks, setCopyTasks] = useState(true);
  const [copyMembers, setCopyMembers] = useState(false);
  const [shiftDates, setShiftDates] = useState(true);

  // Layout & Tags
  const [taskLayout, setTaskLayout] = useState<'STANDARD' | 'KANBAN' | 'LIST' | 'GANTT'>('STANDARD');
  const [tags, setTags] = useState('');

  // Budget & Financials
  const [currency, setCurrency] = useState('USD');
  const [budgetType, setBudgetType] = useState<'NONE' | 'FIXED_COST' | 'BASED_ON_PROJECT_HOURS' | 'BASED_ON_STAFF_HOURS' | 'BASED_ON_TASK_HOURS'>('NONE');
  const [budgetAmount, setBudgetAmount] = useState<string>('');
  const [budgetHours, setBudgetHours] = useState<string>('');
  const [billingMethod, setBillingMethod] = useState<'NONE' | 'FIXED_RATE' | 'PROJECT_HOURLY_RATE' | 'STAFF_HOURLY_RATE' | 'TASK_HOURLY_RATE'>('NONE');
  const [billingRate, setBillingRate] = useState<string>('');

  // Work Schedule & Client Portal Access
  const [workingDays, setWorkingDays] = useState('1,2,3,4,5');
  const [hoursPerDay, setHoursPerDay] = useState('8.0');
  const [allowClientAccess, setAllowClientAccess] = useState(false);

  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Populate or reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (project) {
        setName(project.name || '');
        setDescription(project.description || '');
        setStartDate(project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '');
        setEndDate(project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '');
        setVisibility(project.visibility || 'PRIVATE');
        setIsTemplate(project.isTemplate || false);
        setGroupId(project.groupId || '');
        setOwnerId(project.ownerId || '');
        setIsStrict(project.isStrict || false);
        setTaskLayout(project.taskLayout || 'STANDARD');
        setTags(project.tags || '');
        setCurrency(project.currency || 'USD');
        setBudgetType(project.budgetType || 'NONE');
        setBudgetAmount(project.budgetAmount !== null && project.budgetAmount !== undefined ? String(project.budgetAmount) : '');
        setBudgetHours(project.budgetHours !== null && project.budgetHours !== undefined ? String(project.budgetHours) : '');
        setBillingMethod(project.billingMethod || 'NONE');
        setBillingRate(project.billingRate !== null && project.billingRate !== undefined ? String(project.billingRate) : '');
        setWorkingDays(project.workingDays || '1,2,3,4,5');
        setHoursPerDay(project.hoursPerDay !== null && project.hoursPerDay !== undefined ? String(project.hoursPerDay) : '8.0');
        setAllowClientAccess(project.allowClientAccess || false);
        if (project.budgetType !== 'NONE') setIsBudgetOpen(true);
        if (project.workingDays || project.allowClientAccess) setIsScheduleOpen(true);
      } else {
        setName('');
        setDescription('');
        setStartDate('');
        setEndDate('');
        setVisibility('PRIVATE');
        setIsTemplate(false);
        setGroupId('');
        setOwnerId('');
        setIsStrict(false);
        setTemplateProjectId('');
        setCopyMilestones(true);
        setCopyTasks(true);
        setCopyMembers(false);
        setShiftDates(true);
        setTaskLayout('STANDARD');
        setTags('');
        setCurrency('USD');
        setBudgetType('NONE');
        setBudgetAmount('');
        setBudgetHours('');
        setBillingMethod('NONE');
        setBillingRate('');
        setWorkingDays('1,2,3,4,5');
        setHoursPerDay('8.0');
        setAllowClientAccess(false);
        setIsBudgetOpen(false);
        setIsScheduleOpen(false);
        setIsCreatingGroup(false);
        setErrorMessage(null);
      }
    }
  }, [isOpen, project]);

  // Fetch available projects / templates for cloning
  const { data: availableProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isOpen && !isEditMode,
  });

  // Fetch project groups
  const { data: projectGroups = [] } = useQuery({
    queryKey: ['project-groups'],
    queryFn: async () => {
      const res = await api.get('/project-groups');
      return res.data;
    },
    enabled: isOpen,
  });

  // Fetch organization members for Project Owner selection
  const { data: orgMembers = [] } = useQuery({
    queryKey: ['orgMembers'],
    queryFn: async () => {
      const res = await api.get('/organization/members');
      return res.data;
    },
    enabled: isOpen,
  });

  // Create Project Group Mutation
  const createGroupMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/project-groups', payload);
      return res.data;
    },
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ['project-groups'] });
      setGroupId(newGroup.id);
      setIsCreatingGroup(false);
      setNewGroupName('');
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'Failed to create project group');
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditMode) {
        const res = await api.patch(`/projects/${project.id}`, payload);
        return res.data;
      } else {
        const res = await api.post('/projects', payload);
        return res.data;
      }
    },
    onSuccess: (savedProj) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      }
      onClose();
      if (!isEditMode) {
        router.push(`/projects/${savedProj.id}`);
      }
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'Failed to save project');
    },
  });

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    createGroupMutation.mutate({
      name: newGroupName.trim(),
      color: newGroupColor,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!name.trim()) {
      setErrorMessage('Project name is required');
      return;
    }

    const payload: any = {
      name: name.trim(),
      description: description.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      visibility,
      isTemplate,
      taskLayout,
      tags: tags.trim() || undefined,
      currency,
      budgetType,
      budgetAmount: budgetAmount ? parseFloat(budgetAmount) : undefined,
      budgetHours: budgetHours ? parseFloat(budgetHours) : undefined,
      billingMethod,
      billingRate: billingRate ? parseFloat(billingRate) : undefined,
      groupId: groupId || undefined,
      ownerId: ownerId || undefined,
      isStrict,
      workingDays,
      hoursPerDay: parseFloat(hoursPerDay) || 8.0,
      allowClientAccess,
    };

    if (!isEditMode && templateProjectId) {
      payload.templateProjectId = templateProjectId;
      payload.copyMilestones = copyMilestones;
      payload.copyTasks = copyTasks;
      payload.copyMembers = copyMembers;
      payload.shiftDates = shiftDates;
    }

    saveProjectMutation.mutate(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end overflow-hidden animate-in fade-in duration-200">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 text-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-lg">
                {isEditMode ? 'Edit Project Details' : 'Add New Project'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEditMode
                  ? `Update settings, group, owner, and budget for ${project?.name || 'project'}`
                  : 'Configure group, owner, strict schedule, budget, and work calendar.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          
          {/* Scrollable Form Body */}
          <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
            {errorMessage && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-xs p-4 rounded-xl flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          
          {/* Section 1: General Info */}
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Project Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Mobile Banking Application"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>

            {/* Project Group & Project Owner Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Project Group Selector */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-indigo-400" /> Project Group
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingGroup(!isCreatingGroup)}
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                  >
                    <FolderPlus className="w-3 h-3" /> New Group
                  </button>
                </div>
                
                {isCreatingGroup ? (
                  <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-indigo-500/50">
                    <input
                      type="text"
                      placeholder="Group Name"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none"
                    />
                    <input
                      type="color"
                      value={newGroupColor}
                      onChange={(e) => setNewGroupColor(e.target.value)}
                      className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={handleCreateGroup}
                      disabled={createGroupMutation.isPending}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                  >
                    <option value="">None (Unassigned Group)</option>
                    {projectGroups.map((g: any) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Project Owner Selector */}
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-indigo-400" /> Project Owner
                </label>
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                >
                  <option value="">Default (Logged-in Creator)</option>
                  {orgMembers.map((m: any) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.firstName} {m.user.lastName} ({m.user.email})
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Template Selection Dropdown (Only in Create Mode) */}
            {!isEditMode && (
              <div className="space-y-2 bg-slate-950/60 border border-slate-850 p-4 rounded-xl">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5 text-indigo-400" />
                  Choose from Projects / Baseline Templates
                </label>
                <select
                  value={templateProjectId}
                  onChange={(e) => setTemplateProjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
                >
                  <option value="">None (Start from scratch)</option>
                  {availableProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.isTemplate ? `[Template] ${p.name}` : p.name} ({p.projectCode})
                    </option>
                  ))}
                </select>

                {/* Copy Options Checkboxes */}
                {templateProjectId && (
                  <div className="pt-2 border-t border-slate-850/60 space-y-2 animate-in fade-in duration-150">
                    <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider block">
                      Template Copy Options:
                    </span>
                    <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-300">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={copyMilestones}
                          onChange={(e) => setCopyMilestones(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                        />
                        <span>Copy Milestones</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={copyTasks}
                          onChange={(e) => setCopyTasks(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                        />
                        <span>Copy Tasks</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={copyMembers}
                          onChange={(e) => setCopyMembers(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                        />
                        <span>Copy Team Members</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none text-amber-300">
                        <input
                          type="checkbox"
                          checked={shiftDates}
                          onChange={(e) => setShiftDates(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
                        />
                        <span>Smart Shift Dates to Start Date</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Project Overview & Scope Description
              </label>
              <textarea
                placeholder="Write a detailed summary of baseline tasks, goals, or scope..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs [color-scheme:dark]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Strict Project Toggle & Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Task Layout</label>
                <select
                  value={taskLayout}
                  onChange={(e) => setTaskLayout(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                >
                  <option value="STANDARD">Standard Layout</option>
                  <option value="KANBAN">Kanban Board Layout</option>
                  <option value="LIST">List View Layout</option>
                  <option value="GANTT">Gantt Timeline Layout</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3 text-indigo-400" /> Tags
                </label>
                <input
                  type="text"
                  placeholder="e.g. ClientWork, Urgent, SaaS"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>
            </div>

            {/* Strict Project & Template Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                <div className="flex items-center justify-between">
                  <label htmlFor="strictCheckbox" className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Strict Project Schedule
                  </label>
                  <input
                    type="checkbox"
                    id="strictCheckbox"
                    checked={isStrict}
                    onChange={(e) => setIsStrict(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Enforces strict schedule bounds so tasks & milestones cannot exceed project start/end dates.
                </p>
              </div>

              <div className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                <div className="flex items-center justify-between">
                  <label htmlFor="isTemplateCheckbox" className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer">
                    <Copy className="w-3.5 h-3.5 text-indigo-400" /> Reusable Project Template
                  </label>
                  <input
                    type="checkbox"
                    id="isTemplateCheckbox"
                    checked={isTemplate}
                    onChange={(e) => setIsTemplate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Saves this project as a baseline blueprint for future project creation.
                </p>
              </div>
            </div>

            {/* Visibility Options */}
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Visibility Setting</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVisibility('PRIVATE')}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    visibility === 'PRIVATE'
                      ? 'border-indigo-500 bg-indigo-500/10 text-slate-100'
                      : 'border-slate-850 bg-slate-950/40 text-slate-400 hover:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Lock className="w-4 h-4 text-indigo-400" /> Private to Members
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibility('ORGANIZATION')}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    visibility === 'ORGANIZATION'
                      ? 'border-indigo-500 bg-indigo-500/10 text-slate-100'
                      : 'border-slate-850 bg-slate-950/40 text-slate-400 hover:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Globe className="w-4 h-4 text-blue-400" /> Public to Organization
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Work Schedule & Client Access Accordion */}
          <div className="border border-slate-850 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setIsScheduleOpen(!isScheduleOpen)}
              className="w-full px-4 py-3 bg-slate-950 flex items-center justify-between text-xs font-bold text-slate-200 hover:bg-slate-850/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Work Calendar & Client Access Settings</span>
              </div>
              {isScheduleOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {isScheduleOpen && (
              <div className="p-4 bg-slate-900/50 space-y-4 border-t border-slate-850">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Working Days</label>
                    <select
                      value={workingDays}
                      onChange={(e) => setWorkingDays(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                    >
                      <option value="1,2,3,4,5">Monday - Friday (5 Days)</option>
                      <option value="7,1,2,3,4">Sunday - Thursday (5 Days)</option>
                      <option value="1,2,3,4,5,6">Monday - Saturday (6 Days)</option>
                      <option value="1,2,3,4,5,6,7">Everyday (7 Days)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Working Hours / Day</label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="8.0"
                      value={hoursPerDay}
                      onChange={(e) => setHoursPerDay(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-850/60 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-200 block">Allow Client Portal Access</span>
                    <span className="text-[10px] text-slate-400 block">External client users can log in to view progress & milestones.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowClientAccess}
                    onChange={(e) => setAllowClientAccess(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Budget & Financial Accordion */}
          <div className="border border-slate-850 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setIsBudgetOpen(!isBudgetOpen)}
              className="w-full px-4 py-3 bg-slate-950 flex items-center justify-between text-xs font-bold text-slate-200 hover:bg-slate-850/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Budget & Financial Configuration</span>
              </div>
              {isBudgetOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {isBudgetOpen && (
              <div className="p-4 bg-slate-900/50 space-y-4 border-t border-slate-850">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                    >
                      <option value="USD">USD - US Dollar ($)</option>
                      <option value="EUR">EUR - Euro (€)</option>
                      <option value="INR">INR - Indian Rupee (₹)</option>
                      <option value="GBP">GBP - British Pound (£)</option>
                      <option value="CAD">CAD - Canadian Dollar ($)</option>
                      <option value="AUD">AUD - Australian Dollar ($)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Project Budget Type</label>
                    <select
                      value={budgetType}
                      onChange={(e) => setBudgetType(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                    >
                      <option value="NONE">None</option>
                      <option value="FIXED_COST">Fixed Project Amount</option>
                      <option value="BASED_ON_PROJECT_HOURS">Based on Project Hours</option>
                      <option value="BASED_ON_STAFF_HOURS">Based on Staff Hours</option>
                      <option value="BASED_ON_TASK_HOURS">Based on Task Hours</option>
                    </select>
                  </div>
                </div>

                {budgetType !== 'NONE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 animate-in fade-in duration-150">
                    {budgetType === 'FIXED_COST' && (
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Monetary Budget Amount ({currency})</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 50000"
                          value={budgetAmount}
                          onChange={(e) => setBudgetAmount(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
                        />
                      </div>
                    )}

                    {(budgetType === 'BASED_ON_PROJECT_HOURS' || budgetType === 'BASED_ON_STAFF_HOURS' || budgetType === 'BASED_ON_TASK_HOURS') && (
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Budgeted Hours</label>
                        <input
                          type="number"
                          step="0.5"
                          placeholder="e.g. 250"
                          value={budgetHours}
                          onChange={(e) => setBudgetHours(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-850/60">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Billing Method</label>
                    <select
                      value={billingMethod}
                      onChange={(e) => setBillingMethod(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                    >
                      <option value="NONE">None</option>
                      <option value="FIXED_RATE">Fixed Project Rate</option>
                      <option value="PROJECT_HOURLY_RATE">Based on Project Hourly Rate</option>
                      <option value="STAFF_HOURLY_RATE">Based on Staff Hourly Rate</option>
                      <option value="TASK_HOURLY_RATE">Based on Task Hourly Rate</option>
                    </select>
                  </div>

                  {billingMethod !== 'NONE' && (
                    <div className="space-y-1 animate-in fade-in duration-150">
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Hourly / Contract Rate ({currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 100"
                        value={billingRate}
                        onChange={(e) => setBillingRate(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          </div>

          {/* Fixed Modal Footer */}
          <div className="flex justify-end gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-900 active:scale-95 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveProjectMutation.isPending}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-xs active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saveProjectMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEditMode ? (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>{isTemplate ? 'Add Project Template' : 'Create Project'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
