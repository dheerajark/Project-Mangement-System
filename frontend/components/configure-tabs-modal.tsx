'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  SlidersHorizontal,
  LayoutDashboard,
  ListTodo,
  Users,
  Flag,
  Bug,
  Clock,
  PieChart,
  FolderTree,
  Check,
  RotateCcw,
  Lock,
  Loader2,
  Sparkles,
} from 'lucide-react';

export interface TabConfigItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  required?: boolean;
}

export const ALL_PROJECT_TABS: TabConfigItem[] = [
  {
    id: 'overview',
    name: 'Overview',
    description: 'Project dashboard, health meters, budget tracking, and core details.',
    icon: LayoutDashboard,
    required: true,
  },
  {
    id: 'tasks',
    name: 'Tasks',
    description: 'Task lists, subtasks hierarchy, Classic & Plain views, and Kanban board.',
    icon: ListTodo,
  },
  {
    id: 'members',
    name: 'Members',
    description: 'Project team roster, role privileges, and staff hourly billing rates.',
    icon: Users,
  },
  {
    id: 'milestones',
    name: 'Milestones',
    description: 'Phase management, release roadmaps, deadlines, and milestone progress.',
    icon: Flag,
  },
  {
    id: 'issues',
    name: 'Issues',
    description: 'Bug tracking, severity triage, defect lifecycles, and issue comments.',
    icon: Bug,
  },
  {
    id: 'timeLogs',
    name: 'Time Logs',
    description: 'Log worked hours against tasks, live timers, and staff timesheets.',
    icon: Clock,
  },
  {
    id: 'reports',
    name: 'Reports',
    description: 'Project analytics, budget consumption, burnup charts, and export data.',
    icon: PieChart,
  },
  {
    id: 'documents',
    name: 'Documents',
    description: 'Project repository, folder trees, file versions, and visual previewer.',
    icon: FolderTree,
  },
];

export const DEFAULT_ENABLED_TABS = [
  'overview',
  'tasks',
  'members',
  'milestones',
  'issues',
  'timeLogs',
  'reports',
  'documents',
];

interface ConfigureTabsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEnabledTabs: string[];
  canEditProject: boolean;
  onSave: (newTabs: string[]) => Promise<void>;
}

export default function ConfigureTabsModal({
  isOpen,
  onClose,
  currentEnabledTabs,
  canEditProject,
  onSave,
}: ConfigureTabsModalProps) {
  const [selectedTabs, setSelectedTabs] = useState<string[]>(DEFAULT_ENABLED_TABS);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (currentEnabledTabs && currentEnabledTabs.length > 0) {
        // Ensure 'overview' is always included
        const sanitized = Array.from(new Set(['overview', ...currentEnabledTabs]));
        setSelectedTabs(sanitized);
      } else {
        setSelectedTabs(DEFAULT_ENABLED_TABS);
      }
      setError(null);
    }
  }, [isOpen, currentEnabledTabs]);

  if (!isOpen) return null;

  const toggleTab = (tabId: string) => {
    if (tabId === 'overview') return; // Cannot disable overview
    if (selectedTabs.includes(tabId)) {
      // Must have at least 1 tab beside overview
      setSelectedTabs(selectedTabs.filter((id) => id !== tabId));
    } else {
      setSelectedTabs([...selectedTabs, tabId]);
    }
  };

  const handleResetToDefault = () => {
    setSelectedTabs(DEFAULT_ENABLED_TABS);
  };

  const handleSelectAll = () => {
    setSelectedTabs(ALL_PROJECT_TABS.map((t) => t.id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      // Ensure 'overview' is always first
      const ordered = ['overview', ...selectedTabs.filter((id) => id !== 'overview')];
      await onSave(ordered);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save tab preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const enabledCount = selectedTabs.length;
  const totalCount = ALL_PROJECT_TABS.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />

      <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between shrink-0 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600/30 to-blue-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/10">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                Customize Project Tabs
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                  {enabledCount}/{totalCount} Active
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Choose which module tabs appear in this project's navigation bar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions Bar */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-850 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400 font-medium">
            Toggle modules on/off to simplify your project workspace
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            >
              Select All
            </button>
            <span className="text-slate-700">•</span>
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-950/40 border border-rose-900/60 text-rose-200 text-xs rounded-xl">
            {error}
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-2.5 overflow-y-auto flex-1">
          {ALL_PROJECT_TABS.map((tab) => {
            const isEnabled = selectedTabs.includes(tab.id);
            const Icon = tab.icon;

            return (
              <div
                key={tab.id}
                onClick={() => !tab.required && toggleTab(tab.id)}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  tab.required
                    ? 'bg-slate-950/30 border-slate-850 opacity-90 cursor-default'
                    : isEnabled
                    ? 'bg-slate-950/70 border-indigo-500/30 hover:border-indigo-500/50 cursor-pointer'
                    : 'bg-slate-950/20 border-slate-900 hover:border-slate-800 opacity-60 hover:opacity-80 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-4">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isEnabled
                        ? 'bg-indigo-600/15 border-indigo-500/30 text-indigo-400'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-100">{tab.name}</span>
                      {tab.required && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                          <Lock className="w-2.5 h-2.5" /> Required
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {tab.description}
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <div className="shrink-0 pl-2">
                  {tab.required ? (
                    <div className="w-10 h-6 rounded-full bg-indigo-600/50 flex items-center justify-end px-1 opacity-70">
                      <div className="w-4 h-4 rounded-full bg-white shadow" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTab(tab.id);
                      }}
                      className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 cursor-pointer ${
                        isEnabled ? 'bg-indigo-600 justify-end' : 'bg-slate-800 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 text-center sm:text-left">
            {canEditProject
              ? 'Changes will be saved to this project for all team members.'
              : 'Saved as your personal navigation preference for this project.'}
          </span>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-300 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
