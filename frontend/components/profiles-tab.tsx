'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  Sliders,
  Plus,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Shield,
  Check,
  Loader2,
  X,
  Lock,
  Archive,
  Info,
} from 'lucide-react';

interface ProfilesTabProps {
  canManage: boolean;
}

const PERMISSION_GROUPS: Record<string, string[]> = {
  'Project Permissions': ['CREATE_PROJECT', 'VIEW_PROJECT', 'EDIT_PROJECT', 'ARCHIVE_PROJECT'],
  'Task Permissions': ['CREATE_TASK', 'VIEW_TASK', 'VIEW_ALL_TASKS', 'EDIT_TASK', 'ARCHIVE_TASK'],
  'Issue Permissions': ['CREATE_ISSUE', 'VIEW_ISSUE', 'VIEW_ALL_ISSUES', 'EDIT_ISSUE', 'ARCHIVE_ISSUE', 'COMMENT_ISSUE'],
  'Milestone Permissions': ['CREATE_MILESTONE', 'VIEW_MILESTONE', 'VIEW_ALL_MILESTONES', 'EDIT_MILESTONE', 'ARCHIVE_MILESTONE'],
  'Document & File Permissions': ['CREATE_DOCUMENT', 'VIEW_DOCUMENT', 'UPDATE_DOCUMENT', 'DELETE_DOCUMENT'],
  'Reports Permissions': ['VIEW_REPORT'],
  'Time Tracking Permissions': ['LOG_TIME_ENTRY', 'ARCHIVE_TIME_ENTRY', 'VIEW_TIME_ENTRY', 'SUBMIT_TIMESHEET', 'APPROVE_TIMESHEET'],
  'Administration Permissions': ['MANAGE_USERS', 'INVITE_MEMBERS'],
};

export default function ProfilesTab({ canManage }: ProfilesTabProps) {
  const queryClient = useQueryClient();

  // Create & Clone modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');

  const [cloneSourceProfile, setCloneSourceProfile] = useState<any | null>(null);
  const [cloneNewName, setCloneNewName] = useState('');
  const [cloneNewDesc, setCloneNewDesc] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Accordion open/close state keyed by profileId_groupName
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // 1. Fetch All Permissions
  const { data: allPermissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const res = await api.get('/organization/permissions');
      return res.data;
    },
    enabled: canManage,
  });

  // 2. Fetch Profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const res = await api.get('/organization/profiles');
      return res.data;
    },
    enabled: canManage,
  });

  // Permission add mutation
  const addPermissionMutation = useMutation({
    mutationFn: async ({ profileId, permissionId }: { profileId: string; permissionId: string }) => {
      return api.post(`/organization/profiles/${profileId}/permissions/${permissionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });

  // Permission remove mutation
  const removePermissionMutation = useMutation({
    mutationFn: async ({ profileId, permissionId }: { profileId: string; permissionId: string }) => {
      return api.delete(`/organization/profiles/${profileId}/permissions/${permissionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });

  // Create Profile Mutation
  const createProfileMutation = useMutation({
    mutationFn: async () => {
      return api.post('/organization/profiles', {
        name: newProfileName,
        description: newProfileDesc || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setIsCreateOpen(false);
      setNewProfileName('');
      setNewProfileDesc('');
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'Failed to create profile');
    },
  });

  // Clone Profile Mutation
  const cloneProfileMutation = useMutation({
    mutationFn: async () => {
      if (!cloneSourceProfile) return;
      return api.post(`/organization/profiles/${cloneSourceProfile.id}/clone`, {
        newName: cloneNewName,
        description: cloneNewDesc || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setCloneSourceProfile(null);
      setCloneNewName('');
      setCloneNewDesc('');
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'Failed to clone profile');
    },
  });

  // Archive Profile Mutation
  const archiveProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      return api.post(`/organization/profiles/${profileId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });

  const toggleGroupExpand = (profileId: string, groupName: string) => {
    const key = `${profileId}_${groupName}`;
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!canManage) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <Lock className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-200">Access Restricted</h3>
        <p className="text-xs text-slate-400 mt-1">You require Administrator privileges to manage organization profiles & permissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">User Profiles & Privilege Matrix</h3>
            <p className="text-xs text-slate-400">
              Configure granular module-level action permissions across your organization (Zoho Profiles).
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setErrorMessage(null);
            setIsCreateOpen(true);
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Custom Profile
        </button>
      </div>

      {/* Profiles Cards List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          Loading profiles and permissions matrix...
        </div>
      ) : (
        <div className="space-y-6">
          {profiles.map((profile: any) => {
            const assignedPermissionIds = new Set(
              profile.profilePermissions?.map((pp: any) => pp.permissionId || pp.permission?.id),
            );

            return (
              <div
                key={profile.id}
                className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6 shadow-sm"
              >
                {/* Profile Title Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-300">
                      <Shield className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-100">{profile.name}</h4>
                        {profile.isSystem ? (
                          <span className="px-2.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold rounded-md">
                            System Default
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold rounded-md">
                            Custom Profile
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {profile.description || 'No description available'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setCloneSourceProfile(profile);
                        setCloneNewName(`${profile.name} Copy`);
                        setCloneNewDesc(`Cloned from ${profile.name}`);
                        setErrorMessage(null);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Clone Profile
                    </button>

                    {!profile.isSystem && (
                      <button
                        onClick={() => {
                          if (confirm(`Archive profile "${profile.name}"? Users assigned to this profile will be reassigned to default Member Profile.`)) {
                            archiveProfileMutation.mutate(profile.id);
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        Archive
                      </button>
                    )}
                  </div>
                </div>

                {/* Permissions Matrix Accordion */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Permissions Privilege Matrix
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(PERMISSION_GROUPS).map(([groupName, permNames]) => {
                      const isExpanded = expandedSections[`${profile.id}_${groupName}`] ?? true;

                      const groupPermissions = allPermissions.filter((p: any) =>
                        permNames.includes(p.name),
                      );

                      const activeInGroup = groupPermissions.filter((p: any) =>
                        assignedPermissionIds.has(p.id),
                      ).length;

                      return (
                        <div
                          key={groupName}
                          className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleGroupExpand(profile.id, groupName)}
                            className="w-full px-4 py-3 bg-slate-950 flex items-center justify-between text-xs font-bold text-slate-200 hover:bg-slate-900 transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              {groupName}
                              <span className="px-2 py-0.5 bg-slate-850 text-slate-400 rounded text-[10px] font-mono">
                                {activeInGroup}/{groupPermissions.length} Active
                              </span>
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="p-3 pt-1 border-t border-slate-900 space-y-2">
                              {groupPermissions.map((perm: any) => {
                                const isChecked = assignedPermissionIds.has(perm.id);
                                const isSuperAdminProfile =
                                  profile.isSystem && profile.name === 'Admin Profile';

                                return (
                                  <label
                                    key={perm.id}
                                    className={`flex items-start justify-between p-2 rounded-lg text-xs transition-colors ${
                                      isSuperAdminProfile ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:bg-slate-900'
                                    }`}
                                  >
                                    <div className="pr-3">
                                      <span className="font-semibold text-slate-200 block">
                                        {perm.name}
                                      </span>
                                      <span className="text-[11px] text-slate-400 block mt-0.5">
                                        {perm.description || perm.name}
                                      </span>
                                    </div>

                                    <input
                                      type="checkbox"
                                      disabled={isSuperAdminProfile}
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isSuperAdminProfile) return;
                                        if (isChecked) {
                                          removePermissionMutation.mutate({
                                            profileId: profile.id,
                                            permissionId: perm.id,
                                          });
                                        } else {
                                          addPermissionMutation.mutate({
                                            profileId: profile.id,
                                            permissionId: perm.id,
                                          });
                                        }
                                      }}
                                      className="accent-indigo-500 w-4 h-4 mt-0.5 cursor-pointer rounded"
                                    />
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
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-Over Drawer: Create Profile */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 h-full shadow-2xl border-l border-slate-800 flex flex-col justify-between animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/50 backdrop-blur shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100">Create Custom Profile</h2>
                  <p className="text-xs text-slate-400">Define a custom access profile template</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newProfileName.trim()) return;
                createProfileMutation.mutate();
              }}
              className="flex-1 flex flex-col justify-between overflow-hidden"
            >
              <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-140px)]">
                {errorMessage && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                    {errorMessage}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Profile Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="e.g. QA Specialist Profile"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={newProfileDesc}
                    onChange={(e) => setNewProfileDesc(e.target.value)}
                    placeholder="Describe privilege scope and target users..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProfileMutation.isPending}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {createProfileMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-Over Drawer: Clone Profile */}
      {cloneSourceProfile && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 h-full shadow-2xl border-l border-slate-800 flex flex-col justify-between animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/50 backdrop-blur shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100">Clone Profile</h2>
                  <p className="text-xs text-slate-400">Copy permissions from {cloneSourceProfile.name}</p>
                </div>
              </div>
              <button
                onClick={() => setCloneSourceProfile(null)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!cloneNewName.trim()) return;
                cloneProfileMutation.mutate();
              }}
              className="flex-1 flex flex-col justify-between overflow-hidden"
            >
              <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-140px)]">
                {errorMessage && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                    {errorMessage}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    New Profile Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={cloneNewName}
                    onChange={(e) => setCloneNewName(e.target.value)}
                    placeholder="e.g. Lead Auditor Profile"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={cloneNewDesc}
                    onChange={(e) => setCloneNewDesc(e.target.value)}
                    placeholder="Notes about cloned profile..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setCloneSourceProfile(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cloneProfileMutation.isPending}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {cloneProfileMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Clone Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
