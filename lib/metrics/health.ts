/**
 * Rule-based team health computation.
 *
 * The AI layer (Part 2+) will eventually feed richer signals here.
 * For now, these are deterministic rules derived from observable DB state.
 * The rules are intentionally transparent so supervisors and coordinators
 * can understand exactly why a team is flagged.
 *
 * Health levels:
 *   ON_TRACK – no overdue tasks, milestone on schedule, recent activity
 *   AT_RISK   – some overdue tasks, or no contribution activity this week
 *   CRITICAL  – heavy overdue burden, missed milestone, or multiple friction events
 */

import { prisma } from '@/lib/db';
import type { TeamHealthStatus } from '@prisma/client';
import { isWorkloadFair } from '@/lib/metrics/workload';

type HealthFactors = {
  overdueTaskCount: number;
  totalOpenTasks: number;
  activeMemberCount: number;
  hasActivityThisWeek: boolean;
  nextMilestoneIsOnTrack: boolean;
  recentFrictionEventCount: number;
};

export async function gatherHealthFactors(teamId: string): Promise<HealthFactors> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  // --- Bug fix from original code ---
  // The previous implementation used two `where` keys inside the same
  // findFirst() call, which is a JavaScript duplicate-key issue. Only the
  // second `where` was applied, meaning the team filter was silently dropped.
  // Fixed here by combining both conditions into a single `where` object.
  const [
    overdueTaskCount,
    totalOpenTasks,
    nextMilestone,
    recentActivityUserIds,
    totalMembers,
    recentFrictionEventCount,
  ] = await Promise.all([
    prisma.task.count({
      where: {
        project: { teamId },
        status: { notIn: ['DONE', 'CANCELLED'] },
        dueDate: { lt: now },
      },
    }),
    prisma.task.count({
      where: {
        project: { teamId },
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
    }),
    // Combined where: both team filter and status filter in one object
    prisma.milestone.findFirst({
      where: {
        project: { teamId },
        status: { notIn: ['COMPLETED'] },
      },
      orderBy: { dueDate: 'asc' },
    }),
    // Get unique user IDs who contributed in the last 7 days
    prisma.contributionLog.findMany({
      where: {
        project: { teamId },
        loggedAt: { gte: sevenDaysAgo },
      },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.teamMember.count({ where: { teamId } }),
    prisma.socialFrictionEvent.count({
      where: {
        teamId,
        flaggedAt: { gte: sevenDaysAgo },
        resolved: false,
      },
    }),
  ]);

  return {
    overdueTaskCount,
    totalOpenTasks,
    activeMemberCount: recentActivityUserIds.length,
    hasActivityThisWeek: recentActivityUserIds.length > 0,
    nextMilestoneIsOnTrack: nextMilestone ? nextMilestone.dueDate >= now : true,
    recentFrictionEventCount,
  };
}

export function computeHealthFromFactors(factors: HealthFactors): TeamHealthStatus {
  const {
    overdueTaskCount,
    activeMemberCount,
    totalOpenTasks,
    hasActivityThisWeek,
    nextMilestoneIsOnTrack,
    recentFrictionEventCount,
  } = factors;

  // CRITICAL: significant overdue backlog, stale team, or missed milestone with friction
  if (
    overdueTaskCount >= 4 ||
    (!hasActivityThisWeek && !nextMilestoneIsOnTrack) ||
    recentFrictionEventCount >= 3
  ) {
    return 'CRITICAL';
  }

  // AT_RISK: any overdue tasks, no recent activity, or some team friction
  if (
    overdueTaskCount > 0 ||
    !hasActivityThisWeek ||
    recentFrictionEventCount > 0 ||
    !nextMilestoneIsOnTrack
  ) {
    return 'AT_RISK';
  }

  return 'ON_TRACK';
}

export async function computeTeamHealth(teamId: string): Promise<TeamHealthStatus> {
  const factors = await gatherHealthFactors(teamId);
  return computeHealthFromFactors(factors);
}

/**
 * Compute health, persist the result to the Team record, and store
 * an append-only TeamHealthSignal snapshot for trend tracking.
 */
export async function updateTeamHealthStatus(teamId: string): Promise<TeamHealthStatus> {
  const [factors, workloadFair] = await Promise.all([
    gatherHealthFactors(teamId),
    isWorkloadFair(teamId),
  ]);
  const health = computeHealthFromFactors(factors);

  await prisma.$transaction([
    prisma.team.update({
      where: { id: teamId },
      data: { healthStatus: health },
    }),
    prisma.teamHealthSignal.create({
      data: {
        teamId,
        healthStatus: health,
        overdueTaskCount: factors.overdueTaskCount,
        totalOpenTasks: factors.totalOpenTasks,
        activeMemberCount: factors.activeMemberCount,
        hasActivityThisWeek: factors.hasActivityThisWeek,
        nextMilestoneIsOnTrack: factors.nextMilestoneIsOnTrack,
        workloadIsFair: workloadFair,
      },
    }),
  ]);

  return health;
}
