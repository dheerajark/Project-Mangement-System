'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  FileText,
  Loader2,
  X,
  Download,
  History,
  Upload,
  Tag,
  Calendar,
  User,
  CheckSquare,
  ExternalLink,
  Layers,
  FileCode,
  Image as ImageIcon,
  FileSpreadsheet,
  Eye,
} from 'lucide-react';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string | null;
  projectId: string;
}

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  documentId,
  projectId,
}: DocumentPreviewModalProps) {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'DETAILS' | 'VERSIONS' | 'UPLOAD_NEW'>('DETAILS');

  // New version state
  const [newVersion, setNewVersion] = useState('1.1');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Fetch single document details with version history
  const { data: document, isLoading } = useQuery({
    queryKey: ['project-document-detail', documentId],
    queryFn: async () => {
      if (!documentId) return null;
      const res = await api.get(`/documents/${documentId}`);
      return res.data;
    },
    enabled: isOpen && !!documentId,
  });

  const addVersionMutation = useMutation({
    mutationFn: async () => {
      if (!documentId) return;
      return api.post(`/documents/${documentId}/versions`, {
        version: newVersion,
        fileUrl: newFileUrl || document?.fileUrl || 'https://storage.zoho-pms.internal/updated-doc',
        fileSize: document?.fileSize || 1024 * 300,
        notes: newNotes || 'Updated document version',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-document-detail', documentId] });
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      setNewVersion('');
      setNewFileUrl('');
      setNewNotes('');
      setActiveTab('VERSIONS');
    },
  });

  if (!isOpen || !documentId) return null;

  const getFileIcon = (mimeType?: string, name?: string) => {
    if (mimeType?.includes('image')) return <ImageIcon className="w-6 h-6 text-emerald-400" />;
    if (mimeType?.includes('pdf')) return <FileText className="w-6 h-6 text-rose-400" />;
    if (mimeType?.includes('spreadsheet') || name?.endsWith('.xlsx'))
      return <FileSpreadsheet className="w-6 h-6 text-emerald-400" />;
    if (mimeType?.includes('code') || mimeType?.includes('json') || name?.endsWith('.js') || name?.endsWith('.ts'))
      return <FileCode className="w-6 h-6 text-indigo-400" />;
    return <FileText className="w-6 h-6 text-indigo-400" />;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 h-full shadow-2xl border-l border-slate-800 flex flex-col justify-between animate-in slide-in-from-right duration-300">
        {/* Pinned Drawer Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/50 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              {getFileIcon(document?.mimeType, document?.name)}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 truncate max-w-[260px]">
                {document?.name || 'Document Details'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-md">
                  v{document?.version || '1.0'}
                </span>
                <span className="text-xs text-slate-400">{formatBytes(document?.fileSize || 0)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 shrink-0">
          <button
            onClick={() => setActiveTab('DETAILS')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'DETAILS'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('VERSIONS')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'VERSIONS'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Version History ({document?.versions?.length || 1})
          </button>
          <button
            onClick={() => {
              setActiveTab('UPLOAD_NEW');
              // auto calculate next version string (e.g. 1.0 -> 1.1)
              if (document?.version) {
                const parts = document.version.split('.');
                if (parts.length === 2 && !isNaN(Number(parts[1]))) {
                  setNewVersion(`${parts[0]}.${Number(parts[1]) + 1}`);
                } else {
                  setNewVersion('2.0');
                }
              }
            }}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'UPLOAD_NEW'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Update Version
          </button>
        </div>

        {/* Drawer Body - Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
              <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-500" />
              Loading document data...
            </div>
          ) : activeTab === 'DETAILS' ? (
            <div className="space-y-6">
              {/* Interactive In-Browser Document Visual Preview Frame */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    Document Preview
                  </span>
                  <a
                    href={document?.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" /> Fullscreen View
                  </a>
                </div>

                {/* Dynamic Format Previewer */}
                <div className="w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-850 min-h-[200px] max-h-[360px] flex items-center justify-center relative">
                  {document?.mimeType?.includes('image') || ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].some(ext => document?.name?.toLowerCase().endsWith(ext)) ? (
                    <img
                      src={document.fileUrl}
                      alt={document.name}
                      className="max-h-[340px] w-auto max-w-full object-contain p-2 mx-auto rounded-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : document?.mimeType?.includes('pdf') || document?.name?.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={document.fileUrl}
                      className="w-full h-[320px] border-0 rounded-lg"
                      title={document.name}
                    />
                  ) : document?.mimeType?.includes('text') || document?.mimeType?.includes('json') || ['txt', 'md', 'json', 'js', 'ts', 'html'].some(ext => document?.name?.toLowerCase().endsWith(ext)) ? (
                    <iframe
                      src={document.fileUrl}
                      className="w-full h-[280px] border-0 rounded-lg bg-slate-950 p-2 font-mono text-xs text-slate-300"
                      title={document.name}
                    />
                  ) : (
                    <div className="p-6 text-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
                        {getFileIcon(document?.mimeType, document?.name)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{document?.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {formatBytes(document?.fileSize || 0)} • {document?.mimeType || 'Document'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-950/50 border border-slate-850 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3 h-3" /> Uploaded By
                  </span>
                  <p className="text-xs font-semibold text-slate-200">
                    {document?.uploadedBy?.firstName
                      ? `${document.uploadedBy.firstName} ${document.uploadedBy.lastName || ''}`
                      : document?.uploadedBy?.email || 'System Admin'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/50 border border-slate-850 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Upload Date
                  </span>
                  <p className="text-xs font-semibold text-slate-200">
                    {document?.createdAt ? new Date(document.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/50 border border-slate-850 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Folder Directory
                  </span>
                  <p className="text-xs font-semibold text-slate-200">
                    {document?.folder?.name ? `📁 ${document.folder.name}` : 'Root Directory'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/50 border border-slate-850 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <CheckSquare className="w-3 h-3" /> Entity Association
                  </span>
                  <p className="text-xs font-semibold text-slate-200">
                    {document?.task ? (
                      <span className="text-indigo-400">Task #{document.task.taskNumber}</span>
                    ) : document?.issue ? (
                      <span className="text-rose-400">Issue BUG-{document.issue.issueNumber}</span>
                    ) : (
                      'Project Root Document'
                    )}
                  </p>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-500" /> Document Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {document?.tags
                    ? document.tags.split(',').map((tag: string, i: number) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-700"
                        >
                          #{tag.trim()}
                        </span>
                      ))
                    : <span className="text-xs text-slate-500 italic">No tags attached</span>}
                </div>
              </div>
            </div>
          ) : activeTab === 'VERSIONS' ? (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Revision & Version Log
              </h3>
              <div className="space-y-3">
                {document?.versions?.map((ver: any, index: number) => (
                  <div
                    key={ver.id || index}
                    className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-2 relative group hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-md">
                          v{ver.version}
                        </span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-md">
                            Current Active
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(ver.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 font-medium">
                      {ver.notes || 'No changelog notes provided for this version.'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-900">
                      <span>
                        Uploaded by:{' '}
                        <strong className="text-slate-200">
                          {ver.uploadedBy?.firstName
                            ? `${ver.uploadedBy.firstName} ${ver.uploadedBy.lastName || ''}`
                            : ver.uploadedBy?.email || 'User'}
                        </strong>
                      </span>
                      <a
                        href={ver.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                      >
                        <Download className="w-3 h-3" /> Get v{ver.version}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* UPLOAD NEW VERSION TAB */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addVersionMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-1">
                <h4 className="text-xs font-bold text-indigo-300">Upload New Revision</h4>
                <p className="text-[11px] text-indigo-400/80">
                  Uploading a new version preserves previous file versions in history while updating the active document.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  New Version Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  placeholder="e.g. 1.1 or 2.0"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Updated File Location / URL
                </label>
                <input
                  type="text"
                  value={newFileUrl}
                  onChange={(e) => setNewFileUrl(e.target.value)}
                  placeholder="https://storage.zoho-pms.internal/..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Revision Notes / Changelog
                </label>
                <textarea
                  rows={3}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Describe what changed in this version update..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={addVersionMutation.isPending}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {addVersionMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Publish Version v{newVersion}
              </button>
            </form>
          )}
        </div>

        {/* Pinned Bottom Footer */}
        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
}
