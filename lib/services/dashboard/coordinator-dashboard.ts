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

// ── Coordinator Workflow Checklist (Part 10) ──────────────────────────────────

export type WorkflowStepStatus = 'done' | 'ready' | 'needs_action' | 'not_started';

export type WorkflowChecklistStep = {
  step: number;
  title: string;
  status: WorkflowStepStatus;
  detail: string;
  href: string;
};

export async function getCoordinatorWorkflowChecklist(): Promise<WorkflowChecklistStep[]> {
  const steps: WorkflowChecklistStep[] = [];

  // Step 1: Academic term + intake
  const activeTerm = await prisma.academicTerm.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  });

  if (!activeTerm) {
    steps.push({
      step: 1, title: 'Set up academic term & student intake',
      status: 'not_started', detail: 'No active academic term found.',
      href: '/dashboard/coordinator/formation-setup',
    });
    return steps; // nothing else is meaningful without a term
  }

  const intakeCount = await prisma.studentIntake.count({ where: { termId: activeTerm.id } });
  steps.push({
    step: 1, title: 'Set up academic term & student intake',
    status: intakeCount > 0 ? 'done' : 'needs_action',
    detail: intakeCount > 0 ? `${intakeCount} students in intake for "${activeTerm.name}"` : 'No students added to intake yet.',
    href: '/dashboard/coordinator/formation-setup',
  });

  // Step 2: Formation profiles
  const submittedProfiles = await prisma.studentFormationProfile.count({
    where: { status: 'SUBMITTED', studentProfile: { intakeRecords: { some: { termId: activeTerm.id } } } },
  });
  const totalIntake = intakeCount;
  const profilePct = totalIntake > 0 ? Math.round((submittedProfiles / totalIntake) * 100) : 0;
  const profileStatus: WorkflowStepStatus = profilePct >= 80 ? 'done' : profilePct >= 50 ? 'ready' : totalIntake > 0 ? 'needs_action' : 'not_started';
  steps.push({
    step: 2, title: 'Check student formation profiles',
    status: profileStatus,
    detail: totalIntake > 0 ? `${submittedProfiles}/${totalIntake} profiles submitted (${profilePct}%)` : 'Add students to intake first.',
    href: '/dashboard/coordinator/formation-setup',
  });

  // Step 3: Project topics
  const openTopics = await prisma.projectTopic.count({ where: { termId: activeTerm.id, status: 'OPEN' } });
  steps.push({
    step: 3, title: 'Open project topics',
    status: openTopics >= 5 ? 'done' : openTopics > 0 ? 'ready' : 'needs_action',
    detail: openTopics > 0 ? `${openTopics} open topic${openTopics !== 1 ? 's' : ''} available` : 'No topics open for student selection.',
    href: '/dashboard/coordinator/project-topics',
  });

  // Step 4: Project preferences / conflicts
  const submittedPrefStudents = await prisma.projectPreference.groupBy({
    by: ['studentProfileId'],
    where: { termId: activeTerm.id, status: 'SUBMITTED' },
  });
  const prefCount = submittedPrefStudents.length;
  const unresolvedConflicts = await prisma.projectSelectionConflict.count({ where: { termId: activeTerm.id, resolved: false } });
  const prefStatus: WorkflowStepStatus = prefCount >= totalIntake * 0.8 ? (unresolvedConflicts > 0 ? 'ready' : 'done') : prefCount > 0 ? 'ready' : 'needs_action';
  steps.push({
    step: 4, title: 'Review project preferences & conflicts',
    status: prefStatus,
    detail: `${prefCount} student${prefCount !== 1 ? 's' : ''} submitted preferences · ${unresolvedConflicts} unresolved conflict${unresolvedConflicts !== 1 ? 's' : ''}`,
    href: '/dashboard/coordinator/project-topics',
  });

  // Step 5: Run draft formation
  const latestRun = await prisma.teamFormationRun.findFirst({
    where: { termId: activeTerm.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, createdAt: true, publishedAt: true },
  });
  const runStatus: WorkflowStepStatus = latestRun?.status === 'COMPLETED' ? 'done' : latestRun ? 'ready' : 'needs_action';
  steps.push({
    step: 5, title: 'Run draft team formation',
    status: runStatus,
    detail: latestRun
      ? `Latest run: ${latestRun.status}${latestRun.createdAt ? ` · ${new Date(latestRun.createdAt).toLocaleDateString()}` : ''}`
      : 'No formation run started yet.',
    href: '/dashboard/coordinator/team-formation',
  });

  // Step 6: Review warnings
  const unresolvedWarnings = latestRun
    ? await prisma.draftTeamWarning.count({ where: { runId: latestRun.id, resolved: false, severity: { in: ['HIGH', 'CRITICAL'] } } })
    : 0;
  const warnStatus: WorkflowStepStatus = latestRun?.status === 'COMPLETED' ? (unresolvedWarnings === 0 ? 'done' : 'needs_action') : 'not_started';
  steps.push({
    step: 6, title: 'Review draft warnings',
    status: warnStatus,
    detail: latestRun?.status === 'COMPLETED'
      ? (unresolvedWarnings > 0 ? `${unresolvedWarnings} unresolved HIGH/CRITICAL warning${unresolvedWarnings !== 1 ? 's' : ''}` : 'No critical warnings')
      : 'Run formation engine first.',
    href: '/dashboard/coordinator/team-formation',
  });

  // Step 7: Publish teams
  const batch = await prisma.formationBatch.findFirst({
    where: { termId: activeTerm.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });
  const publishedTeams = await prisma.team.count({ where: { academicTermId: activeTerm.id } });
  const publishStatus: WorkflowStepStatus = batch?.status === 'PUBLISHED' ? 'done' : latestRun?.status === 'COMPLETED' ? 'ready' : 'not_started';
  steps.push({
    step: 7, title: 'Publish teams',
    status: publishStatus,
    detail: batch?.status === 'PUBLISHED'
      ? `${publishedTeams} team${publishedTeams !== 1 ? 's' : ''} published`
      : latestRun?.status === 'COMPLETED' ? 'Draft formation ready — publish when satisfied' : 'Complete formation run first.',
    href: '/dashboard/coordinator/team-formation',
  });

  // Step 8: Monitor workload & risks
  const openRisks = await prisma.projectSelectionConflict.count({ where: { termId: activeTerm.id, resolved: false } });
  const riskStatus: WorkflowStepStatus = publishedTeams > 0 ? (openRisks > 0 ? 'needs_action' : 'done') : 'not_started';
  steps.push({
    step: 8, title: 'Monitor workload & conflicts',
    status: riskStatus,
    detail: publishedTeams > 0 ? `${openRisks} unresolved conflict${openRisks !== 1 ? 's' : ''} · ${publishedTeams} team${publishedTeams !== 1 ? 's' : ''} active` : 'Publish teams first.',
    href: '/dashboard/coordinator/conflicts',
  });

  return steps;
}
