'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Activity, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EVENT_LABELS } from '@/lib/events/types';
import type { EventType } from '@/lib/events/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityEvent = {
  id:        string;
  action:    string;
  title:     string;
  message:   string | null;
  teamId:    string | null;
  projectId: string | null;
  entity:    string | null;
  entityId:  string | null;
  createdAt: string;
  user?:     { id: string; name: string | null; role: string } | null;
  team?:     { name: string } | null;
  project?:  { title: string } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 28_000; // 28 s — offset slightly from notification bell

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const actionDotColor: Partial<Record<EventType, string>> = {
  'task.created':                    'bg-blue-500',
  'task.assigned':                   'bg-blue-400',
  'task.status_changed':             'bg-sky-500',
  'consultation.requested':          'bg-amber-500',
  'consultation.confirmed':          'bg-green-500',
  'meeting_notes.added':             'bg-indigo-500',
  'project_brain.question_created':  'bg-purple-500',
  'project_brain.question_resolved': 'bg-emerald-500',
  'project_brain.decision_created':  'bg-violet-500',
  'contribution.logged':             'bg-teal-500',
};

// ─── Component ────────────────────────────────────────────────────────────────

type RecentActivityFeedProps = {
  teamId?:    string;
  projectId?: string;
  /** Max items to show. Default 8. */
  limit?:     number;
  /** Compact single-line layout. Default false. */
  compact?:   boolean;
  title?:     string;
};

export function RecentActivityFeed({
  teamId,
  projectId,
  limit = 8,
  compact = false,
  title = 'Recent Activity',
}: RecentActivityFeedProps) {
  const [events,     setEvents]     = useState<ActivityEvent[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetch,  setLastFetch]  = useState<Date | null>(null);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (teamId)    params.set('teamId',    teamId);
    if (projectId) params.set('projectId', projectId);
    return `/api/events?${params}`;
  }, [teamId, projectId, limit]);

  const fetchEvents = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(buildUrl(), { cache: 'no-store' });
      if (!res.ok) return;
      const data: { events: ActivityEvent[] } = await res.json();
      setEvents(data.events);
      setLastFetch(new Date());
    } catch {
      // Silently ignore — activity feed should not crash the page
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(() => fetchEvents(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const typeLabel = (action: string): string =>
    EVENT_LABELS[action as EventType] ?? action.replace(/[._]/g, ' ');

  const dotColor = (action: string): string =>
    actionDotColor[action as EventType] ?? 'bg-muted-foreground';

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={cn('flex items-center gap-2 font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>
          <Activity className={cn('text-muted-foreground', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {lastFetch && (
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              {formatRelativeTime(lastFetch.toISOString())}
            </span>
          )}
          <button
            onClick={() => fetchEvents(true)}
            disabled={refreshing}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            title="Refresh activity"
            aria-label="Refresh activity feed"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border px-3 py-2.5 animate-pulse">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-2/3 rounded bg-muted" />
                <div className="h-2.5 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className={cn(
          'rounded-lg border bg-muted/30 text-center text-muted-foreground',
          compact ? 'px-3 py-3 text-xs' : 'px-4 py-5 text-sm'
        )}>
          No recent activity yet.
        </div>
      ) : (
        <div className={cn('space-y-1 rounded-lg border p-2', compact ? 'p-1.5' : 'p-2')}>
          {events.map((event) => (
            <div
              key={event.id}
              className={cn(
                'flex items-start gap-3 rounded-md px-2.5 transition-colors',
                compact ? 'py-1.5' : 'py-2',
                'hover:bg-muted/40'
              )}
            >
              {/* Colour dot */}
              <div className={cn('mt-1.5 shrink-0 rounded-full', compact ? 'h-1.5 w-1.5' : 'h-2 w-2', dotColor(event.action))} />

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className={cn('font-medium text-foreground truncate', compact ? 'text-[11px]' : 'text-xs')}>
                    {event.title || typeLabel(event.action)}
                  </span>
                  {event.user?.name && (
                    <span className={cn('text-muted-foreground shrink-0', compact ? 'text-[10px]' : 'text-[11px]')}>
                      by {event.user.name}
                    </span>
                  )}
                </div>
                {!compact && event.message && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                    {event.message}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('text-muted-foreground', compact ? 'text-[9px]' : 'text-[10px]')}>
                    {formatRelativeTime(event.createdAt)}
                  </span>
                  {event.team?.name && !teamId && (
                    <>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className={cn('text-muted-foreground truncate', compact ? 'text-[9px] max-w-[60px]' : 'text-[10px] max-w-[100px]')}>
                        {event.team.name}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
