'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import {
  X,
  Eye,
  EyeOff,
  MessageSquare,
  Paperclip,
  Calendar,
  Clock,
  Loader2,
  Plus,
  AlertCircle,
  Activity,
  FileText,
  Send,
  User,
  AlertTriangle,
  Archive,
  Play,
  Square,
  CheckCircle2,
  Check,
} from 'lucide-react';

interface TaskDetailDrawerProps {
  taskId: string | null;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskDetailDrawer({
  taskId,
  projectId,
  isOpen,
  onClose,
}: TaskDetailDrawerProps) {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Form Editing State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [description, setDescription] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [attachFileName, setAttachFileName] = useState('');
  const [attachFileSize, setAttachFileSize] = useState(1024 * 150); // mock size
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);

  // Errors
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Fetch Task Details
  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const res = await api.get(`/tasks/${taskId}`);
      return res.data;
    },
    enabled: isOpen && !!taskId,
  });

  // Fetch Project Milestones
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/milestones`);
      return res.data;
    },
    enabled: isOpen && !!projectId,
  });

  // Populate fields
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatusError(null);
      setUpdateError(null);
    }
  }, [task]);

  // Mutations
  const updateTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch(`/tasks/${taskId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      setIsEditingTitle(false);
      setIsEditingDesc(false);
      setUpdateError(null);
    },
    onError: (err: any) => {
      setUpdateError(err.response?.data?.message || 'Failed to update task');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await api.patch(`/tasks/${taskId}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      setStatusError(null);
    },
    onError: (err: any) => {
      setStatusError(err.response?.data?.message || 'Illegal status transition');
    },
  });

  // Time Tracking State
  const [elapsed, setElapsed] = useState<number>(0);
  const [isStopping, setIsStopping] = useState<boolean>(false);
  const [stopDescription, setStopDescription] = useState<string>('');

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fetch Task Time Logs
  const { data: taskLogs = [] } = useQuery({
    queryKey: ['time-entries', 'task', taskId],
    queryFn: async () => {
      const res = await api.get(`/tasks/${taskId}/time-entries`);
      return res.data;
    },
    enabled: isOpen && !!taskId && !!task?.project?.settings?.allowTimeTracking,
  });

  // Fetch active timer
  const { data: activeTimer } = useQuery({
    queryKey: ['active-timer'],
    queryFn: async () => {
      const res = await api.get('/time-entries/active');
      return res.data;
    },
    refetchInterval: 10000,
    enabled: isOpen,
  });

  const isThisTimerRunning = activeTimer && activeTimer.isTimerRunning && activeTimer.taskId === taskId;

  useEffect(() => {
    if (!isThisTimerRunning || !activeTimer.timerStartedAt) {
      setElapsed(0);
      return;
    }

    const startMs = new Date(activeTimer.timerStartedAt).getTime();
    const initialElapsed = Math.floor((Date.now() - startMs) / 1000);
    setElapsed(initialElapsed > 0 ? initialElapsed : 0);

    const interval = setInterval(() => {
      const currentElapsed = Math.floor((Date.now() - startMs) / 1000);
      setElapsed(currentElapsed > 0 ? currentElapsed : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [isThisTimerRunning, activeTimer]);

  const startTimerMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/time-entries/timer/start', { projectId, taskId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries', 'task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['time-entries', projectId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to start timer');
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: async (desc: string) => {
      const res = await api.post('/time-entries/timer/stop', { description: desc });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries', 'task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['time-entries', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setIsStopping(false);
      setStopDescription('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to stop timer');
    },
  });

  const archiveTimeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/time-entries/${id}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', 'task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['time-entries', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to archive entry');
    },
  });

  const archiveTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/tasks/${taskId}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const toggleWatcherMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/tasks/${taskId}/watchers`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(`/tasks/${taskId}/comments`, { content });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setCommentContent('');
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: async (data: { fileName: string; fileUrl: string; fileSize: number }) => {
      const res = await api.post(`/tasks/${taskId}/attachments`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setAttachFileName('');
      setShowAttachmentForm(false);
    },
  });

  if (!isOpen) return null;

  const isArchived = task?.deletedAt || task?.project?.status === 'ARCHIVED';
  const isWatching = task?.watchers?.some((w: any) => w.userId === user?.sub);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO':
        return 'bg-slate-900 border-slate-800 text-slate-400';
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'REVIEW':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'DONE':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'BLOCKED':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSaveTitle = () => {
    if (title.trim() && title !== task.title) {
      updateTaskMutation.mutate({ title });
    } else {
      setTitle(task.title);
      setIsEditingTitle(false);
    }
  };

  const handleSaveDescription = () => {
    if (description !== (task.description || '')) {
      updateTaskMutation.mutate({ description: description.trim() || null });
    } else {
      setIsEditingDesc(false);
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentContent.trim()) {
      addCommentMutation.mutate(commentContent.trim());
    }
  };

  const handlePostAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (attachFileName.trim()) {
      const fileName = attachFileName.trim();
      addAttachmentMutation.mutate({
        fileName,
        fileUrl: `https://example.com/mock-files/${encodeURIComponent(fileName)}`,
        fileSize: attachFileSize,
      });
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full md:w-[680px] bg-slate-900 border-l border-slate-800/80 z-50 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center z-50">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        )}

        {/* Drawer Header */}
        <header className="border-b border-slate-800 p-4 md:px-6 flex items-center justify-between flex-shrink-0 bg-slate-900/90 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-mono px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-indigo-400 font-semibold uppercase shrink-0">
              {task?.project?.projectCode}-{task?.taskNumber}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:inline">
              Task Workspace
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Watcher Button */}
            {task && (
              <button
                onClick={() => toggleWatcherMutation.mutate()}
                className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                  isWatching
                    ? 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
                title={isWatching ? 'Stop watching this task' : 'Watch this task'}
              >
                {isWatching ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {isWatching ? 'Watching' : 'Watch'} ({task.watchers?.length || 0})
                </span>
              </button>
            )}

            {/* Archive Button */}
            {task && !isArchived && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to archive this task? It will freeze task edits but preserve its logs and comments.')) {
                    archiveTaskMutation.mutate();
                  }
                }}
                className="p-2 bg-slate-950 hover:bg-rose-950/20 hover:text-rose-400 border border-slate-800 hover:border-rose-900/30 rounded-lg text-slate-400 transition-all active:scale-95 flex items-center gap-1.5"
                title="Archive Task"
              >
                <Archive className="w-4 h-4" />
                <span className="hidden sm:inline">Archive</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Drawer Body Scroll */}
        {task && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            
            {/* Archived Freeze Warning banner */}
            {isArchived && (
              <div className="bg-amber-950/20 border border-amber-900/60 text-amber-200 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs">Task Read-Only State</h4>
                  <p className="text-amber-400/80 text-[10px] mt-1">
                    {task.deletedAt 
                      ? 'This task has been archived. Edits and logging functions are disabled.'
                      : 'The parent project has been archived. All tasks inside are frozen.'}
                  </p>
                </div>
              </div>
            )}

            {updateError && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-rose-400 flex-shrink-0" />
                <span>{updateError}</span>
              </div>
            )}

            {/* Main Form Fields */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Details Pane */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Title */}
                <div className="space-y-1">
                  {isEditingTitle && !isArchived ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleSaveTitle}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTitle();
                          if (e.key === 'Escape') {
                            setTitle(task.title);
                            setIsEditingTitle(false);
                          }
                        }}
                        autoFocus
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-bold text-lg focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handleSaveTitle}
                        className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <h2
                      onClick={() => !isArchived && setIsEditingTitle(true)}
                      className={`text-lg font-extrabold text-slate-100 leading-tight tracking-tight ${
                        !isArchived ? 'cursor-pointer hover:bg-slate-850/50 p-1.5 rounded-lg -ml-1.5' : ''
                      }`}
                    >
                      {task.title}
                    </h2>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Description
                  </label>
                  {isEditingDesc && !isArchived ? (
                    <div className="space-y-2">
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        placeholder="Add a detailed description..."
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDescription(task.description || '');
                            setIsEditingDesc(false);
                          }}
                          className="px-3 py-1.5 bg-slate-950 border border-slate-850 hover:bg-slate-900 rounded-lg text-[11px] font-medium text-slate-400"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDescription}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[11px] font-semibold text-white"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => !isArchived && setIsEditingDesc(true)}
                      className={`min-h-16 text-xs text-slate-300 leading-relaxed bg-slate-950/20 border border-slate-900 rounded-xl p-3.5 ${
                        !isArchived ? 'cursor-pointer hover:border-slate-800' : ''
                      }`}
                    >
                      {task.description ? (
                        <p className="whitespace-pre-wrap">{task.description}</p>
                      ) : (
                        <p className="text-slate-500 italic">No description provided. Click to add details.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Attachments Section */}
                <div className="space-y-3 pt-4 border-t border-slate-800/60">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-indigo-400" />
                      Attachments ({task.attachments?.length || 0})
                    </h4>

                    {task.project?.settings?.allowFileUploads && !isArchived && !showAttachmentForm && (
                      <button
                        onClick={() => setShowAttachmentForm(true)}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Attachment
                      </button>
                    )}
                  </div>

                  {/* Add Mock Attachment Form */}
                  {showAttachmentForm && (
                    <form
                      onSubmit={handlePostAttachment}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5"
                    >
                      <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                        Register Mock Document Metadata
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          value={attachFileName}
                          onChange={(e) => setAttachFileName(e.target.value)}
                          placeholder="document_spec.pdf"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                        />
                        <select
                          value={attachFileSize}
                          onChange={(e) => setAttachFileSize(parseInt(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                        >
                          <option value={1024 * 125}>125 KB (PDF Spec)</option>
                          <option value={1024 * 1024 * 2.4}>2.4 MB (Design Mockup)</option>
                          <option value={1024 * 512}>512 KB (Log file)</option>
                        </select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAttachmentForm(false)}
                          className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-slate-400 hover:bg-slate-850"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-semibold"
                        >
                          Register Attachment
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Attachment items list */}
                  <ul className="space-y-2">
                    {task.attachments && task.attachments.length > 0 ? (
                      task.attachments.map((file: any) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between p-2.5 bg-slate-950/30 border border-slate-900 rounded-xl hover:border-slate-850 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 bg-slate-900 border border-slate-850 rounded-lg text-indigo-400 shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-200 truncate" title={file.fileName}>
                                {file.fileName}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span>{formatFileSize(file.fileSize)}</span>
                                <span>•</span>
                                <span>by {file.uploadedBy?.firstName || file.uploadedBy?.email}</span>
                              </div>
                            </div>
                          </div>
                          <a
                            href={file.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-indigo-400 border border-transparent hover:bg-indigo-500/5 rounded-lg transition-colors"
                          >
                            View
                          </a>
                        </li>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">No attachments added to this task.</p>
                    )}
                  </ul>
                </div>

                {/* Comments Section */}
                <div className="space-y-4 pt-4 border-t border-slate-800/60">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    Discussion ({task.comments?.length || 0})
                  </h4>

                  {/* Add Comment Box */}
                  {!isArchived && (
                    <form onSubmit={handlePostComment} className="flex gap-2">
                      <input
                        type="text"
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        placeholder="Discuss task progress..."
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={addCommentMutation.isPending || !commentContent.trim()}
                        className="px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-1.5"
                      >
                        {addCommentMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Comment
                      </button>
                    </form>
                  )}

                  {/* Comment Feed */}
                  <ul className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                    {task.comments && task.comments.length > 0 ? (
                      task.comments.map((comment: any) => (
                        <li
                          key={comment.id}
                          className="bg-slate-950/20 border border-slate-900 rounded-xl p-3 space-y-1.5"
                        >
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-300">
                              {comment.user?.firstName
                                ? `${comment.user.firstName} ${comment.user.lastName || ''}`
                                : comment.user?.email}
                            </span>
                            <span className="text-slate-500">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </li>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">No comments yet. Start the conversation!</p>
                    )}
                  </ul>
                </div>

                {/* Task Level Time Logs (Gated by allowTimeTracking) */}
                {task.project?.settings?.allowTimeTracking && (
                  <div className="space-y-3 pt-4 border-t border-slate-800/60">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      Logged Hours History
                    </h4>

                    {taskLogs.length > 0 ? (
                      <ul className="space-y-2">
                        {taskLogs.map((log: any) => {
                          const isLocked = log.timesheet && (log.timesheet.status === 'SUBMITTED' || log.timesheet.status === 'APPROVED');
                          return (
                            <li
                              key={log.id}
                              className="flex items-center justify-between p-2.5 bg-slate-950/20 border border-slate-900 rounded-xl"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                                  <span>
                                    {log.user.firstName ? `${log.user.firstName} ${log.user.lastName || ''}` : log.user.email}
                                  </span>
                                  <span className="text-[10px] text-slate-505">
                                    {new Date(log.loggedAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate" title={log.description}>
                                  {log.description || <span className="text-slate-650 italic">No notes</span>}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold text-indigo-400">
                                  {log.hours.toFixed(1)}h
                                </span>
                                
                                {hasPermission('ARCHIVE_TIME_ENTRY') && !isArchived && (
                                  <button
                                    onClick={() => {
                                      if (confirm('Are you sure you want to archive this task time log?')) {
                                        archiveTimeMutation.mutate(log.id);
                                      }
                                    }}
                                    disabled={isLocked || archiveTimeMutation.isPending}
                                    className={`p-1 text-slate-500 hover:text-rose-450 border border-transparent rounded transition-all ${
                                      isLocked ? 'opacity-30 cursor-not-allowed' : 'active:scale-95 hover:bg-slate-800'
                                    }`}
                                    title={isLocked ? 'Locked in submitted/approved timesheet' : 'Archive time log'}
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">No hours logged against this task yet.</p>
                    )}
                  </div>
                )}

              </div>

              {/* Right Side Settings Pane */}
              <div className="space-y-5 bg-slate-950/30 border border-slate-900 rounded-xl p-4 md:p-5">
                
                {/* Status Selection */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Task Status
                  </label>
                  
                  {statusError && (
                    <div className="bg-rose-950/30 border border-rose-900 text-rose-400 text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{statusError}</span>
                    </div>
                  )}

                  <select
                    disabled={isArchived}
                    value={task.status}
                    onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 ${getStatusColor(
                      task.status
                    )}`}
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </div>

                {/* Priority Selection */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Priority
                  </label>
                  <select
                    disabled={isArchived}
                    value={task.priority}
                    onChange={(e) => updateTaskMutation.mutate({ priority: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 ${getPriorityColor(
                      task.priority
                    )}`}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                {/* Type Selection */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Task Type
                  </label>
                  <select
                    disabled={isArchived}
                    value={task.type}
                    onChange={(e) => updateTaskMutation.mutate({ type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                    <option value="STORY">Story</option>
                    <option value="IMPROVEMENT">Improvement</option>
                  </select>
                </div>

                {/* Assignee Selection */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Assignee
                  </label>
                  <select
                    disabled={isArchived}
                    value={task.assigneeId || ''}
                    onChange={(e) => updateTaskMutation.mutate({ assigneeId: e.target.value || null })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {task.project?.members?.map((m: any) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.firstName ? `${m.user.firstName} ${m.user.lastName || ''}` : m.user.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estimated Hours */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Estimation (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    disabled={isArchived}
                    value={task.estimatedHours ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseFloat(e.target.value) : null;
                      updateTaskMutation.mutate({ estimatedHours: val });
                    }}
                    placeholder="E.g. 4.5"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Due Date
                  </label>
                  <input
                    type="date"
                    disabled={isArchived}
                    value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      updateTaskMutation.mutate({ dueDate: val });
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>

                {/* Milestone Selector */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Milestone
                  </label>
                  <select
                    disabled={isArchived}
                    value={task.milestoneId || ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      updateTaskMutation.mutate({ milestoneId: val });
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">None</option>
                    {milestones?.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stopwatch & Estimation Progress Bar (Gated by allowTimeTracking) */}
                {task.project?.settings?.allowTimeTracking && (
                  <div className="space-y-3 pt-3 border-t border-slate-800">
                    <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Time Tracking
                    </span>

                    {/* Stopwatch control */}
                    <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${isThisTimerRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stopwatch</div>
                          <div className="text-xs font-mono font-bold text-slate-200">
                            {isThisTimerRunning ? formatTime(elapsed) : '00:00:00'}
                          </div>
                        </div>
                      </div>

                      {!isArchived && (
                        <div>
                          {isThisTimerRunning ? (
                            isStopping ? (
                              <div className="flex flex-col gap-1 items-end">
                                <input
                                  type="text"
                                  placeholder="Work notes..."
                                  value={stopDescription}
                                  onChange={(e) => setStopDescription(e.target.value)}
                                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500 max-w-[120px]"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => setIsStopping(false)}
                                    className="p-1 text-slate-400 hover:text-slate-200"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => stopTimerMutation.mutate(stopDescription)}
                                    disabled={stopTimerMutation.isPending}
                                    className="p-1 text-rose-400 hover:text-rose-350"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setIsStopping(true)}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0"
                              >
                                <Square className="w-3 h-3 fill-white" /> Stop
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => startTimerMutation.mutate()}
                              disabled={startTimerMutation.isPending}
                              className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0"
                            >
                              <Play className="w-3 h-3 fill-white" /> Start
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Progress Bar of estimation vs logged */}
                    {(() => {
                      const totalTaskLogged = taskLogs.reduce((sum: number, l: any) => sum + l.hours, 0);
                      const hasEstimate = task.estimatedHours && task.estimatedHours > 0;
                      const percent = hasEstimate ? Math.min(100, Math.round((totalTaskLogged / task.estimatedHours) * 100)) : 0;
                      const isOverBudget = hasEstimate && totalTaskLogged > task.estimatedHours;
                      
                      return (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-slate-400">Task Logged Time</span>
                            <span className={isOverBudget ? 'text-rose-400' : 'text-indigo-400'}>
                              {totalTaskLogged.toFixed(1)}h{hasEstimate ? ` / ${task.estimatedHours.toFixed(1)}h (${percent}%)` : ''}
                            </span>
                          </div>
                          {hasEstimate && (
                            <div className="w-full bg-slate-950 border border-slate-900 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isOverBudget ? 'bg-rose-500' : percent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Administrative Info */}
                <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 space-y-1">
                  <div>
                    Reporter:{' '}
                    <span className="font-semibold text-slate-400">
                      {task.reporter?.firstName
                        ? `${task.reporter.firstName} ${task.reporter.lastName || ''}`
                        : task.reporter?.email || 'System'}
                    </span>
                  </div>
                  <div>
                    Created: <span className="font-semibold text-slate-400">{new Date(task.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div>
                    Last Updated:{' '}
                    <span className="font-semibold text-slate-400">{new Date(task.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

              </div>

            </div>

            {/* Task Activity Logs Timeline */}
            <div className="space-y-3 pt-4 border-t border-slate-800/60">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-400" />
                Task Activities Audit
              </h4>
              
              <ul className="relative border-l border-slate-800/80 ml-3.5 pl-5.5 space-y-4 text-xs">
                {task.activities && task.activities.length > 0 ? (
                  task.activities.map((act: any) => {
                    const activityUser = act.user?.firstName
                      ? `${act.user.firstName} ${act.user.lastName || ''}`
                      : act.user?.email || 'System';

                    let descriptionText = act.action;
                    if (act.action === 'TASK_CREATED') {
                      descriptionText = 'created this task';
                    } else if (act.action === 'STATUS_CHANGED') {
                      descriptionText = `changed status from ${act.oldValue} to ${act.newValue}`;
                    } else if (act.action === 'PRIORITY_CHANGED') {
                      descriptionText = `changed priority from ${act.oldValue} to ${act.newValue}`;
                    } else if (act.action === 'ASSIGNEE_CHANGED') {
                      descriptionText = `reassigned task`;
                    } else if (act.action === 'TASK_UPDATED') {
                      descriptionText = 'updated task details';
                    } else if (act.action === 'COMMENT_ADDED') {
                      descriptionText = 'added a comment';
                    } else if (act.action === 'ATTACHMENT_UPLOADED') {
                      descriptionText = `uploaded attachment: ${act.newValue}`;
                    } else if (act.action === 'TASK_ARCHIVED') {
                      descriptionText = 'archived this task';
                    }

                    return (
                      <li key={act.id} className="relative group">
                        {/* Bullet Dot */}
                        <div className="absolute -left-[30px] top-[3px] bg-slate-900 border border-slate-750 text-indigo-400 w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        </div>

                        <div className="flex justify-between gap-4">
                          <div>
                            <span className="font-bold text-slate-350">{activityUser}</span>{' '}
                            <span className="text-slate-450">{descriptionText}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {new Date(act.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </li>
                    );
                  })
                ) : (
                  <p className="text-[11px] text-slate-500 italic">No logged activity for this task.</p>
                )}
              </ul>
            </div>

          </div>
        )}

      </div>
    </>
  );
}
