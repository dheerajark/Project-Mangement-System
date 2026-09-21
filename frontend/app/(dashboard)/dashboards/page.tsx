'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Layout,
  Plus,
  Search,
  FolderKanban,
  User,
  Users,
  Lock,
  Globe,
  MoreVertical,
  Trash2,
  Copy,
  Pencil,
  Clock,
  ArrowRight,
  Layers,
  Sparkles,
  Loader2,
  FileText,
} from 'lucide-react';
import Header from '@/components/header';
import CreateDashboardModal from '@/components/dashboards/create-dashboard-modal';
import { useFormatDate } from '@/hooks/useFormatDate';

export default function DashboardsListPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();

  const [activeScope, setActiveScope] = useState<'all' | 'my' | 'project' | 'shared'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Edit / Delete Modal States
  const [deletingDashboardId, setDeletingDashboardId] = useState<string | null>(null);
  const [activeMenuDashboardId, setActiveMenuDashboardId] = useState<string | null>(null);

  // Fetch Dashboards List
  const { data: dashboards = [], isLoading: isLoadingDashboards } = useQuery({
    queryKey: ['dashboards', activeScope, projectFilter, searchQuery],
    queryFn: async () => {
      const params: Record<string, string> = {
        scope: activeScope,
      };
      if (projectFilter !== 'ALL') {
        params.projectId = projectFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const res = await api.get('/dashboards', { params });
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // Fetch Projects for Filter
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/dashboards', data);
      return res.data;
    },
    onSuccess: (newDashboard) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      router.push(`/dashboards/${newDashboard.id}`);
    },
  });

  // Duplicate Mutation
  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/dashboards/${id}/duplicate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      setActiveMenuDashboardId(null);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/dashboards/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      setDeletingDashboardId(null);
      setActiveMenuDashboardId(null);
    },
  });

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Top Header */}
      <Header
        title="Custom Dashboards"
        subtitle="Dashboards Portal"
        activeNav="dashboards"
      >
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-xs active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Dashboard
        </button>
      </Header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/20 p-4 border border-slate-900 rounded-2xl backdrop-blur-md">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-850 overflow-x-auto">
            {[
              { id: 'all', label: 'All Dashboards' },
              { id: 'my', label: 'My Dashboards' },
              { id: 'project', label: 'Project Dashboards' },
              { id: 'shared', label: 'Shared With Me' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveScope(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeScope === tab.id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Project Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dashboards..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-indigo-500 w-48 sm:w-56"
              />
            </div>

            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dashboards Grid */}
        {isLoadingDashboards ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 h-56 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-4 bg-slate-800 rounded w-2/3"></div>
                  <div className="h-3 bg-slate-850 rounded w-full"></div>
                </div>
                <div className="h-8 bg-slate-850/50 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : dashboards.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 bg-slate-900/20 border border-slate-900 rounded-2xl space-y-4">
            <div className="h-16 w-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
              <Layout className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-slate-200">No Custom Dashboards Found</h3>
              <p className="text-xs text-slate-400">
                {searchQuery || projectFilter !== 'ALL'
                  ? 'No dashboards match your filter criteria. Try resetting filters.'
                  : 'Create your first custom dashboard to monitor project health and KPIs.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4.5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              Create Custom Dashboard
            </button>
          </div>
        ) : (
          /* Dashboards Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboards.map((dash: any) => {
              const isMenuOpen = activeMenuDashboardId === dash.id;
              return (
                <div
                  key={dash.id}
                  className="bg-slate-900/30 border border-slate-900 hover:border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-xs transition-all group relative"
                >
                  {/* Card Header & Badges */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Project Tag */}
                        {dash.project ? (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                            <FolderKanban className="w-3 h-3" />
                            {dash.project.projectCode}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700/50 flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            Portal Wide
                          </span>
                        )}

                        {/* Visibility Badge */}
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-semibold bg-slate-900 text-slate-400 border border-slate-850 flex items-center gap-1">
                          {dash.visibility === 'PRIVATE' ? (
                            <>
                              <Lock className="w-2.5 h-2.5 text-amber-400" />
                              Private
                            </>
                          ) : dash.visibility === 'PROJECT_USERS' ? (
                            <>
                              <Users className="w-2.5 h-2.5 text-blue-400" />
                              Project
                            </>
                          ) : (
                            <>
                              <Globe className="w-2.5 h-2.5 text-emerald-400" />
                              Public
                            </>
                          )}
                        </span>
                      </div>

                      {/* Actions Context Menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuDashboardId(isMenuOpen ? null : dash.id)
                          }
                          className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg cursor-pointer transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-7 w-40 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-30 space-y-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                            <Link
                              href={`/dashboards/${dash.id}`}
                              className="flex items-center gap-2 px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                            >
                              <Layout className="w-3.5 h-3.5 text-indigo-400" />
                              Open View
                            </Link>
                            <button
                              type="button"
                              onClick={() => duplicateMutation.mutate(dash.id)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-left cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 text-blue-400" />
                              Duplicate
                            </button>
                            {dash.permissions.canDelete && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingDashboardId(dash.id);
                                  setActiveMenuDashboardId(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-rose-400 hover:bg-rose-950/40 rounded-lg text-left cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <Link href={`/dashboards/${dash.id}`} className="block group/link">
                      <h3 className="text-base font-bold text-slate-100 group-hover/link:text-indigo-400 transition-colors truncate">
                        {dash.name}
                      </h3>
                      {dash.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {dash.description}
                        </p>
                      )}
                    </Link>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-5 mt-4 border-t border-slate-900 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        {dash.widgetCount} widgets
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        {dash.creator?.name?.split(' ')[0] || 'User'}
                      </span>
                    </div>

                    <Link
                      href={`/dashboards/${dash.id}`}
                      className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/30 rounded-xl text-[11px] font-bold text-slate-200 group-hover:text-indigo-300 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      Open
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Dashboard Modal */}
      <CreateDashboardModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
      />

      {/* Delete Confirmation Modal */}
      {deletingDashboardId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 bg-rose-500/10 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Delete Dashboard?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete this custom dashboard? This will only remove the
              dashboard widgets configuration. Underlying projects, tasks, and timesheets will
              NOT be affected.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingDashboardId(null)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deletingDashboardId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold active:scale-95 cursor-pointer"
              >
                Delete Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
