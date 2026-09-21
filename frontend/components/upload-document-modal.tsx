'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { UploadCloud, Loader2, X, FileText, Folder, Link2, Tag, CheckSquare, AlertCircle } from 'lucide-react';

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  folders: any[];
  defaultFolderId?: string | null;
}

export default function UploadDocumentModal({
  isOpen,
  onClose,
  projectId,
  folders = [],
  defaultFolderId = null,
}: UploadDocumentModalProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileSize, setFileSize] = useState<number>(1024 * 250); // default ~250 KB
  const [mimeType, setMimeType] = useState('application/pdf');
  const [version, setVersion] = useState('1.0');
  const [tags, setTags] = useState('');
  const [folderId, setFolderId] = useState('');
  const [entityType, setEntityType] = useState<'NONE' | 'TASK' | 'ISSUE'>('NONE');
  const [taskId, setTaskId] = useState('');
  const [issueId, setIssueId] = useState('');

  // Fetch project tasks for cross-linking
  const { data: tasks = [] } = useQuery({
    queryKey: ['project-tasks-for-doc', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/tasks`);
      return res.data;
    },
    enabled: isOpen && !!projectId,
  });

  // Fetch project issues for cross-linking
  const { data: issues = [] } = useQuery({
    queryKey: ['project-issues-for-doc', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/issues`);
      return res.data;
    },
    enabled: isOpen && !!projectId,
  });

  useEffect(() => {
    if (isOpen) {
      setName('');
      setFileUrl('');
      setFileSize(1024 * 350);
      setMimeType('application/pdf');
      setVersion('1.0');
      setTags('');
      setFolderId(defaultFolderId || '');
      setEntityType('NONE');
      setTaskId('');
      setIssueId('');
    }
  }, [isOpen, defaultFolderId]);

  // Handle mock file pick simulation or custom URL input
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setName(file.name);
      setFileSize(file.size);
      setMimeType(file.type || 'application/octet-stream');
      // Create a mock blob URL or file path for display
      setFileUrl(URL.createObjectURL(file));

      // Auto deduce mimeType label for simple tag suggestion
      if (file.type.includes('image')) {
        setTags('image, asset');
      } else if (file.type.includes('pdf')) {
        setTags('document, pdf');
      } else if (file.type.includes('json') || file.type.includes('javascript') || file.type.includes('code')) {
        setTags('code, source');
      }
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        fileUrl: fileUrl || `https://storage.zoho-pms.internal/docs/${encodeURIComponent(name || 'file.pdf')}`,
        fileSize,
        mimeType,
        version: version || '1.0',
        tags: tags || null,
        folderId: folderId || null,
        taskId: entityType === 'TASK' && taskId ? taskId : null,
        issueId: entityType === 'ISSUE' && issueId ? issueId : null,
      };
      return api.post(`/projects/${projectId}/documents`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-folders', projectId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    uploadMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 h-full shadow-2xl border-l border-slate-800 flex flex-col justify-between animate-in slide-in-from-right duration-300">
        {/* Pinned Drawer Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/50 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Upload Document</h2>
              <p className="text-xs text-slate-400">Add documents & link attachments to entities</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body - Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
          <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-140px)]">
            {uploadMutation.isError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                {(uploadMutation.error as any)?.response?.data?.message || 'Failed to upload document'}
              </div>
            )}

            {/* Upload Box Dropzone Simulation */}
            <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 text-center bg-slate-950/50 transition-colors">
              <input
                type="file"
                id="file-upload-input"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="file-upload-input" className="cursor-pointer block">
                <UploadCloud className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-200">
                  Click to choose file <span className="text-slate-500 font-normal">or drag & drop</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">PDF, DOCX, XLSX, PNG, JPG, JSON up to 50MB</p>
              </label>
            </div>

            {/* Document Name */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Document Title <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. System Architecture Diagram v1.0"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* File URL / Path */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                File Location / URL
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://storage.zoho-pms.internal/..."
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Row: Version & Folder */}
            <div className="grid grid-cols-2 gap-4">
              {/* Initial Version */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Initial Version
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Folder */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Target Folder
                </label>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">Root Directory</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Tags (Comma Separated)
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. design, backend, spec"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Entity Cross-Link Section */}
            <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-3">
              <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                Link Attachment to Entity
              </label>
              
              <div className="flex gap-3 text-xs">
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="entityType"
                    checked={entityType === 'NONE'}
                    onChange={() => setEntityType('NONE')}
                    className="accent-indigo-500"
                  />
                  Project Root
                </label>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="entityType"
                    checked={entityType === 'TASK'}
                    onChange={() => setEntityType('TASK')}
                    className="accent-indigo-500"
                  />
                  Task Attachment
                </label>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="entityType"
                    checked={entityType === 'ISSUE'}
                    onChange={() => setEntityType('ISSUE')}
                    className="accent-indigo-500"
                  />
                  Issue Attachment
                </label>
              </div>

              {entityType === 'TASK' && (
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500 mt-2"
                >
                  <option value="">-- Select Task --</option>
                  {tasks.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      #{t.taskNumber} - {t.title}
                    </option>
                  ))}
                </select>
              )}

              {entityType === 'ISSUE' && (
                <select
                  value={issueId}
                  onChange={(e) => setIssueId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500 mt-2"
                >
                  <option value="">-- Select Issue --</option>
                  {issues.map((i: any) => (
                    <option key={i.id} value={i.id}>
                      BUG-{i.issueNumber} - {i.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Pinned Bottom Footer */}
          <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploadMutation.isPending}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              {uploadMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Upload Document
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
