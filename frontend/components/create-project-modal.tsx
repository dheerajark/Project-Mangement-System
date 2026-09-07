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
  Clock,
  Tag,
  Copy,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  CheckSquare,
  ShieldAlert,
  Sliders,
  Sparkles,
  Layers,
} from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Form States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'ORGANIZATION'>('PRIVATE');
  const [isTemplate, setIsTemplate] = useState(false);

  // Template / Baseline Cloning State
  const [templateProjectId, setTemplateProjectId] = useState<string>('');
  const [copyMilestones, setCopyMilestones] = useState(true);
  const [copyTasks, setCopyTasks] = useState(true);
  const [copyMembers, setCopyMembers] = useState(false);

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

  const [isBudgetOpen, setIsBudgetOpen] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setVisibility('PRIVATE');
      setIsTemplate(false);
      setTemplateProjectId('');
      setCopyMilestones(true);
      setCopyTasks(true);
      setCopyMembers(false);
      setTaskLayout('STANDARD');
      setTags('');
      setCurrency('USD');
      setBudgetType('NONE');
      setBudgetAmount('');
      setBudgetHours('');
      setBillingMethod('NONE');
      setBillingRate('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Fetch baseline projects/templates for cloning dropdown
  const { data: availableProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isOpen,
  });

  const createProjectMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/projects', payload);
      return res.data;
    },
    onSuccess: (newProj) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
      router.push(`/projects/${newProj.id}`);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'Failed to create project');
    },
  });

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
    };

    if (templateProjectId) {
      payload.templateProjectId = templateProjectId;
      payload.copyMilestones = copyMilestones;
      payload.copyTasks = copyTasks;
      payload.copyMembers = copyMembers;
    }

    createProjectMutation.mutate(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-lg">Add New Project</h3>
              <p className="text-xs text-slate-400">Configure layout, baseline template, budget, and billing options.</p>
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
                placeholder="e.g. Standard Implementation Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>

            {/* Template Selection Dropdown */}
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
                  </div>
                </div>
              )}
            </div>

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

            {/* Layout Preference & Tags */}
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

            {/* Visibility & Mark as Template */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Visibility Setting</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility('PRIVATE')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      visibility === 'PRIVATE'
                        ? 'border-indigo-500 bg-indigo-500/10 text-slate-100'
                        : 'border-slate-850 bg-slate-950/40 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-bold text-xs">
                      <Lock className="w-3 h-3" /> Private
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibility('ORGANIZATION')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      visibility === 'ORGANIZATION'
                        ? 'border-indigo-500 bg-indigo-500/10 text-slate-100'
                        : 'border-slate-850 bg-slate-950/40 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-bold text-xs">
                      <Globe className="w-3 h-3" /> Org Public
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="isTemplateCheckbox"
                  checked={isTemplate}
                  onChange={(e) => setIsTemplate(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
                <label htmlFor="isTemplateCheckbox" className="text-xs font-semibold text-slate-200 cursor-pointer select-none">
                  Save as Project Template (Reusable Blueprint)
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Budget & Financial Accordion */}
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
              disabled={createProjectMutation.isPending}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-xs active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {createProjectMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
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
