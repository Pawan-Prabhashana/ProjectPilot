/**
 * Student My Work Dashboard Service
 *
 * Returns all data needed for the /dashboard/my-work page.
 * Scoped to a specific team/project via teamId.
 * Private to the requesting student — no CognitiveProfile exposed externally.
 */

import { prisma } from '@/lib/db';
import type { PriorityLevel, TaskStatus } from '@prisma/client';

export type MyWorkTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: PriorityLevel;
  dueDate: Date | null;
  estimatedMinutes: number | null;
  cognitiveLoad: number | null;
  blockerNote: string | null;
  doneCriteria: string | null;
  milestoneName: string | null;
  isOverdue: boolean;
  isDueSoon: boolean;
};

export type MyContributionSnapshot = {
  thisWeekCount: number;
  thisWeekHours: number;
  totalCount: number;
  lastLoggedAt: Date | null;
};

export type LatestSupervisorNote = {
  bookingId: string;
  slotDate: Date;
  // studentSummary from SupervisorFeedbackParse if available, else truncated note
  summary: string;
  hasActionItems: boolean;
};

export type SafeStartTask = {
  taskId: string;
  taskTitle: string;
  reason: string;
  urgencyLevel: 'overdue' | 'due-soon' | 'next-in-line';
  dueDate: Date | null;
  priority: PriorityLevel;
  estimatedMinutes: number | null;
  cognitiveLoad: number | null;
  doneCriteria: string | null;
  isDecomposed: boolean;
};

export type StudentMyWorkDashboard = {
  teamId: string;
  teamName: string;
  projectId: string | null;
  projectTitle: string | null;
  memberRole: 'MEMBER' | 'LEADER' | 'CO_LEADER';
  safeStart: SafeStartTask | null;
  overdueTasks: MyWorkTask[];
  dueSoonTasks: MyWorkTask[];
  inProgressTasks: MyWorkTask[];
  notStartedTasks: MyWorkTask[];
  latestSupervisorNote: LatestSupervisorNote | null;
  contributions: MyContributionSnapshot;
  hasCognitiveProfile: boolean;
};

export async function getStudentMyWorkDashboard(
  userId: string,
  teamId?: string
): Promise<StudentMyWorkDashboard | null> {
  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Resolve team membership
  const member = await prisma.teamMember.findFirst({
    where: { userId, ...(teamId ? { teamId } : {}) },
    include: {
      team: { include: { project: { select: { id: true, title: true } } } },
    },
  });

  if (!member?.team) return null;

  const { team } = member;
  const projectId = team.project?.id ?? null;

  const memberRole = normalizeMemberRole(member.role as string);

  // Parallel queries
  const [myTasks, contributions, latestBooking, cognitiveProfile] = await Promise.all([
    projectId
      ? prisma.task.findMany({
          where: {
            projectId,
            assigneeId: userId,
            status: { notIn: ['DONE', 'CANCELLED'] },
          },
          include: {
            milestone: { select: { title: true } },
            decomposition: { select: { taskId: true } },
          },
          orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        })
      : Promise.resolve([]),

    projectId
      ? prisma.contributionLog.findMany({
          where: { projectId, userId },
          select: { hours: true, loggedAt: true },
          orderBy: { loggedAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]),

    // Latest completed consultation with notes for this team
    prisma.consultationBooking.findFirst({
      where: {
        teamId: team.id,
        status: 'COMPLETED',
        meetingNote: { isNot: null },
      },
      include: {
        meetingNote: { select: { content: true } },
        feedbackParse: { select: { studentSummary: true, actionItems: true } },
      },
      orderBy: { slotStart: 'desc' },
    }),

    prisma.cognitiveProfile.findUnique({
      where: { userId },
      select: { onboardingCompleted: true },
    }),
  ]);

  // Process tasks into categories
  const enriched: MyWorkTask[] = myTasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    estimatedMinutes: t.estimatedMinutes,
    cognitiveLoad: (t as { cognitiveLoad?: number | null }).cognitiveLoad ?? null,
    blockerNote: (t as { blockerNote?: string | null }).blockerNote ?? null,
    doneCriteria: (t as { doneCriteria?: string | null }).doneCriteria ?? null,
    milestoneName: t.milestone?.title ?? null,
    isOverdue: !!(t.dueDate && t.dueDate < now),
    isDueSoon: !!(t.dueDate && t.dueDate >= now && t.dueDate <= threeDays),
  }));

  const overdueTasks = enriched.filter((t) => t.isOverdue);
  const dueSoonTasks = enriched.filter((t) => !t.isOverdue && t.isDueSoon);
  const inProgressTasks = enriched.filter((t) => t.status === 'IN_PROGRESS' && !t.isOverdue && !t.isDueSoon);
  const notStartedTasks = enriched.filter((t) => t.status === 'TODO' && !t.isOverdue && !t.isDueSoon);

  // Safe start — pick the best single task to start with
  const safeStart = pickSafeStart(myTasks, now, threeDays);

  // Contributions
  const thisWeekLogs = contributions.filter((c) => c.loggedAt >= sevenDaysAgo);
  const contributionSnapshot: MyContributionSnapshot = {
    thisWeekCount: thisWeekLogs.length,
    thisWeekHours: Math.round(thisWeekLogs.reduce((s, c) => s + (c.hours ?? 0), 0) * 10) / 10,
    totalCount: contributions.length,
    lastLoggedAt: contributions[0]?.loggedAt ?? null,
  };

  // Latest supervisor note
  let latestSupervisorNote: LatestSupervisorNote | null = null;
  if (latestBooking) {
    const summary =
      latestBooking.feedbackParse?.studentSummary ??
      (latestBooking.meetingNote?.content
        ? latestBooking.meetingNote.content.slice(0, 200) + (latestBooking.meetingNote.content.length > 200 ? '…' : '')
        : null);

    if (summary) {
      const actionItems = latestBooking.feedbackParse?.actionItems;
      latestSupervisorNote = {
        bookingId: latestBooking.id,
        slotDate: latestBooking.slotStart,
        summary,
        hasActionItems: Array.isArray(actionItems) && actionItems.length > 0,
      };
    }
  }

  return {
    teamId: team.id,
    teamName: team.name,
    projectId,
    projectTitle: team.project?.title ?? null,
    memberRole,
    safeStart,
    overdueTasks,
    dueSoonTasks,
    inProgressTasks,
    notStartedTasks,
    latestSupervisorNote,
    contributions: contributionSnapshot,
    hasCognitiveProfile: cognitiveProfile?.onboardingCompleted ?? false,
  };
}

function pickSafeStart(
  tasks: Awaited<ReturnType<typeof prisma.task.findMany>> & {
    milestone: { title: string } | null;
    decomposition: { taskId: string } | null;
  }[],
  now: Date,
  threeDays: Date
): SafeStartTask | null {
  if (tasks.length === 0) return null;

  const candidate =
    tasks.find((t) => t.dueDate && t.dueDate < now) ??
    tasks.find((t) => t.dueDate && t.dueDate >= now && t.dueDate <= threeDays) ??
    tasks.find((t) => t.status === 'IN_PROGRESS') ??
    tasks[0];

  if (!candidate) return null;

  let urgencyLevel: SafeStartTask['urgencyLevel'] = 'next-in-line';
  let reason = 'This is your highest-priority open task. Starting here keeps the project moving.';

  if (candidate.dueDate && candidate.dueDate < now) {
    urgencyLevel = 'overdue';
    reason = 'This task is overdue. A quick update — even a blocker note — removes it from the risk list.';
  } else if (candidate.dueDate && candidate.dueDate >= now && candidate.dueDate <= threeDays) {
    urgencyLevel = 'due-soon';
    const daysLeft = Math.ceil((candidate.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    reason = `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Getting started now avoids last-minute pressure.`;
  }

  return {
    taskId: candidate.id,
    taskTitle: candidate.title,
    reason,
    urgencyLevel,
    dueDate: candidate.dueDate ?? null,
    priority: candidate.priority,
    estimatedMinutes: candidate.estimatedMinutes ?? null,
    cognitiveLoad: (candidate as { cognitiveLoad?: number | null }).cognitiveLoad ?? null,
    doneCriteria: (candidate as { doneCriteria?: string | null }).doneCriteria ?? null,
    isDecomposed: !!(candidate as { decomposition?: { taskId: string } | null }).decomposition,
  };
}

function normalizeMemberRole(role: string): 'MEMBER' | 'LEADER' | 'CO_LEADER' {
  const upper = role.toUpperCase().replace('-', '_');
  if (upper === 'LEADER' || upper === 'LEAD') return 'LEADER';
  if (upper === 'CO_LEADER' || upper === 'CO_LEAD') return 'CO_LEADER';
  return 'MEMBER';
}
