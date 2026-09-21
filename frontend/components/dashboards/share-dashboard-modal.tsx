'use client';

import React, { useState } from 'react';
import { X, Users, UserPlus, Trash2, Shield, Lock, Globe, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

interface ShareDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboard: {
    id: string;
    name: string;
    visibility: 'PRIVATE' | 'PROJECT_USERS' | 'PORTAL_USERS' | 'CUSTOM';
    shares: Array<{
      id: string;
      userId: string;
      userName: string;
      userEmail: string;
      accessLevel: string;
    }>;
  };
  onUpdateVisibility: (visibility: string) => Promise<void>;
  onAddShare: (userId: string, accessLevel: string) => Promise<void>;
  onRemoveShare: (userId: string) => Promise<void>;
}

export default function ShareDashboardModal({
  isOpen,
  onClose,
  dashboard,
  onUpdateVisibility,
  onAddShare,
  onRemoveShare,
}: ShareDashboardModalProps) {
  const [visibility, setVisibility] = useState(dashboard.visibility);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState('VIEWER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Organization Users
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/organization/users');
      return res.data;
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const handleVisibilityChange = async (newVisibility: string) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setVisibility(newVisibility as any);
      await onUpdateVisibility(newVisibility);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to update visibility');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select a user to share with.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onAddShare(selectedUserId, selectedAccessLevel);
      setSelectedUserId('');
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to share dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await onRemoveShare(userId);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to remove share');
    } finally {
      setIsSubmitting(false);
    }
  };

  const existingSharedUserIds = new Set(dashboard.shares.map((s) => s.userId));
  const availableUsers = users.filter((u: any) => !existingSharedUserIds.has(u.id));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Share Dashboard</h3>
              <p className="text-xs text-slate-400">{dashboard.name}</p>
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

        {/* General Visibility Options */}
        <div className="space-y-2">
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            General Access Level
          </label>
          <div className="space-y-2">
            {[
              {
                id: 'PRIVATE',
                title: 'Private',
                desc: 'Only you and explicit collaborators can access this dashboard.',
                icon: Lock,
              },
              {
                id: 'PROJECT_USERS',
                title: 'Project Members',
                desc: 'All members assigned to the associated project can view.',
                icon: Users,
              },
              {
                id: 'PORTAL_USERS',
                title: 'Organization Wide',
                desc: 'Anyone in your organization can view this dashboard.',
                icon: Globe,
              },
            ].map((opt) => {
              const Icon = opt.icon;
              const isSelected = visibility === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleVisibilityChange(opt.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-600/15 border-indigo-500 text-slate-100 ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/60 border-slate-850 text-slate-300 hover:border-slate-750'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold">{opt.title}</div>
                      <div className="text-[10px] text-slate-400">{opt.desc}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Explicit User Shares Form */}
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Share with Specific Users
          </label>
          <form onSubmit={handleAddShare} className="flex gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="">Select team member...</option>
              {availableUsers.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.firstName || ''} {u.lastName || ''} ({u.email})
                </option>
              ))}
            </select>

            <select
              value={selectedAccessLevel}
              onChange={(e) => setSelectedAccessLevel(e.target.value)}
              className="w-32 px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
              <option value="FULL_ACCESS">Full Access</option>
            </select>

            <button
              type="submit"
              disabled={isSubmitting || !selectedUserId}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add
            </button>
          </form>

          {/* Current Shares List */}
          {dashboard.shares.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">
                Active Collaborators ({dashboard.shares.length})
              </div>
              <div className="divide-y divide-slate-800/80 bg-slate-950/60 border border-slate-850 rounded-xl overflow-hidden">
                {dashboard.shares.map((share) => (
                  <div
                    key={share.id}
                    className="p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-200 truncate">
                        {share.userName}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {share.userEmail}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {share.accessLevel}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemove(share.userId)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 active:scale-95 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
