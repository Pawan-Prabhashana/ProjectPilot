/**
 * Workload fairness metric.
 *
 * Extracted as a standalone module so it can be imported by both
 * lib/metrics/health.ts and lib/services/team-intelligence.ts
 * without creating a circular dependency.
 *
 * "Fair" = no single member carries more than 2× the mean open-task load.
 * This is a conservative heuristic designed to flag imbalances early,
 * particularly important for neurodivergent teams where one person
 * silently absorbing the backlog is a common failure mode.
 */

import { prisma } from '@/lib/db';

export async function isWorkloadFair(teamId: string): Promise<boolean> {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    select: { userId: true },
  });

  if (members.length === 0) return true;

  const taskCounts = await Promise.all(
    members.map(({ userId }) =>
      prisma.task.count({
        where: {
          assigneeId: userId,
          project: { teamId },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
      })
    )
  );

  const total = taskCounts.reduce((a, b) => a + b, 0);
  const mean = total / members.length;
  if (mean === 0) return true;

  return taskCounts.every((count) => count <= mean * 2);
}

export async function getWorkloadDistribution(
  teamId: string
): Promise<{ userId: string; taskCount: number; isOverloaded: boolean }[]> {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    select: { userId: true },
  });

  if (members.length === 0) return [];

  const counts = await Promise.all(
    members.map(async ({ userId }) => ({
      userId,
      taskCount: await prisma.task.count({
        where: {
          assigneeId: userId,
          project: { teamId },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
      }),
    }))
  );

  const total = counts.reduce((s, m) => s + m.taskCount, 0);
  const mean = members.length > 0 ? total / members.length : 0;

  return counts.map((m) => ({
    ...m,
    isOverloaded: mean > 0 && m.taskCount > mean * 2,
  }));
}
