'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Bell, X, Check, CheckCheck, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EVENT_LABELS } from '@/lib/events/types';
import type { EventType } from '@/lib/events/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Notification = {
  id:        string;
  type:      string;
  title:     string;
  body:      string | null;
  link:      string | null;
  read:      boolean;
  createdAt: string;
  team?:     { name: string } | null;
  project?:  { title: string } | null;
};

type ApiResponse = {
  notifications: Notification[];
  unreadCount:   number;
};

// ─── Component ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 25_000; // 25 seconds

export function NotificationBell() {
  const [open,         setOpen]         = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [markingAll,    setMarkingAll]    = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Fetch notifications ────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=15', { cache: 'no-store' });
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silently ignore network errors — the bell should not crash the app
    }
  }, []);

  // Fetch on mount and poll every 25 s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Refresh when dropdown opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    } catch {
      // Best effort
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
    } finally {
      setMarkingAll(false);
    }
  }, []);

  const handleNotificationClick = useCallback((n: Notification) => {
    if (!n.read) markRead(n.id);
    setOpen(false);
  }, [markRead]);

  // ── Rendering ──────────────────────────────────────────────────────────────
  const typeLabel = (type: string): string =>
    EVENT_LABELS[type as EventType] ?? type;

  const formatRelativeTime = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative rounded-md p-1.5 transition-colors',
          open
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white"
            aria-hidden="true"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-card shadow-lg ring-1 ring-black/5 z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={markingAll}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3 w-3" />
                  All read
                </button>
              )}
              <Link
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                View all
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => {
                const inner = (
                  <div
                    className={cn(
                      'flex gap-3 px-4 py-3 transition-colors group',
                      !n.read ? 'bg-primary/5' : 'hover:bg-muted/40'
                    )}
                    onClick={() => handleNotificationClick(n)}
                  >
                    {/* Unread dot */}
                    <div className="mt-1.5 shrink-0">
                      <div
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          !n.read ? 'bg-primary' : 'bg-transparent'
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-xs font-medium text-foreground leading-snug truncate">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                        {n.team?.name && (
                          <>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                              {n.team.name}
                            </span>
                          </>
                        )}
                        {n.link && (
                          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 ml-auto shrink-0" />
                        )}
                      </div>
                    </div>
                    {/* Mark read button */}
                    {!n.read && (
                      <button
                        className="mt-1 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); markRead(n.id); }}
                        title="Mark as read"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );

                return n.link ? (
                  <Link key={n.id} href={n.link} className="block cursor-pointer">
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} className="cursor-default">
                    {inner}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t px-4 py-2">
              <Link
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all notifications →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
