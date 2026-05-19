/**
 * Contribution Intelligence Service
 *
 * Analyses and summarises team contribution patterns across multiple
 * contribution types — making invisible work visible without surveillance.
 *
 * Core philosophy:
 * - Fairness analysis looks at distribution, not absolute hours
 * - Soft contributions (clarification, support, review) count equally
 * - Trends matter more than single-day snapshots
 * - Output is supportive, not punitive
 */

import { prisma } from '@/lib/db';
import type { ContributionType } from '@prisma/client';

export type ContributionMix = {
  type: ContributionType;
  label: string;
  count: number;
  totalHours: number;
  percentage: number; // % of total count
};

export type MemberContributionProfile = {
  userId: string;
  name: string | null;
  email: string;
  teamRole: string;
  totalEntries: number;
  totalHours: number;
  lastActiveAt: Date | null;
  contributionMix: ContributionMix[];
  dominantType: ContributionType | null;
  diversityScore: number; // 0–1: ratio of unique types / total types
  recentEntries: {
    id: string;
    description: string;
    type: ContributionType;
    hours: number | null;
    loggedAt: Date;
  }[];
};

export type TeamContributionSummary = {
  projectId: string;
  totalEntries: number;
  totalHours: number;
  memberProfiles: MemberContributionProfile[];
  teamTypeMix: ContributionMix[];
  distributionIsFair: boolean;
  overloadedMembers: string[]; // userIds
  underContributingMembers: string[]; // userIds (< 50% of mean)
  recentActivityCount: number; // last 7 days
};

// Human-readable labels for each contribution type
export const CONTRIBUTION_LABELS: Record<ContributionType, string> = {
  CODE: 'Code',
  DESIGN: 'Design',
  RESEARCH: 'Research',
  WRITING: 'Writing',
  PLANNING: 'Planning',
  TESTING: 'Testing',
  COORDINATION: 'Coordination',
  REVIEW: 'Peer Review',
  DOCUMENTATION: 'Documentation',
  CLARIFICATION: 'Clarification',
  MEETING_PREP: 'Meeting Prep',
  UNBLOCKING_SUPPORT: 'Support Work',
  OTHER: 'Other',
};

// Contribution types considered "hidden" / often overlooked
export const HIDDEN_CONTRIBUTION_TYPES: ContributionType[] = [
  'COORDINATION',
  'REVIEW',
  'CLARIFICATION',
  'MEETING_PREP',
  'UNBLOCKING_SUPPORT',
];

export async function getTeamContributionSummary(
  teamId: string,
  projectId: string
): Promise<TeamContributionSummary> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const [allLogs, recentCount] = await Promise.all([
    prisma.contributionLog.findMany({
      where: { projectId },
      orderBy: { loggedAt: 'desc' },
    }),
    prisma.contributionLog.count({
      where: { projectId, loggedAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const totalEntries = allLogs.length;
  const totalHours = allLogs.reduce((s, l) => s + (l.hours ?? 0), 0);

  // Per-member profiles
  const memberProfiles: MemberContributionProfile[] = await Promise.all(
    members.map(async ({ user, role }) => {
      const myLogs = allLogs.filter((l) => l.userId === user.id);

      // Aggregate by type
      const typeCounts = new Map<ContributionType, { count: number; totalHours: number }>();
      for (const log of myLogs) {
        const existing = typeCounts.get(log.contributionType) ?? { count: 0, totalHours: 0 };
        typeCounts.set(log.contributionType, {
          count: existing.count + 1,
          totalHours: existing.totalHours + (log.hours ?? 0),
        });
      }

      const totalCount = myLogs.length;
      const contributionMix: ContributionMix[] = Array.from(typeCounts.entries()).map(
        ([type, { count, totalHours: h }]) => ({
          type,
          label: CONTRIBUTION_LABELS[type],
          count,
          totalHours: h,
          percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
        })
      ).sort((a, b) => b.count - a.count);

      const dominantType = contributionMix[0]?.type ?? null;
      const diversityScore = myLogs.length > 0
        ? typeCounts.size / Object.keys(CONTRIBUTION_LABELS).length
        : 0;

      const lastActiveAt = myLogs[0]?.loggedAt ?? null;

      const recentEntries = myLogs.slice(0, 5).map((l) => ({
        id: l.id,
        description: l.description,
        type: l.contributionType,
        hours: l.hours,
        loggedAt: l.loggedAt,
      }));

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        teamRole: role,
        totalEntries: totalCount,
        totalHours: myLogs.reduce((s, l) => s + (l.hours ?? 0), 0),
        lastActiveAt,
        contributionMix,
        dominantType,
        diversityScore: Math.round(diversityScore * 100) / 100,
        recentEntries,
      };
    })
  );

  // Team-level type mix
  const teamTypeCounts = new Map<ContributionType, { count: number; totalHours: number }>();
  for (const log of allLogs) {
    const existing = teamTypeCounts.get(log.contributionType) ?? { count: 0, totalHours: 0 };
    teamTypeCounts.set(log.contributionType, {
      count: existing.count + 1,
      totalHours: existing.totalHours + (log.hours ?? 0),
    });
  }

  const teamTypeMix: ContributionMix[] = Array.from(teamTypeCounts.entries()).map(
    ([type, { count, totalHours: h }]) => ({
      type,
      label: CONTRIBUTION_LABELS[type],
      count,
      totalHours: h,
      percentage: totalEntries > 0 ? Math.round((count / totalEntries) * 100) : 0,
    })
  ).sort((a, b) => b.count - a.count);

  // Fairness: is the contribution load distributed roughly evenly?
  const mean = memberProfiles.length > 0 ? totalEntries / memberProfiles.length : 0;
  const overloadedMembers = memberProfiles
    .filter((m) => m.totalEntries > mean * 2)
    .map((m) => m.userId);
  const underContributingMembers = memberProfiles
    .filter((m) => mean > 0 && m.totalEntries < mean * 0.5)
    .map((m) => m.userId);
  const distributionIsFair = overloadedMembers.length === 0 && underContributingMembers.length === 0;

  return {
    projectId,
    totalEntries,
    totalHours: Math.round(totalHours * 10) / 10,
    memberProfiles,
    teamTypeMix,
    distributionIsFair,
    overloadedMembers,
    underContributingMembers,
    recentActivityCount: recentCount,
  };
}

export async function getMemberContributionProfile(
  projectId: string,
  userId: string
): Promise<MemberContributionProfile | null> {
  const member = await prisma.teamMember.findFirst({
    where: { userId, team: { project: { id: projectId } } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!member) return null;

  const teamId = member.teamId;
  const summary = await getTeamContributionSummary(teamId, projectId);
  return summary.memberProfiles.find((p) => p.userId === userId) ?? null;
}
