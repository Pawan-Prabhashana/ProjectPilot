/**
 * Leader Dashboard Service
 *
 * Returns team-level data for the /dashboard/leader page.
 * Validates that the requesting user is a LEADER or CO_LEADER in the team.
 * Does NOT expose private student CognitiveProfile data.
 */

import { prisma } from '@/lib/db';

export type LeaderTeamMember = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  activeTaskCount: number;
  overdueTaskCount: number;
  completedThisWeekCount: number;
  recentContributionCount: number;
  noRecentActivity: boolean;
};

export type RiskTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  riskReason: string;
  suggestedAction: string;
  isOverdue: boolean;
  daysOverdue: number | null;
};

export type LeaderDashboard = {
  teamId: string;
  teamName: string;
  projectId: string | null;
  projectTitle: string | null;
  leaderRole: 'LEADER' | 'CO_LEADER';
  teamStats: {
    memberCount: number;
    overdueTasks: number;
    blockedTasks: number;
    unassignedTasks: number;
    openQuestionsCount: number;
    activeTasks: number;
    doneTasks: number;
    completionRate: number;
  };
  members: LeaderTeamMember[];
  riskTasks: RiskTask[];
  nextConsultation: {
    bookingId: string;
    slotStart: Date;
    status: string;
    hasBrief: boolean;
  } | null;
  upcomingMilestone: {
    id: string;
    title: string;
    dueDate: Date;
    status: string;
    completionRate: number;
  } | null;
  openQuestionsCount: number;
  unresolvedAssumptionsCount: number;
};

export async function getLeaderDashboard(
  userId: string,
  teamId?: string
): Promise<LeaderDashboard | null> {
  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Resolve team membership — requires LEADER or CO_LEADER
  const member = await prisma.teamMember.findFirst({
    where: {
      userId,
      ...(teamId ? { teamId } : {}),
      role: { in: ['LEADER', 'CO_LEADER'] },
    },
    include: {
      team: { include: { project: { select: { id: true, title: true } } } },
    },
  });

  if (!member?.team) return null;

  const { team } = member;
  const projectId = team.project?.id ?? null;
  const leaderRole = (member.role as string).toUpperCase() === 'CO_LEADER' ? 'CO_LEADER' as const : 'LEADER' as const;

  // Parallel data fetching
  const [
    teamMembers,
    tasks,
    nextConsultation,
    openQuestionsCount,
    unresolvedAssumptionsCount,
    upcomingMilestone,
  ] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId: team.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),

    projectId
      ? prisma.task.findMany({
          where: { projectId, status: { notIn: ['CANCELLED'] } },
          include: {
            assignee: { select: { id: true, name: true, email: true } },
            outgoingDeps: {
              include: { targetTask: { select: { status: true } } },
            },
          },
        })
      : Promise.resolve([]),

    prisma.consultationBooking.findFirst({
      where: {
        teamId: team.id,
        status: { in: ['CONFIRMED', 'PENDING'] },
        slotStart: { gte: now },
      },
      include: { brief: { select: { id: true } } },
      orderBy: { slotStart: 'asc' },
    }),

    projectId
      ? prisma.openQuestion.count({ where: { projectId, resolvedAt: null } })
      : Promise.resolve(0),

    projectId
      ? prisma.assumptionRecord.count({ where: { projectId, isInvalidated: false, validatedAt: null } })
      : Promise.resolve(0),

    projectId
      ? prisma.milestone.findFirst({
          where: {
            projectId,
            status: { notIn: ['COMPLETED'] },
            dueDate: { gte: now },
          },
          include: {
            tasks: { select: { id: true, status: true } },
          },
          orderBy: { dueDate: 'asc' },
        })
      : Promise.resolve(null),
  ]);

  // Team stats
  const activeTasks = tasks.filter((t) => !['DONE', 'CANCELLED'].includes(t.status)).length;
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
  const totalNonCancelled = tasks.filter((t) => t.status !== 'CANCELLED').length;
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < now && !['DONE', 'CANCELLED'].includes(t.status)
  ).length;
  const blockedTasks = tasks.filter(
    (t) =>
      !['DONE', 'CANCELLED'].includes(t.status) &&
      ((t as { blockerNote?: string | null }).blockerNote ||
        t.outgoingDeps.some(
          (d) => !['DONE', 'CANCELLED'].includes(d.targetTask.status)
        ))
  ).length;
  const unassignedTasks = tasks.filter(
    (t) => !t.assigneeId && !['DONE', 'CANCELLED'].includes(t.status)
  ).length;
  const completionRate = totalNonCancelled > 0 ? Math.round((doneTasks / totalNonCancelled) * 100) : 0;

  // Build member workload (no private CognitiveProfile data)
  const recentActivityMap = new Map<string, number>();
  if (projectId) {
    const recentContributions = await prisma.contributionLog.groupBy({
      by: ['userId'],
      where: { projectId, loggedAt: { gte: sevenDaysAgo } },
      _count: { userId: true },
    });
    recentContributions.forEach((r) => {
      recentActivityMap.set(r.userId, r._count.userId);
    });
  }

  const members: LeaderTeamMember[] = await Promise.all(
    teamMembers.map(async ({ user, role }) => {
      const memberTasks = tasks.filter((t) => t.assigneeId === user.id);
      const activeCount = memberTasks.filter((t) => !['DONE', 'CANCELLED'].includes(t.status)).length;
      const overdueCount = memberTasks.filter(
        (t) => t.dueDate && t.dueDate < now && !['DONE', 'CANCELLED'].includes(t.status)
      ).length;
      const completedThisWeek = projectId
        ? await prisma.task.count({
            where: {
              projectId,
              assigneeId: user.id,
              status: 'DONE',
              updatedAt: { gte: sevenDaysAgo },
            },
          })
        : 0;
      const recentContribs = recentActivityMap.get(user.id) ?? 0;
      const noRecentActivity = activeCount === 0 && recentContribs === 0 && completedThisWeek === 0;

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: role as string,
        activeTaskCount: activeCount,
        overdueTaskCount: overdueCount,
        completedThisWeekCount: completedThisWeek,
        recentContributionCount: recentContribs,
        noRecentActivity,
      };
    })
  );

  // Risk tasks
  const riskTasks: RiskTask[] = tasks
    .filter((t) => {
      if (['DONE', 'CANCELLED'].includes(t.status)) return false;
      const isOverdue = !!(t.dueDate && t.dueDate < now);
      const isBlocked = !!(t as { blockerNote?: string | null }).blockerNote ||
        t.outgoingDeps.some((d) => !['DONE', 'CANCELLED'].includes(d.targetTask.status));
      const isHighPriority = t.priority === 'HIGH' || t.priority === 'URGENT';
      const isDueSoon = !!(t.dueDate && t.dueDate >= now && t.dueDate <= threeDays);
      const isUnassigned = !t.assigneeId;
      return isOverdue || isBlocked || (isHighPriority && isDueSoon) || isUnassigned;
    })
    .map((t) => {
      const isOverdue = !!(t.dueDate && t.dueDate < now);
      const isBlocked = !!(t as { blockerNote?: string | null }).blockerNote;
      const daysOverdue = isOverdue && t.dueDate
        ? Math.floor((now.getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      let riskReason: string;
      let suggestedAction: string;

      if (isOverdue) {
        riskReason = `Overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`;
        suggestedAction = 'Ask for a progress update or add a blocker note';
      } else if (isBlocked) {
        riskReason = 'Has an active blocker';
        suggestedAction = 'Clarify the blocker or split the task';
      } else if (!t.assigneeId) {
        riskReason = 'No team member assigned';
        suggestedAction = 'Assign to a team member with capacity';
      } else if (t.dueDate && t.dueDate >= now && t.dueDate <= threeDays) {
        riskReason = `Due within ${Math.ceil((t.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days`;
        suggestedAction = 'Check progress and confirm it is on track';
      } else {
        riskReason = 'High priority task not yet done';
        suggestedAction = 'Review and ensure it is progressing';
      }

      return {
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ?? null,
        assigneeName: t.assignee?.name ?? null,
        assigneeEmail: t.assignee?.email ?? null,
        riskReason,
        suggestedAction,
        isOverdue,
        daysOverdue,
      };
    })
    .slice(0, 8);

  // Upcoming milestone completion rate
  let upcomingMilestoneData = null;
  if (upcomingMilestone) {
    const milestoneTasks = upcomingMilestone.tasks;
    const mDone = milestoneTasks.filter((t) => t.status === 'DONE').length;
    const mTotal = milestoneTasks.length;
    upcomingMilestoneData = {
      id: upcomingMilestone.id,
      title: upcomingMilestone.title,
      dueDate: upcomingMilestone.dueDate,
      status: upcomingMilestone.status,
      completionRate: mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0,
    };
  }

  return {
    teamId: team.id,
    teamName: team.name,
    projectId,
    projectTitle: team.project?.title ?? null,
    leaderRole,
    teamStats: {
      memberCount: teamMembers.length,
      overdueTasks,
      blockedTasks,
      unassignedTasks,
      openQuestionsCount,
      activeTasks,
      doneTasks,
      completionRate,
    },
    members,
    riskTasks,
    nextConsultation: nextConsultation
      ? {
          bookingId: nextConsultation.id,
          slotStart: nextConsultation.slotStart,
          status: nextConsultation.status,
          hasBrief: !!nextConsultation.brief,
        }
      : null,
    upcomingMilestone: upcomingMilestoneData,
    openQuestionsCount,
    unresolvedAssumptionsCount,
  };
}
