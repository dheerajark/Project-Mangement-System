'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
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
} from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'invitations' | 'audit'>('general');
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

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

          <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-full">
            Admin Settings
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
        </section>
      </main>
    </div>
  );
}
