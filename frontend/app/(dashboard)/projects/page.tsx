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
  DollarSign,
  Tag,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/header';
import CreateProjectModal from '@/components/create-project-modal';

export default function ProjectsPage() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PLANNING' | 'COMPLETED' | 'ARCHIVED' | 'TEMPLATES'>('ALL');
  
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
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.tags && p.tags.toLowerCase().includes(searchQuery.toLowerCase()));

    if (statusFilter === 'TEMPLATES') {
      return matchesSearch && p.isTemplate;
    }

    const matchesStatus = statusFilter === 'ALL' ? true : p.status === statusFilter;
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
      <Header
        title="Projects Center"
        subtitle="Projects Portal"
        backHref="/dashboard"
      >
        {hasPermission('CREATE_PROJECT') && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg text-sm active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Project
          </button>
        )}
      </Header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Filter bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/20 border border-slate-900 rounded-2xl p-4">
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'ACTIVE', 'TEMPLATES', 'PLANNING', 'COMPLETED', 'ARCHIVED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                  statusFilter === status
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {status === 'TEMPLATES' ? 'Project Templates' : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by name, code, tag..."
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
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-950 border border-slate-850 rounded text-[10px] font-mono text-indigo-400 tracking-wider">
                          {project.projectCode}
                        </span>
                        {project.isTemplate && (
                          <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[10px] font-semibold flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Template
                          </span>
                        )}
                      </div>
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

                  {/* Badges: Tags & Budget */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {project.tags && project.tags.split(',').map((t: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 bg-slate-950 border border-slate-850 text-slate-400 text-[10px] rounded-md flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5 text-indigo-400" />
                        {t.trim()}
                      </span>
                    ))}
                    {project.budgetType && project.budgetType !== 'NONE' && (
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-md font-semibold flex items-center gap-1">
                        <DollarSign className="w-2.5 h-2.5" />
                        {project.budgetAmount ? `${project.currency || 'USD'} ${project.budgetAmount.toLocaleString()}` : `${project.budgetHours || 0} hrs`}
                      </span>
                    )}
                  </div>
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
                className="mt-6 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 active:scale-95 transition-all shadow-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create Project
              </button>
            )}
          </div>
        )}
      </main>

      {/* Dedicated Zoho-style Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
