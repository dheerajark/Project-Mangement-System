'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPersonalPreferences,
  savePersonalPreferences,
  PersonalPreferences,
} from '@/services/getPersonalPreferences';
import {
  Sun,
  Moon,
  Compass,
  Check,
  Bell,
  Sliders,
  FolderKanban,
  CheckSquare,
  Home,
  Globe,
  ArrowLeft,
  Sparkles,
  Loader2,
  Save,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/header';

function PersonalSettingsContent() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const initialTab = searchParams?.get('tab') === 'accessibility' ? 'accessibility' : 'personal';
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'accessibility'>(initialTab);
  const [prefs, setPrefs] = useState<PersonalPreferences>({
    mode: 'night',
    accentColor: 'blue',
    dimMode: false,
    landingPage: '/dashboard',
  });
  const [saveToast, setSaveToast] = useState(false);

  // Notification Preferences States
  const [notifState, setNotifState] = useState({
    taskAssignment: true,
    taskStatusChange: true,
    taskPriorityChange: true,
    taskDueDateChange: true,
    taskComment: true,
    taskMention: true,
    taskAttachment: true,
    taskReminder: true,
    taskOverdue: true,
    taskDependency: true,
    recurringTask: true,
    taskListComment: true,
    issueAssignment: true,
    issueComment: true,
    milestoneUpdate: true,
    timesheetSubmitted: true,
    timesheetApproved: true,
    timesheetRejected: true,
    emailNotifications: true,
    inAppNotifications: true,
  });
  const [notifSuccessToast, setNotifSuccessToast] = useState(false);
  const [notifErrorMsg, setNotifErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setPrefs(getPersonalPreferences());
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'accessibility') {
      setActiveTab('accessibility');
    }
  }, [searchParams]);

  // Fetch Notification Preferences when Accessibility tab is focused
  const { data: notifData, isLoading: isLoadingNotif } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await api.get('/notifications/preferences');
      return res.data;
    },
    enabled: isAuthenticated && activeTab === 'accessibility',
  });

  useEffect(() => {
    if (notifData) {
      setNotifState({
        taskAssignment: notifData.taskAssignment ?? true,
        taskStatusChange: notifData.taskStatusChange ?? true,
        taskPriorityChange: notifData.taskPriorityChange ?? true,
        taskDueDateChange: notifData.taskDueDateChange ?? true,
        taskComment: notifData.taskComment ?? true,
        taskMention: notifData.taskMention ?? true,
        taskAttachment: notifData.taskAttachment ?? true,
        taskReminder: notifData.taskReminder ?? true,
        taskOverdue: notifData.taskOverdue ?? true,
        taskDependency: notifData.taskDependency ?? true,
        recurringTask: notifData.recurringTask ?? true,
        taskListComment: notifData.taskListComment ?? true,
        issueAssignment: notifData.issueAssignment ?? true,
        issueComment: notifData.issueComment ?? true,
        milestoneUpdate: notifData.milestoneUpdate ?? true,
        timesheetSubmitted: notifData.timesheetSubmitted ?? true,
        timesheetApproved: notifData.timesheetApproved ?? true,
        timesheetRejected: notifData.timesheetRejected ?? true,
        emailNotifications: notifData.emailNotifications ?? true,
        inAppNotifications: notifData.inAppNotifications ?? true,
      });
    }
  }, [notifData]);

  const updateNotifMutation = useMutation({
    mutationFn: async (data: typeof notifState) => {
      const res = await api.patch('/notifications/preferences', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      setNotifSuccessToast(true);
      setTimeout(() => setNotifSuccessToast(false), 3000);
    },
    onError: (err: any) => {
      setNotifErrorMsg(err.response?.data?.message || 'Failed to save notification preferences');
      setTimeout(() => setNotifErrorMsg(null), 4000);
    },
  });

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    updateNotifMutation.mutate(notifState);
  };

  const updatePreference = (update: Partial<PersonalPreferences>) => {
    const updated = savePersonalPreferences(update);
    setPrefs(updated);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const userInitials = user
    ? `${user.firstName?.[0] || 'U'}${user.lastName?.[0] || 'P'}`
    : 'DK';

  const colorSwatches: { id: PersonalPreferences['accentColor']; name: string; hex: string }[] = [
    { id: 'orange', name: 'Orange', hex: '#f97316' },
    { id: 'cyan', name: 'Cyan Blue', hex: '#0ea5e9' },
    { id: 'teal', name: 'Teal', hex: '#14b8a6' },
    { id: 'red', name: 'Crimson Red', hex: '#ef4444' },
    { id: 'green', name: 'Emerald Green', hex: '#10b981' },
    { id: 'blue', name: 'Royal Blue', hex: '#3b82f6' },
  ];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header Bar */}
      <Header
        title="User Preferences & Accessibility"
        subtitle="User Personal"
        backHref="/dashboard"
        activeNav="preferences"
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Tabs */}
        <div className="border-b border-border flex items-center justify-between pb-3">
          <div className="flex items-center gap-8 text-sm font-semibold">
            <button
              onClick={() => setActiveTab('personal')}
              className={`pb-3 relative transition-all cursor-pointer ${
                activeTab === 'personal'
                  ? 'text-primary font-bold border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              User Personal
            </button>
            <button
              onClick={() => setActiveTab('accessibility')}
              className={`pb-3 relative transition-all cursor-pointer ${
                activeTab === 'accessibility'
                  ? 'text-primary font-bold border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Accessibility & Notifications
            </button>
          </div>

          {/* Toast Notification for Personal Preferences */}
          {saveToast && (
            <div className="flex items-center gap-2 text-xs text-emerald-500 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl animate-fade-in">
              <Check className="w-4 h-4" />
              <span>Preferences saved automatically</span>
            </div>
          )}
        </div>

        {/* User Profile Summary Banner */}
        <div className="flex items-center justify-between bg-card border border-border p-6 rounded-2xl shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-400/20 text-amber-500 rounded-full flex items-center justify-center font-bold text-xl border border-amber-400/30 shadow-xs">
              {userInitials}
            </div>
            <div>
              <h2 className="text-base font-bold">{user ? `${user.firstName} ${user.lastName}` : 'User Profile'}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{user?.email || 'user@example.com'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-xl border border-border font-medium">
              <Globe className="w-3.5 h-3.5 text-primary" />
              <span>English (US)</span>
            </div>
          </div>
        </div>

        {/* TAB 1: USER PERSONAL PREFERENCES */}
        {activeTab === 'personal' && (
          <div className="space-y-8 animate-fade-in">
            {/* SECTION 1: THEMES & ACCENT COLOR SWATCHES */}
            <section className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-foreground">Themes</h3>
                <p className="text-xs text-muted-foreground mt-1">Pick your preferred accent color theme for buttons, icons, and highlights.</p>
              </div>

              {/* Color Swatches Grid */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-muted-foreground block">Color Palette Accent</label>
                <div className="flex items-center gap-4 flex-wrap">
                  {colorSwatches.map((swatch) => {
                    const isSelected = prefs.accentColor === swatch.id;
                    return (
                      <button
                        key={swatch.id}
                        onClick={() => updatePreference({ accentColor: swatch.id })}
                        className="w-10 h-10 rounded-full relative flex items-center justify-center transition-all hover:scale-110 focus:outline-none shadow-xs border border-black/10 cursor-pointer"
                        style={{ backgroundColor: swatch.hex }}
                        title={swatch.name}
                      >
                        {isSelected && (
                          <div className="w-7 h-7 rounded-full bg-white/30 backdrop-blur-xs flex items-center justify-center border border-white/70 shadow-xs">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* SECTION 2: MODE SELECTION */}
            <section className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-foreground">Mode</h3>
                <p className="text-xs text-muted-foreground mt-1">Select your preferred eye-care interface mode.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-xl">
                {/* Day Mode */}
                <button
                  onClick={() => updatePreference({ mode: 'day', dimMode: false })}
                  className={`p-5 rounded-2xl border transition-all text-left flex flex-col justify-between h-32 relative cursor-pointer ${
                    prefs.mode === 'day' && !prefs.dimMode
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-muted/40 hover:border-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-500 flex items-center justify-center">
                      <Sun className="w-5 h-5" />
                    </div>
                    {prefs.mode === 'day' && !prefs.dimMode && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <span className="text-xs font-bold text-foreground">Day Mode</span>
                </button>

                {/* Night Mode */}
                <button
                  onClick={() => updatePreference({ mode: 'night', dimMode: false })}
                  className={`p-5 rounded-2xl border transition-all text-left flex flex-col justify-between h-32 relative cursor-pointer ${
                    prefs.mode === 'night' && !prefs.dimMode
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-muted/40 hover:border-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                      <Moon className="w-5 h-5" />
                    </div>
                    {prefs.mode === 'night' && !prefs.dimMode && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <span className="text-xs font-bold text-foreground">Night Mode</span>
                </button>

                {/* Auto Mode */}
                <button
                  onClick={() => updatePreference({ mode: 'auto' })}
                  className={`p-5 rounded-2xl border transition-all text-left flex flex-col justify-between h-32 relative cursor-pointer ${
                    prefs.mode === 'auto'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-muted/40 hover:border-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      <Compass className="w-5 h-5" />
                    </div>
                    {prefs.mode === 'auto' && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <span className="text-xs font-bold text-foreground">Auto (System)</span>
                </button>
              </div>

              {/* Enable Dim Mode Checkbox */}
              <div className="pt-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enableDimMode"
                  checked={prefs.dimMode}
                  onChange={(e) => updatePreference({ dimMode: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <label htmlFor="enableDimMode" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                  Enable Dim Mode (Soft Charcoal Eye Care)
                </label>
              </div>
            </section>

            {/* SECTION 3: LANDING PAGE */}
            <section className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-foreground">Landing Page</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Select the most used module and land on it every time you log in.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl">
                {/* Home */}
                <button
                  onClick={() => updatePreference({ landingPage: '/dashboard' })}
                  className={`p-5 rounded-2xl border transition-all text-left flex flex-col justify-between h-36 relative cursor-pointer ${
                    prefs.landingPage === '/dashboard'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-muted/40 hover:border-muted-foreground'
                  }`}
                >
                  <div className="h-16 bg-muted/80 rounded-xl border border-border flex items-center justify-center p-2">
                    <Home className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-bold text-foreground">Home</span>
                    {prefs.landingPage === '/dashboard' && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </button>

                {/* Projects */}
                <button
                  onClick={() => updatePreference({ landingPage: '/projects' })}
                  className={`p-5 rounded-2xl border transition-all text-left flex flex-col justify-between h-36 relative cursor-pointer ${
                    prefs.landingPage === '/projects'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-muted/40 hover:border-muted-foreground'
                  }`}
                >
                  <div className="h-16 bg-muted/80 rounded-xl border border-border flex items-center justify-center p-2">
                    <FolderKanban className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-bold text-foreground">Projects</span>
                    {prefs.landingPage === '/projects' && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </button>

                {/* Collaboration / Tasks */}
                <button
                  onClick={() => updatePreference({ landingPage: '/tasks' })}
                  className={`p-5 rounded-2xl border transition-all text-left flex flex-col justify-between h-36 relative cursor-pointer ${
                    prefs.landingPage === '/tasks'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-muted/40 hover:border-muted-foreground'
                  }`}
                >
                  <div className="h-16 bg-muted/80 rounded-xl border border-border flex items-center justify-center p-2">
                    <CheckSquare className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-bold text-foreground">Collaboration</span>
                    {prefs.landingPage === '/tasks' && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: ACCESSIBILITY & NOTIFICATION PREFERENCES */}
        {activeTab === 'accessibility' && (
          <div className="space-y-8 animate-fade-in">
            <form onSubmit={handleSaveNotifications} className="space-y-6">
              <section className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Bell className="w-5 h-5 text-rose-500" /> Subscription Settings
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure which actions trigger in-app notifications on your dashboard.
                    </p>
                  </div>
                  {notifSuccessToast && (
                    <div className="flex items-center gap-2 text-xs text-emerald-500 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl animate-fade-in">
                      <Check className="w-4 h-4" />
                      <span>Preferences saved successfully</span>
                    </div>
                  )}
                </div>

                {notifErrorMsg && (
                  <div className="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{notifErrorMsg}</span>
                  </div>
                )}

                {isLoadingNotif ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6 divide-y divide-border/60">
                    {/* DELIVERY CHANNELS */}
                    <div className="pt-2 space-y-4">
                      <h4 className="text-xs font-bold text-rose-500/90 tracking-wider uppercase">Delivery Channels</h4>
                      
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">In-App Notifications & Toasts</label>
                          <span className="text-xs text-muted-foreground">Receive real-time alerts, toast banners, and bell notifications in the app</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.inAppNotifications}
                          onChange={(e) => setNotifState({ ...notifState, inAppNotifications: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Email Notifications</label>
                          <span className="text-xs text-muted-foreground">Receive summary emails for critical task reminders and assignments</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.emailNotifications}
                          onChange={(e) => setNotifState({ ...notifState, emailNotifications: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>
                    </div>

                    {/* TASK REMINDERS & ALERTS */}
                    <div className="pt-6 space-y-4">
                      <h4 className="text-xs font-bold text-rose-500/90 tracking-wider uppercase">Task Reminders & Alerts</h4>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Due Date Reminders</label>
                          <span className="text-xs text-muted-foreground">Receive reminders approaching task due dates (e.g. 1 day before, on due date)</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.taskReminder}
                          onChange={(e) => setNotifState({ ...notifState, taskReminder: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Overdue Task Warnings</label>
                          <span className="text-xs text-muted-foreground">Receive daily or scheduled warnings when assigned tasks are overdue</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.taskOverdue}
                          onChange={(e) => setNotifState({ ...notifState, taskOverdue: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Recurring Task Generations</label>
                          <span className="text-xs text-muted-foreground">Receive alerts when new task occurrences are spawned from recurring schedules</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.recurringTask}
                          onChange={(e) => setNotifState({ ...notifState, recurringTask: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>
                    </div>

                    {/* TASKS & COLLABORATION */}
                    <div className="pt-6 space-y-4">
                      <h4 className="text-xs font-bold text-rose-500/90 tracking-wider uppercase">Tasks & Collaboration</h4>
                      
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Task Assignment & Reassignment</label>
                          <span className="text-xs text-muted-foreground">Receive alerts when tasks are assigned or unassigned to/from you</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.taskAssignment}
                          onChange={(e) => setNotifState({ ...notifState, taskAssignment: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Status & Completion Changes</label>
                          <span className="text-xs text-muted-foreground">Receive alerts when tasks you watch or own change status, complete, or reopen</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.taskStatusChange}
                          onChange={(e) => setNotifState({ ...notifState, taskStatusChange: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Priority Changes</label>
                          <span className="text-xs text-muted-foreground">Receive alerts when a task priority is updated (e.g. escalated to High/Critical)</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.taskPriorityChange}
                          onChange={(e) => setNotifState({ ...notifState, taskPriorityChange: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Schedule & Due Date Changes</label>
                          <span className="text-xs text-muted-foreground">Receive alerts when task start or due dates are adjusted</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.taskDueDateChange}
                          onChange={(e) => setNotifState({ ...notifState, taskDueDateChange: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Direct @Mentions</label>
                          <span className="text-xs text-muted-foreground">Receive priority alerts when someone mentions you with @username</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.taskMention}
                          onChange={(e) => setNotifState({ ...notifState, taskMention: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Task Comments</label>
                          <span className="text-xs text-muted-foreground">Receive alerts when someone comments on tasks you own or watch</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.taskComment}
                          onChange={(e) => setNotifState({ ...notifState, taskComment: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Task Attachments</label>
                          <span className="text-xs text-muted-foreground">Receive alerts when documents or files are uploaded to your tasks</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.taskAttachment}
                          onChange={(e) => setNotifState({ ...notifState, taskAttachment: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Task Dependencies</label>
                          <span className="text-xs text-muted-foreground">Receive alerts when predecessor tasks are marked complete so you can start</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.taskDependency}
                          onChange={(e) => setNotifState({ ...notifState, taskDependency: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Task List Comments</label>
                          <span className="text-xs text-muted-foreground">Receive alerts when someone comments on task lists in your projects</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.taskListComment}
                          onChange={(e) => setNotifState({ ...notifState, taskListComment: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>
                    </div>

                    {/* ISSUES & BUGS */}
                    <div className="pt-6 space-y-4">
                      <h4 className="text-xs font-bold text-rose-500/90 tracking-wider uppercase">Issues & Bugs</h4>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Issue Assignment</label>
                          <span className="text-xs text-muted-foreground">Receive alerts when issues are assigned to you</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.issueAssignment}
                          onChange={(e) => setNotifState({ ...notifState, issueAssignment: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Issue Comments</label>
                          <span className="text-xs text-muted-foreground">Receive alerts when someone comments on your issues</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.issueComment}
                          onChange={(e) => setNotifState({ ...notifState, issueComment: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>
                    </div>

                    {/* MILESTONES */}
                    <div className="pt-6 space-y-4">
                      <h4 className="text-xs font-bold text-rose-500/90 tracking-wider uppercase">Milestones</h4>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Milestone Status Updates</label>
                          <span className="text-xs text-muted-foreground">Receive alerts when milestones are completed or missed</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.milestoneUpdate}
                          onChange={(e) => setNotifState({ ...notifState, milestoneUpdate: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>
                    </div>

                    {/* TIMESHEETS */}
                    <div className="pt-6 space-y-4">
                      <h4 className="text-xs font-bold text-rose-500/90 tracking-wider uppercase">Timesheet Events</h4>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Timesheet Submission</label>
                          <span className="text-xs text-muted-foreground">Notify me when members submit timesheets for review (Managers/Admins)</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.timesheetSubmitted}
                          onChange={(e) => setNotifState({ ...notifState, timesheetSubmitted: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Timesheet Approvals</label>
                          <span className="text-xs text-muted-foreground">Notify me when my timesheet has been approved</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.timesheetApproved}
                          onChange={(e) => setNotifState({ ...notifState, timesheetApproved: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-border/40">
                        <div>
                          <label className="text-sm font-semibold text-foreground block">Timesheet Rejections</label>
                          <span className="text-xs text-muted-foreground">Notify me when my timesheet has been rejected</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifState.timesheetRejected}
                          onChange={(e) => setNotifState({ ...notifState, timesheetRejected: e.target.checked })}
                          className="w-10 h-5 bg-muted/80 border border-border rounded-full appearance-none checked:bg-primary checked:before:translate-x-5 before:content-[''] before:block before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform before:translate-x-0.5 before:translate-y-0.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-border">
                  <button
                    type="submit"
                    disabled={updateNotifMutation.isPending || isLoadingNotif}
                    className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {updateNotifMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Save Preferences</span>
                  </button>
                </div>
              </section>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default function PersonalSettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    }>
      <PersonalSettingsContent />
    </Suspense>
  );
}
