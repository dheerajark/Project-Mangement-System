'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderKanban,
  Plus,
  Search,
  Lock,
  Globe,
  Calendar,
  User,
  Archive,
  ArrowLeft,
  Loader2,
  X,
  ShieldAlert,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

export default function ProjectsPage() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PLANNING' | 'COMPLETED' | 'ARCHIVED'>('ALL');
  
  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'ORGANIZATION'>('PRIVATE');
  const [createError, setCreateError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch Projects Query
  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // Create Project Mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      visibility: 'PRIVATE' | 'ORGANIZATION';
    }) => {
      const res = await api.post('/projects', data);
      return res.data;
    },
    onSuccess: (newProj) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsCreateModalOpen(false);
      // Reset form
      setProjectName('');
      setProjectDescription('');
      setStartDate('');
      setEndDate('');
      setVisibility('PRIVATE');
      setCreateError(null);
      // Redirect to new project details
      router.push(`/projects/${newProj.id}`);
    },
    onError: (err: any) => {
      setCreateError(err.response?.data?.message || 'Failed to create project');
    },
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!projectName.trim()) {
      setCreateError('Project name is required');
      return;
    }
    createProjectMutation.mutate({
      name: projectName,
      description: projectDescription || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      visibility,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Filter projects based on search query and status filter
  const filteredProjects = projects?.filter((p: any) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ? true : p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'PLANNING':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'COMPLETED':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'ARCHIVED':
        return 'bg-slate-800 text-slate-400 border border-slate-700/50';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  };

  const getVisibilityIcon = (vis: string) => {
    return vis === 'ORGANIZATION' ? (
      <Globe className="w-3.5 h-3.5" />
    ) : (
      <Lock className="w-3.5 h-3.5 text-indigo-400" />
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Top Navbar */}
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
              Projects Center
            </span>
          </div>

          <div className="flex items-center gap-4">
            {hasPermission('CREATE_PROJECT') && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-sm active:scale-[0.98] transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Project
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Filter bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/20 border border-slate-900 rounded-2xl p-4">
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'ACTIVE', 'PLANNING', 'COMPLETED', 'ARCHIVED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                  statusFilter === status
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by name, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
            />
          </div>
        </div>

        {/* Projects Loading State */}
        {isLoadingProjects ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <span className="text-slate-400 text-sm font-medium">Fetching projects...</span>
          </div>
        ) : filteredProjects && filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project: any) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-slate-900/30 border border-slate-900 hover:border-indigo-500/30 hover:bg-slate-900/40 rounded-2xl p-6 flex flex-col justify-between group transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/[0.01]"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 bg-slate-950 border border-slate-850 rounded text-[10px] font-mono text-indigo-400 tracking-wider">
                        {project.projectCode}
                      </span>
                      <h4 className="text-slate-100 font-bold text-base group-hover:text-indigo-400 transition-colors mt-2">
                        {project.name}
                      </h4>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getStatusStyle(project.status)}`}>
                      {project.status}
                    </span>
                  </div>

                  {/* Card Description */}
                  <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="mt-6 border-t border-slate-900 pt-4 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5" title="Project Owner">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {project.owner.firstName
                        ? `${project.owner.firstName} ${project.owner.lastName || ''}`
                        : project.owner.email}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5" title="Visibility">
                      {getVisibilityIcon(project.visibility)}
                      <span className="capitalize">{project.visibility.toLowerCase()}</span>
                    </div>

                    <div className="flex items-center gap-1.5" title="Members Count">
                      <span>{project.members?.length || 0} members</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-slate-800 rounded-2xl p-16 text-center space-y-4 max-w-xl mx-auto mt-12 bg-slate-900/10">
            <FolderKanban className="w-12 h-12 text-slate-600 mx-auto" />
            <div>
              <h4 className="text-slate-200 font-bold text-lg">No Projects Found</h4>
              <p className="text-slate-400 text-xs mt-1">
                {searchQuery
                  ? "We couldn't find any projects matching your search query."
                  : 'Start by creating your first organizational project module.'}
              </p>
            </div>
            {hasPermission('CREATE_PROJECT') && !searchQuery && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-6 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 active:scale-95 transition-all shadow-lg"
              >
                <Plus className="w-4 h-4" /> Create Project
              </button>
            )}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="absolute top-0 right-0 w-[40%] h-[30%] rounded-full bg-indigo-500/5 blur-[50px]" />
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-100 text-lg">Create New Project</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-850 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-xs p-4 rounded-xl flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project Apollo"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Write a brief summary of the project scope..."
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs [color-scheme:dark]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Visibility Setting</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVisibility('PRIVATE')}
                    className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      visibility === 'PRIVATE'
                        ? 'border-indigo-500 bg-indigo-500/5 text-slate-100'
                        : 'border-slate-850 bg-slate-950/40 text-slate-400 hover:border-slate-800 hover:text-slate-350'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Lock className="w-3.5 h-3.5" /> Private
                    </div>
                    <span className="text-[10px] opacity-75">Only assigned project members can access</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibility('ORGANIZATION')}
                    className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      visibility === 'ORGANIZATION'
                        ? 'border-indigo-500 bg-indigo-500/5 text-slate-100'
                        : 'border-slate-850 bg-slate-950/40 text-slate-400 hover:border-slate-800 hover:text-slate-350'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Globe className="w-3.5 h-3.5" /> Organization
                    </div>
                    <span className="text-[10px] opacity-75">Any organization member can view and join</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-900 active:scale-98 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  className="px-4.5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-sm active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {createProjectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
