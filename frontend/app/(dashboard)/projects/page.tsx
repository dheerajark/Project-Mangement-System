'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban,
  Plus,
  Search,
  Lock,
  Globe,
  User,
  Loader2,
  Tag,
  Layers,
  DollarSign,
  Briefcase,
  AlertTriangle,
  List,
  LayoutGrid,
  Calendar,
  ExternalLink,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/header';
import CreateProjectModal from '@/components/create-project-modal';

export default function ProjectsPage() {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();

  // View Mode: Default to 'LIST' (Zoho-style Data Table with sticky locked columns)
  const [viewMode, setViewMode] = useState<'LIST' | 'GRID'>('LIST');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PLANNING' | 'COMPLETED' | 'ARCHIVED' | 'TEMPLATES'>('ALL');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  // Fetch Project Groups Query
  const { data: projectGroups = [] } = useQuery({
    queryKey: ['project-groups'],
    queryFn: async () => {
      const res = await api.get('/project-groups');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Filter projects based on search query, status filter, and group filter
  const filteredProjects = projects?.filter((p: any) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.tags && p.tags.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesGroup = selectedGroupId === 'ALL' ? true : p.groupId === selectedGroupId;

    if (statusFilter === 'TEMPLATES') {
      return matchesSearch && matchesGroup && p.isTemplate;
    }

    const matchesStatus = statusFilter === 'ALL' ? true : p.status === statusFilter;
    return matchesSearch && matchesGroup && matchesStatus;
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Filter & View Mode Bar */}
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-slate-900/30 border border-slate-850 rounded-2xl p-4 shadow-sm">
          
          {/* Status Pills */}
          <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
            {(['ALL', 'ACTIVE', 'TEMPLATES', 'PLANNING', 'COMPLETED', 'ARCHIVED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                  statusFilter === status
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {status === 'TEMPLATES' ? 'Templates' : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}

            {/* Project Group Selector Dropdown */}
            {projectGroups.length > 0 && (
              <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-800">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="ALL">All Project Groups</option>
                  {projectGroups.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Search Input & View Switcher */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
            <div className="relative w-full lg:w-72">
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

            {/* Zoho-style View Mode Switcher (List Table vs Grid Cards) */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                title="Zoho List Table View (Locked Columns)"
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'LIST'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                title="Grid Cards View"
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'GRID'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Projects Loading State */}
        {isLoadingProjects ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <span className="text-slate-400 text-sm font-medium">Fetching projects...</span>
          </div>
        ) : filteredProjects && filteredProjects.length > 0 ? (
          
          /* VIEW 1: ZOHO LIST TABLE VIEW (Locked First Columns + Horizontal Scrollable Details) */
          viewMode === 'LIST' ? (
            <div className="border border-slate-850 rounded-2xl bg-slate-900/30 overflow-hidden shadow-xl">
              <div className="overflow-x-auto max-w-full scrollbar-thin">
                <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
                  
                  {/* Table Header (Sticky Top & Locked First Column Header) */}
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-850 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      
                      {/* LOCKED COLUMN #1 & #2: Code & Project Name (Sticky Left) */}
                      <th className="py-3.5 px-4 sticky left-0 bg-slate-950 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.4)] min-w-[280px]">
                        Project Code & Name
                      </th>
                      
                      <th className="py-3.5 px-4 min-w-[130px]">Group</th>
                      <th className="py-3.5 px-4 min-w-[100px]">Status</th>
                      <th className="py-3.5 px-4 min-w-[140px]">Project Owner</th>
                      <th className="py-3.5 px-4 min-w-[160px]">Task Progress</th>
                      <th className="py-3.5 px-4 min-w-[170px]">Timeline (Dates)</th>
                      <th className="py-3.5 px-4 min-w-[160px]">Financials / Budget</th>
                      <th className="py-3.5 px-4 min-w-[100px]">Schedule Mode</th>
                      <th className="py-3.5 px-4 min-w-[110px]">Visibility</th>
                      <th className="py-3.5 px-4 min-w-[140px]">Tags</th>
                      <th className="py-3.5 px-4 min-w-[80px] text-right">Action</th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-slate-850/60">
                    {filteredProjects.map((project: any) => {
                      const progressPct = project.progress || 0;
                      return (
                        <tr
                          key={project.id}
                          className="hover:bg-slate-100 dark:hover:bg-slate-850/40 transition-colors group cursor-pointer"
                          onClick={() => router.push(`/projects/${project.id}`)}
                        >
                          
                          {/* LOCKED COLUMN #1 & #2: Code & Project Name (Sticky Left 0px) */}
                          <td className="py-3.5 px-4 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-850 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_5px_rgba(0,0,0,0.4)] transition-colors">
                            <div className="flex items-center gap-2.5">
                              <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded font-mono text-[10px] text-indigo-400 font-bold shrink-0">
                                {project.projectCode}
                              </span>
                              
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-slate-100 text-xs truncate group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                                  {project.name}
                                  {project.isTemplate && (
                                    <span className="px-1.5 py-0.2 bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 rounded text-[9px] font-semibold">
                                      Template
                                    </span>
                                  )}
                                </span>
                                {project.description && (
                                  <span className="text-[10px] text-slate-400 truncate max-w-[220px]">
                                    {project.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Detail Column 1: Project Group */}
                          <td className="py-3.5 px-4">
                            {project.group ? (
                              <span
                                className="px-2 py-0.5 border text-[10px] font-semibold rounded inline-flex items-center gap-1 shrink-0"
                                style={{
                                  backgroundColor: `${project.group.color || '#6366f1'}15`,
                                  borderColor: `${project.group.color || '#6366f1'}40`,
                                  color: project.group.color || '#818cf8',
                                }}
                              >
                                <Briefcase className="w-2.5 h-2.5" />
                                {project.group.name}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Detail Column 2: Status */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getStatusStyle(project.status)}`}>
                              {project.status}
                            </span>
                          </td>

                          {/* Detail Column 3: Project Owner */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {project.owner?.firstName
                                  ? `${project.owner.firstName} ${project.owner.lastName || ''}`
                                  : project.owner?.email || 'System Admin'}
                              </span>
                            </div>
                          </td>

                          {/* Detail Column 4: Task Progress */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1 w-32">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-400 font-medium">Completed</span>
                                <span className="text-indigo-400 font-bold">{progressPct}%</span>
                              </div>
                              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Detail Column 5: Dates */}
                          <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{formatDate(project.startDate)} → {formatDate(project.endDate)}</span>
                            </div>
                          </td>

                          {/* Detail Column 6: Financials / Budget */}
                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            {project.budgetType && project.budgetType !== 'NONE' ? (
                              <div className="flex flex-col text-emerald-400">
                                <span className="font-semibold flex items-center gap-0.5">
                                  <DollarSign className="w-3 h-3" />
                                  {project.budgetAmount
                                    ? `${project.currency || 'USD'} ${project.budgetAmount.toLocaleString()}`
                                    : `${project.budgetHours || 0} hrs`}
                                </span>
                                {project.billingMethod && project.billingMethod !== 'NONE' && (
                                  <span className="text-[9px] text-slate-500 capitalize">
                                    {project.billingMethod.toLowerCase().replace(/_/g, ' ')}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          {/* Detail Column 7: Schedule Mode */}
                          <td className="py-3.5 px-4">
                            {project.isStrict ? (
                              <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] rounded font-semibold inline-flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> Strict
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Flexible</span>
                            )}
                          </td>

                          {/* Detail Column 8: Visibility */}
                          <td className="py-3.5 px-4 text-slate-400">
                            <div className="flex items-center gap-1 capitalize">
                              {getVisibilityIcon(project.visibility)}
                              <span>{project.visibility?.toLowerCase()}</span>
                            </div>
                          </td>

                          {/* Detail Column 9: Tags */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {project.tags ? (
                                project.tags.split(',').slice(0, 2).map((t: string, idx: number) => (
                                  <span key={idx} className="px-1.5 py-0.2 bg-slate-950 border border-slate-800 text-slate-400 text-[9px] rounded">
                                    #{t.trim()}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-600 text-[11px]">—</span>
                              )}
                            </div>
                          </td>

                          {/* Detail Column 10: Action Link */}
                          <td className="py-3.5 px-4 text-right">
                            <Link
                              href={`/projects/${project.id}`}
                              className="p-1.5 hover:bg-indigo-600/20 text-slate-400 hover:text-indigo-400 rounded-lg inline-flex items-center transition-colors"
                              title="Open Project"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (

          /* VIEW 2: GRID CARDS VIEW */
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-slate-950 border border-slate-850 rounded text-[10px] font-mono text-indigo-400 tracking-wider">
                          {project.projectCode}
                        </span>
                        {project.group && (
                          <span
                            className="px-2 py-0.5 border text-[10px] font-semibold rounded flex items-center gap-1"
                            style={{
                              backgroundColor: `${project.group.color || '#6366f1'}15`,
                              borderColor: `${project.group.color || '#6366f1'}40`,
                              color: project.group.color || '#818cf8',
                            }}
                          >
                            <Briefcase className="w-2.5 h-2.5" /> {project.group.name}
                          </span>
                        )}
                        {project.isStrict && (
                          <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[10px] font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Strict
                          </span>
                        )}
                        {project.isTemplate && (
                          <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded text-[10px] font-semibold flex items-center gap-1">
                            <Layers className="w-2.5 h-2.5" /> Template
                          </span>
                        )}
                      </div>
                      <h4 className="text-slate-100 font-bold text-base group-hover:text-indigo-400 transition-colors mt-2">
                        {project.name}
                      </h4>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${getStatusStyle(project.status)}`}>
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
                      {project.owner?.firstName
                        ? `${project.owner.firstName} ${project.owner.lastName || ''}`
                        : project.owner?.email || 'System Owner'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5" title="Visibility">
                      {getVisibilityIcon(project.visibility)}
                      <span className="capitalize">{project.visibility?.toLowerCase()}</span>
                    </div>

                    <div className="flex items-center gap-1.5" title="Members Count">
                      <span>{project.members?.length || 0} members</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          )

        ) : (
          <div className="border border-dashed border-slate-800 rounded-2xl p-16 text-center space-y-4 max-w-xl mx-auto mt-12 bg-slate-900/10">
            <FolderKanban className="w-12 h-12 text-slate-600 mx-auto" />
            <div>
              <h4 className="text-slate-200 font-bold text-lg">No Projects Found</h4>
              <p className="text-slate-400 text-xs mt-1">
                {searchQuery || selectedGroupId !== 'ALL'
                  ? "We couldn't find any projects matching your search query or selected group filter."
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

      {/* Dedicated Zoho-style Create Project Drawer */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
