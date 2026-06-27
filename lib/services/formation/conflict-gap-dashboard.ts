/**
 * Conflict & Gap Detection Dashboard — Service (Part 9)
 *
 * Deterministic, explainable aggregation of operational and formation risks.
 * Collects risks from:
 *   1. Formation readiness (student profiles, intake, batch state)
 *   2. Project selection conflicts (from Part 4 ProjectSelectionConflict)
 *   3. Draft formation warnings (from Part 5 DraftTeamWarning)
 *   4. Published team gaps (skill, role, size, supervisor)
 *   5. Workload/task risks (capacity overload, unassigned tasks)
 *   6. Schedule overlap risks (shared availability slots)
 *   7. Supervisor capacity risks
 *   8. Team health signals and friction events
 *
 * PRIVACY:
 *   - CognitiveProfile is NEVER queried.
 *   - privateSupportNotes is NEVER selected or returned.
 *   - Only public student names/emails and aggregate counts surface.
 */

import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';

// ── Shared type ───────────────────────────────────────────────────────────────

export type RiskSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RiskSource =
  | 'FORMATION_READINESS'
  | 'PROJECT_SELECTION'
  | 'DRAFT_FORMATION'
  | 'PUBLISHED_TEAM'
  | 'WORKLOAD_TASK'
  | 'SUPERVISOR_CAPACITY'
  | 'TEAM_HEALTH';

export type ConflictGapRiskItem = {
  id: string;
  source: RiskSource;
  type: string;
  severity: RiskSeverity;
  title: string;
  message: string;
  recommendedAction: string;
  entityLabel?: string;
  entityType?: 'student' | 'team' | 'topic' | 'task' | 'supervisor' | 'batch' | 'run';
  entityId?: string;
  href?: string;
  metadata?: Record<string, unknown>;
};

export type DashboardSummary = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  bySource: Record<RiskSource, number>;
};

export type RecommendedAction = {
  id: string;
  action: string;
  href?: string;
  count: number;
};

export type ConflictGapDashboardResult = {
  term: { id: string; name: string; code: string } | null;
  batch: { id: string; name: string; status: string } | null;
  risks: ConflictGapRiskItem[];
  summary: DashboardSummary;
  recommendedActions: RecommendedAction[];
};

// ── Helper ────────────────────────────────────────────────────────────────────

function riskId(source: string, type: string, suffix: string): string {
  return `${source}:${type}:${suffix}`;
}

const SEV_ORDER: Record<RiskSeverity, number> = {
  CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1,
};

// ── Active term/batch resolver ────────────────────────────────────────────────

async function resolveActiveTerm(termId?: string) {
  if (termId) {
    return prisma.academicTerm.findUnique({ where: { id: termId } });
  }
  return prisma.academicTerm.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
}

async function resolveActiveBatch(termId: string) {
  return prisma.formationBatch.findFirst({
    where: { termId },
    orderBy: { createdAt: 'desc' },
  });
}

// ── 1. Formation readiness risks ──────────────────────────────────────────────

export async function collectFormationReadinessRisks(
  termId: string
): Promise<ConflictGapRiskItem[]> {
  const risks: ConflictGapRiskItem[] = [];

  const intakes = await prisma.studentIntake.findMany({
    where: { termId },
    select: {
      id: true,
      status: true,
      studentProfileId: true,
      studentProfile: {
        select: {
          id: true,
          user: { select: { name: true, email: true } },
          formationProfile: {
            select: {
              id: true,
              status: true,
              completionScore: true,
              weeklyCapacityHours: true,
              skills: { select: { id: true }, take: 1 },
              availability: { select: { id: true }, take: 1 },
              rolePreferences: { select: { id: true }, take: 1 },
            },
          },
        },
      },
    },
  });

  const noProfile: string[] = [];
  const draftProfile: string[] = [];
  const lowScore: string[] = [];
  const noSkills: string[] = [];
  const noAvail: string[] = [];
  const noRoles: string[] = [];

  for (const intake of intakes) {
    const sp = intake.studentProfile;
    const name = sp?.user?.name ?? sp?.user?.email ?? intake.studentProfileId;

    if (!sp?.formationProfile) {
      noProfile.push(name);
      continue;
    }
    const fp = sp.formationProfile;
    if (fp.status === 'DRAFT' || fp.status === 'NEEDS_REVIEW') {
      draftProfile.push(name);
    }
    if ((fp.completionScore ?? 0) < 70) {
      lowScore.push(name);
    }
    if ((fp.skills?.length ?? 0) === 0) {
      noSkills.push(name);
    }
    if ((fp.availability?.length ?? 0) === 0) {
      noAvail.push(name);
    }
    if ((fp.rolePreferences?.length ?? 0) === 0) {
      noRoles.push(name);
    }
  }

  if (noProfile.length > 0) {
    const sev: RiskSeverity = noProfile.length >= 5 ? 'HIGH' : noProfile.length >= 2 ? 'MEDIUM' : 'LOW';
    risks.push({
      id: riskId('FORMATION_READINESS', 'NO_FORMATION_PROFILE', termId),
      source: 'FORMATION_READINESS',
      type: 'NO_FORMATION_PROFILE',
      severity: sev,
      title: `${noProfile.length} student${noProfile.length !== 1 ? 's' : ''} missing formation profile`,
      message: `${noProfile.slice(0, 4).join(', ')}${noProfile.length > 4 ? ` and ${noProfile.length - 4} more` : ''} have no formation profile.`,
      recommendedAction: 'Ask students to complete their Formation Profile before running team formation.',
      entityType: 'student',
      href: '/dashboard/coordinator/formation-setup',
      metadata: { count: noProfile.length },
    });
  }

  if (draftProfile.length > 0) {
    risks.push({
      id: riskId('FORMATION_READINESS', 'DRAFT_PROFILE', termId),
      source: 'FORMATION_READINESS',
      type: 'DRAFT_PROFILE',
      severity: draftProfile.length >= 4 ? 'MEDIUM' : 'LOW',
      title: `${draftProfile.length} student profile${draftProfile.length !== 1 ? 's' : ''} not yet submitted`,
      message: `${draftProfile.slice(0, 3).join(', ')}${draftProfile.length > 3 ? ` and ${draftProfile.length - 3} more` : ''} have profiles in DRAFT or NEEDS_REVIEW status.`,
      recommendedAction: 'Remind students to submit their formation profiles.',
      entityType: 'student',
      href: '/dashboard/coordinator/formation-setup',
      metadata: { count: draftProfile.length },
    });
  }

  if (lowScore.length > 0) {
    risks.push({
      id: riskId('FORMATION_READINESS', 'LOW_COMPLETION_SCORE', termId),
      source: 'FORMATION_READINESS',
      type: 'LOW_COMPLETION_SCORE',
      severity: lowScore.length >= 5 ? 'MEDIUM' : 'LOW',
      title: `${lowScore.length} student${lowScore.length !== 1 ? 's' : ''} have low profile completion (< 70%)`,
      message: 'Incomplete profiles reduce the quality of skill, availability, and role matching.',
      recommendedAction: 'Ask students to fill in skills, availability slots, and role preferences.',
      entityType: 'student',
      href: '/dashboard/coordinator/formation-setup',
      metadata: { count: lowScore.length },
    });
  }

  if (noSkills.length > 0) {
    risks.push({
      id: riskId('FORMATION_READINESS', 'NO_SKILLS', termId),
      source: 'FORMATION_READINESS',
      type: 'NO_SKILLS',
      severity: noSkills.length >= 3 ? 'MEDIUM' : 'LOW',
      title: `${noSkills.length} student${noSkills.length !== 1 ? 's' : ''} have no skills recorded`,
      message: 'Skill coverage scoring and skill-gap detection will be inaccurate without skill data.',
      recommendedAction: 'Ask students to add skills in their Formation Profile.',
      entityType: 'student',
      href: '/dashboard/coordinator/formation-setup',
      metadata: { count: noSkills.length },
    });
  }

  if (noAvail.length > 0) {
    risks.push({
      id: riskId('FORMATION_READINESS', 'NO_AVAILABILITY', termId),
      source: 'FORMATION_READINESS',
      type: 'NO_AVAILABILITY',
      severity: noAvail.length >= 3 ? 'MEDIUM' : 'LOW',
      title: `${noAvail.length} student${noAvail.length !== 1 ? 's' : ''} have no availability slots`,
      message: 'Schedule overlap scoring cannot be computed without availability data.',
      recommendedAction: 'Ask students to add weekly availability in their Formation Profile.',
      entityType: 'student',
      href: '/dashboard/coordinator/formation-setup',
      metadata: { count: noAvail.length },
    });
  }

  if (noRoles.length > 0) {
    risks.push({
      id: riskId('FORMATION_READINESS', 'NO_ROLE_PREFS', termId),
      source: 'FORMATION_READINESS',
      type: 'NO_ROLE_PREFS',
      severity: 'LOW',
      title: `${noRoles.length} student${noRoles.length !== 1 ? 's' : ''} have no role preferences`,
      message: 'Role assignment quality is reduced without role preference data.',
      recommendedAction: 'Ask students to set role preferences in their Formation Profile.',
      entityType: 'student',
      href: '/dashboard/coordinator/formation-setup',
      metadata: { count: noRoles.length },
    });
  }

  // Batch readiness
  const batch = await resolveActiveBatch(termId);
  if (!batch) {
    risks.push({
      id: riskId('FORMATION_READINESS', 'NO_BATCH', termId),
      source: 'FORMATION_READINESS',
      type: 'NO_BATCH',
      severity: 'HIGH',
      title: 'No formation batch exists for the active term',
      message: 'A formation batch is required before running the team formation engine.',
      recommendedAction: 'Create a formation batch in Formation Setup.',
      entityType: 'batch',
      href: '/dashboard/coordinator/formation-setup',
    });
  } else if (!['READY', 'PUBLISHED'].includes(batch.status)) {
    const includedCount = await prisma.formationBatchStudent.count({
      where: { batchId: batch.id },
    });
    if (includedCount === 0) {
      risks.push({
        id: riskId('FORMATION_READINESS', 'EMPTY_BATCH', batch.id),
        source: 'FORMATION_READINESS',
        type: 'EMPTY_BATCH',
        severity: 'HIGH',
        title: 'Formation batch has no included students',
        message: `Batch "${batch.name}" has no students added. The engine cannot form teams without students.`,
        recommendedAction: 'Add students to the formation batch via Formation Setup.',
        entityType: 'batch',
        entityId: batch.id,
        href: '/dashboard/coordinator/formation-setup',
      });
    }
  }

  return risks;
}

// ── 2. Project selection risks ────────────────────────────────────────────────

export async function collectProjectSelectionRisks(
  termId: string
): Promise<ConflictGapRiskItem[]> {
  const conflicts = await prisma.projectSelectionConflict.findMany({
    where: { termId, resolved: false },
    orderBy: { severity: 'desc' },
    include: {
      topic: { select: { id: true, title: true } },
      studentProfile: { select: { user: { select: { name: true, email: true } } } },
    },
  });

  const sevMap: Record<string, RiskSeverity> = {
    CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', INFO: 'INFO',
  };

  return conflicts.map((c) => ({
    id: riskId('PROJECT_SELECTION', c.type, c.id),
    source: 'PROJECT_SELECTION' as RiskSource,
    type: c.type,
    severity: sevMap[c.severity] ?? 'MEDIUM',
    title: c.title,
    message: c.message,
    recommendedAction: 'Review and resolve on the Project Topics page. Recalculate conflicts if needed.',
    entityLabel: c.topic?.title ?? c.studentProfile?.user?.name ?? undefined,
    entityType: c.topicId ? 'topic' : c.studentProfileId ? 'student' : undefined,
    entityId: c.topicId ?? c.studentProfileId ?? undefined,
    href: '/dashboard/coordinator/project-topics',
    metadata: (c.metadata ?? undefined) as Record<string, unknown> | undefined,
  }));
}

// ── 3. Draft formation risks ──────────────────────────────────────────────────

export async function collectDraftFormationRisks(
  termId: string
): Promise<ConflictGapRiskItem[]> {
  const risks: ConflictGapRiskItem[] = [];

  // Find latest completed run for this term
  const run = await prisma.teamFormationRun.findFirst({
    where: { termId, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, publishedAt: true },
  });

  if (!run) {
    risks.push({
      id: riskId('DRAFT_FORMATION', 'NO_COMPLETED_RUN', termId),
      source: 'DRAFT_FORMATION',
      type: 'NO_COMPLETED_RUN',
      severity: 'MEDIUM',
      title: 'No completed formation run found',
      message: 'The team formation engine has not produced a completed draft for this term. Draft teams, skill gaps, and role assignments cannot be evaluated.',
      recommendedAction: 'Run the team formation engine from the Team Formation Workspace.',
      entityType: 'run',
      href: '/dashboard/coordinator/team-formation',
    });
    return risks;
  }

  const sevMap: Record<string, RiskSeverity> = {
    CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', INFO: 'INFO',
  };

  const warnings = await prisma.draftTeamWarning.findMany({
    where: { runId: run.id, resolved: false },
    orderBy: { severity: 'desc' },
    include: {
      draftTeam: { select: { id: true, name: true } },
      studentProfile: { select: { user: { select: { name: true } } } },
      topic: { select: { title: true } },
    },
  });

  for (const w of warnings) {
    risks.push({
      id: riskId('DRAFT_FORMATION', w.type, w.id),
      source: 'DRAFT_FORMATION',
      type: w.type,
      severity: sevMap[w.severity] ?? 'MEDIUM',
      title: w.title,
      message: w.message,
      recommendedAction: 'Review in the Team Formation Workspace. Adjust team composition or mark teams READY after review.',
      entityLabel: w.draftTeam?.name ?? w.studentProfile?.user?.name ?? w.topic?.title ?? undefined,
      entityType: w.draftTeamId ? 'team' : w.studentProfileId ? 'student' : w.topicId ? 'topic' : undefined,
      entityId: w.draftTeamId ?? w.studentProfileId ?? w.topicId ?? undefined,
      href: '/dashboard/coordinator/team-formation',
      metadata: (w.metadata ?? undefined) as Record<string, unknown> | undefined,
    });
  }

  return risks;
}

// ── 4. Published team risks ───────────────────────────────────────────────────

export async function collectPublishedTeamRisks(
  termId: string
): Promise<ConflictGapRiskItem[]> {
  const risks: ConflictGapRiskItem[] = [];

  const batch = await resolveActiveBatch(termId);
  if (!batch) return risks;

  const teams = await prisma.team.findMany({
    where: { academicTermId: termId },
    select: {
      id: true,
      name: true,
      supervisorId: true,
      sourceDraftTeamId: true,
      members: {
        select: {
          id: true,
          role: true,
          profileId: true,
          profile: {
            select: {
              id: true,
            },
          },
        },
      },
      project: { select: { id: true, title: true } },
    },
  });

  for (const team of teams) {
    // No members
    if (team.members.length === 0) {
      risks.push({
        id: riskId('PUBLISHED_TEAM', 'NO_MEMBERS', team.id),
        source: 'PUBLISHED_TEAM',
        type: 'NO_MEMBERS',
        severity: 'CRITICAL',
        title: `Team "${team.name}" has no members`,
        message: 'This published team has no team members. It may have been created manually or members were removed.',
        recommendedAction: 'Add members to the team via Team Management.',
        entityLabel: team.name,
        entityType: 'team',
        entityId: team.id,
        href: '/dashboard/team-management',
      });
      continue;
    }

    // Team size outside batch bounds
    const memberCount = team.members.length;
    if (memberCount < batch.minTeamSize) {
      risks.push({
        id: riskId('PUBLISHED_TEAM', 'TEAM_TOO_SMALL', team.id),
        source: 'PUBLISHED_TEAM',
        type: 'TEAM_TOO_SMALL',
        severity: 'HIGH',
        title: `Team "${team.name}" is below minimum size (${memberCount}/${batch.minTeamSize})`,
        message: `This team has ${memberCount} member${memberCount !== 1 ? 's' : ''} but the batch minimum is ${batch.minTeamSize}.`,
        recommendedAction: 'Add more members to this team or review the batch configuration.',
        entityLabel: team.name,
        entityType: 'team',
        entityId: team.id,
        href: '/dashboard/team-management',
        metadata: { memberCount, minTeamSize: batch.minTeamSize },
      });
    }

    if (memberCount > batch.maxTeamSize) {
      risks.push({
        id: riskId('PUBLISHED_TEAM', 'TEAM_TOO_LARGE', team.id),
        source: 'PUBLISHED_TEAM',
        type: 'TEAM_TOO_LARGE',
        severity: 'MEDIUM',
        title: `Team "${team.name}" exceeds maximum size (${memberCount}/${batch.maxTeamSize})`,
        message: `This team has ${memberCount} member${memberCount !== 1 ? 's' : ''} but the batch maximum is ${batch.maxTeamSize}.`,
        recommendedAction: 'Move one or more members to another team.',
        entityLabel: team.name,
        entityType: 'team',
        entityId: team.id,
        href: '/dashboard/team-management',
        metadata: { memberCount, maxTeamSize: batch.maxTeamSize },
      });
    }

    // No project
    if (!team.project) {
      risks.push({
        id: riskId('PUBLISHED_TEAM', 'NO_PROJECT', team.id),
        source: 'PUBLISHED_TEAM',
        type: 'NO_PROJECT',
        severity: 'HIGH',
        title: `Team "${team.name}" has no project`,
        message: 'Students in this team cannot log tasks, milestones, or contributions without a linked project.',
        recommendedAction: 'Create a project for this team in Team Management.',
        entityLabel: team.name,
        entityType: 'team',
        entityId: team.id,
        href: '/dashboard/team-management',
      });
    }

    // No supervisor
    if (!team.supervisorId) {
      risks.push({
        id: riskId('PUBLISHED_TEAM', 'NO_SUPERVISOR', team.id),
        source: 'PUBLISHED_TEAM',
        type: 'NO_SUPERVISOR',
        severity: 'MEDIUM',
        title: `Team "${team.name}" has no supervisor assigned`,
        message: 'Students in this team cannot book consultations and have no academic supervisor.',
        recommendedAction: 'Assign a supervisor via Team Management.',
        entityLabel: team.name,
        entityType: 'team',
        entityId: team.id,
        href: '/dashboard/team-management',
      });
    }

    // No team leader
    const hasLeader = team.members.some((m) => m.role === 'LEADER');
    if (!hasLeader) {
      risks.push({
        id: riskId('PUBLISHED_TEAM', 'NO_LEADER', team.id),
        source: 'PUBLISHED_TEAM',
        type: 'NO_LEADER',
        severity: 'MEDIUM',
        title: `Team "${team.name}" has no team leader`,
        message: 'No member has the LEADER role. Teams function better with a designated leader.',
        recommendedAction: 'Promote one member to Team Leader in Team Management.',
        entityLabel: team.name,
        entityType: 'team',
        entityId: team.id,
        href: '/dashboard/team-management',
      });
    }

    // Check unresolved critical/high draft warnings for published team
    if (team.sourceDraftTeamId) {
      const unresolvedCritical = await prisma.draftTeamWarning.count({
        where: {
          draftTeamId: team.sourceDraftTeamId,
          resolved: false,
          severity: { in: ['CRITICAL', 'HIGH'] },
        },
      });
      if (unresolvedCritical > 0) {
        risks.push({
          id: riskId('PUBLISHED_TEAM', 'UNRESOLVED_DRAFT_WARNINGS', team.id),
          source: 'PUBLISHED_TEAM',
          type: 'UNRESOLVED_DRAFT_WARNINGS',
          severity: 'HIGH',
          title: `Team "${team.name}" was published with ${unresolvedCritical} unresolved warning${unresolvedCritical !== 1 ? 's' : ''}`,
          message: 'This team had unresolved HIGH or CRITICAL formation warnings when it was published.',
          recommendedAction: 'Review the original draft warnings and take corrective action if skill gaps or conflicts were ignored.',
          entityLabel: team.name,
          entityType: 'team',
          entityId: team.id,
          href: '/dashboard/coordinator/team-formation',
          metadata: { unresolvedCritical },
        });
      }
    }
  }

  return risks;
}

// ── 5. Workload / task risks ──────────────────────────────────────────────────

export async function collectWorkloadTaskRisks(
  termId: string
): Promise<ConflictGapRiskItem[]> {
  const risks: ConflictGapRiskItem[] = [];

  const teams = await prisma.team.findMany({
    where: { academicTermId: termId },
    select: {
      id: true,
      name: true,
      members: {
        select: {
          id: true,
          userId: true,
          profileId: true,
          profile: {
            select: {
              formationProfile: {
                select: {
                  weeklyCapacityHours: true,
                  maxConcurrentTasks: true,
                },
              },
            },
          },
          user: { select: { name: true, email: true } },
        },
      },
      project: {
        select: {
          id: true,
          tasks: {
            where: { status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] } },
            select: {
              id: true,
              title: true,
              priority: true,
              status: true,
              assigneeId: true,
              estimatedMinutes: true,
              cognitiveLoad: true,
              requiredSkills: true,
              suggestedRoleKey: true,
              dueDate: true,
            },
          },
        },
      },
    },
  });

  for (const team of teams) {
    if (!team.project) continue;

    const activeTasks = team.project.tasks;
    if (activeTasks.length === 0) continue;

    // Build per-member load map
    const memberMap = new Map(
      team.members.map((m) => ({
        ...m,
        assignedMinutes: 0,
        assignedCount: 0,
      })).map((m) => [m.userId, m])
    );

    for (const task of activeTasks) {
      if (task.assigneeId) {
        const m = memberMap.get(task.assigneeId);
        if (m) {
          m.assignedMinutes += task.estimatedMinutes ?? 60;
          m.assignedCount += 1;
        }
      }
    }

    for (const member of Array.from(memberMap.values())) {
      const fp = member.profile?.formationProfile;
      const weeklyCapHours = fp?.weeklyCapacityHours ?? 10;
      const maxConcurrent = fp?.maxConcurrentTasks ?? 4;
      const assignedHours = member.assignedMinutes / 60;
      const name = member.user?.name ?? member.user?.email ?? member.userId;

      if (assignedHours > weeklyCapHours * 1.5) {
        risks.push({
          id: riskId('WORKLOAD_TASK', 'SEVERE_OVERLOAD', `${team.id}-${member.userId}`),
          source: 'WORKLOAD_TASK',
          type: 'SEVERE_OVERLOAD',
          severity: 'HIGH',
          title: `${name} is severely overloaded in "${team.name}"`,
          message: `Assigned task load is ${assignedHours.toFixed(1)}h vs ${weeklyCapHours}h weekly capacity (${Math.round((assignedHours / weeklyCapHours) * 100)}% utilisation).`,
          recommendedAction: 'Redistribute tasks to other team members to rebalance workload.',
          entityLabel: name,
          entityType: 'student',
          entityId: member.profileId,
          href: `/dashboard/tasks`,
          metadata: { assignedHours, weeklyCapHours, team: team.name },
        });
      } else if (assignedHours > weeklyCapHours) {
        risks.push({
          id: riskId('WORKLOAD_TASK', 'OVERLOAD', `${team.id}-${member.userId}`),
          source: 'WORKLOAD_TASK',
          type: 'OVERLOAD',
          severity: 'MEDIUM',
          title: `${name} may be overloaded in "${team.name}"`,
          message: `Assigned task load is ${assignedHours.toFixed(1)}h vs ${weeklyCapHours}h weekly capacity.`,
          recommendedAction: 'Review this member\'s task load and consider reassigning lower-priority tasks.',
          entityLabel: name,
          entityType: 'student',
          entityId: member.profileId,
          href: `/dashboard/tasks`,
          metadata: { assignedHours, weeklyCapHours, team: team.name },
        });
      }

      if (member.assignedCount > maxConcurrent) {
        risks.push({
          id: riskId('WORKLOAD_TASK', 'TOO_MANY_CONCURRENT', `${team.id}-${member.userId}`),
          source: 'WORKLOAD_TASK',
          type: 'TOO_MANY_CONCURRENT',
          severity: 'MEDIUM',
          title: `${name} has ${member.assignedCount} concurrent active tasks (max ${maxConcurrent})`,
          message: `Exceeding the recommended concurrent task limit can reduce focus and quality of work.`,
          recommendedAction: 'Close or unassign lower-priority tasks for this member.',
          entityLabel: name,
          entityType: 'student',
          entityId: member.profileId,
          href: `/dashboard/tasks`,
          metadata: { assignedCount: member.assignedCount, maxConcurrent, team: team.name },
        });
      }
    }

    // Unassigned HIGH/URGENT tasks
    const unassignedUrgent = activeTasks.filter(
      (t) => !t.assigneeId && (t.priority === 'HIGH' || t.priority === 'URGENT')
    );
    if (unassignedUrgent.length > 0) {
      risks.push({
        id: riskId('WORKLOAD_TASK', 'UNASSIGNED_URGENT', team.id),
        source: 'WORKLOAD_TASK',
        type: 'UNASSIGNED_URGENT',
        severity: unassignedUrgent.some((t) => t.priority === 'URGENT') ? 'HIGH' : 'MEDIUM',
        title: `${unassignedUrgent.length} unassigned HIGH/URGENT task${unassignedUrgent.length !== 1 ? 's' : ''} in "${team.name}"`,
        message: `Tasks: ${unassignedUrgent.map((t) => `"${t.title}"`).slice(0, 3).join(', ')}${unassignedUrgent.length > 3 ? '…' : ''} need assignment.`,
        recommendedAction: 'Assign urgent tasks immediately to prevent deadline risk.',
        entityLabel: team.name,
        entityType: 'team',
        entityId: team.id,
        href: `/dashboard/tasks`,
        metadata: { count: unassignedUrgent.length, team: team.name },
      });
    }

    // Overdue tasks
    const now = new Date();
    const overdueTasks = activeTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE' && t.status !== 'CANCELLED'
    );
    if (overdueTasks.length >= 2) {
      risks.push({
        id: riskId('WORKLOAD_TASK', 'MANY_OVERDUE', team.id),
        source: 'WORKLOAD_TASK',
        type: 'MANY_OVERDUE',
        severity: overdueTasks.length >= 4 ? 'HIGH' : 'MEDIUM',
        title: `${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''} in "${team.name}"`,
        message: `Multiple tasks have passed their due date without completion.`,
        recommendedAction: 'Review task statuses with the team and update or reschedule as appropriate.',
        entityLabel: team.name,
        entityType: 'team',
        entityId: team.id,
        href: `/dashboard/tasks`,
        metadata: { count: overdueTasks.length },
      });
    }
  }

  return risks;
}

// ── 6. Schedule overlap risks ─────────────────────────────────────────────────

async function collectScheduleOverlapRisks(termId: string): Promise<ConflictGapRiskItem[]> {
  const risks: ConflictGapRiskItem[] = [];

  const teams = await prisma.team.findMany({
    where: { academicTermId: termId },
    select: {
      id: true,
      name: true,
      members: {
        select: {
          profileId: true,
          profile: {
            select: {
              formationProfile: {
                select: {
                  availability: {
                    select: { dayOfWeek: true, block: true, level: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  for (const team of teams) {
    if (team.members.length < 2) continue;

    // Count slot keys where at least 2 members have level AVAILABLE or PREFERRED
    const slotCountMap = new Map<string, number>();
    for (const member of team.members) {
      const seen = new Set<string>();
      for (const slot of member.profile?.formationProfile?.availability ?? []) {
        if (slot.level === 'AVAILABLE' || slot.level === 'PREFERRED') {
          const key = `${slot.dayOfWeek}-${slot.block}`;
          if (!seen.has(key)) {
            slotCountMap.set(key, (slotCountMap.get(key) ?? 0) + 1);
            seen.add(key);
          }
        }
      }
    }

    const sharedSlots = Array.from(slotCountMap.values()).filter(
      (count) => count >= Math.ceil(team.members.length * 0.6)
    );

    if (sharedSlots.length < 2) {
      risks.push({
        id: riskId('PUBLISHED_TEAM', 'WEAK_SCHEDULE_OVERLAP', team.id),
        source: 'PUBLISHED_TEAM',
        type: 'WEAK_SCHEDULE_OVERLAP',
        severity: sharedSlots.length === 0 ? 'HIGH' : 'MEDIUM',
        title: `Team "${team.name}" has weak schedule overlap (${sharedSlots.length} shared slot${sharedSlots.length !== 1 ? 's' : ''})`,
        message: `Fewer than 2 time slots are shared by most team members, making regular meetings difficult.`,
        recommendedAction: 'Encourage members to add more availability. Consider flexible asynchronous meeting formats.',
        entityLabel: team.name,
        entityType: 'team',
        entityId: team.id,
        href: '/dashboard/coordinator/formation-setup',
        metadata: { sharedSlots: sharedSlots.length, memberCount: team.members.length },
      });
    }
  }

  return risks;
}

// ── 7. Supervisor capacity risks ──────────────────────────────────────────────

async function collectSupervisorCapacityRisks(termId: string): Promise<ConflictGapRiskItem[]> {
  const risks: ConflictGapRiskItem[] = [];

  const supervisors = await prisma.supervisorProfile.findMany({
    select: {
      id: true,
      user: { select: { name: true, email: true } },
      supervisedTeams: {
        where: { academicTermId: termId },
        select: { id: true, name: true },
      },
    },
  });

  const SUPERVISOR_SOFT_CAP = 4;

  for (const sup of supervisors) {
    if (sup.supervisedTeams.length > SUPERVISOR_SOFT_CAP) {
      const name = sup.user?.name ?? sup.user?.email ?? sup.id;
      risks.push({
        id: riskId('SUPERVISOR_CAPACITY', 'OVER_CAPACITY', sup.id),
        source: 'SUPERVISOR_CAPACITY',
        type: 'OVER_CAPACITY',
        severity: 'MEDIUM',
        title: `Supervisor "${name}" is assigned to ${sup.supervisedTeams.length} teams (soft cap: ${SUPERVISOR_SOFT_CAP})`,
        message: `Supervising too many teams may reduce the quality of feedback and consultation availability.`,
        recommendedAction: 'Consider redistributing teams across supervisors.',
        entityLabel: name,
        entityType: 'supervisor',
        entityId: sup.id,
        href: '/dashboard/supervisor-management',
        metadata: { teamCount: sup.supervisedTeams.length, cap: SUPERVISOR_SOFT_CAP },
      });
    }
  }

  // Supervisors with no teams in this term
  const supervisorsWithNoTeams = supervisors.filter((s) => s.supervisedTeams.length === 0);
  if (supervisorsWithNoTeams.length > 0) {
    risks.push({
      id: riskId('SUPERVISOR_CAPACITY', 'UNASSIGNED_SUPERVISORS', termId),
      source: 'SUPERVISOR_CAPACITY',
      type: 'UNASSIGNED_SUPERVISORS',
      severity: 'INFO',
      title: `${supervisorsWithNoTeams.length} supervisor${supervisorsWithNoTeams.length !== 1 ? 's' : ''} not assigned to any team`,
      message: `${supervisorsWithNoTeams.map((s) => s.user?.name ?? s.id).slice(0, 3).join(', ')}${supervisorsWithNoTeams.length > 3 ? ' and others' : ''} have no teams for this term.`,
      recommendedAction: 'Assign teams to all available supervisors for better coverage.',
      entityType: 'supervisor',
      href: '/dashboard/supervisor-management',
      metadata: { count: supervisorsWithNoTeams.length },
    });
  }

  return risks;
}

// ── 8. Team health risks ──────────────────────────────────────────────────────

async function collectTeamHealthRisks(termId: string): Promise<ConflictGapRiskItem[]> {
  const risks: ConflictGapRiskItem[] = [];

  const teams = await prisma.team.findMany({
    where: { academicTermId: termId },
    select: {
      id: true,
      name: true,
      healthSignals: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
        select: {
          healthStatus: true,
          overdueTaskCount: true,
          workloadIsFair: true,
        },
      },
      frictionEvents: {
        where: { resolved: false },
        select: { id: true, severity: true, eventType: true },
      },
    },
  });

  for (const team of teams) {
    const signal = team.healthSignals[0];
    if (signal) {
      if (signal.healthStatus === 'AT_RISK' || signal.healthStatus === 'CRITICAL') {
        risks.push({
          id: riskId('TEAM_HEALTH', 'HEALTH_SIGNAL', team.id),
          source: 'TEAM_HEALTH',
          type: 'HEALTH_SIGNAL',
          severity: signal.healthStatus === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          title: `Team "${team.name}" health is ${signal.healthStatus}`,
          message: `Latest team health signal indicates ${signal.overdueTaskCount} overdue task${signal.overdueTaskCount !== 1 ? 's' : ''} and ${signal.workloadIsFair ? 'fair' : 'uneven'} workload distribution.`,
          recommendedAction: 'Review team activity and task completion. Schedule a check-in if needed.',
          entityLabel: team.name,
          entityType: 'team',
          entityId: team.id,
          href: '/dashboard/team-management',
        });
      }
    }

    const criticalFriction = team.frictionEvents.filter((e) => e.severity === 'HIGH');
    const unresolvedFriction = team.frictionEvents.length;
    if (unresolvedFriction > 0) {
      risks.push({
        id: riskId('TEAM_HEALTH', 'FRICTION_EVENTS', team.id),
        source: 'TEAM_HEALTH',
        type: 'FRICTION_EVENTS',
        severity: criticalFriction.length > 0 ? 'HIGH' : 'MEDIUM',
        title: `Team "${team.name}" has ${unresolvedFriction} unresolved friction event${unresolvedFriction !== 1 ? 's' : ''}`,
        message: `Unresolved friction events (e.g. silent members, disengagement, missed deadlines) need attention.`,
        recommendedAction: 'Review friction events and resolve or escalate through the supervisor.',
        entityLabel: team.name,
        entityType: 'team',
        entityId: team.id,
        href: '/dashboard/team-management',
        metadata: { unresolvedFriction, criticalCount: criticalFriction.length },
      });
    }
  }

  return risks;
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function summariseRiskItems(risks: ConflictGapRiskItem[]): DashboardSummary {
  const summary: DashboardSummary = {
    total: risks.length,
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
    bySource: {
      FORMATION_READINESS: 0, PROJECT_SELECTION: 0, DRAFT_FORMATION: 0,
      PUBLISHED_TEAM: 0, WORKLOAD_TASK: 0, SUPERVISOR_CAPACITY: 0, TEAM_HEALTH: 0,
    },
  };
  for (const r of risks) {
    summary[r.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'info']++;
    summary.bySource[r.source]++;
  }
  return summary;
}

// ── Recommended actions ───────────────────────────────────────────────────────

export function buildRecommendedActions(risks: ConflictGapRiskItem[]): RecommendedAction[] {
  const actionMap = new Map<string, RecommendedAction>();

  const upsert = (id: string, action: string, href?: string) => {
    const existing = actionMap.get(id);
    if (existing) {
      existing.count++;
    } else {
      actionMap.set(id, { id, action, href, count: 1 });
    }
  };

  for (const r of risks) {
    switch (r.source) {
      case 'FORMATION_READINESS':
        upsert('complete-profiles', 'Ask students to complete their Formation Profiles', '/dashboard/student/formation-profile');
        break;
      case 'PROJECT_SELECTION':
        upsert('recalc-conflicts', 'Recalculate project selection conflicts', '/dashboard/coordinator/project-topics');
        break;
      case 'DRAFT_FORMATION':
        if (r.type === 'NO_COMPLETED_RUN') {
          upsert('run-engine', 'Run the team formation engine', '/dashboard/coordinator/team-formation');
        } else {
          upsert('review-draft', 'Review draft formation warnings in the workspace', '/dashboard/coordinator/team-formation');
        }
        break;
      case 'PUBLISHED_TEAM':
        if (r.type === 'NO_PROJECT' || r.type === 'NO_SUPERVISOR' || r.type === 'NO_MEMBERS') {
          upsert('fix-teams', 'Fix team setup gaps (missing project/supervisor/members)', '/dashboard/team-management');
        } else if (r.type === 'WEAK_SCHEDULE_OVERLAP') {
          upsert('schedule-flexibility', 'Encourage members to update their availability', '/dashboard/coordinator/formation-setup');
        } else {
          upsert('review-teams', 'Review published team configurations', '/dashboard/team-management');
        }
        break;
      case 'WORKLOAD_TASK':
        upsert('rebalance-tasks', 'Rebalance overloaded task assignments', '/dashboard/tasks');
        break;
      case 'SUPERVISOR_CAPACITY':
        upsert('reassign-supervisors', 'Review and redistribute supervisor assignments', '/dashboard/supervisor-management');
        break;
      case 'TEAM_HEALTH':
        upsert('check-team-health', 'Review team health signals and friction events', '/dashboard/team-management');
        break;
    }
  }

  return Array.from(actionMap.values()).sort((a, b) => b.count - a.count);
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function getCoordinatorConflictGapDashboard(
  termId?: string
): Promise<ConflictGapDashboardResult> {
  try {
    const term = await resolveActiveTerm(termId);

    if (!term) {
      return {
        term: null,
        batch: null,
        risks: [],
        summary: summariseRiskItems([]),
        recommendedActions: [],
      };
    }

    const batch = await resolveActiveBatch(term.id);

    const [
      readinessRisks,
      selectionRisks,
      draftRisks,
      teamRisks,
      workloadRisks,
      scheduleRisks,
      supervisorRisks,
      healthRisks,
    ] = await Promise.all([
      collectFormationReadinessRisks(term.id),
      collectProjectSelectionRisks(term.id),
      collectDraftFormationRisks(term.id),
      collectPublishedTeamRisks(term.id),
      collectWorkloadTaskRisks(term.id),
      collectScheduleOverlapRisks(term.id),
      collectSupervisorCapacityRisks(term.id),
      collectTeamHealthRisks(term.id),
    ]);

    const allRisks: ConflictGapRiskItem[] = [
      ...readinessRisks,
      ...selectionRisks,
      ...draftRisks,
      ...teamRisks,
      ...workloadRisks,
      ...scheduleRisks,
      ...supervisorRisks,
      ...healthRisks,
    ].sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity]);

    return {
      term: { id: term.id, name: term.name, code: term.code },
      batch: batch
        ? { id: batch.id, name: batch.name, status: batch.status }
        : null,
      risks: allRisks,
      summary: summariseRiskItems(allRisks),
      recommendedActions: buildRecommendedActions(allRisks),
    };
  } catch (err) {
    log.error('conflict-gap-dashboard.error', { error: String(err) });
    return {
      term: null,
      batch: null,
      risks: [],
      summary: summariseRiskItems([]),
      recommendedActions: [],
    };
  }
}
