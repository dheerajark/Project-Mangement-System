'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  X,
  UserCheck,
  Shield,
  DollarSign,
  AlertCircle,
  Loader2,
  Save,
} from 'lucide-react';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  member: any | null;
}

export default function EditMemberModal({
  isOpen,
  onClose,
  projectId,
  member,
}: EditMemberModalProps) {
  const queryClient = useQueryClient();

  const [role, setRole] = useState<'OWNER' | 'MANAGER' | 'MEMBER' | 'CLIENT'>('MEMBER');
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setRole(member.role || 'MEMBER');
      setHourlyRate(member.hourlyRate !== null && member.hourlyRate !== undefined ? member.hourlyRate.toString() : '');
      setErrorMessage(null);
    }
  }, [member]);

  const updateMemberMutation = useMutation({
    mutationFn: async (payload: { role: string; hourlyRate?: number | null }) => {
      const res = await api.patch(`/projects/${projectId}/members/${member.userId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'Failed to update member role & rate.');
    },
  });

  if (!isOpen || !member) return null;

  const memberName = member.user?.firstName
    ? `${member.user.firstName} ${member.user.lastName || ''}`
    : member.user?.email || 'Project Member';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedRate = hourlyRate.trim() === '' ? null : parseFloat(hourlyRate);

    updateMemberMutation.mutate({
      role,
      hourlyRate: parsedRate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end transition-all">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Edit Member Details</h2>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">
                {memberName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
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
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Member Info Card */}
            <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Member Account</div>
              <div className="font-semibold text-sm text-slate-100">{memberName}</div>
              <div className="text-xs text-slate-400">{member.user?.email}</div>
            </div>

            {/* Role Selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                Project Profile / Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
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
                placeholder="e.g., 75.00"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
              />
              <p className="text-[11px] text-slate-500">
                Used for project financial reporting and staff-based billing calculations.
              </p>
            </div>
          </div>

          {/* Pinned Bottom Footer (Fixed at Bottom) */}
          <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMemberMutation.isPending}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2"
            >
              {updateMemberMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
