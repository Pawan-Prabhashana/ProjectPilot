/**
 * Cognitive Load Score — Personal Workload Pressure Metric
 *
 * Estimates how mentally demanding the current assignment is for an
 * individual student. This is an ACADEMIC WORKLOAD measure, not a
 * medical or psychological assessment.
 *
 * Formula (additive, clamped to 0–100):
 *   +8  per overdue assigned task
 *   +5  per task due within 3 days
 *   +4  per active high-priority (HIGH/URGENT) task
 *   +6  per blocked assigned task
 *   +3  per ambiguous assigned task (no description / no done criteria)
 *   +5  if a consultation is within 3 days
 *   +2  per unresolved open project question
 *   +cognitiveLoad weight if set on the task (scaled as: value × 2)
 *   -5  if no URGENT tasks are assigned (breathing room)
 *   -3  per task completed in last 7 days (max −12)
 */

import { prisma } from '@/lib/db';
import type { ExplainableScore, ScoreFactor, ScoreStatus } from './types';

const VAGUE_TERMS = [
  'improve', 'fix', 'handle', 'update', 'make better', 'do research',
  'complete soon', 'work on', 'polish', 'check', 'prepare', 'finalize',
  'stuff', 'etc', 'review',
];

function hasVagueTerms(text: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return VAGUE_TERMS.some((t) => lower.includes(t));
}

function classifyStatus(score: number): ScoreStatus {
  if (score <= 24) return 'LOW';
  if (score <= 49) return 'BALANCED';
  if (score <= 69) return 'WATCH';
  if (score <= 84) return 'HIGH';
  return 'CRITICAL';
}

function buildRecommendation(status: ScoreStatus): string {
  switch (status) {
    case 'LOW':
      return 'Use this as a good time to handle one medium-effort task and make solid progress.';
    case 'BALANCED':
      return 'Continue with the next planned task and keep your updates visible to the team.';
    case 'WATCH':
      return 'Choose one safe next step and avoid picking up new work today. Focus on reducing overdue items first.';
    case 'HIGH':
      return 'Split the most urgent task into a single 10-minute first step and complete just that. Ask for help if blocked.';
    case 'CRITICAL':
      return 'Use overload rescue mode. Pick one task only. Ask your team leader or supervisor for clarification on priorities.';
    default:
      return 'Log some tasks or complete your team setup to get a workload reading.';
  }
}

/**
 * Calculates a cognitive load score for a specific student within a team.
 *
 * @param userId   The student's User.id
 * @param teamId   The team context (determines which project tasks to check)
 */
export async function calculateCognitiveLoadScore(
  userId: string,
  teamId: string
): Promise<ExplainableScore> {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const calculatedAt = now.toISOString();

  // Find the project for this team
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { project: { select: { id: true } } },
  });
  const projectId = team?.project?.id;

  if (!projectId) {
    return buildLowConfidenceScore('cognitive_load', 'Cognitive Load', calculatedAt,
      'No project is linked to this team yet.');
  }

  // Fetch assigned tasks
  const [activeTasks, recentlyCompleted, upcomingConsultation, openQuestions] =
    await Promise.all([
      prisma.task.findMany({
        where: {
          projectId,
          assigneeId: userId,
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
        select: {
          id: true, title: true, description: true, doneCriteria: true,
          blockerNote: true, cognitiveLoad: true, status: true,
          priority: true, dueDate: true,
        },
      }),
      prisma.task.count({
        where: {
          projectId,
          assigneeId: userId,
          status: 'DONE',
          updatedAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.consultationBooking.findFirst({
        where: {
          teamId,
          status: 'CONFIRMED',
          slotStart: { gte: now, lte: threeDaysFromNow },
        },
        select: { id: true, slotStart: true },
      }),
      prisma.openQuestion.count({
        where: { projectId, resolvedAt: null },
      }),
    ]);

  if (activeTasks.length === 0 && recentlyCompleted === 0) {
    return {
      key: 'cognitive_load',
      label: 'Cognitive Load',
      score: null,
      maxScore: 100,
      status: 'UNKNOWN',
      summary: 'No active tasks are assigned to you in this workspace.',
      factors: [],
      dataSources: ['Tasks'],
      recommendedAction: 'Ask your team leader to assign a task, or pick an unassigned one from the team board.',
      confidence: 'LOW',
      calculatedAt,
    };
  }

  let raw = 0;
  const factors: ScoreFactor[] = [];

  // ── Overdue tasks ──────────────────────────────────────────────────────────
  const overdueTasks = activeTasks.filter((t) => t.dueDate && t.dueDate < now);
  if (overdueTasks.length > 0) {
    const contribution = overdueTasks.length * 8;
    raw += contribution;
    factors.push({
      label: 'Overdue tasks',
      value: overdueTasks.length,
      impact: 'negative',
      weight: contribution,
      explanation: `${overdueTasks.length} assigned task${overdueTasks.length !== 1 ? 's are' : ' is'} past the due date. Overdue work creates compounding pressure.`,
    });
  }

  // ── Due soon ───────────────────────────────────────────────────────────────
  const dueSoon = activeTasks.filter(
    (t) => t.dueDate && t.dueDate >= now && t.dueDate <= threeDaysFromNow
  );
  if (dueSoon.length > 0) {
    const contribution = dueSoon.length * 5;
    raw += contribution;
    factors.push({
      label: 'Due within 3 days',
      value: dueSoon.length,
      impact: 'negative',
      weight: contribution,
      explanation: `${dueSoon.length} task${dueSoon.length !== 1 ? 's' : ''} due within 3 days. Upcoming deadlines increase preparation pressure.`,
    });
  }

  // ── High-priority tasks ────────────────────────────────────────────────────
  const highPriorityTasks = activeTasks.filter(
    (t) => t.priority === 'HIGH' || t.priority === 'URGENT'
  );
  if (highPriorityTasks.length > 0) {
    const contribution = highPriorityTasks.length * 4;
    raw += contribution;
    factors.push({
      label: 'High or urgent priority tasks',
      value: highPriorityTasks.length,
      impact: 'negative',
      weight: contribution,
      explanation: `${highPriorityTasks.length} active task${highPriorityTasks.length !== 1 ? 's are' : ' is'} marked HIGH or URGENT, requiring focused attention.`,
    });
  }

  // ── Blocked tasks ──────────────────────────────────────────────────────────
  const blockedTasks = activeTasks.filter((t) => !!t.blockerNote);
  if (blockedTasks.length > 0) {
    const contribution = blockedTasks.length * 6;
    raw += contribution;
    factors.push({
      label: 'Blocked tasks',
      value: blockedTasks.length,
      impact: 'negative',
      weight: contribution,
      explanation: `${blockedTasks.length} task${blockedTasks.length !== 1 ? 's are' : ' is'} blocked. Blocked work creates waiting pressure and uncertainty.`,
    });
  }

  // ── Ambiguous tasks ────────────────────────────────────────────────────────
  const ambiguousTasks = activeTasks.filter(
    (t) => !t.description || !t.doneCriteria || hasVagueTerms(t.title) || hasVagueTerms(t.description)
  );
  if (ambiguousTasks.length > 0) {
    const contribution = ambiguousTasks.length * 3;
    raw += contribution;
    factors.push({
      label: 'Unclear tasks',
      value: ambiguousTasks.length,
      impact: 'negative',
      weight: contribution,
      explanation: `${ambiguousTasks.length} task${ambiguousTasks.length !== 1 ? 's have' : ' has'} missing descriptions or definitions of done. Vague tasks require more mental energy to start.`,
    });
  }

  // ── Consultation soon ──────────────────────────────────────────────────────
  if (upcomingConsultation) {
    raw += 5;
    factors.push({
      label: 'Consultation within 3 days',
      value: 'Yes',
      impact: 'negative',
      weight: 5,
      explanation: 'A supervisor consultation is coming up soon, adding preparation pressure.',
    });
  }

  // ── Open project questions ─────────────────────────────────────────────────
  if (openQuestions > 0) {
    const contribution = Math.min(openQuestions * 2, 10);
    raw += contribution;
    factors.push({
      label: 'Unresolved project questions',
      value: openQuestions,
      impact: 'negative',
      weight: contribution,
      explanation: `${openQuestions} open question${openQuestions !== 1 ? 's' : ''} in Project Brain. Unresolved questions create background uncertainty.`,
    });
  }

  // ── Task cognitive load field ──────────────────────────────────────────────
  const heavyTasks = activeTasks.filter((t) => (t.cognitiveLoad ?? 0) >= 4);
  if (heavyTasks.length > 0) {
    const contribution = heavyTasks.reduce((sum, t) => sum + (t.cognitiveLoad ?? 0) * 2, 0);
    raw += contribution;
    factors.push({
      label: 'High cognitive load tasks',
      value: heavyTasks.length,
      impact: 'negative',
      weight: contribution,
      explanation: `${heavyTasks.length} task${heavyTasks.length !== 1 ? 's are' : ' is'} rated 4–5 on cognitive complexity, requiring sustained focus.`,
    });
  }

  // ── Relief: no urgent tasks ────────────────────────────────────────────────
  const hasUrgent = activeTasks.some((t) => t.priority === 'URGENT');
  if (!hasUrgent) {
    raw -= 5;
    factors.push({
      label: 'No urgent tasks',
      value: 'None',
      impact: 'positive',
      weight: -5,
      explanation: 'No URGENT-priority work is assigned. This reduces immediate deadline pressure.',
    });
  }

  // ── Relief: recent completions ─────────────────────────────────────────────
  if (recentlyCompleted > 0) {
    const relief = Math.min(recentlyCompleted * 3, 12);
    raw -= relief;
    factors.push({
      label: 'Tasks completed this week',
      value: recentlyCompleted,
      impact: 'positive',
      weight: -relief,
      explanation: `${recentlyCompleted} task${recentlyCompleted !== 1 ? 's' : ''} completed in the last 7 days. Recent progress builds momentum and lowers pressure.`,
    });
  }

  // Clamp to 0–100
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const status = classifyStatus(score);

  // Confidence based on data richness
  const confidence: ExplainableScore['confidence'] =
    activeTasks.length >= 3 ? 'HIGH'
    : activeTasks.length >= 1 ? 'MEDIUM'
    : 'LOW';

  const summary = buildSummary(status, overdueTasks.length, blockedTasks.length,
    upcomingConsultation, dueSoon.length, recentlyCompleted);

  return {
    key: 'cognitive_load',
    label: 'Cognitive Load',
    score,
    maxScore: 100,
    status,
    summary,
    factors: factors.sort((a, b) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0)),
    dataSources: ['Assigned tasks', 'Task due dates', 'Task priorities', 'Task status', 'Project Brain questions', 'Consultations'],
    recommendedAction: buildRecommendation(status),
    confidence,
    calculatedAt,
  };
}

function buildSummary(
  status: ScoreStatus,
  overdue: number,
  blocked: number,
  consultation: unknown,
  dueSoon: number,
  completed: number
): string {
  const parts: string[] = [];

  if (overdue > 0) parts.push(`${overdue} overdue task${overdue !== 1 ? 's' : ''}`);
  if (blocked > 0) parts.push(`${blocked} blocked task${blocked !== 1 ? 's' : ''}`);
  if (dueSoon > 0) parts.push(`${dueSoon} task${dueSoon !== 1 ? 's' : ''} due within 3 days`);
  if (consultation) parts.push('a consultation coming up soon');
  if (completed > 0) parts.push(`${completed} completed this week (positive momentum)`);

  const statusLabel: Record<ScoreStatus, string> = {
    LOW: 'low',
    BALANCED: 'balanced',
    WATCH: 'building',
    HIGH: 'high',
    CRITICAL: 'critical',
    UNKNOWN: 'unknown',
  };

  if (parts.length === 0) {
    return 'Workload pressure is within a manageable range based on current assignments.';
  }
  return `Academic workload pressure is ${statusLabel[status]} because of ${parts.join(', ')}.`;
}

function buildLowConfidenceScore(
  key: string, label: string, calculatedAt: string, reason: string
): ExplainableScore {
  return {
    key, label,
    score: null,
    maxScore: 100,
    status: 'UNKNOWN',
    summary: reason,
    factors: [],
    dataSources: [],
    recommendedAction: 'Complete your team setup and add tasks to see a score.',
    confidence: 'LOW',
    calculatedAt,
  };
}
