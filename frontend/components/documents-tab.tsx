'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  Folder,
  FolderPlus,
  UploadCloud,
  FileText,
  Search,
  Grid,
  List,
  Download,
  Trash2,
  Edit2,
  ChevronRight,
  ArrowLeft,
  Eye,
  HardDrive,
  Globe,
  FileArchive,
  Code,
  Image as ImageIcon,
  FileSpreadsheet,
  Layers,
  ChevronDown,
  Sparkles,
  CheckSquare,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import CreateFolderModal from './create-folder-modal';
import UploadDocumentModal from './upload-document-modal';
import DocumentPreviewModal from './document-preview-modal';

interface DocumentsTabProps {
  projectId: string;
}

export default function DocumentsTab({ projectId }: DocumentsTabProps) {
  const queryClient = useQueryClient();

  // Search, filter, view states
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('TABLE');
  const [mimeFilter, setMimeFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState<'all' | 'task' | 'issue'>('all');
  const [isTreeSidebarOpen, setIsTreeSidebarOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Breadcrumb path stack e.g. [{id: 'folder1', name: 'Design Specs'}]
  const [folderBreadcrumbs, setFolderBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);

  // Modals state
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  // Active folder ID (null = Root Directory)
  const currentFolderId = folderBreadcrumbs.length > 0 ? folderBreadcrumbs[folderBreadcrumbs.length - 1].id : null;

  // 1. Fetch Folders
  const { data: folders = [], isLoading: isLoadingFolders } = useQuery({
    queryKey: ['project-folders', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/folders`);
      return res.data;
    },
    enabled: !!projectId,
  });

  // 2. Fetch Documents strictly scoped to current location
  const { data: documents = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ['project-documents', projectId, currentFolderId, mimeFilter, search, entityFilter],
    queryFn: async () => {
      const params: any = {};

      if (entityFilter === 'task') {
        params.taskId = 'all';
      } else if (entityFilter === 'issue') {
        params.issueId = 'all';
      } else {
        params.folderId = currentFolderId ? currentFolderId : 'root';
      }

      if (search) params.search = search;
      if (mimeFilter !== 'all') params.mimeType = mimeFilter;

      const res = await api.get(`/projects/${projectId}/documents`, { params });
      return res.data;
    },
    enabled: !!projectId,
  });

  // Delete document mutation
  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      return api.delete(`/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-folders', projectId] });
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      return api.delete(`/folders/${folderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-folders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
    },
  });

  // Subfolders in current location
  const currentSubfolders = folders.filter((f: any) => {
    if (entityFilter !== 'all') return false;
    if (currentFolderId) {
      return f.parentId === currentFolderId;
    }
    return !f.parentId;
  });

  // Root level folders for sidebar tree
  const rootFolders = folders.filter((f: any) => !f.parentId);

  // Calculate storage stats
  const totalStorageBytes = documents.reduce((acc: number, d: any) => acc + (d.fileSize || 0), 0);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Get file extension string
  const getFileExt = (name: string) => {
    if (!name) return 'FILE';
    const parts = name.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'FILE';
  };

  // Get file type styling badge & icon (Zoho Projects Style)
  const getFileBadge = (mimeType?: string, name: string = '') => {
    const ext = getFileExt(name);

    if (ext === 'html' || ext === 'htm') {
      return {
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        icon: <Globe className="w-5 h-5 text-amber-400" />,
        ext: 'HTML',
      };
    }
    if (ext === 'pdf' || mimeType?.includes('pdf')) {
      return {
        bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
        icon: <FileText className="w-5 h-5 text-rose-400" />,
        ext: 'PDF',
      };
    }
    if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext) || mimeType?.includes('image')) {
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        icon: <ImageIcon className="w-5 h-5 text-emerald-400" />,
        ext: ext.toUpperCase(),
      };
    }
    if (['js', 'ts', 'tsx', 'jsx', 'json', 'css', 'py'].includes(ext) || mimeType?.includes('json')) {
      return {
        bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
        icon: <Code className="w-5 h-5 text-indigo-400" />,
        ext: ext.toUpperCase(),
      };
    }
    if (['xlsx', 'xls', 'csv'].includes(ext) || mimeType?.includes('spreadsheet')) {
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        icon: <FileSpreadsheet className="w-5 h-5 text-emerald-400" />,
        ext: 'XLS',
      };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return {
        bg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
        icon: <FileArchive className="w-5 h-5 text-purple-400" />,
        ext: ext.toUpperCase(),
      };
    }
    return {
      bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
      icon: <FileText className="w-5 h-5 text-blue-400" />,
      ext: ext.toUpperCase(),
    };
  };

  // Helper to build full breadcrumb path when clicking a sidebar folder node
  const selectFolderFromTree = (targetFolder: any) => {
    setEntityFilter('all');
    const path: Array<{ id: string; name: string }> = [{ id: targetFolder.id, name: targetFolder.name }];
    let curr = targetFolder;
    while (curr.parentId) {
      const parent = folders.find((f: any) => f.id === curr.parentId);
      if (parent) {
        path.unshift({ id: parent.id, name: parent.name });
        curr = parent;
      } else {
        break;
      }
    }
    setFolderBreadcrumbs(path);
  };

  return (
    <div className="space-y-6">
      {/* ─── ZOHO STATS HEADER BANNER ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Documents</p>
            <h3 className="text-xl font-bold text-slate-100">{documents.length}</h3>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Folder className="w-6 h-6 fill-amber-400/20" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Folders Created</p>
            <h3 className="text-xl font-bold text-slate-100">{folders.length}</h3>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Storage Used</p>
            <h3 className="text-xl font-bold text-slate-100">{formatBytes(totalStorageBytes)}</h3>
          </div>
        </div>
      </div>

      {/* ─── ZOHO FILE EXPLORER MAIN LAYOUT (LEFT SIDEBAR + RIGHT WORKSPACE) ── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ─── LEFT FOLDER TREE NAVIGATION PANEL (ZOHO SIDEBAR) ──────────────── */}
        <aside
          className={`w-full lg:w-64 bg-slate-900 border border-slate-800 rounded-2xl p-4 shrink-0 shadow-sm transition-all duration-200 ${
            isTreeSidebarOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Project Repository</span>
            </div>
            <button
              onClick={() => {
                setEditingFolder(null);
                setIsCreateFolderOpen(true);
              }}
              className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Add New Folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1 text-xs">
            {/* Root Node */}
            <button
              onClick={() => {
                setEntityFilter('all');
                setFolderBreadcrumbs([]);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-colors cursor-pointer ${
                currentFolderId === null && entityFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <FolderOpen className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                All Documents
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-950/60 text-slate-400">
                {folders.length}
              </span>
            </button>

            {/* Folder Tree Hierarchy List */}
            {rootFolders.map((rf: any) => {
              const isSelected = currentFolderId === rf.id;
              const subItems = folders.filter((f: any) => f.parentId === rf.id);
              const isExpanded = !!expandedFolders[rf.id];

              return (
                <div key={rf.id} className="space-y-0.5">
                  <div
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div
                      onClick={() => selectFolderFromTree(rf)}
                      className="flex items-center gap-2 truncate flex-1 min-w-0"
                    >
                      <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />
                      <span className="truncate">{rf.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {rf._count?.documents || 0}
                      </span>
                      {subItems.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedFolders((prev) => ({ ...prev, [rf.id]: !prev[rf.id] }));
                          }}
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                          title={isExpanded ? 'Collapse subfolders' : 'Expand subfolders'}
                        >
                          <ChevronRight
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isExpanded ? 'rotate-90 text-amber-400' : ''
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subfolders Level 1 (Collapsed by default, expanded manually) */}
                  {subItems.length > 0 && isExpanded && (
                    <div className="pl-4 space-y-0.5 border-l border-slate-800 ml-3 my-1">
                      {subItems.map((sf: any) => {
                        const isSubSelected = currentFolderId === sf.id;
                        return (
                          <button
                            key={sf.id}
                            onClick={() => selectFolderFromTree(sf)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer ${
                              isSubSelected
                                ? 'bg-amber-500/20 text-amber-300 font-bold'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Folder className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                              <span className="truncate">{sf.name}</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {sf._count?.documents || 0}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Smart Categorized Views */}
            <div className="pt-3 mt-3 border-t border-slate-800 space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Smart Views
              </div>
              <button
                onClick={() => {
                  setFolderBreadcrumbs([]);
                  setEntityFilter('task');
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  entityFilter === 'task'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                Task Attachments
              </button>
              <button
                onClick={() => {
                  setFolderBreadcrumbs([]);
                  setEntityFilter('issue');
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  entityFilter === 'issue'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Issue Attachments
              </button>
            </div>
          </div>
        </aside>

        {/* ─── RIGHT MAIN FILE EXPLORER WORKSPACE ─────────────────────────────── */}
        <main className="flex-1 w-full space-y-4">
          {/* Action Bar & Interactive Breadcrumb Controls */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Interactive Breadcrumbs */}
              <div className="flex items-center gap-2 overflow-x-auto text-xs text-slate-300 py-1">
                {folderBreadcrumbs.length > 0 && (
                  <button
                    onClick={() => setFolderBreadcrumbs(folderBreadcrumbs.slice(0, folderBreadcrumbs.length - 1))}
                    className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-950 border border-slate-800 hover:bg-slate-850 rounded-lg cursor-pointer transition-colors mr-1 shrink-0"
                    title="Go Up One Level"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => {
                    setEntityFilter('all');
                    setFolderBreadcrumbs([]);
                  }}
                  className={`font-semibold hover:text-amber-400 flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                    folderBreadcrumbs.length === 0 && entityFilter === 'all' ? 'text-amber-400 font-bold' : 'text-slate-400'
                  }`}
                >
                  <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                  Documents Root
                </button>

                {entityFilter === 'task' && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span className="font-bold text-indigo-400 flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5" /> Task Attachments
                    </span>
                  </>
                )}

                {entityFilter === 'issue' && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span className="font-bold text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Issue Attachments
                    </span>
                  </>
                )}

                {folderBreadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <button
                      onClick={() => setFolderBreadcrumbs(folderBreadcrumbs.slice(0, idx + 1))}
                      className={`font-semibold hover:text-amber-400 truncate cursor-pointer transition-colors shrink-0 ${
                        idx === folderBreadcrumbs.length - 1 ? 'text-amber-400 font-bold' : 'text-slate-400'
                      }`}
                    >
                      📁 {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Primary Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 justify-end">
                <button
                  onClick={() => {
                    setEditingFolder(null);
                    setIsCreateFolderOpen(true);
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/20 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4 text-amber-400" />
                  New Folder
                </button>

                <button
                  onClick={() => setIsUploadDocOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload Document
                </button>
              </div>
            </div>

            {/* Filter & View Mode Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
              {/* Search Box */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search files or tags..."
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {/* File Type Filter */}
                <select
                  value={mimeFilter}
                  onChange={(e) => setMimeFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">All File Types</option>
                  <option value="pdf">PDF Documents</option>
                  <option value="image">Images & Media</option>
                  <option value="code">Code & HTML</option>
                </select>

                {/* Grid / Table Toggle */}
                <div className="flex items-center p-1 bg-slate-950 border border-slate-850 rounded-xl">
                  <button
                    onClick={() => setViewMode('GRID')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'GRID' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Grid Cards View"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('TABLE')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'TABLE' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Details Table View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ─── UNIFIED FILE EXPLORER VIEW (GRID MODE) ────────────────────── */}
          {viewMode === 'GRID' && (
            <div className="space-y-6">
              {/* Folder Cards Grid */}
              {currentSubfolders.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                    Folders ({currentSubfolders.length})
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {currentSubfolders.map((folder: any) => (
                      <div
                        key={folder.id}
                        onClick={() => setFolderBreadcrumbs([...folderBreadcrumbs, { id: folder.id, name: folder.name }])}
                        className="p-4 bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl transition-all cursor-pointer group flex items-center justify-between shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                            <Folder className="w-5 h-5 fill-amber-400/20" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-slate-200 truncate group-hover:text-amber-300 transition-colors">
                              {folder.name}
                            </h5>
                            <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                              {folder._count?.documents || 0} files
                            </p>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setEditingFolder(folder);
                              setIsCreateFolderOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="Edit Folder"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete folder "${folder.name}"?`)) {
                                deleteFolderMutation.mutate(folder.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="Delete Folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents Grid */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  Documents & Attachments ({documents.length})
                </div>

                {documents.length === 0 && currentSubfolders.length === 0 ? (
                  <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">This Location is Empty</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                        No documents or nested folders exist here yet. Upload documents to get started.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsUploadDocOpen(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-lg shadow-indigo-600/20 inline-flex items-center gap-2"
                    >
                      <UploadCloud className="w-4 h-4" />
                      Upload Document Now
                    </button>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
                    <p className="text-xs text-slate-400">No files in this folder. Click above to upload a document.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {documents.map((doc: any) => {
                      const badge = getFileBadge(doc.mimeType, doc.name);
                      return (
                        <div
                          key={doc.id}
                          className="p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-2xl transition-all flex flex-col justify-between group space-y-4 shadow-sm"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${badge.bg}`}>
                                  {badge.icon}
                                </div>
                                <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-mono font-bold rounded uppercase">
                                  .{getFileExt(doc.name)}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-md">
                                  v{doc.version || '1.0'}
                                </span>
                                <button
                                  onClick={() => {
                                    setPreviewDocId(doc.id);
                                    setIsPreviewOpen(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                                  title="Preview & Version History"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Delete document "${doc.name}"?`)) {
                                      deleteDocMutation.mutate(doc.id);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <h5
                                onClick={() => {
                                  setPreviewDocId(doc.id);
                                  setIsPreviewOpen(true);
                                }}
                                className="text-xs font-bold text-slate-100 truncate hover:text-indigo-400 cursor-pointer transition-colors"
                                title={doc.name}
                              >
                                {doc.name}
                              </h5>
                              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                                {formatBytes(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>

                            {doc.task ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-semibold rounded-lg">
                                Task #{doc.task.taskNumber}
                              </span>
                            ) : doc.issue ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-semibold rounded-lg">
                                Issue BUG-{doc.issue.issueNumber}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-950 border border-slate-800 text-slate-400 text-[10px] rounded-md">
                                Project Root
                              </span>
                            )}
                          </div>

                          <div className="pt-3 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="truncate max-w-[120px]">
                              {doc.uploadedBy?.firstName
                                ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName || ''}`
                                : 'Admin'}
                            </span>
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3" /> Get
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── UNIFIED FILE EXPLORER VIEW (TABLE MODE - INCLUDES BOTH FOLDERS & FILES) ── */}
          {viewMode === 'TABLE' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Name</th>
                      <th className="px-4 py-3.5">Type</th>
                      <th className="px-4 py-3.5">Version / Items</th>
                      <th className="px-4 py-3.5">Linked Entity</th>
                      <th className="px-4 py-3.5">Size</th>
                      <th className="px-4 py-3.5">Uploaded / Created By</th>
                      <th className="px-4 py-3.5">Date</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {/* Render Subfolders First in Table */}
                    {currentSubfolders.map((folder: any) => (
                      <tr
                        key={folder.id}
                        onClick={() => setFolderBreadcrumbs([...folderBreadcrumbs, { id: folder.id, name: folder.name }])}
                        className="bg-slate-900/40 hover:bg-slate-850/60 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5 font-bold text-amber-300">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                              <Folder className="w-4 h-4 fill-amber-400/20" />
                            </div>
                            <span className="truncate max-w-[220px]">{folder.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold rounded">
                            Folder
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                          {folder._count?.documents || 0} items
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                          Directory
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                          --
                        </td>
                        <td className="px-4 py-3.5 text-slate-400">
                          Project Member
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                          {new Date(folder.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingFolder(folder);
                                setIsCreateFolderOpen(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Folder"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete folder "${folder.name}"?`)) {
                                  deleteFolderMutation.mutate(folder.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Delete Folder"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* Render Files Second in Table */}
                    {documents.map((doc: any) => {
                      const badge = getFileBadge(doc.mimeType, doc.name);
                      return (
                        <tr key={doc.id} className="hover:bg-slate-950/50 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-slate-200">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${badge.bg}`}>
                                {badge.icon}
                              </div>
                              <span
                                onClick={() => {
                                  setPreviewDocId(doc.id);
                                  setIsPreviewOpen(true);
                                }}
                                className="font-bold text-slate-100 hover:text-indigo-400 cursor-pointer transition-colors truncate max-w-[220px]"
                                title={doc.name}
                              >
                                {doc.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-mono font-bold rounded uppercase">
                              .{getFileExt(doc.name)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-md">
                              v{doc.version || '1.0'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {doc.task ? (
                              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-semibold rounded-md">
                                Task #{doc.task.taskNumber}
                              </span>
                            ) : doc.issue ? (
                              <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 text-[10px] font-semibold rounded-md">
                                Issue BUG-{doc.issue.issueNumber}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Root</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                            {formatBytes(doc.fileSize)}
                          </td>
                          <td className="px-4 py-3.5 text-slate-300">
                            {doc.uploadedBy?.firstName
                              ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName || ''}`
                              : 'Admin'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setPreviewDocId(doc.id);
                                  setIsPreviewOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                                title="Preview & Version History"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                                title="Download file"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete document "${doc.name}"?`)) {
                                    deleteDocMutation.mutate(doc.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {currentSubfolders.length === 0 && documents.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-500 italic">
                          No folders or documents found in this directory.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Slide-Over Modals */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => {
          setIsCreateFolderOpen(false);
          setEditingFolder(null);
        }}
        projectId={projectId}
        folders={folders}
        existingFolder={editingFolder}
        defaultParentId={currentFolderId}
      />

      <UploadDocumentModal
        isOpen={isUploadDocOpen}
        onClose={() => setIsUploadDocOpen(false)}
        projectId={projectId}
        folders={folders}
        defaultFolderId={currentFolderId}
      />

      <DocumentPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewDocId(null);
        }}
        documentId={previewDocId}
        projectId={projectId}
      />
    </div>
  );
}
