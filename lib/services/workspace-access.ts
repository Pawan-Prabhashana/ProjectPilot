/**
 * Workspace Access Service
 *
 * Provides the current user's accessible workspaces (teams + projects).
 * This replaces the unsafe findFirst() team lookup pattern used across
 * dashboard pages, which breaks when a user belongs to multiple teams.
 *
 * For STUDENT:      returns teams where they are a TeamMember
 * For SUPERVISOR:   returns teams where Team.supervisorId = SupervisorProfile.id
 * For COORDINATOR:  returns all teams
 */

import { prisma } from '@/lib/db';
import type { AuthenticatedUser } from '@/lib/rbac';

export type AccessibleWorkspace = {
  teamId: string;
  teamName: string;
  teamSlug: string;
  projectId: string | null;
  projectTitle: string | null;
  healthStatus: string;
  /** The user's capability within this workspace. */
  userCapability: 'MEMBER' | 'LEADER' | 'CO_LEADER' | 'SUPERVISOR' | 'COORDINATOR';
  isLeader: boolean;
  isSupervisor: boolean;
  isCoordinator: boolean;
};

/**
 * Returns all workspaces accessible to the given user.
 */
export async function getAccessibleWorkspacesForUser(
  user: AuthenticatedUser
): Promise<AccessibleWorkspace[]> {
  if (user.role === 'STUDENT') {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: user.id },
      include: {
        team: {
          include: { project: { select: { id: true, title: true } } },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => {
      const capability = normalizeRole(m.role as string);
      return {
        teamId: m.team.id,
        teamName: m.team.name,
        teamSlug: m.team.slug,
        projectId: m.team.project?.id ?? null,
        projectTitle: m.team.project?.title ?? null,
        healthStatus: m.team.healthStatus,
        userCapability: capability,
        isLeader: capability === 'LEADER' || capability === 'CO_LEADER',
        isSupervisor: false,
        isCoordinator: false,
      };
    });
  }

  if (user.role === 'SUPERVISOR') {
    const profile = await prisma.supervisorProfile.findUnique({
      where: { userId: user.id },
      include: {
        supervisedTeams: {
          include: { project: { select: { id: true, title: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!profile) return [];

    return profile.supervisedTeams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      teamSlug: team.slug,
      projectId: team.project?.id ?? null,
      projectTitle: team.project?.title ?? null,
      healthStatus: team.healthStatus,
      userCapability: 'SUPERVISOR' as const,
      isLeader: false,
      isSupervisor: true,
      isCoordinator: false,
    }));
  }

  // COORDINATOR: all teams
  const teams = await prisma.team.findMany({
    include: { project: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return teams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    teamSlug: team.slug,
    projectId: team.project?.id ?? null,
    projectTitle: team.project?.title ?? null,
    healthStatus: team.healthStatus,
    userCapability: 'COORDINATOR' as const,
    isLeader: false,
    isSupervisor: false,
    isCoordinator: true,
  }));
}

/**
 * Resolves the active workspace for a user.
 *
 * Priority:
 *   1. requestedTeamId from searchParams (validated against accessible workspaces)
 *   2. First accessible workspace
 *   3. null if no accessible workspaces
 */
export async function resolveActiveWorkspace(
  user: AuthenticatedUser,
  requestedTeamId?: string
): Promise<AccessibleWorkspace | null> {
  const workspaces = await getAccessibleWorkspacesForUser(user);
  if (workspaces.length === 0) return null;

  if (requestedTeamId) {
    const found = workspaces.find((w) => w.teamId === requestedTeamId);
    if (found) return found;
  }

  return workspaces[0];
}

/**
 * Normalises a TeamMember.role string to a typed capability.
 * Accepts both old string values ("lead", "co-lead") and new enum values.
 */
function normalizeRole(role: string): 'MEMBER' | 'LEADER' | 'CO_LEADER' {
  const upper = role.toUpperCase().replace('-', '_');
  if (upper === 'LEADER' || upper === 'LEAD') return 'LEADER';
  if (upper === 'CO_LEADER' || upper === 'CO_LEAD') return 'CO_LEADER';
  return 'MEMBER';
}
