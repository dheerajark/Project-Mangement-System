'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  X,
  UserPlus,
  Search,
  Shield,
  DollarSign,
  Mail,
  Check,
  AlertCircle,
  Loader2,
  Users,
} from 'lucide-react';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  availableUsers: any[];
}

export default function AddUserModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  availableUsers = [],
}: AddUserModalProps) {
  const queryClient = useQueryClient();

  // Mode: 'existing' | 'invite'
  const [activeTab, setActiveTab] = useState<'existing' | 'invite'>('existing');

  // Form states
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [role, setRole] = useState<'OWNER' | 'MANAGER' | 'MEMBER' | 'CLIENT'>('MEMBER');
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mutation to add users
  const addMemberMutation = useMutation({
    mutationFn: async (payload: { userId: string; role: string; hourlyRate?: number }) => {
      const res = await api.post(`/projects/${projectId}/members`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
    },
  });

  if (!isOpen) return null;

  const filteredUsers = availableUsers.filter((m: any) => {
    const name = m.user.firstName
      ? `${m.user.firstName} ${m.user.lastName || ''}`.toLowerCase()
      : '';
    const email = (m.user.email || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    return name.includes(query) || email.includes(query);
  });

  const toggleUserSelection = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((m: any) => m.user.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedRate = hourlyRate ? parseFloat(hourlyRate) : undefined;

    if (activeTab === 'existing') {
      if (selectedUserIds.length === 0) {
        setErrorMessage('Please select at least one user to add.');
        return;
      }

      try {
        for (const userId of selectedUserIds) {
          await addMemberMutation.mutateAsync({
            userId,
            role,
            hourlyRate: parsedRate,
          });
        }
        onClose();
        resetForm();
      } catch (err: any) {
        setErrorMessage(err.response?.data?.message || 'Failed to add project members.');
      }
    } else {
      if (!inviteEmail.trim()) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }

      // For invite tab, match user or inform invitation
      const matchedUser = availableUsers.find(
        (m: any) => m.user.email.toLowerCase() === inviteEmail.trim().toLowerCase()
      );

      if (matchedUser) {
        try {
          await addMemberMutation.mutateAsync({
            userId: matchedUser.user.id,
            role,
            hourlyRate: parsedRate,
          });
          onClose();
          resetForm();
        } catch (err: any) {
          setErrorMessage(err.response?.data?.message || 'Failed to add user to project.');
        }
      } else {
        setErrorMessage(`User with email "${inviteEmail}" is not currently in your organization. Ask your admin to invite them to the organization first.`);
      }
    }
  };

  const resetForm = () => {
    setSelectedUserIds([]);
    setSearchQuery('');
    setRole('MEMBER');
    setHourlyRate('');
    setInviteEmail('');
    setInviteNote('');
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end transition-all">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Add Users to Project</h2>
              <p className="text-xs text-slate-400">
                Assign team members or client users to {projectName || 'this project'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('existing')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'existing'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Select Portal Users ({availableUsers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invite')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'invite'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            Invite by Email
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-200 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body (Scrollable) */}
        <form id="add-user-form" onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Common Settings: Role & Hourly Rate */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl">
              {/* Role */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  Project Role <span className="text-rose-400">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="MEMBER">Member (Standard Access)</option>
                  <option value="MANAGER">Manager (Edit & Assign Privs)</option>
                  <option value="OWNER">Owner (Full Admin Access)</option>
                  <option value="CLIENT">Client User (Restricted External)</option>
                </select>
              </div>

              {/* Staff Hourly Rate */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Staff Hourly Rate ($/hr)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g., 65.00"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />
              </div>
            </div>

            {activeTab === 'existing' ? (
              /* Portal Users Selection */
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search available users by name or email..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                  />
                </div>

                {/* Selection Header */}
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>Available Users ({filteredUsers.length})</span>
                  {filteredUsers.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-indigo-400 hover:underline text-[11px] font-medium"
                    >
                      {selectedUserIds.length === filteredUsers.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                  )}
                </div>

                {/* Users List */}
                {filteredUsers.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 border border-dashed border-slate-850 rounded-xl">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No available users found matching your search.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {filteredUsers.map((m: any) => {
                      const isSelected = selectedUserIds.includes(m.user.id);
                      const name = m.user.firstName
                        ? `${m.user.firstName} ${m.user.lastName || ''}`
                        : m.user.email;
                      return (
                        <div
                          key={m.user.id}
                          onClick={() => toggleUserSelection(m.user.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-indigo-600/10 border-indigo-500/50 text-slate-100'
                              : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'border-slate-700 bg-slate-900'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <div>
                              <div className="font-semibold text-xs text-slate-100">{name}</div>
                              <div className="text-[10px] text-slate-500">{m.user.email}</div>
                            </div>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            {m.user.role || 'USER'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Invite New User via Email */
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="e.g., developer@company.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Invitation Note (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={inviteNote}
                    onChange={(e) => setInviteNote(e.target.value)}
                    placeholder="Add a personal message to the project invitation..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pinned Bottom Footer (Always Visible at Bottom) */}
          <div className="flex items-center justify-between gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
            <span className="text-xs text-slate-400">
              {activeTab === 'existing'
                ? `${selectedUserIds.length} user(s) selected`
                : 'Invitation will be sent'}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  resetForm();
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addMemberMutation.isPending}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2"
              >
                {addMemberMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Add Users to Project
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
