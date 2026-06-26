/**
 * Dashboard summary data queries.
 *
 * These are used directly by server components on the overview page.
 * Each function is typed so the components receive predictable shapes.
 * Queries are kept lean — they don't fetch full entities, just counts and
 * key scalar values needed for summary cards.
 */

import { prisma } from '@/lib/db';
import type { TeamHealthStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// STUDENT DASHBOARD
// ---------------------------------------------------------------------------

export type StudentDashboardSummary = {
  teamId: string | null;
  teamName: string | null;
  teamHealth: TeamHealthStatus | null;
  projectTitle: string | null;
  nextMilestone: { title: string; dueDate: Date; status: string } | null;
  overdueTasksCount: number;
  myOpenTasksCount: number;
  nextConsultation: { slotStart: Date; agenda: string | null } | null;
  cognitiveProfileComplete: boolean;
  openQuestionsCount: number;
};

export async function getStudentDashboardSummary(
  userId: string,
  /** When provided, fetches data for the specific team instead of findFirst */
  teamId?: string
): Promise<StudentDashboardSummary> {
  const now = new Date();

  const member = await prisma.teamMember.findFirst({
    where: { userId, ...(teamId ? { teamId } : {}) },
    include: {
      team: {
        include: {
          project: {
            include: {
              milestones: {
                where: { status: { notIn: ['COMPLETED'] } },
                orderBy: { dueDate: 'asc' },
                take: 1,
              },
              openQuestions: {
                where: { resolvedAt: null },
                select: { id: true },
              },
            },
          },
          consultationBookings: {
            where: { status: 'CONFIRMED', slotStart: { gte: now } },
            orderBy: { slotStart: 'asc' },
            take: 1,
          },
        },
      },
    },
  });

  const empty: StudentDashboardSummary = {
    teamId: null,
    teamName: null,
    teamHealth: null,
    projectTitle: null,
    nextMilestone: null,
    overdueTasksCount: 0,
    myOpenTasksCount: 0,
    nextConsultation: null,
    cognitiveProfileComplete: false,
    openQuestionsCount: 0,
  };

  if (!member?.team) return empty;

  const project = member.team.project;

  const [overdueTasksCount, myOpenTasksCount, cognitiveProfile] = await Promise.all([
    project
      ? prisma.task.count({
          where: {
            projectId: project.id,
            status: { notIn: ['DONE', 'CANCELLED'] },
            dueDate: { lt: now },
          },
        })
      : Promise.resolve(0),
    project
      ? prisma.task.count({
          where: {
            projectId: project.id,
            assigneeId: userId,
            status: { notIn: ['DONE', 'CANCELLED'] },
          },
        })
      : Promise.resolve(0),
    prisma.cognitiveProfile.findUnique({
      where: { userId },
      select: { onboardingCompleted: true },
    }),
  ]);

  const nextBooking = member.team.consultationBookings?.[0];
  const nextMilestone = project?.milestones?.[0];

  return {
    teamId: member.team.id,
    teamName: member.team.name,
    teamHealth: member.team.healthStatus,
    projectTitle: project?.title ?? null,
    nextMilestone: nextMilestone
      ? { title: nextMilestone.title, dueDate: nextMilestone.dueDate, status: nextMilestone.status }
      : null,
    overdueTasksCount,
    myOpenTasksCount,
    nextConsultation: nextBooking
      ? { slotStart: nextBooking.slotStart, agenda: nextBooking.agenda }
      : null,
    cognitiveProfileComplete: cognitiveProfile?.onboardingCompleted ?? false,
    openQuestionsCount: project?.openQuestions?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// SUPERVISOR DASHBOARD
// ---------------------------------------------------------------------------

export type SupervisorDashboardSummary = {
  supervisedTeamsCount: number;
  upcomingConsultationsCount: number;
  pendingRequestsCount: number;
  atRiskTeamsCount: number;
  criticalTeamsCount: number;
  recentActivityCount: number;
  unreadBriefCount: number;
};

export async function getSupervisorDashboardSummary(
  userId: string
): Promise<SupervisorDashboardSummary> {
  const profile = await prisma.supervisorProfile.findUnique({
    where: { userId },
    include: { supervisedTeams: { select: { id: true } } },
  });

  const teamIds = profile?.supervisedTeams.map((t) => t.id) ?? [];
  const now = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    upcomingConsultationsCount,
    pendingRequestsCount,
    atRiskTeamsCount,
    criticalTeamsCount,
    recentActivityCount,
    unreadBriefCount,
  ] = await Promise.all([
    prisma.consultationBooking.count({
      where: { teamId: { in: teamIds }, status: 'CONFIRMED', slotStart: { gte: now } },
    }),
    prisma.consultationBooking.count({
      where: { teamId: { in: teamIds }, status: 'PENDING' },
    }),
    prisma.team.count({
      where: { id: { in: teamIds }, healthStatus: 'AT_RISK' },
    }),
    prisma.team.count({
      where: { id: { in: teamIds }, healthStatus: 'CRITICAL' },
    }),
    prisma.contributionLog.count({
      where: {
        project: { teamId: { in: teamIds } },
        loggedAt: { gte: sevenDaysAgo },
      },
    }),
    // Briefs that have been generated but not yet seen by supervisor
    prisma.consultationBrief.count({
      where: {
        booking: { teamId: { in: teamIds }, status: 'CONFIRMED' },
      },
    }),
  ]);

  return {
    supervisedTeamsCount: teamIds.length,
    upcomingConsultationsCount,
    pendingRequestsCount,
    atRiskTeamsCount,
    criticalTeamsCount,
    recentActivityCount,
    unreadBriefCount,
  };
}

// ---------------------------------------------------------------------------
// COORDINATOR DASHBOARD
// ---------------------------------------------------------------------------

export type CoordinatorDashboardSummary = {
  totalUsers: number;
  totalStudents: number;
  totalSupervisors: number;
  totalActiveTeams: number;
  upcomingConsultationsCount: number;
  flaggedTeamsCount: number;
  unresolvedFrictionEvents: number;
};

export async function getCoordinatorDashboardSummary(): Promise<CoordinatorDashboardSummary> {
  const [
    totalUsers,
    totalStudents,
    totalSupervisors,
    totalActiveTeams,
    upcomingConsultationsCount,
    flaggedTeamsCount,
    unresolvedFrictionEvents,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'SUPERVISOR' } }),
    prisma.team.count(),
    prisma.consultationBooking.count({
      where: { status: 'CONFIRMED', slotStart: { gte: new Date() } },
    }),
    prisma.team.count({ where: { healthStatus: { in: ['AT_RISK', 'CRITICAL'] } } }),
    prisma.socialFrictionEvent.count({ where: { resolved: false } }),
  ]);

  return {
    totalUsers,
    totalStudents,
    totalSupervisors,
    totalActiveTeams,
    upcomingConsultationsCount,
    flaggedTeamsCount,
    unresolvedFrictionEvents,
  };
}

// ---------------------------------------------------------------------------
// TASK RISK SUMMARY
// ---------------------------------------------------------------------------

export type TaskRiskSummary = {
  totalTasks: number;
  overdueTasks: number;
  dueSoon: number; // due within 3 days
  unassignedTasks: number;
  completionRate: number; // 0–100
};

export async function getTaskRiskSummary(projectId: string): Promise<TaskRiskSummary> {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [totalTasks, overdueTasks, dueSoon, unassignedTasks, doneTasks] = await Promise.all([
    prisma.task.count({ where: { projectId } }),
    prisma.task.count({
      where: { projectId, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { lt: now } },
    }),
    prisma.task.count({
      where: {
        projectId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        dueDate: { gte: now, lte: threeDaysFromNow },
      },
    }),
    prisma.task.count({
      where: { projectId, assigneeId: null, status: { notIn: ['DONE', 'CANCELLED'] } },
    }),
    prisma.task.count({ where: { projectId, status: 'DONE' } }),
  ]);

  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return { totalTasks, overdueTasks, dueSoon, unassignedTasks, completionRate };
}

// ---------------------------------------------------------------------------
// WORKLOAD BALANCE SUMMARY
// ---------------------------------------------------------------------------

export type MemberWorkload = {
  userId: string;
  name: string | null;
  openTasks: number;
  overdueTasks: number;
  estimatedHoursRemaining: number;
};

export async function getTeamWorkloadBalance(teamId: string): Promise<MemberWorkload[]> {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { id: true, name: true } } },
  });

  const now = new Date();

  const workloads = await Promise.all(
    members.map(async ({ user }) => {
      const [openTasks, overdueTasks, estimateResult] = await Promise.all([
        prisma.task.count({
          where: { assigneeId: user.id, project: { teamId }, status: { notIn: ['DONE', 'CANCELLED'] } },
        }),
        prisma.task.count({
          where: {
            assigneeId: user.id,
            project: { teamId },
            status: { notIn: ['DONE', 'CANCELLED'] },
            dueDate: { lt: now },
          },
        }),
        prisma.task.aggregate({
          where: {
            assigneeId: user.id,
            project: { teamId },
            status: { notIn: ['DONE', 'CANCELLED'] },
            estimatedMinutes: { not: null },
          },
          _sum: { estimatedMinutes: true },
        }),
      ]);

      return {
        userId: user.id,
        name: user.name,
        openTasks,
        overdueTasks,
        estimatedHoursRemaining: Math.round((estimateResult._sum.estimatedMinutes ?? 0) / 60),
      };
    })
  );

  return workloads;
}
