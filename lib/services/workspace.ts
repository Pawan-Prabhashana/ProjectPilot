/**
 * Workspace Intelligence Service
 *
 * Provides the structured data powering the Team Workspace / Project Hub.
 * All logic here is deterministic — no LLM calls. Phase 2 will enrich
 * these summaries with AI-generated narratives.
 *
 * Design principle: surfaces ambiguity, blockers, and dependency chains
 * explicitly so the team is never surprised by invisible problems.
 */

import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Full Workspace Snapshot
// ---------------------------------------------------------------------------

export type MilestoneProgress = {
  id: string;
  title: string;
  dueDate: Date;
  status: string;
  orderIndex: number;
  taskCount: number;
  completedTaskCount: number;
  progress: number; // 0–100
  isOverdue: boolean;
};

export type BlockerSummaryItem = {
  taskId: string;
  taskTitle: string;
  assigneeName: string | null;
  blockerNote: string;
  daysOverdue: number | null;
  priority: string;
};

export type WorkloadMember = {
  userId: string;
  name: string | null;
  email: string;
  role: string; // TeamMemberRole enum value as string
  openTaskCount: number;
  overdueTaskCount: number;
  estimatedHoursRemaining: number;
  cognitiveLoadTotal: number;
  isOverloaded: boolean;
};

export type WorkspaceSnapshot = {
  project: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    createdAt: Date;
  };
  team: {
    id: string;
    name: string;
    healthStatus: string;
  };
  milestones: MilestoneProgress[];
  taskStats: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
    overdue: number;
    blocked: number;
    ambiguous: number;
    completionRate: number;
  };
  blockers: BlockerSummaryItem[];
  workload: WorkloadMember[];
  recentActivity: {
    userId: string;
    name: string | null;
    description: string;
    contributionType: string;
    hours: number | null;
    loggedAt: Date;
  }[];
  openQuestionsCount: number;
  nextConsultation: {
    slotStart: Date;
    agenda: string | null;
    hasBrief: boolean;
  } | null;
  consultationReadiness: 'READY' | 'NEEDS_PREP' | 'NO_UPCOMING';
};

export async function getWorkspaceSnapshot(
  teamId: string,
  projectId: string
): Promise<WorkspaceSnapshot> {
  const now = new Date();

  const [project, team, members, milestones, tasks, contributions, upcomingBookings, openQuestionsCount] =
    await Promise.all([
      prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
      prisma.team.findUniqueOrThrow({ where: { id: teamId } }),
      prisma.teamMember.findMany({
        where: { teamId },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.milestone.findMany({
        where: { projectId },
        include: {
          tasks: { select: { id: true, status: true } },
        },
        orderBy: { orderIndex: 'asc' },
      }),
      prisma.task.findMany({
        where: { projectId },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          outgoingDeps: {
            include: { targetTask: { select: { id: true, status: true, title: true } } },
          },
        },
      }),
      prisma.contributionLog.findMany({
        where: { projectId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { loggedAt: 'desc' },
        take: 12,
      }),
      prisma.consultationBooking.findMany({
        where: {
          teamId,
          status: { in: ['CONFIRMED', 'PENDING'] },
          slotStart: { gte: now },
        },
        include: { brief: { select: { id: true } } },
        orderBy: { slotStart: 'asc' },
        take: 1,
      }),
      prisma.openQuestion.count({ where: { projectId, resolvedAt: null } }),
    ]);

  // --- Milestone progress ---
  const milestoneProgress: MilestoneProgress[] = milestones.map((m) => {
    const total = m.tasks.length;
    const done = m.tasks.filter((t) => t.status === 'DONE').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      id: m.id,
      title: m.title,
      dueDate: m.dueDate,
      status: m.status,
      orderIndex: m.orderIndex,
      taskCount: total,
      completedTaskCount: done,
      progress,
      isOverdue: m.dueDate < now && m.status !== 'COMPLETED',
    };
  });

  // --- Task stats ---
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const todo = tasks.filter((t) => t.status === 'TODO').length;
  const overdue = tasks.filter(
    (t) => t.dueDate && t.dueDate < now && !['DONE', 'CANCELLED'].includes(t.status)
  ).length;

  // A task is "blocked" if it has a BLOCKS dependency on an incomplete task OR has a blockerNote
  const blocked = tasks.filter((t) => {
    const hasBlockerNote = !!t.blockerNote;
    const dependencyBlocked = t.outgoingDeps.some(
      (d) =>
        d.dependencyType === 'BLOCKS' &&
        !['DONE', 'CANCELLED'].includes(d.targetTask.status)
    );
    return hasBlockerNote || dependencyBlocked;
  }).length;

  // Ambiguous tasks (approximation — would normally query AmbiguityFlag)
  const ambiguous = tasks.filter(
    (t) => !t.description || !t.assigneeId || !t.dueDate
  ).length;

  // --- Blockers ---
  const blockers: BlockerSummaryItem[] = tasks
    .filter((t) => t.blockerNote || t.outgoingDeps.some(
      (d) => d.dependencyType === 'BLOCKS' && !['DONE', 'CANCELLED'].includes(d.targetTask.status)
    ))
    .filter((t) => !['DONE', 'CANCELLED'].includes(t.status))
    .map((t) => {
      const daysOverdue =
        t.dueDate && t.dueDate < now
          ? Math.floor((now.getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;
      const note =
        t.blockerNote ??
        `Waiting on: ${t.outgoingDeps
          .filter((d) => d.dependencyType === 'BLOCKS' && !['DONE', 'CANCELLED'].includes(d.targetTask.status))
          .map((d) => d.targetTask.title)
          .join(', ')}`;

      return {
        taskId: t.id,
        taskTitle: t.title,
        assigneeName: t.assignee?.name ?? null,
        blockerNote: note,
        daysOverdue,
        priority: t.priority,
      };
    });

  // --- Workload ---
  const mean = members.length > 0
    ? tasks.filter((t) => !['DONE', 'CANCELLED'].includes(t.status)).length / members.length
    : 0;

  const workload: WorkloadMember[] = await Promise.all(
    members.map(async ({ user, role }) => {
      const myTasks = tasks.filter((t) => t.assigneeId === user.id);
      const openTasks = myTasks.filter((t) => !['DONE', 'CANCELLED'].includes(t.status));
      const overdueTaskCount = openTasks.filter((t) => t.dueDate && t.dueDate < now).length;
      const estimatedMinutes = openTasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
      const cognitiveLoadTotal = openTasks.reduce((s, t) => s + ((t as { cognitiveLoad?: number | null }).cognitiveLoad ?? 3), 0);
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: role as string,
        openTaskCount: openTasks.length,
        overdueTaskCount,
        estimatedHoursRemaining: Math.round(estimatedMinutes / 60),
        cognitiveLoadTotal,
        isOverloaded: mean > 0 && openTasks.length > mean * 1.75,
      };
    })
  );

  // --- Consultation readiness ---
  const nextBooking = upcomingBookings[0] ?? null;
  let consultationReadiness: WorkspaceSnapshot['consultationReadiness'] = 'NO_UPCOMING';
  if (nextBooking) {
    const daysUntil = Math.ceil((nextBooking.slotStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    consultationReadiness = nextBooking.brief || daysUntil > 3 ? 'READY' : 'NEEDS_PREP';
  }

  return {
    project: {
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt,
    },
    team: {
      id: team.id,
      name: team.name,
      healthStatus: team.healthStatus,
    },
    milestones: milestoneProgress,
    taskStats: {
      total,
      done,
      inProgress,
      todo,
      overdue,
      blocked,
      ambiguous,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    },
    blockers,
    workload,
    recentActivity: contributions.map((c) => ({
      userId: c.userId,
      name: c.user.name,
      description: c.description,
      contributionType: c.contributionType,
      hours: c.hours,
      loggedAt: c.loggedAt,
    })),
    openQuestionsCount,
    nextConsultation: nextBooking
      ? {
          slotStart: nextBooking.slotStart,
          agenda: nextBooking.agenda,
          hasBrief: !!nextBooking.brief,
        }
      : null,
    consultationReadiness,
  };
}
