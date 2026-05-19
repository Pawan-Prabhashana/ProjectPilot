/**
 * Team Health Score — Academic Project Progress Metric
 *
 * Estimates whether the team is progressing safely towards its goals.
 * This is an operational health indicator based on observable task and
 * activity data. It does NOT use private cognitive profile data.
 *
 * Formula (subtractive from 100, clamped to 0–100):
 *   Start: 100
 *   −8  per overdue task            (max −32)
 *   −10 per blocked task            (max −30)
 *   −5  per unassigned active task  (max −20)
 *   −4  per high-priority open question (max −20)
 *   −10 if no team activity this week
 *   −10 if next milestone is at risk
 *   −8  if no consultation scheduled and 3+ open questions
 *   +3  per task completed this week (max +12)
 *   +5  if consultation is soon and open questions exist
 *   +5  if every active task has an assignee
 *
 * Status thresholds:
 *   85–100 = LOW risk (Healthy)
 *   70–84  = BALANCED (Stable)
 *   50–69  = WATCH
 *   30–49  = HIGH (At Risk)
 *   0–29   = CRITICAL
 */

import { prisma } from '@/lib/db';
import type { ExplainableScore, ScoreFactor, ScoreStatus } from './types';

function classifyStatus(score: number): ScoreStatus {
  if (score >= 85) return 'LOW';        // Healthy
  if (score >= 70) return 'BALANCED';   // Stable
  if (score >= 50) return 'WATCH';
  if (score >= 30) return 'HIGH';       // At Risk
  return 'CRITICAL';
}

const STATUS_LABEL: Record<ScoreStatus, string> = {
  LOW:      'Healthy',
  BALANCED: 'Stable',
  WATCH:    'Watch',
  HIGH:     'At Risk',
  CRITICAL: 'Critical',
  UNKNOWN:  'Unknown',
};

function buildRecommendation(status: ScoreStatus, blockedCount: number,
  overdueCount: number, unassignedCount: number): string {
  if (status === 'CRITICAL') {
    return 'Escalate immediately. Hold an emergency blocker check-in and request supervisor guidance.';
  }
  if (status === 'HIGH') {
    if (blockedCount > 0) return 'Resolve the most critical blocker first. Run a 15-minute check-in with the team.';
    if (overdueCount > 0) return 'Triage overdue tasks. Mark unrealistic ones as cancelled and reschedule the rest.';
    return 'Run a short blocker check-in and reassign any unowned work before the next milestone.';
  }
  if (status === 'WATCH') {
    if (unassignedCount > 0) return 'Assign owners to unassigned tasks so no work falls through the cracks.';
    return 'Review task priorities and ensure every member has clear next steps.';
  }
  if (status === 'BALANCED') {
    return 'Continue current pace. Log contributions regularly to keep progress visible.';
  }
  return 'The team is healthy. Use this window to prepare for upcoming milestones.';
}

export async function calculateTeamHealthScore(teamId: string): Promise<ExplainableScore> {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo     = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const calculatedAt     = now.toISOString();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { project: { select: { id: true } } },
  });
  const projectId = team?.project?.id;

  if (!projectId) {
    return {
      key: 'team_health',
      label: 'Team Health',
      score: null,
      maxScore: 100,
      status: 'UNKNOWN',
      summary: 'No project is linked to this team yet. Health cannot be assessed.',
      factors: [],
      dataSources: [],
      recommendedAction: 'Link a project to the team to start tracking health.',
      confidence: 'LOW',
      calculatedAt,
    };
  }

  const [
    activeTasks,
    completedThisWeek,
    recentActivity,
    nextMilestone,
    openQuestions,
    upcomingConsultation,
    memberCount,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { projectId, status: { notIn: ['DONE', 'CANCELLED'] } },
      select: { id: true, assigneeId: true, blockerNote: true, dueDate: true, priority: true },
    }),
    prisma.task.count({
      where: { projectId, status: 'DONE', updatedAt: { gte: sevenDaysAgo } },
    }),
    prisma.contributionLog.count({
      where: { projectId, loggedAt: { gte: sevenDaysAgo } },
    }),
    prisma.milestone.findFirst({
      where: { projectId, status: { notIn: ['COMPLETED'] } },
      orderBy: { dueDate: 'asc' },
      select: { dueDate: true, title: true },
    }),
    prisma.openQuestion.count({
      where: { projectId, resolvedAt: null },
    }),
    prisma.consultationBooking.findFirst({
      where: { teamId, status: 'CONFIRMED', slotStart: { gte: now } },
      orderBy: { slotStart: 'asc' },
      select: { slotStart: true },
    }),
    prisma.teamMember.count({ where: { teamId } }),
  ]);

  const overdueCount    = activeTasks.filter((t) => t.dueDate && t.dueDate < now).length;
  const blockedCount    = activeTasks.filter((t) => !!t.blockerNote).length;
  const unassignedCount = activeTasks.filter((t) => !t.assigneeId).length;
  const allAssigned     = activeTasks.length > 0 && unassignedCount === 0;
  const hasActivityThisWeek    = recentActivity > 0;
  const milestoneAtRisk = nextMilestone
    ? nextMilestone.dueDate < sevenDaysFromNow
    : false;
  const consultationSoon = upcomingConsultation
    ? upcomingConsultation.slotStart <= threeDaysFromNow
    : false;
  const highPriorityQuestions = await prisma.openQuestion.count({
    where: { projectId, resolvedAt: null, priority: { in: ['HIGH', 'URGENT'] } },
  });

  let raw = 100;
  const factors: ScoreFactor[] = [];

  // ── Overdue tasks ──────────────────────────────────────────────────────────
  if (overdueCount > 0) {
    const deduction = Math.min(overdueCount * 8, 32);
    raw -= deduction;
    factors.push({
      label: 'Overdue tasks',
      value: overdueCount,
      impact: 'negative',
      weight: deduction,
      explanation: `${overdueCount} task${overdueCount !== 1 ? 's are' : ' is'} past the due date, indicating the team is falling behind its planned pace.`,
    });
  }

  // ── Blocked tasks ──────────────────────────────────────────────────────────
  if (blockedCount > 0) {
    const deduction = Math.min(blockedCount * 10, 30);
    raw -= deduction;
    factors.push({
      label: 'Blocked tasks',
      value: blockedCount,
      impact: 'negative',
      weight: deduction,
      explanation: `${blockedCount} task${blockedCount !== 1 ? 's have' : ' has'} an active blocker. Blocked tasks can create downstream delays.`,
    });
  }

  // ── Unassigned tasks ───────────────────────────────────────────────────────
  if (unassignedCount > 0) {
    const deduction = Math.min(unassignedCount * 5, 20);
    raw -= deduction;
    factors.push({
      label: 'Unassigned active tasks',
      value: unassignedCount,
      impact: 'negative',
      weight: deduction,
      explanation: `${unassignedCount} active task${unassignedCount !== 1 ? 's have' : ' has'} no assigned owner. Ownerless tasks are the most common source of invisible missed work.`,
    });
  }

  // ── High-priority open questions ───────────────────────────────────────────
  if (highPriorityQuestions > 0) {
    const deduction = Math.min(highPriorityQuestions * 4, 20);
    raw -= deduction;
    factors.push({
      label: 'High-priority unresolved questions',
      value: highPriorityQuestions,
      impact: 'negative',
      weight: deduction,
      explanation: `${highPriorityQuestions} high/urgent question${highPriorityQuestions !== 1 ? 's remain' : ' remains'} unresolved. Open decisions block implementation.`,
    });
  }

  // ── No activity this week ──────────────────────────────────────────────────
  if (!hasActivityThisWeek && activeTasks.length > 0) {
    raw -= 10;
    factors.push({
      label: 'No contributions this week',
      value: 'None logged',
      impact: 'negative',
      weight: 10,
      explanation: 'No contribution logs in the past 7 days. This may mean work is happening but not being recorded, or the team is stalled.',
    });
  }

  // ── Milestone at risk ──────────────────────────────────────────────────────
  if (milestoneAtRisk && nextMilestone) {
    raw -= 10;
    factors.push({
      label: 'Milestone due within 7 days',
      value: nextMilestone.title,
      impact: 'negative',
      weight: 10,
      explanation: `Upcoming milestone "${nextMilestone.title}" is due within 7 days. Close deadline with open tasks increases delivery risk.`,
    });
  }

  // ── No consultation and many open questions ────────────────────────────────
  if (!upcomingConsultation && openQuestions >= 3) {
    raw -= 8;
    factors.push({
      label: 'No consultation scheduled',
      value: `${openQuestions} open questions`,
      impact: 'negative',
      weight: 8,
      explanation: `${openQuestions} open questions with no upcoming supervisor consultation scheduled to address them.`,
    });
  }

  // ── Recent completions (positive) ─────────────────────────────────────────
  if (completedThisWeek > 0) {
    const bonus = Math.min(completedThisWeek * 3, 12);
    raw += bonus;
    factors.push({
      label: 'Tasks completed this week',
      value: completedThisWeek,
      impact: 'positive',
      weight: bonus,
      explanation: `${completedThisWeek} task${completedThisWeek !== 1 ? 's' : ''} completed in the last 7 days. Recent progress is a strong positive signal.`,
    });
  }

  // ── Consultation soon and open questions (positive) ────────────────────────
  if (consultationSoon && openQuestions > 0) {
    raw += 5;
    factors.push({
      label: 'Consultation soon with open questions',
      value: 'Scheduled',
      impact: 'positive',
      weight: 5,
      explanation: 'An upcoming consultation provides an opportunity to resolve open questions and unblock work.',
    });
  }

  // ── All tasks assigned (positive) ─────────────────────────────────────────
  if (allAssigned) {
    raw += 5;
    factors.push({
      label: 'All tasks have an owner',
      value: activeTasks.length,
      impact: 'positive',
      weight: 5,
      explanation: 'Every active task has an assigned team member. Clear ownership reduces invisible risk.',
    });
  }

  const score  = Math.max(0, Math.min(100, Math.round(raw)));
  const status = classifyStatus(score);

  const confidence: ExplainableScore['confidence'] =
    activeTasks.length >= 5 ? 'HIGH'
    : activeTasks.length >= 2 ? 'MEDIUM'
    : 'LOW';

  const summary = buildSummary(status, overdueCount, blockedCount, completedThisWeek,
    hasActivityThisWeek, unassignedCount);

  return {
    key: 'team_health',
    label: 'Team Health',
    score,
    maxScore: 100,
    status,
    summary,
    factors: factors.sort((a, b) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0)),
    dataSources: ['Tasks', 'Task due dates', 'Task status', 'Contribution logs', 'Milestones', 'Project Brain questions', 'Consultations'],
    recommendedAction: buildRecommendation(status, blockedCount, overdueCount, unassignedCount),
    confidence,
    calculatedAt,
  };
}

function buildSummary(
  status: ScoreStatus,
  overdueCount: number,
  blockedCount: number,
  completedThisWeek: number,
  hasActivity: boolean,
  unassignedCount: number
): string {
  const negatives: string[] = [];
  if (overdueCount > 0) negatives.push(`${overdueCount} overdue task${overdueCount !== 1 ? 's' : ''}`);
  if (blockedCount > 0) negatives.push(`${blockedCount} blocked task${blockedCount !== 1 ? 's' : ''}`);
  if (!hasActivity)     negatives.push('no logged activity this week');
  if (unassignedCount > 0) negatives.push(`${unassignedCount} unassigned task${unassignedCount !== 1 ? 's' : ''}`);

  const positives: string[] = [];
  if (completedThisWeek > 0) positives.push(`${completedThisWeek} completed this week`);

  if (negatives.length === 0 && positives.length === 0) {
    return `Team health is ${STATUS_LABEL[status]}. No significant risk signals detected.`;
  }

  const parts: string[] = [];
  if (negatives.length > 0) parts.push(`${negatives.join(', ')}`);
  if (positives.length > 0) parts.push(`but ${positives.join(', ')}`);

  return `Team health is ${STATUS_LABEL[status]} — ${parts.join(' ')}.`;
}
