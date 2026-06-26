/**
 * Capacity-Aware Task Allocation — Scoring (Part 8)
 *
 * Pure, deterministic scoring functions. No AI, no randomness, no I/O.
 * Mirrors the style of lib/formation/team-formation-scoring.ts (Part 5) and
 * lib/formation/role-suitability.ts (Part 7).
 *
 * Privacy: scoring uses only operational data (skills, role, capacity, active
 * task load) and the safe, non-diagnostic support-preference flags — used only
 * to generate generic task-guidance text, never to penalise a candidate.
 */

import { getRoleCatalogue } from '@/lib/formation/role-suitability';
import type { MemberAllocationContext, RiskLevel } from './types';
import {
  DEFAULT_TASK_MINUTES,
  HIGH_COGNITIVE_LOAD_THRESHOLD,
  SATURATION_BUFFER,
  SKILL_ACCEPTABLE_LEVEL,
  SKILL_STRONG_LEVEL,
  TASK_GUIDANCE_HINTS,
  UTILIZATION_HIGH_MIN,
  UTILIZATION_LOW_MAX,
  type AllocationWeights,
} from './options';

export function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function minutesToHours(minutes: number | null | undefined): number {
  return (minutes ?? DEFAULT_TASK_MINUTES) / 60;
}

// ── Skill match ──────────────────────────────────────────────────────────────

export type SkillMatchResult = {
  score: number;
  matchedSkills: string[];
  weakSkills: string[];
  missingSkills: string[];
};

function levelFor(member: MemberAllocationContext, skillKey: string): number {
  return member.skills.find((s) => s.skillKey === skillKey)?.level ?? 0;
}

/**
 * Skill match (0–100). Required skills weigh 80%, preferred skills 20%.
 * level >= 4 strong (100), >= 3 acceptable (65), 1-2 weak (30), missing (0).
 * No requiredSkills/preferredSkills given ⇒ neutral 60 (cannot judge fairly).
 */
export function scoreSkillMatch(
  member: MemberAllocationContext,
  requiredSkills: string[],
  preferredSkills: string[] = []
): SkillMatchResult {
  if (requiredSkills.length === 0 && preferredSkills.length === 0) {
    return { score: 60, matchedSkills: [], weakSkills: [], missingSkills: [] };
  }

  const matchedSkills: string[] = [];
  const weakSkills: string[] = [];
  const missingSkills: string[] = [];

  const contribution = (skillKey: string): number => {
    const level = levelFor(member, skillKey);
    if (level >= SKILL_STRONG_LEVEL) {
      matchedSkills.push(skillKey);
      return 100;
    }
    if (level >= SKILL_ACCEPTABLE_LEVEL) {
      matchedSkills.push(skillKey);
      return 65;
    }
    if (level > 0) {
      weakSkills.push(skillKey);
      return 30;
    }
    missingSkills.push(skillKey);
    return 0;
  };

  const requiredAvg = requiredSkills.length
    ? requiredSkills.reduce((sum, sk) => sum + contribution(sk), 0) / requiredSkills.length
    : 70; // no required skills but preferred exist — don't punish

  const preferredAvg = preferredSkills.length
    ? preferredSkills.reduce((sum, sk) => sum + contribution(sk), 0) / preferredSkills.length
    : requiredAvg;

  const score = requiredSkills.length > 0 ? clampScore(requiredAvg * 0.8 + preferredAvg * 0.2) : clampScore(preferredAvg);

  return { score, matchedSkills, weakSkills, missingSkills };
}

// ── Role match ───────────────────────────────────────────────────────────────

/**
 * Deterministically infers which catalogue role keys are most relevant to a
 * set of required skills, ranked by core-skill overlap (ties broken by
 * catalogue order). Reuses the Part 7 role catalogue so task-role mapping and
 * team-role mapping stay in sync (e.g. frontend → frontend_developer/ui_ux_designer).
 */
export function inferRelevantRoleKeys(requiredSkills: string[]): string[] {
  if (requiredSkills.length === 0) return [];
  const catalogue = getRoleCatalogue();
  const scored = catalogue
    .map((role, index) => ({
      key: role.key,
      overlap: role.coreSkills.filter((sk) => requiredSkills.includes(sk)).length,
      index,
    }))
    .filter((r) => r.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.index - b.index);
  return scored.map((r) => r.key);
}

export type RoleMatchResult = {
  score: number;
  reason: string;
};

/**
 * Role match (0–100) against the task's relevant role keys (best first).
 * Exact match on the top relevant role ⇒ 100; matches a lower-ranked relevant
 * role ⇒ 75; no resolved role but has a stated preference for the top relevant
 * role ⇒ 60; otherwise a neutral 40 (never zero — role is a soft signal here).
 */
export function scoreRoleMatch(member: MemberAllocationContext, relevantRoleKeys: string[]): RoleMatchResult {
  if (relevantRoleKeys.length === 0) {
    return { score: 55, reason: 'No specific role was implied by this task.' };
  }
  if (member.resolvedRoleKey && member.resolvedRoleKey === relevantRoleKeys[0]) {
    return { score: 100, reason: `Role match: ${member.resolvedRoleLabel ?? member.resolvedRoleKey} is the top fit for this task.` };
  }
  if (member.resolvedRoleKey && relevantRoleKeys.includes(member.resolvedRoleKey)) {
    return { score: 75, reason: `Role match: ${member.resolvedRoleLabel ?? member.resolvedRoleKey} is relevant to this task.` };
  }
  return { score: 40, reason: 'Role does not closely match this task; skills are the main signal.' };
}

// ── Capacity available ───────────────────────────────────────────────────────

export type CapacityResult = {
  score: number;
  projectedHours: number;
  utilization: number;
  availableCapacityHours: number;
};

/**
 * Capacity-available score (0–100) from projected utilization
 * (currentAssignedHours + newTaskHours) / weeklyCapacityHours.
 * Banded deterministically; never excludes low-capacity members.
 */
export function scoreCapacityAvailable(member: MemberAllocationContext, newTaskMinutes: number | null | undefined): CapacityResult {
  const newTaskHours = minutesToHours(newTaskMinutes);
  const projectedHours = member.currentAssignedHours + newTaskHours;
  const capacity = Math.max(1, member.weeklyCapacityHours);
  const utilization = projectedHours / capacity;

  let score: number;
  if (utilization <= 0.5) score = 100;
  else if (utilization <= UTILIZATION_LOW_MAX) score = 85;
  else if (utilization <= 1.0) score = 65;
  else if (utilization <= UTILIZATION_HIGH_MIN) score = 40;
  else score = 15;

  return {
    score,
    projectedHours: Math.round(projectedHours * 10) / 10,
    utilization: Math.round(utilization * 100) / 100,
    availableCapacityHours: Math.max(0, Math.round((capacity - member.currentAssignedHours) * 10) / 10),
  };
}

// ── Current load fairness ───────────────────────────────────────────────────────

export type LoadFairnessResult = {
  score: number;
  loadRatio: number;
};

/**
 * Current-load fairness (0–100), relative to the team's mean load ratio.
 * A member exactly at the team average scores ~70 (neutral-good); below
 * average scores higher (up to 100); above average scores lower (down to 0).
 * This actively discourages concentrating tasks on the same high-skill member.
 */
export function scoreCurrentLoadFairness(member: MemberAllocationContext, teamMeanLoadRatio: number): LoadFairnessResult {
  const capacity = Math.max(1, member.weeklyCapacityHours);
  const loadRatio = member.currentAssignedHours / capacity;
  const relative = loadRatio - teamMeanLoadRatio;
  let score = clampScore(70 - relative * 150);

  // Extra penalty if already at/above their own max concurrent task limit.
  if (member.activeTaskCount >= member.maxConcurrentTasks + SATURATION_BUFFER) {
    score = clampScore(score - 25);
  } else if (member.activeTaskCount >= member.maxConcurrentTasks) {
    score = clampScore(score - 10);
  }

  return { score, loadRatio: Math.round(loadRatio * 100) / 100 };
}

// ── Due date feasibility ─────────────────────────────────────────────────────

/**
 * Due-date feasibility (0–100). Compares the daily pace required to finish
 * the new task by its due date against the member's remaining daily budget
 * (weekly capacity minus a same-week share of current load). No due date ⇒
 * neutral 60.
 */
export function scoreDueDateFeasibility(
  dueDate: Date | null,
  newTaskMinutes: number | null | undefined,
  member: MemberAllocationContext,
  now: Date = new Date()
): number {
  if (!dueDate) return 60;

  const newTaskHours = minutesToHours(newTaskMinutes);
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilDue <= 0) {
    return newTaskHours <= 2 ? 50 : 20;
  }

  const dailyBudget = Math.max(0.5, member.weeklyCapacityHours / 5);
  const currentDailyLoad = member.currentAssignedHours / 5;
  const remainingDailyBudget = Math.max(0.5, dailyBudget - currentDailyLoad);
  const pace = newTaskHours / Math.max(1, daysUntilDue);
  const ratio = pace / remainingDailyBudget;

  let score: number;
  if (ratio <= 0.5) score = 100;
  else if (ratio <= 1) score = 80;
  else if (ratio <= 1.5) score = 55;
  else if (ratio <= 2) score = 30;
  else score = 10;

  if (daysUntilDue <= 1 && newTaskHours > 3) score = Math.min(score, 30);

  return score;
}

// ── Support fit (safe, non-diagnostic) ──────────────────────────────────────

export type SupportFitResult = {
  score: number;
  hints: string[];
};

/**
 * Support fit (70–100, never harsher). Uses ONLY safe support-preference flags
 * to produce generic task-guidance hints when the task is high cognitive load.
 * Never penalises a candidate for having support preferences.
 */
export function scoreSupportFit(member: MemberAllocationContext, cognitiveLoad: number | null | undefined): SupportFitResult {
  const hints: string[] = [];
  if ((cognitiveLoad ?? 0) >= HIGH_COGNITIVE_LOAD_THRESHOLD) {
    for (const [flag, hint] of Object.entries(TASK_GUIDANCE_HINTS)) {
      if (member.safeSupportPreferences[flag] && hints.length < 3) hints.push(hint);
    }
  }
  // Always within [70, 100] — support fit informs guidance, not exclusion.
  const score = hints.length > 0 ? 85 : 90;
  return { score, hints };
}

// ── Overall + risk ───────────────────────────────────────────────────────────

export function computeOverallScore(
  parts: {
    skillScore: number;
    roleScore: number;
    capacityScore: number;
    currentLoadScore: number;
    dueDateScore: number;
    supportFitScore: number;
  },
  weights: AllocationWeights
): number {
  const totalWeight =
    weights.skillMatchWeight +
    weights.roleMatchWeight +
    weights.capacityAvailableWeight +
    weights.currentLoadFairnessWeight +
    weights.dueDateFeasibilityWeight +
    weights.supportFitWeight;

  const weighted =
    parts.skillScore * weights.skillMatchWeight +
    parts.roleScore * weights.roleMatchWeight +
    parts.capacityScore * weights.capacityAvailableWeight +
    parts.currentLoadScore * weights.currentLoadFairnessWeight +
    parts.dueDateScore * weights.dueDateFeasibilityWeight +
    parts.supportFitScore * weights.supportFitWeight;

  return totalWeight > 0 ? clampScore(weighted / totalWeight) : 0;
}

export function deriveRiskLevel(input: {
  skillScore: number;
  utilization: number;
  missingSkills: string[];
  activeTaskCount: number;
  maxConcurrentTasks: number;
  dueDateScore: number;
  cognitiveLoad: number | null | undefined;
  availableCapacityHours: number;
  newTaskHours: number;
}): { level: RiskLevel; warnings: string[] } {
  const warnings: string[] = [];

  const hasMissingSkill = input.missingSkills.length > 0;
  if (hasMissingSkill) warnings.push(`Missing required skill(s): ${input.missingSkills.join(', ')}.`);

  const isSaturated = input.activeTaskCount >= input.maxConcurrentTasks + SATURATION_BUFFER;
  if (isSaturated) warnings.push(`Already has ${input.activeTaskCount} active tasks (limit ${input.maxConcurrentTasks}).`);

  const isOverUtilized = input.utilization > UTILIZATION_HIGH_MIN;
  if (isOverUtilized) warnings.push(`Projected workload is ${Math.round(input.utilization * 100)}% of weekly capacity.`);

  const isHeavyLowCapacity =
    (input.cognitiveLoad ?? 0) >= HIGH_COGNITIVE_LOAD_THRESHOLD && input.availableCapacityHours < input.newTaskHours * 0.5;
  if (isHeavyLowCapacity) warnings.push('High cognitive load task with little remaining capacity.');

  const dueDateTight = input.dueDateScore <= 30;
  if (dueDateTight) warnings.push('Due date is tight relative to remaining capacity.');

  if (hasMissingSkill || isSaturated || isOverUtilized || isHeavyLowCapacity) {
    return { level: 'HIGH', warnings };
  }

  const isMediumUtilized = input.utilization > UTILIZATION_LOW_MAX;
  const skillAcceptableNotStrong = input.skillScore >= 50 && input.skillScore < 85;
  if (isMediumUtilized || skillAcceptableNotStrong || dueDateTight || input.activeTaskCount >= input.maxConcurrentTasks) {
    return { level: 'MEDIUM', warnings };
  }

  return { level: 'LOW', warnings };
}
