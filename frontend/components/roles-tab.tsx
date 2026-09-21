'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  Shield,
  Plus,
  Trash2,
  Edit2,
  Users,
  GitMerge,
  ChevronRight,
  Info,
  Loader2,
  X,
  Lock,
  Sparkles,
} from 'lucide-react';

interface RolesTabProps {
  canManage: boolean;
}

export default function RolesTab({ canManage }: RolesTabProps) {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);

  // Form states
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [parentRoleId, setParentRoleId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Roles
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['organization-roles'],
    queryFn: async () => {
      const res = await api.get('/organization/roles');
      return res.data;
    },
    enabled: canManage,
  });

  const roleMutation = useMutation({
    mutationFn: async () => {
      if (editingRole) {
        return api.patch(`/organization/roles/${editingRole.id}`, {
          name: roleName,
          description: roleDesc || null,
          parentRoleId: parentRoleId || null,
        });
      } else {
        return api.post('/organization/roles', {
          name: roleName,
          description: roleDesc || null,
          parentRoleId: parentRoleId || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-roles'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'Failed to save role');
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      return api.delete(`/organization/roles/${roleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-roles'] });
    },
  });

  const openCreateModal = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDesc('');
    setParentRoleId('');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (role: any) => {
    setEditingRole(role);
    setRoleName(role.name || '');
    setRoleDesc(role.description || '');
    setParentRoleId(role.parentRoleId || '');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRole(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) return;
    roleMutation.mutate();
  };

  if (!canManage) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <Lock className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-200">Access Restricted</h3>
        <p className="text-xs text-slate-400 mt-1">You require Administrator privileges to manage organizational roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <GitMerge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Roles & Organizational Hierarchy</h3>
            <p className="text-xs text-slate-400">
              Define designations and reporting structures across your organization (Zoho Roles).
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Custom Role
        </button>
      </div>

      {/* Role Cards List / Hierarchy Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          Loading organizational roles...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role: any) => (
            <div
              key={role.id}
              className="p-5 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-2xl space-y-4 transition-all shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-300">
                      <Shield className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-100">{role.name}</h4>
                        {role.isSystem ? (
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold rounded-md">
                            System Role
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold rounded-md">
                            Custom Role
                          </span>
                        )}
                      </div>
                      {role.parentRole && (
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <span>Reports to:</span>
                          <strong className="text-indigo-400">{role.parentRole.name}</strong>
                        </p>
                      )}
                    </div>
                  </div>

                  {!role.isSystem && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(role)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                        title="Edit Role"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete role "${role.name}"?`)) {
                            deleteRoleMutation.mutate(role.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                        title="Delete Role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-400">
                  {role.description || 'No description provided for this role designation.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  Assigned Members: <strong className="text-slate-200">{role._count?.userRoles || 0}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-Over Drawer for Role Creation / Editing */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 h-full shadow-2xl border-l border-slate-800 flex flex-col justify-between animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/50 backdrop-blur shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100">
                    {editingRole ? 'Edit Role' : 'Create Custom Role'}
                  </h2>
                  <p className="text-xs text-slate-400">Define designation and hierarchy reporting</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-140px)]">
                {errorMessage && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                    {errorMessage}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Role Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="e.g. Lead Architect, QA Specialist..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Reports To (Parent Role)
                  </label>
                  <select
                    value={parentRoleId}
                    onChange={(e) => setParentRoleId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">None (Top Level Role)</option>
                    {roles
                      .filter((r: any) => !editingRole || r.id !== editingRole.id)
                      .map((r: any) => (
                        <option key={r.id} value={r.id}>
                          🛡️ {r.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Role Description
                  </label>
                  <textarea
                    rows={3}
                    value={roleDesc}
                    onChange={(e) => setRoleDesc(e.target.value)}
                    placeholder="Describe responsibilities and designation scope..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Pinned Bottom Footer */}
              <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roleMutation.isPending}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {roleMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
