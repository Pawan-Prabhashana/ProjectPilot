'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, ExternalLink, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EVENT_LABELS } from '@/lib/events/types';
import type { EventType } from '@/lib/events/types';

type Notification = {
  id:        string;
  type:      string;
  title:     string;
  body:      string | null;
  link:      string | null;
  read:      boolean;
  readAt:    string | null;
  createdAt: string;
  team?:     { name: string } | null;
  project?:  { title: string } | null;
};

type ApiResponse = {
  notifications: Notification[];
  unreadCount:   number;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function typeLabel(type: string): string {
  return EVENT_LABELS[type as EventType] ?? type.replace(/[._]/g, ' ');
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [unreadOnly,    setUnreadOnly]    = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [markingAll,    setMarkingAll]    = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (unreadOnly) params.set('unreadOnly', 'true');
      const res = await fetch(`/api/notifications?${params}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  }, []);

  const displayed = unreadOnly ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Bell className="h-5 w-5 text-muted-foreground" />
            Notification Centre
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Unread filter */}
          <button
            onClick={() => setUnreadOnly((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              unreadOnly
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Filter className="h-3 w-3" />
            {unreadOnly ? 'Showing unread' : 'All notifications'}
          </button>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 rounded-lg border border-transparent bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
            >
              <CheckCheck className="h-3 w-3" />
              {markingAll ? 'Marking…' : 'Mark all read'}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 px-6 py-10 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
          </p>
          {unreadOnly && (
            <button
              onClick={() => setUnreadOnly(false)}
              className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
            >
              Show all notifications
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1 rounded-xl border bg-card p-2">
          {displayed.map((n) => {
            const inner = (
              <div
                className={cn(
                  'flex items-start gap-4 rounded-lg px-4 py-3 transition-colors group',
                  !n.read ? 'bg-primary/5' : 'hover:bg-muted/40',
                  n.link && 'cursor-pointer'
                )}
                onClick={() => { if (!n.read) markRead(n.id); }}
              >
                {/* Unread indicator */}
                <div className="mt-2 shrink-0">
                  <div className={cn('h-2 w-2 rounded-full', !n.read ? 'bg-primary' : 'bg-transparent')} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className={cn('font-medium text-foreground', n.read ? 'text-sm' : 'text-sm')}>
                      {n.title}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {typeLabel(n.type)}
                    </span>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                      {n.body}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                    {n.team?.name && (
                      <span className="text-xs text-muted-foreground">
                        {n.team.name}
                      </span>
                    )}
                    {n.read && n.readAt && (
                      <span className="text-[11px] text-muted-foreground/60">
                        Read {formatDateTime(n.readAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {n.link && (
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                  {!n.read && (
                    <button
                      className="rounded p-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); markRead(n.id); }}
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>
            );

            return n.link ? (
              <Link key={n.id} href={n.link} className="block">
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
