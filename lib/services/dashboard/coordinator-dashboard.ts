/**
 * Coordinator Dashboard Service
 *
 * Returns platform-wide operational data for /dashboard/coordinator.
 * Only counts and structural data — no private student cognitive profile details.
 */

import { prisma } from '@/lib/db';

export type TeamSetupGap = {
  teamId: string;
  teamName: string;
  issues: string[];
};

export type RecentTeamOverview = {
  teamId: string;
  teamName: string;
  projectTitle: string | null;
  healthStatus: string;
  supervisorName: string | null;
  leaderName: string | null;
  memberCount: number;
  createdAt: Date;
};

export type CoordinatorDashboard = {
  stats: {
    totalUsers: number;
    totalStudents: number;
    totalSupervisors: number;
    totalTeams: number;
    totalActiveProjects: number;
    teamsWithoutSupervisor: number;
    teamsWithoutProject: number;
    upcomingConsultations: number;
    unresolvedFrictionEvents: number;
    studentsWithoutTeam: number;
    supervisorsWithNoTeams: number;
  };
  setupGaps: TeamSetupGap[];
  recentTeams: RecentTeamOverview[];
};

export async function getCoordinatorDashboard(): Promise<CoordinatorDashboard> {
  const now = new Date();

  const [
    totalUsers,
    totalStudents,
    totalSupervisors,
    teams,
    totalActiveProjects,
    upcomingConsultations,
    unresolvedFrictionEvents,
    studentsWithoutTeam,
    supervisorsWithNoTeams,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'SUPERVISOR' } }),
    prisma.team.findMany({
      include: {
        project: { select: { id: true, title: true, status: true } },
        members: {
          include: { user: { select: { name: true } } },
        },
        supervisor: {
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.project.count({ where: { status: 'ACTIVE' } }),
    prisma.consultationBooking.count({
      where: { status: 'CONFIRMED', slotStart: { gte: now } },
    }),
    prisma.socialFrictionEvent.count({ where: { resolved: false } }),
    // Students not in any team
    prisma.user.count({
      where: {
        role: 'STUDENT',
        teamMemberships: { none: {} },
      },
    }),
    // Supervisors with no supervised teams
    prisma.supervisorProfile.count({
      where: { supervisedTeams: { none: {} } },
    }),
  ]);

  const teamsWithoutSupervisor = teams.filter((t) => !t.supervisorId).length;
  const teamsWithoutProject = teams.filter((t) => !t.project).length;

  // Setup gaps: teams with structural issues
  const setupGaps: TeamSetupGap[] = teams
    .map((team) => {
      const issues: string[] = [];
      if (!team.supervisor) issues.push('No supervisor assigned');
      if (!team.project) issues.push('No project linked');
      const hasLeader = team.members.some(
        (m) => (m.role as string).toUpperCase() === 'LEADER' || (m.role as string).toUpperCase() === 'CO_LEADER'
      );
      if (!hasLeader && team.members.length > 0) issues.push('No team leader assigned');
      if (team.members.length === 0) issues.push('No members yet');
      return { teamId: team.id, teamName: team.name, issues };
    })
    .filter((g) => g.issues.length > 0)
    .slice(0, 10);

  // Recent teams overview (last 10)
  const recentTeams: RecentTeamOverview[] = teams.slice(0, 10).map((team) => {
    const leaderMember = team.members.find(
      (m) => (m.role as string).toUpperCase() === 'LEADER'
    );
    return {
      teamId: team.id,
      teamName: team.name,
      projectTitle: team.project?.title ?? null,
      healthStatus: team.healthStatus,
      supervisorName: team.supervisor?.user.name ?? null,
      leaderName: leaderMember?.user.name ?? null,
      memberCount: team.members.length,
      createdAt: team.createdAt,
    };
  });

  return {
    stats: {
      totalUsers,
      totalStudents,
      totalSupervisors,
      totalTeams: teams.length,
      totalActiveProjects,
      teamsWithoutSupervisor,
      teamsWithoutProject,
      upcomingConsultations,
      unresolvedFrictionEvents,
      studentsWithoutTeam,
      supervisorsWithNoTeams,
    },
    setupGaps,
    recentTeams,
  };
}
