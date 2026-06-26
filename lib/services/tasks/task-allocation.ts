/**
 * Capacity-Aware Task Allocation — Service (Part 8)
 *
 * Recommends fair, explainable task assignees for a team. Deterministic, no
 * AI: the same team/task input always produces the same recommendation.
 * Humans always confirm — nothing here silently sets an assignee.
 *
 * WHAT THIS IS NOT:
 *   - It does not create or modify Team / TeamMember / Project records.
 *   - It does not auto-assign tasks. Applying a recommendation is an explicit,
 *     separate, human-confirmed action (see applyTaskAllocationDecision).
 *
 * PRIVACY (hard rules):
 *   - CognitiveProfile is NEVER queried.
 *   - privateSupportNotes is NEVER selected, stored, or surfaced.
 *   - Only StudentFormationProfile.safeSupportPreferences (non-diagnostic
 *     work-pattern flags) is read, and only to produce generic task-guidance
 *     hints. No diagnosis or neurodivergent labels appear anywhere.
 */

import { prisma, Prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import { getRoleDefinition } from '@/lib/formation/role-suitability';
import {
  ACTIVE_TASK_STATUSES,
  ALLOCATION_WEIGHTS,
  DEFAULT_MAX_CONCURRENT_TASKS,
  DEFAULT_TASK_MINUTES,
  DEFAULT_WEEKLY_CAPACITY_HOURS,
} from '@/lib/task-allocation/options';
import {
  computeOverallScore,
  deriveRiskLevel,
  inferRelevantRoleKeys,
  scoreCapacityAvailable,
  scoreCurrentLoadFairness,
  scoreDueDateFeasibility,
  scoreRoleMatch,
  scoreSkillMatch,
  scoreSupportFit,
  type CapacityResult,
} from '@/lib/task-allocation/scoring';
import type {
  MemberAllocationContext,
  MemberWorkloadOverview,
  TaskAllocationContext,
  TaskAllocationInput,
  TaskAllocationRecommendationResult,
  TaskAssigneeRecommendation,
  TeamWorkloadOverview,
} from '@/lib/task-allocation/types';

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Loads the deterministic allocation context for a team: every team member's
 * skills, resolved role, weekly capacity, and current active-task load.
 * Never reads CognitiveProfile or privateSupportNotes.
 */
export async function getTaskAllocationContext(teamId: string): Promise<TaskAllocationContext> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      project: { select: { id: true } },
      sourceDraftTeam: {
        select: {
          members: {
            select: { studentProfileId: true, suggestedRoleKey: true, suggestedRoleLabel: true },
          },
        },
      },
      members: {
        select: {
          userId: true,
          profileId: true,
          role: true,
          user: { select: { name: true, email: true } },
          profile: {
            select: {
              formationProfile: {
                select: {
                  weeklyCapacityHours: true,
                  maxConcurrentTasks: true,
                  safeSupportPreferences: true,
                  skills: { select: { skillKey: true, level: true } },
                  rolePreferences: {
                    select: { roleKey: true, roleLabel: true, preferenceLevel: true, confidenceLevel: true, avoid: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!team) throw new Error('Team not found.');

  const projectId = team.project?.id ?? null;
  const publishedRoleByProfile = new Map(
    (team.sourceDraftTeam?.members ?? []).map((m) => [m.studentProfileId, m])
  );

  const loadByUserId = projectId ? await loadActiveTaskStats(projectId) : new Map<string, { count: number; hours: number }>();

  const members: MemberAllocationContext[] = team.members.map((m) => {
    const fp = m.profile.formationProfile;
    const published = publishedRoleByProfile.get(m.profileId);

    let resolvedRoleKey: string | null = published?.suggestedRoleKey ?? null;
    let resolvedRoleLabel: string | null = published?.suggestedRoleLabel ?? null;
    if (!resolvedRoleKey && fp?.rolePreferences) {
      const best = fp.rolePreferences
        .filter((rp) => !rp.avoid)
        .sort((a, b) => b.preferenceLevel * b.confidenceLevel - a.preferenceLevel * a.confidenceLevel)[0];
      if (best) {
        resolvedRoleKey = best.roleKey;
        resolvedRoleLabel = best.roleLabel;
      }
    }

    const load = loadByUserId.get(m.userId) ?? { count: 0, hours: 0 };
    const safeSupport = normalizeSupportFlags(fp?.safeSupportPreferences);

    return {
      userId: m.userId,
      studentProfileId: m.profileId,
      name: m.user?.name ?? 'Student',
      email: m.user?.email ?? '',
      teamMemberRole: m.role,
      resolvedRoleKey,
      resolvedRoleLabel,
      skills: (fp?.skills ?? []).map((s) => ({ skillKey: s.skillKey, level: s.level })),
      weeklyCapacityHours: fp?.weeklyCapacityHours ?? DEFAULT_WEEKLY_CAPACITY_HOURS,
      maxConcurrentTasks: fp?.maxConcurrentTasks ?? DEFAULT_MAX_CONCURRENT_TASKS,
      hasFormationProfile: !!fp,
      safeSupportPreferences: safeSupport,
      activeTaskCount: load.count,
      currentAssignedHours: Math.round(load.hours * 10) / 10,
    };
  });

  const ratios = members.map((m) => m.currentAssignedHours / Math.max(1, m.weeklyCapacityHours));
  const teamMeanLoadRatio = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;

  return { teamId, projectId, members, teamMeanLoadRatio };
}

/**
 * Returns each team member's active task count and total assigned hours
 * (estimatedMinutes, or the safe default when missing) within the team's project.
 */
export async function calculateMemberTaskLoad(
  teamId: string
): Promise<{ userId: string; activeTaskCount: number; currentAssignedHours: number }[]> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { project: { select: { id: true } } } });
  if (!team?.project) return [];
  const map = await loadActiveTaskStats(team.project.id);
  return Array.from(map.entries()).map(([userId, v]) => ({
    userId,
    activeTaskCount: v.count,
    currentAssignedHours: Math.round(v.hours * 10) / 10,
  }));
}

async function loadActiveTaskStats(projectId: string): Promise<Map<string, { count: number; hours: number }>> {
  const tasks = await prisma.task.findMany({
    where: { projectId, status: { in: [...ACTIVE_TASK_STATUSES] }, assigneeId: { not: null } },
    select: { assigneeId: true, estimatedMinutes: true },
  });
  const map = new Map<string, { count: number; hours: number }>();
  for (const t of tasks) {
    if (!t.assigneeId) continue;
    const prev = map.get(t.assigneeId) ?? { count: 0, hours: 0 };
    prev.count += 1;
    prev.hours += (t.estimatedMinutes ?? DEFAULT_TASK_MINUTES) / 60;
    map.set(t.assigneeId, prev);
  }
  return map;
}

/**
 * Capacity-focused risk check for a single member against a candidate task —
 * usable standalone (e.g. for quick UI hints) or as part of a full recommendation.
 */
export function calculateCapacityRisk(
  member: MemberAllocationContext,
  taskInput: Pick<TaskAllocationInput, 'estimatedMinutes'>
): CapacityResult & { isSaturated: boolean } {
  const capacity = scoreCapacityAvailable(member, taskInput.estimatedMinutes);
  const isSaturated = member.activeTaskCount >= member.maxConcurrentTasks;
  return { ...capacity, isSaturated };
}

/**
 * Scores every eligible team member against a (possibly draft) task and
 * returns ranked, explainable recommendations. Never auto-assigns.
 */
export async function recommendAssigneesForTask(
  input: TaskAllocationInput
): Promise<TaskAllocationRecommendationResult> {
  const ctx = await getTaskAllocationContext(input.teamId);
  const requiredSkills = input.requiredSkills ?? [];
  const preferredSkills = input.preferredSkills ?? [];
  const dueDate = input.dueDate ? new Date(input.dueDate) : null;

  const inferredRoles = inferRelevantRoleKeys(requiredSkills);
  const relevantRoleKeys = input.suggestedRoleKey
    ? [input.suggestedRoleKey, ...inferredRoles.filter((r) => r !== input.suggestedRoleKey)]
    : inferredRoles;
  const suggestedRoleKey = relevantRoleKeys[0] ?? null;

  const notes: string[] = [];
  if (ctx.members.length === 0) {
    notes.push('This team has no members yet — no recommendations are available.');
  }

  const candidates: TaskAssigneeRecommendation[] = ctx.members.map((member) => {
    const skill = scoreSkillMatch(member, requiredSkills, preferredSkills);
    const role = scoreRoleMatch(member, relevantRoleKeys);
    const capacity = scoreCapacityAvailable(member, input.estimatedMinutes);
    const load = scoreCurrentLoadFairness(member, ctx.teamMeanLoadRatio);
    const dueDateScore = scoreDueDateFeasibility(dueDate, input.estimatedMinutes, member);
    const support = scoreSupportFit(member, input.cognitiveLoad);

    const overall = computeOverallScore(
      {
        skillScore: skill.score,
        roleScore: role.score,
        capacityScore: capacity.score,
        currentLoadScore: load.score,
        dueDateScore,
        supportFitScore: support.score,
      },
      ALLOCATION_WEIGHTS
    );

    const newTaskHours = (input.estimatedMinutes ?? DEFAULT_TASK_MINUTES) / 60;
    const { level: riskLevel, warnings: riskWarnings } = deriveRiskLevel({
      skillScore: skill.score,
      utilization: capacity.utilization,
      missingSkills: skill.missingSkills,
      activeTaskCount: member.activeTaskCount,
      maxConcurrentTasks: member.maxConcurrentTasks,
      dueDateScore,
      cognitiveLoad: input.cognitiveLoad,
      availableCapacityHours: capacity.availableCapacityHours,
      newTaskHours,
    });

    const reasons = buildReasons({ member, skill, role, capacity, load, dueDateScore, support, dueDate });
    const warnings = [...riskWarnings, ...(member.hasFormationProfile ? [] : ['No formation profile on file — using default capacity assumptions.'])];

    return {
      userId: member.userId,
      studentProfileId: member.studentProfileId,
      name: member.name,
      email: member.email,
      score: overall,
      skillScore: skill.score,
      roleScore: role.score,
      capacityScore: capacity.score,
      currentLoadScore: load.score,
      dueDateScore,
      supportFitScore: support.score,
      riskLevel,
      reasons,
      warnings,
      availableCapacityHours: capacity.availableCapacityHours,
      currentAssignedHours: member.currentAssignedHours,
      projectedAssignedHours: capacity.projectedHours,
      recommended: false,
    };
  });

  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.projectedAssignedHours - b.projectedAssignedHours ||
      a.currentAssignedHours - b.currentAssignedHours ||
      a.name.localeCompare(b.name) ||
      a.userId.localeCompare(b.userId)
  );
  if (candidates.length > 0) candidates[0].recommended = true;

  if (requiredSkills.length > 0 && candidates.every((c) => c.skillScore < 50)) {
    notes.push('No team member has a strong match for the required skill(s). Consider the closest candidate and pair with support.');
  }

  return { suggestedRoleKey, candidates, notes };
}

/** Builds the plain-text "why this candidate" explanation for a recommendation. */
export function explainTaskRecommendation(recommendation: TaskAssigneeRecommendation): string {
  const parts = [...recommendation.reasons];
  if (recommendation.warnings.length > 0) parts.push(...recommendation.warnings.map((w) => `Caution: ${w}`));
  parts.push(`Overall fit ${recommendation.score}/100 (risk: ${recommendation.riskLevel}).`);
  return parts.join(' ');
}

function buildReasons(args: {
  member: MemberAllocationContext;
  skill: ReturnType<typeof scoreSkillMatch>;
  role: ReturnType<typeof scoreRoleMatch>;
  capacity: CapacityResult;
  load: ReturnType<typeof scoreCurrentLoadFairness>;
  dueDateScore: number;
  support: ReturnType<typeof scoreSupportFit>;
  dueDate: Date | null;
}): string[] {
  const { member, skill, role, capacity, load, dueDateScore, support, dueDate } = args;
  const reasons: string[] = [];

  if (skill.matchedSkills.length > 0) reasons.push(`Strong/acceptable in ${skill.matchedSkills.join(', ')}.`);
  else if (skill.missingSkills.length === 0 && skill.weakSkills.length === 0) reasons.push('No specific skill requirement to match against.');

  reasons.push(role.reason);
  reasons.push(`Projected workload ${capacity.projectedHours}h of ${member.weeklyCapacityHours}h weekly capacity (${Math.round(capacity.utilization * 100)}%).`);

  if (load.loadRatio < 0.5) reasons.push('Currently has light workload relative to capacity.');
  else if (load.loadRatio > 0.9) reasons.push('Currently carrying a heavy workload relative to capacity.');

  if (dueDate) {
    reasons.push(dueDateScore >= 80 ? 'Due date is comfortably achievable.' : dueDateScore >= 55 ? 'Due date is achievable but tight.' : 'Due date is at risk given current load.');
  }

  if (support.hints.length > 0) reasons.push(`Task guidance: ${support.hints.join('; ')}.`);

  return reasons;
}

/**
 * Returns a workload overview for every team member — capacity, current load,
 * remaining capacity, role, skill coverage, and overload risk. Safe to show to
 * coordinators, supervisors, team leaders, and (filtered to their own row) students.
 */
export async function getTeamWorkloadOverview(teamId: string): Promise<TeamWorkloadOverview> {
  const ctx = await getTaskAllocationContext(teamId);

  const members: MemberWorkloadOverview[] = ctx.members.map((member) => {
    const remaining = Math.max(0, member.weeklyCapacityHours - member.currentAssignedHours);
    const utilization = member.currentAssignedHours / Math.max(1, member.weeklyCapacityHours);

    let overloadRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (utilization > 1.3 || member.activeTaskCount >= member.maxConcurrentTasks + 1) overloadRisk = 'HIGH';
    else if (utilization > 0.8 || member.activeTaskCount >= member.maxConcurrentTasks) overloadRisk = 'MEDIUM';

    const strongSkills = member.skills.filter((s) => s.level >= 4).map((s) => s.skillKey);
    const acceptableSkills = member.skills.filter((s) => s.level === 3).map((s) => s.skillKey);
    const skillCoverageSummary =
      strongSkills.length > 0
        ? `Strong: ${strongSkills.slice(0, 3).join(', ')}${acceptableSkills.length > 0 ? `; also ${acceptableSkills.slice(0, 2).join(', ')}` : ''}`
        : acceptableSkills.length > 0
        ? `Acceptable: ${acceptableSkills.slice(0, 3).join(', ')}`
        : 'No skills recorded yet.';

    const recommendationNote =
      overloadRisk === 'HIGH'
        ? 'At or over capacity — avoid assigning new tasks until load decreases.'
        : overloadRisk === 'MEDIUM'
        ? 'Approaching capacity — assign smaller or lower-urgency tasks only.'
        : 'Good availability for new tasks.';

    return {
      userId: member.userId,
      studentProfileId: member.studentProfileId,
      name: member.name,
      email: member.email,
      weeklyCapacityHours: member.weeklyCapacityHours,
      currentAssignedHours: member.currentAssignedHours,
      remainingCapacityHours: Math.round(remaining * 10) / 10,
      activeTaskCount: member.activeTaskCount,
      maxConcurrentTasks: member.maxConcurrentTasks,
      overloadRisk,
      roleKey: member.resolvedRoleKey,
      roleLabel: member.resolvedRoleLabel ?? (member.resolvedRoleKey ? getRoleDefinition(member.resolvedRoleKey)?.label ?? null : null),
      skillCoverageSummary,
      recommendationNote,
    };
  });

  return { teamId, projectId: ctx.projectId, members };
}

// ── Applying a recommendation (explicit human action) ───────────────────────

export type ApplyAllocationInput = {
  taskId: string;
  userId: string; // chosen assignee
  studentProfileId?: string | null;
  teamId: string;
  projectId?: string | null;
  recommendation?: TaskAssigneeRecommendation | null; // for audit trail, if available
  actorUserId: string;
};

/**
 * Sets a task's assignee and records the accepted recommendation for audit.
 * Always an explicit, human-confirmed action — never called automatically.
 */
export async function applyTaskAllocationDecision(input: ApplyAllocationInput): Promise<{ taskId: string; assigneeId: string }> {
  const rationale = input.recommendation ? explainTaskRecommendation(input.recommendation) : null;
  const now = new Date();

  await prisma.$transaction([
    prisma.task.update({
      where: { id: input.taskId },
      data: {
        assigneeId: input.userId,
        allocationRationale: rationale,
        allocationScore: input.recommendation
          ? ({
              score: input.recommendation.score,
              skillScore: input.recommendation.skillScore,
              roleScore: input.recommendation.roleScore,
              capacityScore: input.recommendation.capacityScore,
              currentLoadScore: input.recommendation.currentLoadScore,
              dueDateScore: input.recommendation.dueDateScore,
              supportFitScore: input.recommendation.supportFitScore,
            } as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        allocationUpdatedAt: now,
      },
    }),
    prisma.taskAllocationRecommendation.create({
      data: {
        taskId: input.taskId,
        teamId: input.teamId,
        projectId: input.projectId ?? null,
        recommendedUserId: input.userId,
        recommendedStudentProfileId: input.studentProfileId ?? null,
        score: input.recommendation?.score ?? 0,
        skillScore: input.recommendation?.skillScore ?? 0,
        roleScore: input.recommendation?.roleScore ?? 0,
        capacityScore: input.recommendation?.capacityScore ?? 0,
        currentLoadScore: input.recommendation?.currentLoadScore ?? 0,
        dueDateScore: input.recommendation?.dueDateScore ?? 0,
        supportFitScore: input.recommendation?.supportFitScore ?? 0,
        rationale,
        metadata: input.recommendation
          ? ({ riskLevel: input.recommendation.riskLevel, warnings: input.recommendation.warnings } as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        accepted: true,
      },
    }),
  ]);

  log.info('task-allocation.applied', { taskId: input.taskId, userId: input.userId, actorUserId: input.actorUserId });

  return { taskId: input.taskId, assigneeId: input.userId };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeSupportFlags(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}
