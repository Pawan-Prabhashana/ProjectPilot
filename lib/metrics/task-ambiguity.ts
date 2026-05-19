/**
 * Task Ambiguity Score
 *
 * Detects clarity problems in individual tasks that can cause executive
 * function difficulties — especially for neurodivergent students who rely on
 * explicit structure to start and complete work.
 *
 * Per-task formula (additive, clamped 0–100):
 *   +15  missing description
 *   +12  missing assignee
 *   +10  missing due date
 *   +8   missing priority (not set or defaulted)
 *   +15  missing definition of done
 *   +8   vague title (contains known vague terms)
 *   +8   vague description
 *   +10  blocked but no blocker explanation
 *   +10  high/urgent priority but unclear description
 *
 * Status thresholds:
 *   0–19   = LOW
 *   20–39  = BALANCED
 *   40–59  = WATCH
 *   60–79  = HIGH
 *   80–100 = CRITICAL
 */

import { prisma } from '@/lib/db';
import type { ExplainableScore, ScoreFactor, ScoreStatus, TaskAmbiguityDetail, TeamAmbiguitySummary } from './types';

export const VAGUE_TERMS = [
  'improve', 'fix', 'handle', 'update', 'make better', 'do research',
  'complete soon', 'work on', 'polish', 'check', 'prepare', 'finalize',
  'stuff', 'etc',
];

function hasVagueTerms(text: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return VAGUE_TERMS.some((t) => lower.includes(t));
}

function classifyStatus(score: number): ScoreStatus {
  if (score <= 19) return 'LOW';
  if (score <= 39) return 'BALANCED';
  if (score <= 59) return 'WATCH';
  if (score <= 79) return 'HIGH';
  return 'CRITICAL';
}

export type TaskInput = {
  id: string;
  title: string;
  description: string | null;
  doneCriteria: string | null;
  assigneeId: string | null;
  dueDate: Date | null;
  priority: string;
  blockerNote: string | null;
  status: string;
};

/**
 * Compute ambiguity score for a single task (no DB query needed — pass the task).
 */
export function scoreTaskAmbiguity(task: TaskInput): TaskAmbiguityDetail {
  const calculatedAt = new Date().toISOString();
  let raw = 0;
  const factors: ScoreFactor[] = [];
  const suggestedFixes: string[] = [];

  // ── Missing description ────────────────────────────────────────────────────
  const hasDescription = task.description && task.description.trim().length >= 20;
  if (!hasDescription) {
    raw += 15;
    factors.push({
      label: 'No description',
      value: 'Missing',
      impact: 'negative',
      weight: 15,
      explanation: 'A task with no description leaves the purpose and approach undefined.',
    });
    suggestedFixes.push('Add a 2–3 sentence description explaining what needs to be done and why.');
  }

  // ── Missing assignee ───────────────────────────────────────────────────────
  if (!task.assigneeId) {
    raw += 12;
    factors.push({
      label: 'No assignee',
      value: 'Missing',
      impact: 'negative',
      weight: 12,
      explanation: 'Without an owner, nobody is accountable and the task may be forgotten.',
    });
    suggestedFixes.push('Assign a team member who will own this task.');
  }

  // ── Missing due date ───────────────────────────────────────────────────────
  if (!task.dueDate) {
    raw += 10;
    factors.push({
      label: 'No due date',
      value: 'Missing',
      impact: 'negative',
      weight: 10,
      explanation: 'Without a deadline, the task competes invisibly with everything else.',
    });
    suggestedFixes.push('Set a realistic due date, even an estimate, to make the deadline visible.');
  }

  // ── Missing definition of done ─────────────────────────────────────────────
  const hasDoneCriteria = task.doneCriteria && task.doneCriteria.trim().length >= 10;
  if (!hasDoneCriteria) {
    raw += 15;
    factors.push({
      label: 'No definition of done',
      value: 'Missing',
      impact: 'negative',
      weight: 15,
      explanation: 'Unclear completion criteria make it impossible to know when the task is finished.',
    });
    suggestedFixes.push('Add a definition of done: what does this look like when it is complete?');
  }

  // ── Vague title ────────────────────────────────────────────────────────────
  if (hasVagueTerms(task.title)) {
    raw += 8;
    factors.push({
      label: 'Vague title',
      value: 'Detected',
      impact: 'negative',
      weight: 8,
      explanation: `The title contains a vague action word (e.g. "fix", "improve", "update"). These make it unclear what specifically needs to happen.`,
    });
    suggestedFixes.push('Rewrite the title to be specific: instead of "Improve report", try "Add executive summary section to the report".');
  }

  // ── Vague description ──────────────────────────────────────────────────────
  if (hasDescription && hasVagueTerms(task.description)) {
    raw += 8;
    factors.push({
      label: 'Vague description',
      value: 'Detected',
      impact: 'negative',
      weight: 8,
      explanation: 'The description uses non-specific language that does not explain the expected outcome.',
    });
    suggestedFixes.push('Replace vague phrases with concrete actions and measurable outcomes.');
  }

  // ── Blocked without explanation ────────────────────────────────────────────
  if (task.status === 'TODO' && !task.blockerNote && task.dueDate) {
    const now = new Date();
    const daysOverdue = Math.floor((now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue > 3) {
      raw += 10;
      factors.push({
        label: 'Overdue with no explanation',
        value: `${daysOverdue}d overdue`,
        impact: 'negative',
        weight: 10,
        explanation: 'This task is overdue and still in TODO with no blocker note. It may be stuck but the team cannot see why.',
      });
      suggestedFixes.push('Add a blocker note explaining why this task has not started yet.');
    }
  }

  // ── High priority but unclear ──────────────────────────────────────────────
  const isHighPriority = task.priority === 'HIGH' || task.priority === 'URGENT';
  if (isHighPriority && !hasDescription) {
    raw += 10;
    factors.push({
      label: 'High priority but no description',
      value: task.priority,
      impact: 'negative',
      weight: 10,
      explanation: 'High-priority tasks without descriptions create pressure without direction.',
    });
    suggestedFixes.push('High-priority tasks especially need clear descriptions so the assignee can start immediately.');
  }

  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const status = classifyStatus(score);

  const summary = buildTaskSummary(status, !hasDescription, !task.assigneeId, !task.dueDate, !hasDoneCriteria);

  const explainableScore: ExplainableScore = {
    key: 'task_ambiguity',
    label: 'Task Clarity',
    score,
    maxScore: 100,
    status,
    summary,
    factors: factors.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)),
    dataSources: ['Task description', 'Task assignee', 'Task due date', 'Definition of done', 'Task priority'],
    recommendedAction: suggestedFixes.length > 0
      ? suggestedFixes[0]
      : 'This task has good clarity. Keep it up.',
    confidence: 'HIGH',
    calculatedAt,
  };

  return { taskId: task.id, taskTitle: task.title, score: explainableScore, suggestedFixes };
}

function buildTaskSummary(
  status: ScoreStatus,
  noDesc: boolean, noAssignee: boolean,
  noDueDate: boolean, noDOD: boolean
): string {
  const issues: string[] = [];
  if (noDesc)     issues.push('no description');
  if (noAssignee) issues.push('no owner');
  if (noDueDate)  issues.push('no due date');
  if (noDOD)      issues.push('no definition of done');

  if (issues.length === 0) return 'This task has clear ownership and criteria.';

  const statusText: Record<ScoreStatus, string> = {
    LOW: 'minor', BALANCED: 'some', WATCH: 'notable',
    HIGH: 'significant', CRITICAL: 'critical', UNKNOWN: '',
  };
  return `This task has ${statusText[status]} clarity gaps: ${issues.join(', ')}.`;
}

/**
 * Compute ambiguity scores for all active tasks in a team.
 * Returns a team-level summary plus per-task details.
 */
export async function calculateTeamAmbiguity(
  teamId: string
): Promise<TeamAmbiguitySummary> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { project: { select: { id: true } } },
  });
  const projectId = team?.project?.id;

  const emptyScore: ExplainableScore = {
    key: 'team_ambiguity',
    label: 'Team Task Clarity',
    score: null,
    maxScore: 100,
    status: 'UNKNOWN',
    summary: projectId
      ? 'No active tasks found. Add tasks to see a clarity score.'
      : 'No project linked to this team.',
    factors: [],
    dataSources: [],
    recommendedAction: 'Create tasks with descriptions, owners, and due dates.',
    confidence: 'LOW',
    calculatedAt: new Date().toISOString(),
  };

  if (!projectId) {
    return { teamId, totalActiveTasks: 0, ambiguousTaskCount: 0, criticalCount: 0, highCount: 0, overallScore: emptyScore, topItems: [] };
  }

  const tasks = await prisma.task.findMany({
    where: { projectId, status: { notIn: ['DONE', 'CANCELLED'] } },
    select: {
      id: true, title: true, description: true, doneCriteria: true,
      assigneeId: true, dueDate: true, priority: true, blockerNote: true, status: true,
    },
  });

  if (tasks.length === 0) {
    return { teamId, totalActiveTasks: 0, ambiguousTaskCount: 0, criticalCount: 0, highCount: 0, overallScore: emptyScore, topItems: [] };
  }

  const details = tasks.map(scoreTaskAmbiguity);
  const ambiguous = details.filter((d) => d.score.status !== 'LOW');
  const critical  = details.filter((d) => d.score.status === 'CRITICAL').length;
  const high      = details.filter((d) => d.score.status === 'HIGH').length;

  // Overall team ambiguity: average of all task scores, weighted by status severity
  const avgScore = Math.round(
    details.reduce((sum, d) => sum + (d.score.score ?? 0), 0) / tasks.length
  );
  const overallStatus = classifyStatus(avgScore);

  const topItems = details
    .filter((d) => d.score.status !== 'LOW')
    .sort((a, b) => (b.score.score ?? 0) - (a.score.score ?? 0))
    .slice(0, 5);

  const factors: ScoreFactor[] = [];
  if (critical > 0) {
    factors.push({
      label: 'Critically unclear tasks',
      value: critical,
      impact: 'negative',
      weight: critical * 20,
      explanation: `${critical} task${critical !== 1 ? 's have' : ' has'} critical clarity gaps requiring immediate attention.`,
    });
  }
  if (high > 0) {
    factors.push({
      label: 'Highly unclear tasks',
      value: high,
      impact: 'negative',
      weight: high * 12,
      explanation: `${high} task${high !== 1 ? 's have' : ' has'} significant clarity problems.`,
    });
  }
  const clearCount = details.filter((d) => d.score.status === 'LOW').length;
  if (clearCount > 0) {
    factors.push({
      label: 'Well-defined tasks',
      value: clearCount,
      impact: 'positive',
      weight: -clearCount * 5,
      explanation: `${clearCount} task${clearCount !== 1 ? 's are' : ' is'} clear with owners, due dates, and definitions of done.`,
    });
  }

  const summary = ambiguous.length === 0
    ? 'All active tasks have good clarity. No significant gaps detected.'
    : `${ambiguous.length} of ${tasks.length} active task${ambiguous.length !== 1 ? 's have' : ' has'} clarity gaps${critical > 0 ? `, including ${critical} critical` : ''}.`;

  const overallScore: ExplainableScore = {
    key: 'team_ambiguity',
    label: 'Team Task Clarity',
    score: avgScore,
    maxScore: 100,
    status: overallStatus,
    summary,
    factors,
    dataSources: ['Task descriptions', 'Task assignees', 'Task due dates', 'Definitions of done'],
    recommendedAction: critical > 0
      ? 'Address the critically unclear tasks first — they carry the highest risk of invisible stalls.'
      : ambiguous.length > 0
        ? 'Add definitions of done and due dates to the most unclear tasks.'
        : 'Maintain clarity standards as new tasks are created.',
    confidence: tasks.length >= 5 ? 'HIGH' : tasks.length >= 2 ? 'MEDIUM' : 'LOW',
    calculatedAt: new Date().toISOString(),
  };

  return { teamId, totalActiveTasks: tasks.length, ambiguousTaskCount: ambiguous.length, criticalCount: critical, highCount: high, overallScore, topItems };
}
