'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { FolderPlus, Loader2, X, Folder } from 'lucide-react';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  folders: any[];
  existingFolder?: any;
  defaultParentId?: string | null;
}

export default function CreateFolderModal({
  isOpen,
  onClose,
  projectId,
  folders = [],
  existingFolder = null,
  defaultParentId = null,
}: CreateFolderModalProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (existingFolder) {
        setName(existingFolder.name || '');
        setDescription(existingFolder.description || '');
        setParentId(existingFolder.parentId || '');
      } else {
        setName('');
        setDescription('');
        setParentId(defaultParentId || '');
      }
    }
  }, [isOpen, existingFolder, defaultParentId]);

  const folderMutation = useMutation({
    mutationFn: async () => {
      if (existingFolder) {
        return api.patch(`/folders/${existingFolder.id}`, {
          name,
          description: description || null,
          parentId: parentId || null,
        });
      } else {
        return api.post(`/projects/${projectId}/folders`, {
          name,
          description: description || null,
          parentId: parentId || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-folders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    folderMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 h-full shadow-2xl border-l border-slate-800 flex flex-col justify-between animate-in slide-in-from-right duration-300">
        {/* Pinned Drawer Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/50 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {existingFolder ? 'Edit Folder' : 'Create New Folder'}
              </h2>
              <p className="text-xs text-slate-400">Organize your project documents in custom folders</p>
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
            {folderMutation.isError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                {(folderMutation.error as any)?.response?.data?.message || 'Failed to save folder'}
              </div>
            )}

            {/* Folder Name */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Folder Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Folder className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Design Specs, Legal Contracts..."
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Parent Folder */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Parent Folder (Optional)
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">None (Root Directory)</option>
                {folders
                  .filter((f) => !existingFolder || f.id !== existingFolder.id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-500">
                Select a parent folder to nest this folder inside another directory.
              </p>
            </div>

            {/* Folder Description */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Description (Optional)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add notes about what files should be stored here..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
              />
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
              disabled={folderMutation.isPending}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-amber-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              {folderMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {existingFolder ? 'Save Changes' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
