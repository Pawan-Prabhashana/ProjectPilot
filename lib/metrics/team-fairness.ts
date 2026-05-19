/**
 * Team Fairness Score — Visible Workload Distribution Metric
 *
 * Shows whether work appears balanced across the team based on observable
 * task and contribution data.
 *
 * Important framing:
 * - This does NOT accuse anyone of underperforming.
 * - Imbalances often reflect hidden work, different task sizes, or poor visibility.
 * - The language is careful and non-stigmatising.
 * - Low confidence is flagged when contribution logs are sparse.
 *
 * Formula:
 * 1. Calculate per-member: active tasks, overdue tasks, completed this week,
 *    contribution log count, estimated hours.
 * 2. Start from 100.
 * 3. Subtract for distribution imbalance:
 *    - If one member owns >50% of active tasks: −25
 *    - For each member with >1.75× mean active tasks: −10 (max −30)
 *    - If one member has most overdue work: −10
 * 4. Add for good signals:
 *    - If every member has at least one task: +5
 *    - If contribution logs are roughly balanced: +5
 * 5. Clamp to 0–100.
 * 6. Reduce confidence if total contribution logs < memberCount × 2.
 *
 * Status thresholds:
 *   85–100 = LOW (Balanced)
 *   70–84  = BALANCED (Low concern)
 *   50–69  = WATCH
 *   30–49  = HIGH (Visible imbalance)
 *   0–29   = CRITICAL (Severe imbalance)
 */

import { prisma } from '@/lib/db';
import type { ExplainableScore, ScoreFactor, ScoreStatus, FairnessMemberSnapshot } from './types';

function classifyStatus(score: number): ScoreStatus {
  if (score >= 85) return 'LOW';
  if (score >= 70) return 'BALANCED';
  if (score >= 50) return 'WATCH';
  if (score >= 30) return 'HIGH';
  return 'CRITICAL';
}

const STATUS_LABEL: Record<ScoreStatus, string> = {
  LOW:      'Balanced',
  BALANCED: 'Low concern',
  WATCH:    'Watch',
  HIGH:     'Visible imbalance',
  CRITICAL: 'Severe imbalance',
  UNKNOWN:  'Unknown',
};

function buildRecommendation(status: ScoreStatus, sparseData: boolean): string {
  if (sparseData) {
    return 'Ask all team members to log their contributions, including hidden work like meetings and reviews, before reassigning tasks.';
  }
  if (status === 'CRITICAL' || status === 'HIGH') {
    return 'Review task assignments as a team. Consider redistributing 1–2 tasks from the most loaded member. Hidden work may not be fully visible — ask members to log it.';
  }
  if (status === 'WATCH') {
    return 'Monitor closely. Check whether the imbalance reflects task size differences or genuinely unequal workload.';
  }
  if (status === 'BALANCED') {
    return 'Distribution looks acceptable. Continue logging contributions to maintain visibility.';
  }
  return 'Workload appears well distributed. Keep logging contributions to maintain this transparency.';
}

export type TeamFairnessResult = {
  score: ExplainableScore;
  memberSnapshots: FairnessMemberSnapshot[];
  sparseContributionData: boolean;
};

export async function calculateTeamFairnessScore(
  teamId: string
): Promise<TeamFairnessResult> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const calculatedAt = now.toISOString();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      project: { select: { id: true } },
      members: { select: { user: { select: { id: true, name: true } } } },
    },
  });

  const projectId  = team?.project?.id;
  const rawMembers = team?.members ?? [];

  if (!projectId || rawMembers.length === 0) {
    const emptyScore: ExplainableScore = {
      key: 'team_fairness',
      label: 'Team Fairness',
      score: null,
      maxScore: 100,
      status: 'UNKNOWN',
      summary: projectId
        ? 'No team members found.'
        : 'No project linked to this team.',
      factors: [],
      dataSources: [],
      recommendedAction: 'Set up the team with members and a linked project.',
      confidence: 'LOW',
      calculatedAt,
    };
    return { score: emptyScore, memberSnapshots: [], sparseContributionData: true };
  }

  // Fetch per-member task stats in parallel
  const memberData = await Promise.all(
    rawMembers.map(async ({ user }) => {
      const [activeTasks, overdueTasks, completedThisWeek, contribCount, estimateResult] =
        await Promise.all([
          prisma.task.count({
            where: { projectId, assigneeId: user.id, status: { notIn: ['DONE', 'CANCELLED'] } },
          }),
          prisma.task.count({
            where: { projectId, assigneeId: user.id, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { lt: now } },
          }),
          prisma.task.count({
            where: { projectId, assigneeId: user.id, status: 'DONE', updatedAt: { gte: sevenDaysAgo } },
          }),
          prisma.contributionLog.count({
            where: { projectId, userId: user.id },
          }),
          prisma.task.aggregate({
            where: { projectId, assigneeId: user.id, status: { notIn: ['DONE', 'CANCELLED'] }, estimatedMinutes: { not: null } },
            _sum: { estimatedMinutes: true },
          }),
        ]);
      return {
        userId: user.id,
        name: user.name,
        activeTasks,
        overdueTasks,
        completedThisWeek,
        contributionLogs: contribCount,
        estimatedHoursRemaining: Math.round((estimateResult._sum.estimatedMinutes ?? 0) / 60),
      };
    })
  );

  const totalActiveTasks = memberData.reduce((s, m) => s + m.activeTasks, 0);
  const memberCount = rawMembers.length;
  const meanActiveTasks = memberCount > 0 ? totalActiveTasks / memberCount : 0;

  // Sparse data check
  const totalContribs = memberData.reduce((s, m) => s + m.contributionLogs, 0);
  const sparseContributionData = totalContribs < memberCount * 2;

  // Build snapshots
  const snapshots: FairnessMemberSnapshot[] = memberData.map((m) => ({
    userId: m.userId,
    name: m.name,
    activeTasks: m.activeTasks,
    overdueTasks: m.overdueTasks,
    completedThisWeek: m.completedThisWeek,
    contributionLogs: m.contributionLogs,
    estimatedHoursRemaining: m.estimatedHoursRemaining,
    shareOfTeamWork: totalActiveTasks > 0 ? m.activeTasks / totalActiveTasks : 0,
    isConcentrated: meanActiveTasks > 0 && m.activeTasks > meanActiveTasks * 1.75,
  }));

  // ── Score calculation ──────────────────────────────────────────────────────
  let raw = 100;
  const factors: ScoreFactor[] = [];

  // One member owns >50% of active tasks
  const dominantMember = snapshots.find((m) => m.shareOfTeamWork > 0.5);
  if (dominantMember && memberCount > 1 && totalActiveTasks > 2) {
    raw -= 25;
    factors.push({
      label: 'One member carries majority of work',
      value: `${Math.round(dominantMember.shareOfTeamWork * 100)}% visible tasks`,
      impact: 'negative',
      weight: 25,
      explanation: `${dominantMember.name ?? 'One member'} has ${Math.round(dominantMember.shareOfTeamWork * 100)}% of the visible task load. Hidden work may not be fully captured in these logs.`,
    });
  }

  // Members with >1.75× mean load
  const concentratedMembers = snapshots.filter((m) => m.isConcentrated);
  if (concentratedMembers.length > 0 && memberCount > 1) {
    const deduction = Math.min(concentratedMembers.length * 10, 30);
    raw -= deduction;
    factors.push({
      label: 'Concentrated task load',
      value: `${concentratedMembers.length} member${concentratedMembers.length !== 1 ? 's' : ''}`,
      impact: 'negative',
      weight: deduction,
      explanation: `${concentratedMembers.length} member${concentratedMembers.length !== 1 ? 's are' : ' is'} carrying more than 1.75× the team average of ${meanActiveTasks.toFixed(1)} tasks. This may need attention.`,
    });
  }

  // One member has most overdue work
  const mostOverdue = snapshots.reduce((max, m) => m.overdueTasks > max.overdueTasks ? m : max, snapshots[0]);
  if (mostOverdue && mostOverdue.overdueTasks >= 2 && memberCount > 1) {
    raw -= 10;
    factors.push({
      label: 'Overdue work concentrated',
      value: `${mostOverdue.overdueTasks} overdue`,
      impact: 'negative',
      weight: 10,
      explanation: `${mostOverdue.name ?? 'One member'} has ${mostOverdue.overdueTasks} overdue tasks — more than others. This may indicate a bottleneck or capacity problem.`,
    });
  }

  // Every member has at least one task (positive signal)
  const membersWithTasks = snapshots.filter((m) => m.activeTasks > 0).length;
  if (membersWithTasks === memberCount && memberCount > 1) {
    raw += 5;
    factors.push({
      label: 'All members have active work',
      value: memberCount,
      impact: 'positive',
      weight: 5,
      explanation: 'Every team member has at least one active task. Visible engagement is distributed.',
    });
  }

  // Contribution logs roughly balanced (no one has zero if others have many)
  const contribCounts = memberData.map((m) => m.contributionLogs);
  const maxContribs = Math.max(...contribCounts, 0);
  const minContribs = Math.min(...contribCounts, 0);
  if (maxContribs > 0 && memberCount > 1 && (maxContribs - minContribs) <= maxContribs * 0.5) {
    raw += 5;
    factors.push({
      label: 'Contributions reasonably distributed',
      value: 'Balanced',
      impact: 'positive',
      weight: 5,
      explanation: 'Contribution logs are spread reasonably across the team, suggesting no member is invisible.',
    });
  }

  // Sparse data warning
  if (sparseContributionData) {
    factors.push({
      label: 'Limited contribution data',
      value: `${totalContribs} log${totalContribs !== 1 ? 's' : ''} for ${memberCount} members`,
      impact: 'neutral',
      explanation: 'Contribution logs are sparse. Hidden work (meetings, reviews, coordination) may not be fully captured, meaning the score may understate fairness.',
    });
  }

  const score  = Math.max(0, Math.min(100, Math.round(raw)));
  const status = classifyStatus(score);

  const summary = buildSummary(status, concentratedMembers, meanActiveTasks,
    dominantMember, sparseContributionData, memberCount);

  const confidence: ExplainableScore['confidence'] = sparseContributionData ? 'LOW'
    : totalActiveTasks >= 3 ? 'HIGH' : 'MEDIUM';

  return {
    score: {
      key: 'team_fairness',
      label: 'Team Fairness',
      score,
      maxScore: 100,
      status,
      summary,
      factors: factors.sort((a, b) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0)),
      dataSources: ['Active tasks per member', 'Overdue tasks per member', 'Completed tasks', 'Contribution logs', 'Estimated hours'],
      recommendedAction: buildRecommendation(status, sparseContributionData),
      confidence,
      calculatedAt,
    },
    memberSnapshots: snapshots,
    sparseContributionData,
  };
}

function buildSummary(
  status: ScoreStatus,
  concentrated: FairnessMemberSnapshot[],
  mean: number,
  dominant: FairnessMemberSnapshot | undefined,
  sparseData: boolean,
  memberCount: number
): string {
  if (memberCount <= 1) return 'Only one member in the team — fairness assessment requires multiple members.';

  const parts: string[] = [];

  if (dominant && dominant.shareOfTeamWork > 0.5) {
    parts.push(`${dominant.name ?? 'one member'} holds ${Math.round(dominant.shareOfTeamWork * 100)}% of visible tasks`);
  } else if (concentrated.length > 0) {
    parts.push(`${concentrated.length} member${concentrated.length !== 1 ? 's are' : ' is'} carrying significantly more than the team average of ${mean.toFixed(1)} tasks`);
  }

  if (sparseData) {
    parts.push('contribution logs are limited so hidden work may not be fully captured');
  }

  if (parts.length === 0) {
    return `Visible workload is ${STATUS_LABEL[status]}. Task distribution looks reasonable across the team.`;
  }

  return `Visible workload is in ${STATUS_LABEL[status]} because ${parts.join(', ')}.`;
}
