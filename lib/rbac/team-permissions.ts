/**
 * Team-level permission helpers.
 *
 * These complement the global role checks in lib/rbac/index.ts with
 * fine-grained team/capability checks that understand the difference
 * between global account roles (User.role) and team capabilities
 * (TeamMember.role).
 *
 * KEY RULE: Team.supervisorId references SupervisorProfile.id, NOT User.id.
 * All supervisor checks MUST go through SupervisorProfile.
 *
 * Global roles:
 *   STUDENT     — can view/interact with their own team
 *   SUPERVISOR  — can view teams where SupervisorProfile.id === Team.supervisorId
 *   COORDINATOR — can view/manage everything
 *
 * Team capabilities (TeamMember.role):
 *   MEMBER     — standard student; view + own-task updates
 *   LEADER     — student with team management capabilities
 *   CO_LEADER  — student with partial leader capabilities
 */

import { prisma } from '@/lib/db';
import type { AuthenticatedUser } from '@/lib/rbac';

// ── Global role predicates ────────────────────────────────────────────────────

export function isStudent(user: AuthenticatedUser): boolean {
  return user.role === 'STUDENT';
}

export function isSupervisor(user: AuthenticatedUser): boolean {
  return user.role === 'SUPERVISOR';
}

export function isCoordinator(user: AuthenticatedUser): boolean {
  return user.role === 'COORDINATOR';
}

// ── Profile lookups ───────────────────────────────────────────────────────────

/**
 * Returns the SupervisorProfile for a given userId, or null.
 * Use this whenever you need to compare against Team.supervisorId.
 */
export async function getSupervisorProfileForUser(userId: string) {
  return prisma.supervisorProfile.findUnique({ where: { userId } });
}

export async function getStudentProfileForUser(userId: string) {
  return prisma.studentProfile.findUnique({ where: { userId } });
}

// ── Team membership helpers ───────────────────────────────────────────────────

export async function getTeamMembership(userId: string, teamId: string) {
  return prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
}

export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  const m = await getTeamMembership(userId, teamId);
  return m !== null;
}

export async function isTeamLeader(userId: string, teamId: string): Promise<boolean> {
  const m = await getTeamMembership(userId, teamId);
  return m?.role === 'LEADER';
}

export async function isTeamCoLeader(userId: string, teamId: string): Promise<boolean> {
  const m = await getTeamMembership(userId, teamId);
  return m?.role === 'CO_LEADER';
}

/**
 * Returns true if the user has LEADER or CO_LEADER role in the given team.
 */
export async function hasLeaderCapability(userId: string, teamId: string): Promise<boolean> {
  const m = await getTeamMembership(userId, teamId);
  return m?.role === 'LEADER' || m?.role === 'CO_LEADER';
}

/**
 * Returns true if the user is a LEADER or CO_LEADER in ANY of their teams.
 * Used by DashboardShell to decide whether to show leader nav items.
 */
export async function hasAnyLeaderCapability(userId: string): Promise<boolean> {
  const count = await prisma.teamMember.count({
    where: { userId, role: { in: ['LEADER', 'CO_LEADER'] } },
  });
  return count > 0;
}

// ── Team access checks ────────────────────────────────────────────────────────

/**
 * A user can VIEW a team if:
 *   STUDENT    → they are a team member
 *   SUPERVISOR → their SupervisorProfile.id matches Team.supervisorId
 *   COORDINATOR → always
 */
export async function canViewTeam(user: AuthenticatedUser, teamId: string): Promise<boolean> {
  if (user.role === 'COORDINATOR') return true;
  if (user.role === 'STUDENT') return isTeamMember(user.id, teamId);
  if (user.role === 'SUPERVISOR') {
    const profile = await getSupervisorProfileForUser(user.id);
    if (!profile) return false;
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { supervisorId: true },
    });
    return team?.supervisorId === profile.id;
  }
  return false;
}

/**
 * A user can MANAGE a team (create tasks, assign, etc.) if:
 *   STUDENT    → LEADER or CO_LEADER in that team
 *   SUPERVISOR → supervises that team
 *   COORDINATOR → always
 */
export async function canManageTeam(user: AuthenticatedUser, teamId: string): Promise<boolean> {
  if (user.role === 'COORDINATOR') return true;
  if (user.role === 'SUPERVISOR') {
    const profile = await getSupervisorProfileForUser(user.id);
    if (!profile) return false;
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { supervisorId: true },
    });
    return team?.supervisorId === profile.id;
  }
  if (user.role === 'STUDENT') return hasLeaderCapability(user.id, teamId);
  return false;
}

/**
 * Can create tasks for this team.
 * LEADER / CO_LEADER / SUPERVISOR (of team) / COORDINATOR
 */
export async function canCreateTask(user: AuthenticatedUser, teamId: string): Promise<boolean> {
  return canManageTeam(user, teamId);
}

/**
 * Can assign tasks for this team.
 * Same as canCreateTask.
 */
export async function canAssignTask(user: AuthenticatedUser, teamId: string): Promise<boolean> {
  return canManageTeam(user, teamId);
}

/**
 * Can update a specific task.
 * Assignee can update their own task; leaders/supervisors/coordinators can update any task.
 */
export async function canUpdateTask(user: AuthenticatedUser, taskId: string): Promise<boolean> {
  if (user.role === 'COORDINATOR') return true;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { include: { team: { select: { id: true, supervisorId: true } } } },
    },
  });
  if (!task) return false;

  const teamId = task.project.team.id;

  if (user.role === 'SUPERVISOR') {
    const profile = await getSupervisorProfileForUser(user.id);
    return profile !== null && task.project.team.supervisorId === profile.id;
  }

  if (user.role === 'STUDENT') {
    if (task.assigneeId === user.id) return true;
    return hasLeaderCapability(user.id, teamId);
  }

  return false;
}

/**
 * Can view a project (delegates to canViewTeam via project.teamId).
 */
export async function canViewProject(user: AuthenticatedUser, projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { teamId: true },
  });
  if (!project) return false;
  return canViewTeam(user, project.teamId);
}

/**
 * Supervisor-specific check: can the supervisor view this team?
 * Uses SupervisorProfile.id — NOT User.id.
 */
export async function canViewSupervisorTeam(
  user: AuthenticatedUser,
  teamId: string
): Promise<boolean> {
  if (user.role === 'COORDINATOR') return true;
  if (user.role !== 'SUPERVISOR') return false;
  const profile = await getSupervisorProfileForUser(user.id);
  if (!profile) return false;
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { supervisorId: true },
  });
  return team?.supervisorId === profile.id;
}

// ── Throwing access guards ────────────────────────────────────────────────────

export async function requireTeamAccess(
  user: AuthenticatedUser,
  teamId: string
): Promise<void> {
  const ok = await canViewTeam(user, teamId);
  if (!ok) throw new Error('Access denied: you do not have access to this team.');
}

export async function requireTeamLeaderAccess(
  user: AuthenticatedUser,
  teamId: string
): Promise<void> {
  const ok = await canManageTeam(user, teamId);
  if (!ok) throw new Error('Access denied: leader or supervisor access required.');
}

/**
 * Asserts that the user supervises the given team.
 * CRITICAL: uses SupervisorProfile.id, not User.id.
 */
export async function requireSupervisorAccessToTeam(
  user: AuthenticatedUser,
  teamId: string
): Promise<void> {
  if (user.role === 'COORDINATOR') return;
  if (user.role !== 'SUPERVISOR') {
    throw new Error('Access denied: supervisor access required.');
  }
  const profile = await getSupervisorProfileForUser(user.id);
  if (!profile) throw new Error('Supervisor profile not found.');
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { supervisorId: true },
  });
  if (team?.supervisorId !== profile.id) {
    throw new Error('Access denied: you do not supervise this team.');
  }
}
