/**
 * Supervisor Dashboard Service
 *
 * Returns data for /dashboard/supervisor.
 * Uses SupervisorProfile.id (not User.id) for team lookup — critical distinction.
 * Does NOT expose private student CognitiveProfile data.
 */

import { prisma } from '@/lib/db';

export type SupervisedTeamCard = {
  teamId: string;
  teamName: string;
  projectId: string | null;
  projectTitle: string | null;
  healthStatus: string;
  memberCount: number;
  activeTaskCount: number;
  overdueTaskCount: number;
  openQuestionsCount: number;
  leaderName: string | null;
  nextConsultation: { slotStart: Date; status: string } | null;
  needsAttention: boolean;
  attentionReasons: string[];
};

export type SupervisorConsultation = {
  bookingId: string;
  teamName: string;
  slotStart: Date;
  slotEnd: Date;
  status: string;
  hasBrief: boolean;
  hasNote: boolean;
  agenda: string | null;
};

export type SupervisorDashboard = {
  supervisorName: string | null;
  profileTitle: string | null;
  department: string | null;
  supervisorProfileId: string;
  teams: SupervisedTeamCard[];
  pendingConsultations: SupervisorConsultation[];
  upcomingConsultations: SupervisorConsultation[];
  recentConsultations: SupervisorConsultation[];
  stats: {
    totalTeams: number;
    atRiskTeams: number;
    criticalTeams: number;
    pendingRequests: number;
    upcomingMeetings: number;
  };
};

export async function getSupervisorDashboard(userId: string): Promise<SupervisorDashboard | null> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // CRITICAL: use SupervisorProfile.userId, not User.id directly
  const profile = await prisma.supervisorProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { name: true } },
      supervisedTeams: {
        include: {
          project: { select: { id: true, title: true } },
          members: {
            include: { user: { select: { id: true, name: true } } },
          },
          consultationBookings: {
            where: { status: { in: ['CONFIRMED', 'PENDING'] }, slotStart: { gte: now } },
            orderBy: { slotStart: 'asc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!profile) return null;

  const teamIds = profile.supervisedTeams.map((t) => t.id);

  // Fetch task stats and open questions per team
  const [taskStats, openQuestionCounts, recentActivity] = await Promise.all([
    prisma.task.groupBy({
      by: ['projectId'],
      where: {
        project: { teamId: { in: teamIds } },
        status: { notIn: ['CANCELLED'] },
      },
      _count: { id: true },
    }),

    prisma.openQuestion.groupBy({
      by: ['projectId'],
      where: {
        project: { teamId: { in: teamIds } },
        resolvedAt: null,
      },
      _count: { id: true },
    }),

    // Activity in last 7 days per team
    prisma.contributionLog.groupBy({
      by: ['projectId'],
      where: {
        project: { teamId: { in: teamIds } },
        loggedAt: { gte: sevenDaysAgo },
      },
      _count: { id: true },
    }),
  ]);

  // Build per-team overdue counts
  const overdueMap = new Map<string, number>();
  await Promise.all(
    teamIds.map(async (tid) => {
      const team = profile.supervisedTeams.find((t) => t.id === tid);
      if (!team?.project) return;
      const count = await prisma.task.count({
        where: {
          projectId: team.project.id,
          status: { notIn: ['DONE', 'CANCELLED'] },
          dueDate: { lt: now },
        },
      });
      overdueMap.set(tid, count);
    })
  );

  // Build task/question/activity maps keyed by projectId
  const taskCountMap = new Map(taskStats.map((s) => [s.projectId, s._count.id]));
  const questionCountMap = new Map(openQuestionCounts.map((s) => [s.projectId, s._count.id]));
  const activityMap = new Map(recentActivity.map((s) => [s.projectId, s._count.id]));

  // Build team cards
  const teams: SupervisedTeamCard[] = profile.supervisedTeams.map((team) => {
    const projectId = team.project?.id ?? null;
    const activeTaskCount = projectId ? (taskCountMap.get(projectId) ?? 0) : 0;
    const overdueTaskCount = overdueMap.get(team.id) ?? 0;
    const openQuestionsCount = projectId ? (questionCountMap.get(projectId) ?? 0) : 0;
    const hasRecentActivity = projectId ? (activityMap.get(projectId) ?? 0) > 0 : false;

    const leaderMember = team.members.find(
      (m) => (m.role as string).toUpperCase() === 'LEADER'
    );
    const leaderName = leaderMember?.user.name ?? null;

    const nextBooking = team.consultationBookings[0] ?? null;
    const nextConsultationDays = nextBooking
      ? Math.ceil((nextBooking.slotStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Attention logic (deterministic)
    const attentionReasons: string[] = [];
    if (overdueTaskCount > 0) attentionReasons.push(`${overdueTaskCount} overdue task${overdueTaskCount > 1 ? 's' : ''}`);
    if (openQuestionsCount > 0) attentionReasons.push(`${openQuestionsCount} open question${openQuestionsCount > 1 ? 's' : ''}`);
    if (!hasRecentActivity) attentionReasons.push('no activity logged this week');
    if (nextConsultationDays !== null && nextConsultationDays <= 3) {
      attentionReasons.push(`consultation in ${nextConsultationDays} day${nextConsultationDays !== 1 ? 's' : ''}`);
    }
    if (team.healthStatus === 'CRITICAL') attentionReasons.push('team health is critical');
    if (team.healthStatus === 'AT_RISK') attentionReasons.push('team health is at risk');

    return {
      teamId: team.id,
      teamName: team.name,
      projectId,
      projectTitle: team.project?.title ?? null,
      healthStatus: team.healthStatus,
      memberCount: team.members.length,
      activeTaskCount,
      overdueTaskCount,
      openQuestionsCount,
      leaderName,
      nextConsultation: nextBooking
        ? { slotStart: nextBooking.slotStart, status: nextBooking.status }
        : null,
      needsAttention: attentionReasons.length > 0,
      attentionReasons,
    };
  });

  // Consultation queries
  const [pendingBookings, upcomingBookings, recentCompleted] = await Promise.all([
    prisma.consultationBooking.findMany({
      where: { teamId: { in: teamIds }, status: 'PENDING' },
      include: {
        team: { select: { name: true } },
        brief: { select: { id: true } },
        meetingNote: { select: { id: true } },
      },
      orderBy: { slotStart: 'asc' },
    }),
    prisma.consultationBooking.findMany({
      where: { teamId: { in: teamIds }, status: 'CONFIRMED', slotStart: { gte: now } },
      include: {
        team: { select: { name: true } },
        brief: { select: { id: true } },
        meetingNote: { select: { id: true } },
      },
      orderBy: { slotStart: 'asc' },
      take: 5,
    }),
    prisma.consultationBooking.findMany({
      where: { teamId: { in: teamIds }, status: 'COMPLETED', slotStart: { gte: sevenDaysAgo } },
      include: {
        team: { select: { name: true } },
        brief: { select: { id: true } },
        meetingNote: { select: { id: true } },
      },
      orderBy: { slotStart: 'desc' },
      take: 5,
    }),
  ]);

  function mapConsultation(b: typeof pendingBookings[number]): SupervisorConsultation {
    return {
      bookingId: b.id,
      teamName: b.team.name,
      slotStart: b.slotStart,
      slotEnd: b.slotEnd,
      status: b.status,
      hasBrief: !!b.brief,
      hasNote: !!b.meetingNote,
      agenda: b.agenda,
    };
  }

  const atRiskTeams = teams.filter((t) => t.healthStatus === 'AT_RISK').length;
  const criticalTeams = teams.filter((t) => t.healthStatus === 'CRITICAL').length;

  return {
    supervisorName: profile.user.name,
    profileTitle: profile.title,
    department: profile.department,
    supervisorProfileId: profile.id,
    teams: teams.sort((a, b) => {
      // Sort: attention first, then by health
      if (a.needsAttention && !b.needsAttention) return -1;
      if (!a.needsAttention && b.needsAttention) return 1;
      return 0;
    }),
    pendingConsultations: pendingBookings.map(mapConsultation),
    upcomingConsultations: upcomingBookings.map(mapConsultation),
    recentConsultations: recentCompleted.map(mapConsultation),
    stats: {
      totalTeams: teams.length,
      atRiskTeams,
      criticalTeams,
      pendingRequests: pendingBookings.length,
      upcomingMeetings: upcomingBookings.length,
    },
  };
}
