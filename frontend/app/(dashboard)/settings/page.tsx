'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronUp,
  Info,
  Settings,
  Users,
  Mail,
  FileText,
  Plus,
  Trash2,
  UserMinus,
  UserCheck,
  Copy,
  Check,
  ArrowLeft,
  AlertCircle,
  Shield,
  Loader2,
  Lock,
  Sliders,
} from 'lucide-react';
import Link from 'next/link';
import NotificationBell from '@/components/notification-bell';

// Collapsible permissions categories mapping
const PERMISSION_GROUPS: Record<string, string[]> = {
  'Project Permissions': ['CREATE_PROJECT', 'VIEW_PROJECT', 'EDIT_PROJECT', 'ARCHIVE_PROJECT'],
  'Task Permissions': ['CREATE_TASK', 'VIEW_TASK', 'EDIT_TASK', 'ARCHIVE_TASK'],
  'Issue Permissions': ['CREATE_ISSUE', 'VIEW_ISSUE', 'EDIT_ISSUE', 'ARCHIVE_ISSUE', 'COMMENT_ISSUE'],
  'Milestone Permissions': ['CREATE_MILESTONE', 'VIEW_MILESTONE', 'EDIT_MILESTONE', 'ARCHIVE_MILESTONE'],
  'Reports Permissions': ['VIEW_REPORT'],
  'Time Tracking Permissions': ['LOG_TIME_ENTRY', 'ARCHIVE_TIME_ENTRY', 'VIEW_TIME_ENTRY', 'SUBMIT_TIMESHEET', 'APPROVE_TIMESHEET'],
  'Administration Permissions': ['MANAGE_USERS', 'INVITE_MEMBERS'],
};

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'invitations' | 'audit' | 'profiles'>('general');
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Profile Form States
  const [isCreateProfileOpen, setIsCreateProfileOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');

  const [cloneSourceProfile, setCloneSourceProfile] = useState<any | null>(null);
  const [cloneNewName, setCloneNewName] = useState('');
  const [cloneNewDesc, setCloneNewDesc] = useState('');

  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);

  // Accordion open/close state keyed by profileId_groupName
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Invitation Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteSuccessToken, setInviteSuccessToken] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Settings Form State
  const [theme, setTheme] = useState('dark');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [language, setLanguage] = useState('en');
  const [currency, setCurrency] = useState('USD');
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const canManage = hasPermission('MANAGE_USERS');

  // Queries
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/organization/settings');
      return res.data;
    },
    enabled: isAuthenticated && canManage,
  });

  const { data: members, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const res = await api.get('/organization/members');
      return res.data;
    },
    enabled: isAuthenticated && canManage,
  });

  const { data: invitations, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const res = await api.get('/invitations');
      return res.data;
    },
    enabled: isAuthenticated && canManage,
  });

  const { data: auditLogs, isLoading: isLoadingAuditLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await api.get('/organization/audit-logs');
      return res.data;
    },
    enabled: isAuthenticated && canManage,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/organization/roles');
      return res.data;
    },
    enabled: isAuthenticated && canManage,
  });

  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const res = await api.get('/organization/profiles');
      return res.data;
    },
    enabled: isAuthenticated && canManage,
  });

  const { data: systemPermissions, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const res = await api.get('/organization/permissions');
      return res.data;
    },
    enabled: isAuthenticated && canManage,
  });

  // Populate settings form when data is loaded
  useEffect(() => {
    if (settings) {
      setTheme(settings.theme || 'dark');
      setAllowedDomains(settings.allowedEmailDomains || '');
      setTimezone(settings.timezone || 'UTC');
      setDateFormat(settings.dateFormat || 'YYYY-MM-DD');
      setLanguage(settings.language || 'en');
      setCurrency(settings.currency || 'USD');
    }
  }, [settings]);

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch('/organization/settings', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    },
  });

  const createInvitationMutation = useMutation({
    mutationFn: async (data: { email: string; roleId: string }) => {
      const res = await api.post('/invitations', data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setInviteSuccessToken(data.token);
      setInviteEmail('');
      setInviteRoleId('');
    },
    onError: (err: any) => {
      setInviteError(err.response?.data?.message || 'Failed to send invitation');
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/invitations/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) => {
      const res = await api.patch(`/organization/members/${userId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.delete(`/organization/members/${userId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const assignProfileMutation = useMutation({
    mutationFn: async ({ memberId, profileId }: { memberId: string; profileId: string }) => {
      const res = await api.patch(`/organization/members/${memberId}/profile`, { profileId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to assign profile.');
    },
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await api.post('/organization/profiles', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (err: any) => {
      setProfileErrorMessage(err.response?.data?.message || 'Failed to create profile.');
    },
  });

  const cloneProfileMutation = useMutation({
    mutationFn: async ({ profileId, data }: { profileId: string; data: { name: string; description?: string } }) => {
      const res = await api.post(`/organization/profiles/${profileId}/clone`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (err: any) => {
      setProfileErrorMessage(err.response?.data?.message || 'Failed to clone profile.');
    },
  });

  const archiveProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await api.post(`/organization/profiles/${profileId}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (err: any) => {
      setProfileErrorMessage(err.response?.data?.message || 'Failed to archive profile.');
    },
  });

  const togglePermissionMutation = useMutation({
    mutationFn: async ({ profileId, permissionId, active }: { profileId: string; permissionId: string; active: boolean }) => {
      if (active) {
        return api.post(`/organization/profiles/${profileId}/permissions/${permissionId}`);
      } else {
        return api.delete(`/organization/profiles/${profileId}/permissions/${permissionId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (err: any) => {
      setProfileErrorMessage(err.response?.data?.message || 'Dependency check failed on profile change.');
    },
  });

  // Handlers
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate({
      theme,
      allowedEmailDomains: allowedDomains || null,
      timezone,
      dateFormat,
      language,
      currency,
    });
  };

  const handleCreateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccessToken(null);
    if (!inviteEmail || !inviteRoleId) {
      setInviteError('Please fill in all fields');
      return;
    }
    createInvitationMutation.mutate({ email: inviteEmail, roleId: inviteRoleId });
  };

  const handleCopyLink = (token: string, inviteId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedTokenId(inviteId);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Access Denied if user has no permissions to manage
  if (!canManage) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
          <Lock className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-100">Access Denied</h1>
          <p className="text-slate-400 text-sm mt-3">
            You do not have the <span className="font-semibold text-slate-200">MANAGE_USERS</span> permission required to access the Organization Control Panel.
          </p>
          <div className="mt-8 border-t border-slate-800 pt-6">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-semibold shadow-lg text-sm transition-all duration-150 inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
              Organization Control Panel
            </span>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link
              href="/settings/notifications"
              className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all duration-150 flex items-center justify-center"
              title="Notification Preferences"
            >
              <Sliders className="w-4 h-4" />
            </Link>
            <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-full">
              Admin Settings
            </div>
          </div>
        </div>
      </header>

      {/* Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                activeTab === 'general'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Settings className="w-4 h-4" />
              General Settings
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                activeTab === 'members'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Users className="w-4 h-4" />
              Member Management
            </button>
            <button
              onClick={() => setActiveTab('invitations')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                activeTab === 'invitations'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Mail className="w-4 h-4" />
              Invitations
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                activeTab === 'audit'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <FileText className="w-4 h-4" />
              Audit Logs
            </button>
            <button
              onClick={() => setActiveTab('profiles')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                activeTab === 'profiles'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Shield className="w-4 h-4" />
              Profiles & Permissions
            </button>
          </div>
        </aside>

        {/* Tab Details */}
        <section className="flex-1 min-w-0">
          {activeTab === 'general' && (
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 md:p-8 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-100">Organization Settings</h3>
                <p className="text-slate-400 text-xs mt-1">Configure language, theme, currency and formatting parameters.</p>
              </div>

              {settingsSuccess && (
                <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-sm p-4 rounded-xl flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>Organization settings successfully saved!</span>
                </div>
              )}

              {isLoadingSettings ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
              ) : (
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Default Theme</label>
                      <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                      >
                        <option value="dark">Dark Theme</option>
                        <option value="light">Light Theme</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Allowed Email Domains</label>
                      <input
                        type="text"
                        placeholder="e.g. company.com (comma separated)"
                        value={allowedDomains}
                        onChange={(e) => setAllowedDomains(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Timezone</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                      >
                        <option value="UTC">UTC</option>
                        <option value="EST">EST (GMT-5)</option>
                        <option value="PST">PST (GMT-8)</option>
                        <option value="IST">IST (GMT+5:30)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Date Format</label>
                      <select
                        value={dateFormat}
                        onChange={(e) => setDateFormat(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                      >
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Default Language</label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                      >
                        <option value="en">English (US)</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Currency</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="INR">INR (₹)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-900">
                    <button
                      type="submit"
                      disabled={updateSettingsMutation.isPending}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-sm active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 md:p-8 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-100">Member Management</h3>
                <p className="text-slate-400 text-xs mt-1">Manage tenant users, toggle statuses, and adjust system permissions.</p>
              </div>

              {isLoadingMembers ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-900">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-900">
                      <tr>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Profile</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 bg-slate-900/10">
                      {members?.map((m: any) => {
                        const isSelf = m.userId === user?.sub;
                        const roleObj = m.user.userRoles?.[0]?.role;
                        return (
                          <tr key={m.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-200">
                              {m.user.firstName || m.user.lastName
                                ? `${m.user.firstName || ''} ${m.user.lastName || ''}`
                                : 'Unnamed User'}
                              {isSelf && <span className="ml-2 px-2 py-0.5 bg-slate-800 text-[10px] rounded text-slate-400">You</span>}
                            </td>
                            <td className="px-6 py-4 text-slate-400">{m.user.email}</td>
                            <td className="px-6 py-4">
                              <select
                                disabled={isSelf || !roles}
                                value={roleObj?.id || ''}
                                onChange={(e) => updateMemberMutation.mutate({ userId: m.userId, data: { roleId: e.target.value } })}
                                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                              >
                                {roles?.map((r: any) => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4">
                              <select
                                disabled={isSelf || !profiles}
                                value={m.user.userProfile?.profileId || ''}
                                onChange={(e) => assignProfileMutation.mutate({ memberId: m.userId, profileId: e.target.value })}
                                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                              >
                                <option value="" disabled>Select Profile...</option>
                                {profiles?.map((p: any) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                m.status === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${m.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                {m.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  disabled={isSelf}
                                  onClick={() => updateMemberMutation.mutate({
                                    userId: m.userId,
                                    data: { status: m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }
                                  })}
                                  className={`p-1.5 border rounded-lg transition-all ${
                                    m.status === 'ACTIVE'
                                      ? 'text-amber-400 border-amber-900/30 hover:bg-amber-500/10'
                                      : 'text-emerald-400 border-emerald-900/30 hover:bg-emerald-500/10'
                                  } disabled:opacity-30`}
                                  title={m.status === 'ACTIVE' ? 'Suspend member' : 'Activate member'}
                                >
                                  {m.status === 'ACTIVE' ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                </button>
                                <button
                                  disabled={isSelf}
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to remove this member? This soft-deletes the user's account.`)) {
                                      deleteMemberMutation.mutate(m.userId);
                                    }
                                  }}
                                  className="p-1.5 text-red-400 border border-red-900/30 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-30"
                                  title="Remove member"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'invitations' && (
            <div className="space-y-8">
              {/* Form Card */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 md:p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-100">Invite Members</h3>
                  <p className="text-slate-400 text-xs mt-1">Send a new onboarding invitation to join your organization.</p>
                </div>

                {inviteError && (
                  <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <span>{inviteError}</span>
                  </div>
                )}

                {inviteSuccessToken && (
                  <div className="bg-slate-900 border border-indigo-800 rounded-xl p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-indigo-500/15 text-indigo-400 rounded-lg">
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200">Invitation Link Generated!</h4>
                        <p className="text-slate-400 text-xs mt-1">Copy and share this secure link with the invitee so they can set up their profile.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/accept-invite?token=${inviteSuccessToken}`}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-300 focus:outline-none"
                      />
                      <button
                        onClick={() => handleCopyLink(inviteSuccessToken, 'new-invite')}
                        className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5 active:scale-95 transition-all"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy Link
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleCreateInvite} className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
                    <input
                      type="email"
                      placeholder="new.user@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  <div className="w-full md:w-64">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Initial Role</label>
                    <select
                      value={inviteRoleId}
                      onChange={(e) => setInviteRoleId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                    >
                      <option value="">Select Role...</option>
                      {roles?.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={createInvitationMutation.isPending}
                    className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 h-[42px]"
                  >
                    {createInvitationMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> Create
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Table Card */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 md:p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-100">Pending Invitations</h3>
                  <p className="text-slate-400 text-xs mt-1">Track and manage outgoing invites.</p>
                </div>

                {isLoadingInvitations ? (
                  <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-900">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-900">
                        <tr>
                          <th className="px-6 py-4">Invited Email</th>
                          <th className="px-6 py-4">Assigned Role</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Expires At</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900 bg-slate-900/10">
                        {invitations?.map((inv: any) => (
                          <tr key={inv.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-200">{inv.email}</td>
                            <td className="px-6 py-4 text-slate-400">{inv.role.name}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                inv.status === 'PENDING'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : inv.status === 'ACCEPTED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700/30'
                              }`}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500">
                              {new Date(inv.expiresAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {inv.status === 'PENDING' && (
                                <button
                                  onClick={() => revokeInvitationMutation.mutate(inv.id)}
                                  className="p-1.5 text-red-400 border border-red-900/30 hover:bg-red-500/10 rounded-lg transition-all"
                                  title="Revoke invitation"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {(!invitations || invitations.length === 0) && (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">No invitations found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 md:p-8 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-100">Audit Logs</h3>
                <p className="text-slate-400 text-xs mt-1">Immutable registry of administrative tenant operations.</p>
              </div>

              {isLoadingAuditLogs ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-900">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-900">
                      <tr>
                        <th className="px-6 py-4">Timestamp</th>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Action</th>
                        <th className="px-6 py-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 bg-slate-900/10 text-xs">
                      {auditLogs?.map((log: any) => (
                        <tr key={log.id} className="hover:bg-slate-900/30 transition-colors">
                          <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-200">
                            {log.user.firstName || log.user.lastName
                              ? `${log.user.firstName || ''} ${log.user.lastName || ''}`
                              : log.user.email}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/15 text-indigo-300 rounded font-mono text-[10px]">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 max-w-xs md:max-w-sm truncate text-slate-400" title={`Old: ${log.oldValue || 'None'} \nNew: ${log.newValue || 'None'}`}>
                            {log.newValue ? `Updated ${log.entityType}: ${log.newValue}` : `Action on ${log.entityType}`}
                          </td>
                        </tr>
                      ))}
                      {(!auditLogs || auditLogs.length === 0) && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">No audit logs recorded</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'profiles' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* Info banner about caching */}
              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                    <Info className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Profiles & Permissions Manager</h3>
                    <p className="text-slate-400 text-xs mt-1">
                      Manage object and action-level security profiles. Assign profiles to users to govern what actions they can perform.
                    </p>
                    <p className="text-slate-500 text-[11px] mt-2 font-medium">
                      💡 <strong>Note on Refresh Cycle</strong>: When changes are made, active sessions will force-refresh their tokens automatically on their next action. Administrators can also clone from standard profiles to create custom overrides.
                    </p>
                  </div>
                </div>
              </div>

              {profileErrorMessage && (
                <div className="bg-red-950/40 border border-red-800 text-red-300 text-sm p-4 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <span>{profileErrorMessage}</span>
                  </div>
                  <button 
                    onClick={() => setProfileErrorMessage(null)} 
                    className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded hover:bg-red-500/10 transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Profiles Header Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-100">Profiles</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Custom and standard templates currently configured.</p>
                </div>
                <button
                  onClick={() => setIsCreateProfileOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Profile
                </button>
              </div>

              {/* Profiles Accordion List */}
              {isLoadingProfiles || isLoadingPermissions ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
              ) : (
                <div className="space-y-6">
                  {profiles?.map((profile: any) => {
                    const isGlobalTemplate = profile.organizationId === null;
                    const isSystemAdmin = profile.isSystem && profile.name === 'Admin Profile';

                    // Group permissions count
                    const getActiveCount = (groupName: string, perms: string[]) => {
                      return perms.filter((pName) => {
                        return profile.profilePermissions.some((pp: any) => pp.permission.name === pName);
                      }).length;
                    };

                    const getPermObjByName = (pName: string) => {
                      return systemPermissions?.find((p: any) => p.name === pName);
                    };

                    const isPermActive = (pName: string) => {
                      return profile.profilePermissions.some((pp: any) => pp.permission.name === pName);
                    };

                    const handlePermissionToggle = async (pName: string) => {
                      setProfileErrorMessage(null);
                      const permObj = getPermObjByName(pName);
                      if (!permObj) return;

                      const currentlyActive = isPermActive(pName);

                      togglePermissionMutation.mutate({
                        profileId: profile.id,
                        permissionId: permObj.id,
                        active: !currentlyActive,
                      });
                    };

                    // final list of groups mapping dynamically
                    const allGroupedPerms = Object.values(PERMISSION_GROUPS).flat();
                    const ungroupedPerms = systemPermissions?.filter((p: any) => !allGroupedPerms.includes(p.name)).map((p: any) => p.name) || [];
                    const finalGroups = {
                      ...PERMISSION_GROUPS,
                      ...(ungroupedPerms.length > 0 ? { 'Other Permissions': ungroupedPerms } : {}),
                    };

                    return (
                      <div 
                        key={profile.id} 
                        className={`bg-slate-900/20 border rounded-2xl shadow-xl transition-all duration-300 ${
                          isSystemAdmin
                            ? 'border-indigo-900/30'
                            : isGlobalTemplate
                            ? 'border-slate-800'
                            : 'border-emerald-900/30 hover:border-emerald-800/40'
                        }`}
                      >
                        {/* Profile Header */}
                        <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-bold text-slate-100">{profile.name}</h4>
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                                isSystemAdmin
                                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                  : isGlobalTemplate
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                {isSystemAdmin ? 'System Admin' : isGlobalTemplate ? 'Global Template' : 'Custom Profile'}
                              </span>
                            </div>
                            <p className="text-slate-400 text-xs mt-1.5">{profile.description || 'No description provided.'}</p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setCloneSourceProfile(profile);
                                setCloneNewName(`${profile.name} Clone`);
                                setCloneNewDesc(`Cloned from ${profile.name}`);
                              }}
                              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl active:scale-95 transition-all flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              Clone
                            </button>
                            {!profile.isSystem && !isGlobalTemplate && (
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to archive "${profile.name}"? Active users will automatically fall back to standard Member Profile.`)) {
                                    archiveProfileMutation.mutate(profile.id);
                                  }
                                }}
                                className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 text-xs font-semibold rounded-xl active:scale-95 transition-all flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                Archive
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Groups Container */}
                        <div className="p-4 space-y-3 bg-slate-950/20 rounded-b-2xl">
                          {Object.entries(finalGroups).map(([groupName, perms]) => {
                            const activeCount = getActiveCount(groupName, perms);
                            const totalCount = perms.length;
                            const sectionKey = `${profile.id}_${groupName}`;
                            const isExpanded = !!expandedSections[sectionKey];

                            return (
                              <div key={groupName} className="border border-slate-900 bg-slate-900/10 rounded-xl overflow-hidden">
                                {/* Accordion Header */}
                                <button
                                  onClick={() => setExpandedSections(prev => ({ ...prev, [sectionKey]: !isExpanded }))}
                                  className="w-full flex justify-between items-center px-4 py-3 bg-slate-900/40 hover:bg-slate-900/60 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-200">{groupName}</span>
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                      activeCount === totalCount
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : activeCount > 0
                                        ? 'bg-indigo-500/10 text-indigo-400'
                                        : 'bg-slate-800 text-slate-500'
                                    }`}>
                                      {activeCount} of {totalCount} active
                                    </span>
                                  </div>
                                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                                </button>

                                {/* Accordion Content (Permissions List) */}
                                {isExpanded && (
                                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-950/40 border-t border-slate-900">
                                    {perms.map((pName: string) => {
                                      const pObj = getPermObjByName(pName);
                                      if (!pObj) return null;

                                      const active = isPermActive(pName);
                                      const isLocked = isSystemAdmin || isGlobalTemplate;

                                      return (
                                        <label
                                          key={pObj.id}
                                          className={`flex items-start gap-3 p-3 border rounded-xl select-none transition-all ${
                                            active
                                              ? 'bg-emerald-500/5 border-emerald-900/30 text-slate-200'
                                              : 'bg-slate-900/10 border-slate-900 text-slate-400 hover:border-slate-800'
                                          } ${isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                                        >
                                          <input
                                            type="checkbox"
                                            disabled={isLocked || togglePermissionMutation.isPending}
                                            checked={active}
                                            onChange={() => handlePermissionToggle(pName)}
                                            className="mt-1 h-3.5 w-3.5 rounded border-slate-800 bg-slate-900 text-emerald-600 focus:ring-emerald-500/30"
                                          />
                                          <div>
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-xs font-bold font-mono tracking-wide">{pObj.name}</span>
                                              {isLocked && <Lock className="w-2.5 h-2.5 text-slate-500" />}
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1 leading-normal">{pObj.description}</p>
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Create Profile Modal */}
              {isCreateProfileOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative">
                    <button
                      onClick={() => {
                        setIsCreateProfileOpen(false);
                        setProfileErrorMessage(null);
                      }}
                      className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
                    >
                      ✕
                    </button>
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-indigo-400" />
                      Create Custom Profile
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">Add a new profile name and description.</p>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newProfileName) return;
                        createProfileMutation.mutate({ name: newProfileName, description: newProfileDesc });
                        setIsCreateProfileOpen(false);
                        setNewProfileName('');
                        setNewProfileDesc('');
                      }}
                      className="space-y-4 mt-6"
                    >
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Profile Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Guest Developer"
                          value={newProfileName}
                          onChange={(e) => setNewProfileName(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Description</label>
                        <textarea
                          placeholder="Provide a description of this profile's scope..."
                          value={newProfileDesc}
                          onChange={(e) => setNewProfileDesc(e.target.value)}
                          rows={3}
                          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreateProfileOpen(false);
                            setProfileErrorMessage(null);
                          }}
                          className="px-4 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 text-xs font-semibold rounded-xl transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={createProfileMutation.isPending}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
                        >
                          {createProfileMutation.isPending ? 'Creating...' : 'Create'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Clone Profile Modal */}
              {cloneSourceProfile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative">
                    <button
                      onClick={() => setCloneSourceProfile(null)}
                      className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
                    >
                      ✕
                    </button>
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Copy className="w-5 h-5 text-emerald-400" />
                      Clone Profile: {cloneSourceProfile.name}
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">Copy all settings and permissions into a new custom profile.</p>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!cloneNewName) return;
                        cloneProfileMutation.mutate({
                          profileId: cloneSourceProfile.id,
                          data: { name: cloneNewName, description: cloneNewDesc },
                        });
                        setCloneSourceProfile(null);
                        setCloneNewName('');
                        setCloneNewDesc('');
                      }}
                      className="space-y-4 mt-6"
                    >
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">New Profile Name</label>
                        <input
                          type="text"
                          required
                          value={cloneNewName}
                          onChange={(e) => setCloneNewName(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Description</label>
                        <textarea
                          value={cloneNewDesc}
                          onChange={(e) => setCloneNewDesc(e.target.value)}
                          rows={3}
                          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setCloneSourceProfile(null)}
                          className="px-4 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 text-xs font-semibold rounded-xl transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={cloneProfileMutation.isPending}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all"
                        >
                          {cloneProfileMutation.isPending ? 'Cloning...' : 'Clone'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
