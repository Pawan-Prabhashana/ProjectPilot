/**
 * Central Event Creation Service
 *
 * Single entry point for creating platform events and their associated
 * notifications. All business logic that triggers notifications should
 * call this service — never write to ActivityLog or Notification directly.
 *
 * Design goals:
 * - Event creation never crashes the primary user action. Errors are caught
 *   and logged to console so the calling route can continue.
 * - Notification targeting is flexible: target specific users, all team
 *   members, the supervisor, or coordinators.
 * - The actor (the user who triggered the event) is excluded from their
 *   own notifications by default.
 * - Clean separation from business logic — upgrading to Supabase Realtime,
 *   Pusher, or SSE later only requires changing this file.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { EventType, EventVisibility } from './types';

// ─── Input types ──────────────────────────────────────────────────────────────

export type NotifyOptions = {
  /** Explicitly target these user IDs. */
  targetUserIds?: string[];
  /** Notify all team members (except actor unless includeActor = true). */
  includeTeamMembers?: boolean;
  /** Notify the team's assigned supervisor. */
  includeSupervisor?: boolean;
  /** Notify all coordinators. */
  includeCoordinators?: boolean;
  /** Include the actor in their own notifications. Default: false. */
  includeActor?: boolean;
  /** The href that the notification bell click should navigate to. */
  href?: string;
};

export type CreateEventInput = {
  type: EventType | string;
  title: string;
  message?: string;
  actorId?: string | null;
  teamId?: string | null;
  projectId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  visibility?: EventVisibility | string;
  payload?: Prisma.InputJsonValue;
  notify?: NotifyOptions | false;
};

// ─── Main service function ────────────────────────────────────────────────────

/**
 * Creates an ActivityLog event and optional Notification rows.
 *
 * Returns the created ActivityLog, or null if something failed silently.
 * Errors in notification creation are caught and logged but do not throw.
 */
export async function createEvent(input: CreateEventInput) {
  const {
    type,
    title,
    message,
    actorId,
    teamId,
    projectId,
    entityType,
    entityId,
    visibility = 'TEAM',
    payload,
    notify,
  } = input;

  // 1. Write the event to ActivityLog
  let event;
  try {
    event = await prisma.activityLog.create({
      data: {
        action:     type,
        title,
        message:    message ?? null,
        userId:     actorId ?? null,
        teamId:     teamId ?? null,
        projectId:  projectId ?? null,
        entity:     entityType ?? null,
        entityId:   entityId ?? null,
        visibility,
        metadata:   payload,
      },
    });
  } catch (err) {
    console.error('[createEvent] Failed to write ActivityLog:', err);
    return null;
  }

  // 2. Resolve notification recipients
  if (notify === false || notify === undefined) return event;

  const {
    targetUserIds = [],
    includeTeamMembers = false,
    includeSupervisor = false,
    includeCoordinators = false,
    includeActor = false,
    href,
  } = notify;

  const recipientSet = new Set<string>(targetUserIds);

  try {
    // Add team members
    if (includeTeamMembers && teamId) {
      const members = await prisma.teamMember.findMany({
        where:  { teamId },
        select: { userId: true },
      });
      members.forEach((m) => recipientSet.add(m.userId));
    }

    // Add supervisor
    if (includeSupervisor && teamId) {
      const team = await prisma.team.findUnique({
        where:   { id: teamId },
        include: { supervisor: { select: { userId: true } } },
      });
      if (team?.supervisor?.userId) recipientSet.add(team.supervisor.userId);
    }

    // Add coordinators
    if (includeCoordinators) {
      const coordinators = await prisma.user.findMany({
        where:  { role: 'COORDINATOR' },
        select: { id: true },
      });
      coordinators.forEach((c) => recipientSet.add(c.id));
    }

    // Remove actor unless explicitly included
    if (actorId && !includeActor) recipientSet.delete(actorId);

    if (recipientSet.size === 0) return event;

    // 3. Create notifications
    await prisma.notification.createMany({
      data: Array.from(recipientSet).map((userId) => ({
        userId,
        teamId:        teamId ?? null,
        projectId:     projectId ?? null,
        activityLogId: event!.id,
        type,
        title,
        body:     message ?? null,
        link:     href ?? null,
        read:     false,
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    // Notification failure must not crash the primary action
    console.error('[createEvent] Failed to create notifications:', err);
  }

  return event;
}
