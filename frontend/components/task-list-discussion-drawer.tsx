'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import {
  X,
  MessageSquare,
  Send,
  Loader2,
  Lock,
  Globe,
  Flag,
  CheckCircle2,
  Trash2,
  Edit2,
  Check,
  Paperclip,
  AtSign,
  FileText,
  AlertCircle,
  Clock,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';

interface TaskListDiscussionDrawerProps {
  taskListId: string | null;
  projectId: string;
  project?: any;
  onClose: () => void;
}

export default function TaskListDiscussionDrawer({
  taskListId,
  projectId,
  project,
  onClose,
}: TaskListDiscussionDrawerProps) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [newComment, setNewComment] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<{ fileName: string; fileUrl: string; fileSize?: number }[]>([]);
  const [showAttachInput, setShowAttachInput] = useState(false);
  const [attachFileName, setAttachFileName] = useState('');
  const [attachFileUrl, setAttachFileUrl] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);

  // Inline edit state: commentId -> content
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const isArchived = project?.status === 'ARCHIVED';

  // Fetch Task List Details
  const { data: taskList, isLoading: isLoadingTaskList } = useQuery({
    queryKey: ['task-list', taskListId],
    queryFn: async () => {
      const res = await api.get(`/task-lists/${taskListId}`);
      return res.data;
    },
    enabled: !!taskListId,
  });

  // Fetch Task List Comments
  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ['task-list-comments', taskListId],
    queryFn: async () => {
      const res = await api.get(`/task-lists/${taskListId}/comments`);
      return res.data;
    },
    enabled: !!taskListId,
  });

  // Fetch Project Members (for @mentions)
  const { data: projectMembers = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data?.members || [];
    },
    enabled: !!projectId,
  });

  // Mutation: Add Comment
  const addCommentMutation = useMutation({
    mutationFn: async (payload: {
      content: string;
      mentionedUserIds?: string[];
      attachments?: { fileName: string; fileUrl: string; fileSize?: number }[];
    }) => {
      const res = await api.post(`/task-lists/${taskListId}/comments`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-list-comments', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
      setNewComment('');
      setMentionedUserIds([]);
      setAttachments([]);
      setShowAttachInput(false);
      setAttachFileName('');
      setAttachFileUrl('');
    },
  });

  // Mutation: Update Comment
  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const res = await api.patch(`/task-lists/comments/${commentId}`, { content });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-list-comments', taskListId] });
      setEditingCommentId(null);
      setEditContent('');
    },
  });

  // Mutation: Delete Comment
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await api.delete(`/task-lists/comments/${commentId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-list-comments', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['task-lists', projectId] });
    },
  });

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || addCommentMutation.isPending || isArchived) return;

    addCommentMutation.mutate({
      content: newComment.trim(),
      mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  };

  const handleAddAttachment = () => {
    if (!attachFileName.trim() || !attachFileUrl.trim()) return;
    setAttachments((prev) => [
      ...prev,
      {
        fileName: attachFileName.trim(),
        fileUrl: attachFileUrl.trim(),
        fileSize: 1024 * 100, // standard placeholder size
      },
    ]);
    setAttachFileName('');
    setAttachFileUrl('');
    setShowAttachInput(false);
  };

  const handleSelectMention = (member: any) => {
    const mentionName = member.user?.firstName
      ? `@${member.user.firstName} ${member.user.lastName || ''}`.trim()
      : `@${member.user?.email || 'User'}`;

    setNewComment((prev) => `${prev} ${mentionName} `);
    if (member.userId && !mentionedUserIds.includes(member.userId)) {
      setMentionedUserIds((prev) => [...prev, member.userId]);
    }
    setShowMentionPicker(false);
    commentInputRef.current?.focus();
  };

  const getInitials = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName) {
      return `${firstName[0]}${lastName ? lastName[0] : ''}`.toUpperCase();
    }
    return email ? email.substring(0, 2).toUpperCase() : 'U';
  };

  // Helper to parse comment text and format @mentions with highlighted tags
  const renderCommentContent = (content: string) => {
    const mentionRegex = /(@[a-zA-Z0-9_]+(?:\s+[a-zA-Z0-9_]+)?)/g;
    const parts = content.split(mentionRegex);

    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (!taskListId) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-100 truncate">
                  {taskList?.name || 'Task List Discussion'}
                </h3>
                {taskList?.status && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                      taskList.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}
                  >
                    {taskList.status}
                  </span>
                )}
                {taskList?.flag && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 ${
                      taskList.flag === 'EXTERNAL'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {taskList.flag === 'EXTERNAL' ? (
                      <Globe className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Lock className="w-3 h-3 text-slate-400" />
                    )}
                    <span>{taskList.flag}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">
                Task List Discussion Thread • {project?.name || 'Project'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Task List Metadata Banner */}
        {taskList && (
          <div className="px-5 py-3 bg-slate-950/40 border-b border-slate-850 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              {taskList.milestone && (
                <span className="flex items-center gap-1 text-amber-300 font-medium">
                  <Flag className="w-3.5 h-3.5 text-amber-400" />
                  <span>{taskList.milestone.title}</span>
                </span>
              )}
              {taskList.description && (
                <span className="text-slate-400 truncate max-w-xs">{taskList.description}</span>
              )}
            </div>
            <span className="font-semibold text-slate-300">
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </span>
          </div>
        )}

        {/* Archived Notice */}
        {isArchived && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>This project is archived. Discussion is currently in read-only mode.</span>
          </div>
        )}

        {/* Comments Feed Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoadingComments ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
              <p className="text-xs text-slate-400">Loading comments...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 mx-auto bg-slate-800/60 rounded-2xl flex items-center justify-center text-slate-400">
                <MessageSquare className="w-6 h-6 text-indigo-400/80" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-slate-200">No discussions yet</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Start the conversation on this task list. Mention teammates with @ to coordinate deliverables.
                </p>
              </div>
            </div>
          ) : (
            comments.map((comment: any) => {
              const isOwner = currentUser?.sub === comment.userId;
              const isEditing = editingCommentId === comment.id;
              const isEdited =
                comment.updatedAt &&
                new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000;

              let parsedAttachments: any[] = [];
              if (comment.attachments) {
                try {
                  parsedAttachments = JSON.parse(comment.attachments);
                } catch (e) {
                  parsedAttachments = [];
                }
              }

              return (
                <div
                  key={comment.id}
                  className="bg-slate-950/50 border border-slate-850 hover:border-slate-800 rounded-2xl p-4 space-y-3 transition-all group shadow-sm"
                >
                  {/* Author Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                        {getInitials(
                          comment.user?.firstName,
                          comment.user?.lastName,
                          comment.user?.email
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200">
                            {comment.user?.firstName
                              ? `${comment.user.firstName} ${comment.user.lastName || ''}`
                              : comment.user?.email || 'Unknown User'}
                          </span>
                          {isOwner && (
                            <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{new Date(comment.createdAt).toLocaleString()}</span>
                          {isEdited && <span className="italic text-slate-500">(edited)</span>}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Edit / Delete */}
                    {!isArchived && isOwner && !isEditing && (
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCommentId(comment.id);
                            setEditContent(comment.content);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-900 rounded transition-colors cursor-pointer"
                          title="Edit comment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this comment?')) {
                              deleteCommentMutation.mutate(comment.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded transition-colors cursor-pointer"
                          title="Delete comment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  {isEditing ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-indigo-500/50 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[70px]"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingCommentId(null)}
                          className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={updateCommentMutation.isPending || !editContent.trim()}
                          onClick={() =>
                            updateCommentMutation.mutate({
                              commentId: comment.id,
                              content: editContent.trim(),
                            })
                          }
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {updateCommentMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {renderCommentContent(comment.content)}
                    </div>
                  )}

                  {/* Attachments */}
                  {parsedAttachments.length > 0 && (
                    <div className="pt-2 border-t border-slate-900 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                        <Paperclip className="w-3 h-3 text-indigo-400" /> Attachments
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {parsedAttachments.map((att: any, idx: number) => (
                          <a
                            key={idx}
                            href={att.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-indigo-300 hover:text-indigo-200 text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="font-medium">{att.fileName}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* New Comment Input Box */}
        {!isArchived && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/90 relative">
            {/* Mention Suggestions Popup */}
            {showMentionPicker && (
              <div className="absolute bottom-full mb-2 left-4 right-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-30 max-h-48 overflow-y-auto space-y-1">
                <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                  Mention Project Team Member:
                </div>
                {projectMembers.map((member: any) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleSelectMention(member)}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800/80 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 font-bold text-[10px] flex items-center justify-center">
                        {getInitials(
                          member.user?.firstName,
                          member.user?.lastName,
                          member.user?.email
                        )}
                      </div>
                      <span className="font-medium">
                        {member.user?.firstName
                          ? `${member.user.firstName} ${member.user.lastName || ''}`
                          : member.user?.email}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{member.role}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Attached Files Preview */}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 border border-indigo-500/30 text-indigo-300 text-xs rounded-lg"
                  >
                    <Paperclip className="w-3 h-3 text-indigo-400" />
                    <span className="truncate max-w-[150px]">{att.fileName}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-400 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Attachment Dialog */}
            {showAttachInput && (
              <div className="mb-2.5 p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Attach File URL / Document
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Document Name (e.g. Scope.pdf)"
                    value={attachFileName}
                    onChange={(e) => setAttachFileName(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="File URL (e.g. https://...)"
                    value={attachFileUrl}
                    onChange={(e) => setAttachFileUrl(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAttachInput(false)}
                    className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddAttachment}
                    disabled={!attachFileName.trim() || !attachFileUrl.trim()}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Add File
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handlePostComment} className="space-y-2.5">
              <textarea
                ref={commentInputRef}
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  if (e.target.value.endsWith('@')) {
                    setShowMentionPicker(true);
                  }
                }}
                placeholder="Post a comment or discussion topic on this task list... Type @ to mention"
                rows={2}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
              />

              <div className="flex items-center justify-between">
                {/* Utilities: Mention & Attach Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowMentionPicker(!showMentionPicker)}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                    title="Mention team member"
                  >
                    <AtSign className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Mention</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAttachInput(!showAttachInput)}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                    title="Attach document or link"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Attach</span>
                  </button>
                </div>

                {/* Submit Comment Button */}
                <button
                  type="submit"
                  disabled={addCommentMutation.isPending || !newComment.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                >
                  {addCommentMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Post Comment</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
