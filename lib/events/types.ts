/**
 * Platform Event Type Constants
 *
 * Central registry for all event/notification type strings.
 * Use these constants everywhere instead of raw strings to prevent typos
 * and make it easy to search for all usages of a given event.
 *
 * These are stored in ActivityLog.action and Notification.type.
 * The string format follows the pattern: "<domain>.<verb>"
 */

export const EVENT_TYPES = {
  // ── Task events ──────────────────────────────────────────────────────────
  TASK_CREATED:        'task.created',
  TASK_ASSIGNED:       'task.assigned',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_UPDATED:        'task.updated',
  TASK_BLOCKED:        'task.blocked',

  // ── Consultation events ───────────────────────────────────────────────────
  CONSULTATION_REQUESTED:  'consultation.requested',
  CONSULTATION_CONFIRMED:  'consultation.confirmed',
  CONSULTATION_CANCELLED:  'consultation.cancelled',
  MEETING_NOTES_ADDED:     'meeting_notes.added',
  MEETING_NOTES_UPDATED:   'meeting_notes.updated',

  // ── Project Brain events ──────────────────────────────────────────────────
  PROJECT_BRAIN_QUESTION_CREATED:  'project_brain.question_created',
  PROJECT_BRAIN_QUESTION_RESOLVED: 'project_brain.question_resolved',
  PROJECT_BRAIN_DECISION_CREATED:  'project_brain.decision_created',
  PROJECT_BRAIN_ASSUMPTION_CREATED:'project_brain.assumption_created',

  // ── Contribution events ───────────────────────────────────────────────────
  CONTRIBUTION_LOGGED: 'contribution.logged',

  // ── Team events ───────────────────────────────────────────────────────────
  TEAM_MEMBER_ADDED:        'team.member_added',
  TEAM_MEMBER_ROLE_CHANGED: 'team.member_role_changed',

  // ── System events ─────────────────────────────────────────────────────────
  SYSTEM_NOTICE: 'system.notice',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

/**
 * Visibility levels for events.
 * Controls which audience can see an event in their activity feed.
 */
export const EVENT_VISIBILITY = {
  PRIVATE:     'PRIVATE',      // Only the target user
  TEAM:        'TEAM',         // All team members
  SUPERVISOR:  'SUPERVISOR',   // Team members + supervisor
  COORDINATOR: 'COORDINATOR',  // Coordinators only
  SYSTEM:      'SYSTEM',       // All users (system-wide notices)
} as const;

export type EventVisibility = (typeof EVENT_VISIBILITY)[keyof typeof EVENT_VISIBILITY];

/**
 * Human-readable labels for event types, used in the activity feed UI.
 */
export const EVENT_LABELS: Record<EventType, string> = {
  'task.created':                    'Task created',
  'task.assigned':                   'Task assigned',
  'task.status_changed':             'Task status updated',
  'task.updated':                    'Task updated',
  'task.blocked':                    'Task blocked',
  'consultation.requested':          'Consultation requested',
  'consultation.confirmed':          'Consultation confirmed',
  'consultation.cancelled':          'Consultation cancelled',
  'meeting_notes.added':             'Meeting notes added',
  'meeting_notes.updated':           'Meeting notes updated',
  'project_brain.question_created':  'Question raised',
  'project_brain.question_resolved': 'Question resolved',
  'project_brain.decision_created':  'Decision logged',
  'project_brain.assumption_created':'Assumption recorded',
  'contribution.logged':             'Contribution logged',
  'team.member_added':               'Member added',
  'team.member_role_changed':        'Role updated',
  'system.notice':                   'System notice',
};
