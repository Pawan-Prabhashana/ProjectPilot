/**
 * Support Intelligence Service
 *
 * Derives student-specific assistive recommendations from real project
 * and task state. All outputs are deterministic and scoped privately to
 * the requesting student.
 *
 * Key features:
 * - Next-Best-Action: the single highest-value task to focus on now
 * - Smallest-Useful-Step: the gentlest possible first action
 * - Confidence Support: reassurance grounded in real progress data
 * - Low-Energy Mode view: simplified one-step entry for overwhelm days
 * - Focus Mode data: full context for a single task
 *
 * Design principle: every output includes an explanation. Nothing should
 * feel magical or random. Students should always be able to understand
 * WHY a recommendation was made.
 */

import { prisma } from '@/lib/db';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NextBestAction = {
  taskId: string;
  taskTitle: string;
  reason: string;
  urgencyLevel: 'overdue' | 'due-soon' | 'blocked-others' | 'next-in-line' | 'any-open';
  suggestedFirstStep: string;
  needsClarification: boolean;
  clarificationHint: string | null;
  isDecomposed: boolean;
  dueDate: Date | null;
};

export type SmallestUsefulStep = {
  description: string;
  taskId: string | null;
  taskTitle: string | null;
  rationale: string;
  estimatedMinutes: number;
};

export type ConfidenceSupport = {
  completedTaskCount: number;
  totalTaskCount: number;
  completionPercent: number;
  completedMilestones: number;
  totalMilestones: number;
  recentWins: string[];           // up to 3 recently completed tasks
  progressStatement: string;     // e.g. "You've already completed 7 of 12 tasks"
  alreadyDoneNote: string;       // "the hardest part" style note if applicable
  whatCountsAsEnough: string;    // contextual "enough for today"
  canDefer: string[];            // tasks that can safely wait
  reassurance: string;           // one calming contextual sentence
};

export type LowEnergyView = {
  oneTask: NextBestAction | null;
  smallestStep: SmallestUsefulStep;
  confidence: ConfidenceSupport;
  todayMinimum: string;           // plain English minimum for today
  skipReason: string | null;      // if there's genuinely nothing urgent
};

export type FocusModeData = {
  task: {
    id: string;
    title: string;
    description: string | null;
    doneCriteria: string | null;
    priority: string;
    dueDate: Date | null;
    estimatedMinutes: number | null;
    blockerNote: string | null;
    milestoneName: string | null;
  };
  decompositionSteps: { title: string; estimatedMinutes: number; done: boolean }[];
  nextStep: string;
  whyItMatters: string;
  suggestedSessionMinutes: number;
  supportPrompt: string;
  isBlocked: boolean;
};

// ─── Next Best Action ──────────────────────────────────────────────────────────

export async function getNextBestAction(userId: string): Promise<NextBestAction | null> {
  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      status: { notIn: ['DONE', 'CANCELLED'] },
    },
    include: {
      milestone: { select: { title: true } },
      decomposition: { select: { steps: true } },
      outgoingDeps: {
        select: { targetTask: { select: { status: true, title: true } } },
      },
    },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
  });

  if (tasks.length === 0) return null;

  // Priority 1: overdue
  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < now);
  if (overdue.length > 0) {
    const t = overdue[0];
    return buildNextBestAction(t, 'overdue', `This task is overdue. Completing it (or adding a blocker note) removes it from the risk list.`);
  }

  // Priority 2: due within 3 days
  const dueSoon = tasks.filter((t) => t.dueDate && t.dueDate >= now && t.dueDate <= threeDays);
  if (dueSoon.length > 0) {
    const t = dueSoon[0];
    const daysLeft = Math.ceil((t.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return buildNextBestAction(t, 'due-soon', `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Getting started now prevents last-minute pressure.`);
  }

  // Priority 3: tasks blocking downstream work
  const blocking = tasks.filter((t) =>
    t.outgoingDeps.some(
      (d) => d.targetTask.status !== 'DONE' && d.targetTask.status !== 'CANCELLED'
    )
  );
  if (blocking.length > 0) {
    const t = blocking[0];
    const blockedCount = t.outgoingDeps.filter(
      (d) => d.targetTask.status !== 'DONE' && d.targetTask.status !== 'CANCELLED'
    ).length;
    return buildNextBestAction(
      t,
      'blocked-others',
      `Completing this unblocks ${blockedCount} downstream task${blockedCount > 1 ? 's' : ''}. Other team members may be waiting.`
    );
  }

  // Priority 4: next in line by priority/due date
  const next = tasks[0];
  return buildNextBestAction(next, 'next-in-line', `This is your highest-priority open task. Starting here keeps your project moving forward.`);
}

type TaskWithRelations = Awaited<ReturnType<typeof prisma.task.findMany>>[number] & {
  milestone: { title: string } | null;
  decomposition: { steps: import('@prisma/client').Prisma.JsonValue } | null;
  outgoingDeps: { targetTask: { status: string; title: string } }[];
};

function buildNextBestAction(
  task: TaskWithRelations,
  urgencyLevel: NextBestAction['urgencyLevel'],
  reason: string
): NextBestAction {
  const steps = parseDecompositionSteps(task.decomposition?.steps);
  const nextUnfinishedStep = steps.find((s) => !s.done);

  const needsClarification = !task.doneCriteria && !task.description;
  const clarificationHint = needsClarification
    ? 'This task has no description or definition of done. Clarify what "complete" means before starting.'
    : task.blockerNote
    ? `This task has a blocker: "${task.blockerNote}". Resolve the blocker before proceeding.`
    : null;

  const suggestedFirstStep = task.blockerNote
    ? `First, address the blocker: ${task.blockerNote}`
    : nextUnfinishedStep
    ? nextUnfinishedStep.title
    : task.doneCriteria
    ? `Work toward: ${task.doneCriteria.slice(0, 100)}`
    : `Open your notes and write one sentence about what "done" looks like for this task.`;

  return {
    taskId: task.id,
    taskTitle: task.title,
    reason,
    urgencyLevel,
    suggestedFirstStep,
    needsClarification,
    clarificationHint,
    isDecomposed: steps.length > 0,
    dueDate: task.dueDate ?? null,
  };
}

// ─── Smallest Useful Step ─────────────────────────────────────────────────────

export async function getSmallestUsefulStep(userId: string): Promise<SmallestUsefulStep> {
  const next = await getNextBestAction(userId);

  if (!next) {
    return {
      description: 'Check the project board and see if there are any tasks you can claim or clarify.',
      taskId: null,
      taskTitle: null,
      rationale: 'No open tasks assigned to you right now.',
      estimatedMinutes: 5,
    };
  }

  // Make the step as small as possible
  let description: string;
  let estimatedMinutes = 15;

  if (next.needsClarification) {
    description = `Open the task "${next.taskTitle}" and write one sentence: what would "done" look like?`;
    estimatedMinutes = 5;
  } else if (next.isDecomposed) {
    description = next.suggestedFirstStep;
    estimatedMinutes = 10;
  } else if (next.urgencyLevel === 'overdue') {
    description = `Open "${next.taskTitle}" and add a note about where you are with it — even if it's just "not started yet".`;
    estimatedMinutes = 5;
  } else {
    description = `Spend 10 minutes on "${next.taskTitle}" — just open your tools and make one visible change.`;
    estimatedMinutes = 10;
  }

  return {
    description,
    taskId: next.taskId,
    taskTitle: next.taskTitle,
    rationale: next.reason,
    estimatedMinutes,
  };
}

// ─── Confidence Support ───────────────────────────────────────────────────────

export async function getConfidenceSupport(userId: string): Promise<ConfidenceSupport> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [allMyTasks, recentlyCompleted, milestones, overdueCount] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: userId },
      select: { id: true, title: true, status: true, priority: true, cognitiveLoad: true },
    }),
    prisma.task.findMany({
      where: { assigneeId: userId, status: 'DONE', updatedAt: { gte: sevenDaysAgo } },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    }),
    prisma.teamMember.findFirst({
      where: { userId },
      select: {
        team: {
          select: {
            project: {
              select: {
                milestones: {
                  select: { id: true, title: true, status: true },
                  orderBy: { orderIndex: 'asc' },
                },
              },
            },
          },
        },
      },
    }),
    prisma.task.count({
      where: {
        assigneeId: userId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        dueDate: { lt: now },
      },
    }),
  ]);

  const completedTasks = allMyTasks.filter((t) => t.status === 'DONE');
  const openTasks = allMyTasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const totalTasks = allMyTasks.filter((t) => t.status !== 'CANCELLED').length;
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  const allMilestones = milestones?.team?.project?.milestones ?? [];
  const completedMilestones = allMilestones.filter((m) => m.status === 'COMPLETED').length;

  const recentWins = recentlyCompleted.map((t) => t.title);

  // Progress statement
  let progressStatement: string;
  if (completedTasks.length === 0) {
    progressStatement = 'You have not completed any tasks yet — that is okay, every project starts here.';
  } else if (completionPercent >= 75) {
    progressStatement = `You have completed ${completedTasks.length} of ${totalTasks} tasks (${completionPercent}%). The end of the project is in sight.`;
  } else if (completionPercent >= 50) {
    progressStatement = `You are past the halfway point — ${completedTasks.length} of ${totalTasks} tasks done (${completionPercent}%).`;
  } else {
    progressStatement = `You have already completed ${completedTasks.length} task${completedTasks.length !== 1 ? 's' : ''}. Progress is real even when it does not feel like it.`;
  }

  // Already done note
  let alreadyDoneNote = '';
  const heavyDone = completedTasks.filter((t) => (t.cognitiveLoad ?? 0) >= 4).length;
  if (heavyDone > 0) {
    alreadyDoneNote = `You have already completed ${heavyDone} high-effort task${heavyDone > 1 ? 's' : ''}. The hardest work is already behind you.`;
  } else if (completedTasks.length >= 3) {
    alreadyDoneNote = 'You have been making consistent progress. This is what a project in motion looks like.';
  } else if (recentlyCompleted.length > 0) {
    alreadyDoneNote = `You completed "${recentlyCompleted[0].title}" recently. That counts.`;
  }

  // What counts as enough
  const openHighPriority = openTasks.filter((t) => t.priority === 'HIGH' || t.priority === 'URGENT');
  let whatCountsAsEnough: string;
  if (overdueCount > 0) {
    whatCountsAsEnough = 'Today, making progress on one overdue task — even a partial update — counts as enough.';
  } else if (openHighPriority.length > 0) {
    whatCountsAsEnough = `Moving "${openHighPriority[0].title}" forward by any amount counts as a productive session today.`;
  } else if (openTasks.length === 0) {
    whatCountsAsEnough = 'Your task board is clear. Reviewing the project state and updating the team counts as a good session.';
  } else {
    whatCountsAsEnough = 'Completing one task of any size — or making a meaningful update to one — counts as a useful session.';
  }

  // Can defer
  const canDefer = openTasks
    .filter((t) => t.priority === 'LOW')
    .map((t) => t.title)
    .slice(0, 3);

  // Reassurance
  let reassurance: string;
  if (overdueCount === 0 && openTasks.length <= 3) {
    reassurance = 'Your workload looks manageable right now. You are in a good position to move things forward steadily.';
  } else if (overdueCount > 2) {
    reassurance = 'A few things are overdue — that is fixable. One task at a time is a real strategy, not a compromise.';
  } else {
    reassurance = 'Progress does not always feel like progress while it is happening. You are doing the work.';
  }

  return {
    completedTaskCount: completedTasks.length,
    totalTaskCount: totalTasks,
    completionPercent,
    completedMilestones,
    totalMilestones: allMilestones.length,
    recentWins,
    progressStatement,
    alreadyDoneNote,
    whatCountsAsEnough,
    canDefer,
    reassurance,
  };
}

// ─── Low-Energy View ──────────────────────────────────────────────────────────

export async function getLowEnergyView(userId: string): Promise<LowEnergyView> {
  const [oneTask, smallestStep, confidence] = await Promise.all([
    getNextBestAction(userId),
    getSmallestUsefulStep(userId),
    getConfidenceSupport(userId),
  ]);

  const todayMinimum = smallestStep.taskId
    ? `Today: ${smallestStep.description}`
    : 'Today: open the project board and review where things stand.';

  const skipReason =
    oneTask === null
      ? 'No tasks are currently assigned to you. Check with your team about what to pick up next.'
      : null;

  return { oneTask, smallestStep, confidence, todayMinimum, skipReason };
}

// ─── Focus Mode Data ──────────────────────────────────────────────────────────

export async function getFocusModeData(
  userId: string,
  taskId?: string
): Promise<FocusModeData | null> {
  let task;

  if (taskId) {
    task = await prisma.task.findFirst({
      where: { id: taskId, assigneeId: userId },
      include: {
        milestone: { select: { title: true } },
        decomposition: { select: { steps: true } },
      },
    });
  } else {
    const next = await getNextBestAction(userId);
    if (!next) return null;

    task = await prisma.task.findFirst({
      where: { id: next.taskId },
      include: {
        milestone: { select: { title: true } },
        decomposition: { select: { steps: true } },
      },
    });
  }

  if (!task) return null;

  const steps = parseDecompositionSteps(task.decomposition?.steps);
  const nextStep = steps.find((s) => !s.done)?.title
    ?? task.doneCriteria?.slice(0, 100)
    ?? 'Open your tools and make one visible start.';

  const profile = await prisma.cognitiveProfile.findUnique({
    where: { userId },
    select: { focusDurationMinutes: true, pacingPreference: true },
  });

  const suggestedSessionMinutes = profile?.focusDurationMinutes
    ?? (task.estimatedMinutes && task.estimatedMinutes <= 60 ? task.estimatedMinutes : 25);

  const whyItMatters = task.milestone?.title
    ? `This task contributes to the "${task.milestone.title}" milestone.`
    : task.priority === 'URGENT' || task.priority === 'HIGH'
    ? 'This is a high-priority task that keeps the project moving forward.'
    : 'Completing this task reduces the open items on your plate and makes it easier to see what is next.';

  const supportPrompts: Record<string, string> = {
    URGENT: 'Urgent does not mean perfect — a completed draft is always better than a perfect plan.',
    HIGH: 'High priority tasks are worth your focus time. You have done this kind of work before.',
    MEDIUM: 'Medium priority tasks keep momentum steady. This is what "keeping up" looks like.',
    LOW: 'Even small tasks move the needle. This is a good one to clear while warming up.',
  };
  const supportPrompt =
    supportPrompts[task.priority] ??
    'Every task you complete is a task that cannot come back to worry you. You are making progress.';

  return {
    task: {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      doneCriteria: task.doneCriteria ?? null,
      priority: task.priority,
      dueDate: task.dueDate ?? null,
      estimatedMinutes: task.estimatedMinutes ?? null,
      blockerNote: task.blockerNote ?? null,
      milestoneName: task.milestone?.title ?? null,
    },
    decompositionSteps: steps,
    nextStep,
    whyItMatters,
    suggestedSessionMinutes,
    supportPrompt,
    isBlocked: !!task.blockerNote,
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function parseDecompositionSteps(
  steps: import('@prisma/client').Prisma.JsonValue | undefined
): { title: string; estimatedMinutes: number; done: boolean }[] {
  if (!steps || !Array.isArray(steps)) return [];
  return steps.map((s) => {
    if (typeof s === 'object' && s !== null && 'title' in s) {
      return {
        title: String((s as Record<string, unknown>).title ?? ''),
        estimatedMinutes: Number((s as Record<string, unknown>).estimatedMinutes ?? 15),
        done: Boolean((s as Record<string, unknown>).done ?? false),
      };
    }
    return { title: String(s), estimatedMinutes: 15, done: false };
  });
}
