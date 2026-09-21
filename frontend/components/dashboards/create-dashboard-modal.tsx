'use client';

import React, { useState } from 'react';
import { X, Plus, Layout, FolderKanban, Check, Sparkles, Lock, Globe, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

interface CreateDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    projectId?: string;
    visibility: 'PRIVATE' | 'PROJECT_USERS' | 'PORTAL_USERS';
    template: 'BLANK' | 'PROJECT_OVERVIEW' | 'TASKS_HEALTH' | 'TIME_TRACKING';
  }) => Promise<void>;
  defaultProjectId?: string;
}

const TEMPLATES = [
  {
    id: 'PROJECT_OVERVIEW',
    name: 'Project Overview',
    description: 'KPI summary, Task Status & Priority charts, and Overdue / Upcoming task lists.',
    icon: Layout,
  },
  {
    id: 'TASKS_HEALTH',
    name: 'Task Health & Workload',
    description: 'Workload by Assignee, Task Lists, Milestones, and Pending/Overdue task KPIs.',
    icon: Check,
  },
  {
    id: 'TIME_TRACKING',
    name: 'Time Tracking & Logs',
    description: 'Total & Billable hours KPIs, Billable vs Non-Billable chart, and Recent Time Entries table.',
    icon: Sparkles,
  },
  {
    id: 'BLANK',
    name: 'Blank Canvas',
    description: 'Start with an empty dashboard and add your own custom widgets.',
    icon: Plus,
  },
];

export default function CreateDashboardModal({
  isOpen,
  onClose,
  onSubmit,
  defaultProjectId,
}: CreateDashboardModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PROJECT_USERS' | 'PORTAL_USERS'>('PRIVATE');
  const [template, setTemplate] = useState<'BLANK' | 'PROJECT_OVERVIEW' | 'TASKS_HEALTH' | 'TIME_TRACKING'>('PROJECT_OVERVIEW');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Projects for Association Dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a dashboard name.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        projectId: projectId || undefined,
        visibility,
        template,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to create dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Layout className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Create Custom Dashboard</h3>
              <p className="text-xs text-slate-400">Design a personalized metrics view</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dashboard Name */}
          <div className="space-y-1">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Dashboard Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Executive Task Overview"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of what this dashboard tracks..."
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs resize-none"
            />
          </div>

          {/* Project Association & Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Project Scope
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
              >
                <option value="">Portal-Wide (Cross-Project)</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Visibility */}
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Visibility / Access
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
              >
                <option value="PRIVATE">Private (Only Me)</option>
                <option value="PROJECT_USERS" disabled={!projectId}>
                  Project Users {projectId ? '' : '(Requires Project)'}
                </option>
                <option value="PORTAL_USERS">Portal Users (Organization)</option>
              </select>
            </div>
          </div>

          {/* Initial Template Selection */}
          <div className="space-y-2 pt-2">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Starter Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                const isSelected = template === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setTemplate(tmpl.id as any)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-600/10 border-indigo-500 text-slate-100 ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-850 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold">{tmpl.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">{tmpl.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
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
              <Plus className="w-4 h-4" />
              {isSubmitting ? 'Creating...' : 'Create Dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
