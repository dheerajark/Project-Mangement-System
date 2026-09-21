'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/services/api';
import { useRouter } from 'next/navigation';
import { 
  Bell, 
  Check, 
  Trash2, 
  ListTodo, 
  MessageSquare, 
  Bug, 
  Calendar, 
  Clock, 
  AlertCircle, 
  X,
  FileCheck,
  AtSign,
  Paperclip,
  CheckCircle2,
  RefreshCw,
  UserMinus,
  Repeat,
  ArrowUp,
  Tag,
} from 'lucide-react';
import { useFormatDate } from '@/hooks/useFormatDate';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
  triggeredBy?: {
    firstName: string;
    lastName: string;
  };
}

interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: string;
}

export default function NotificationBell() {
  const formatDate = useFormatDate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNREAD' | 'REMINDERS' | 'MENTIONS'>('ALL');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Filter notifications based on active filter tab
  const filteredNotifications = useMemo(() => {
    switch (filterTab) {
      case 'UNREAD':
        return notifications.filter((n) => !n.isRead);
      case 'REMINDERS':
        return notifications.filter(
          (n) => n.type === 'TASK_REMINDER_DUE' || n.type === 'TASK_REMINDER_OVERDUE',
        );
      case 'MENTIONS':
        return notifications.filter((n) => n.type === 'TASK_MENTION');
      case 'ALL':
      default:
        return notifications;
    }
  }, [notifications, filterTab]);

  // 1. Fetch user notifications
  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // 2. Setup real-time Socket.IO handler
  useSocket((newNotif: Notification) => {
    // Append new notification to top
    setNotifications((prev) => [newNotif, ...prev]);

    // Push new sliding toast alert
    const toastId = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [
      ...prev,
      {
        id: toastId,
        title: newNotif.title,
        message: newNotif.message,
        type: newNotif.type,
      },
    ]);

    // Auto dismiss toast after 4.5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 4500);
  });

  // Close dropdown on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Operations
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/notifications/${id}/archive`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed to archive notification:', err);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif.id);
    }
    setIsOpen(false);

    if (notif.actionUrl) {
      router.push(notif.actionUrl);
    }
  };

  // Icon selector based on category type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'TASK_REMINDER_DUE':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'TASK_REMINDER_OVERDUE':
        return <AlertCircle className="w-4 h-4 text-rose-400 animate-pulse" />;
      case 'TASK_MENTION':
        return <AtSign className="w-4 h-4 text-purple-400" />;
      case 'TASK_ASSIGNMENT':
        return <ListTodo className="w-4 h-4 text-blue-400" />;
      case 'TASK_UNASSIGNED':
        return <UserMinus className="w-4 h-4 text-slate-400" />;
      case 'TASK_STATUS_CHANGED':
        return <RefreshCw className="w-4 h-4 text-indigo-400" />;
      case 'TASK_COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'TASK_REOPENED':
        return <RefreshCw className="w-4 h-4 text-amber-400" />;
      case 'TASK_PRIORITY_CHANGED':
        return <ArrowUp className="w-4 h-4 text-orange-400" />;
      case 'TASK_DUE_DATE_CHANGED':
        return <Calendar className="w-4 h-4 text-sky-400" />;
      case 'TASK_ATTACHMENT':
        return <Paperclip className="w-4 h-4 text-teal-400" />;
      case 'TASK_COMMENT':
      case 'ISSUE_COMMENT':
      case 'TASK_LIST_COMMENT':
        return <MessageSquare className="w-4 h-4 text-purple-400" />;
      case 'ISSUE_ASSIGNMENT':
        return <Bug className="w-4 h-4 text-orange-400" />;
      case 'ISSUE_RESOLVED':
        return <FileCheck className="w-4 h-4 text-emerald-400" />;
      case 'MILESTONE_UPDATE':
        return <Calendar className="w-4 h-4 text-pink-400" />;
      case 'TIMESHEET_SUBMITTED':
        return <Clock className="w-4 h-4 text-indigo-400" />;
      case 'TIMESHEET_APPROVED':
        return <FileCheck className="w-4 h-4 text-emerald-400" />;
      case 'TIMESHEET_REJECTED':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      case 'RECURRING_TASK_GENERATED':
        return <Repeat className="w-4 h-4 text-cyan-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return formatDate(date);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all duration-150 flex items-center justify-center cursor-pointer"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-rose-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-bounce shadow-md">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-[999] overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-slate-200">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-semibold">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* Filter Sub-nav */}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-950/60 border-b border-slate-800 text-[11px] overflow-x-auto">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterTab('UNREAD')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterTab === 'UNREAD'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
            </button>
            <button
              onClick={() => setFilterTab('REMINDERS')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterTab === 'REMINDERS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Reminders
            </button>
            <button
              onClick={() => setFilterTab('MENTIONS')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterTab === 'MENTIONS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              @Mentions
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-slate-400">No notifications in this view.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-slate-800/40 cursor-pointer transition-colors duration-150 group relative ${
                    !notif.isRead ? 'bg-slate-900/90 border-l-2 border-indigo-500' : ''
                  }`}
                >
                  <div className="mt-0.5 p-1.5 bg-slate-950/80 border border-slate-800 rounded-lg shrink-0">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-xs font-semibold text-slate-200 truncate">{notif.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{notif.message}</p>
                    <span className="text-[10px] text-slate-500 font-medium mt-1.5 block">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>
                  
                  {/* Actions (Appear on hover) */}
                  <div className="absolute right-3.5 top-3.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {!notif.isRead && (
                      <button
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        className="p-1 hover:text-emerald-400 hover:bg-slate-950 rounded transition-colors text-slate-500 cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleArchive(notif.id, e)}
                      className="p-1 hover:text-rose-400 hover:bg-slate-950 rounded transition-colors text-slate-500 cursor-pointer"
                      title="Archive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sliding Toast Banners Overlay (Top Right of Screen) */}
      <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-3 pointer-events-none w-80">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="p-4 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl shadow-2xl flex items-start gap-3 pointer-events-auto animate-slide-in backdrop-blur-xl"
            style={{
              animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <div className="mt-0.5 p-1.5 bg-slate-950/80 border border-slate-800 rounded-lg">
              {getNotificationIcon(toast.type)}
            </div>
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-xs font-semibold text-slate-200">{toast.title}</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Slide-in Keyframe Definition */}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
