/**
 * Team Formation Engine — Scoring (Part 5)
 *
 * Pure, deterministic scoring functions. No AI, no randomness, no I/O.
 * Every function takes normalised inputs and returns a transparent 0–100 score
 * (and, where useful, diagnostic metadata the engine turns into warnings).
 *
 * Privacy: scoring uses only operational data and the safe, non-diagnostic
 * support-preference flags. CognitiveProfile is never referenced.
 */

import type {
  NormalizedStudent,
  NormalizedTopic,
  TeamScoreBreakdown,
  DraftMemberPlan,
} from './team-formation-types';
import {
  AVAILABILITY_WEIGHT,
  CORE_SKILL_KEYS,
  SCHEDULE_STRONG_SHARED_SLOTS,
  SCHEDULE_USABLE_LEVEL,
  SKILL_COVERED_LEVEL,
  SKILL_STRONG_LEVEL,
  SUPERVISOR_DRAFT_TEAM_SOFT_CAP,
  SUPPORT_ROUTINE_HINTS,
  TEAM_ROLES,
  type FormationWeights,
} from './team-formation-options';

export function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ── Skill ───────────────────────────────────────────────────────────────────

export type SkillScoreResult = {
  score: number;
  missingRequired: string[]; // required skills with no covered member
  weakRequired: string[]; // required skills covered but never strongly
  coveredPreferred: number;
  totalPreferred: number;
};

/** Best level any member has for a skill key. */
function bestLevel(members: NormalizedStudent[], skillKey: string): number {
  let best = 0;
  for (const m of members) {
    for (const s of m.skills) {
      if (s.skillKey === skillKey && s.level > best) best = s.level;
    }
  }
  return best;
}

/**
 * Skill score (0–100).
 *  - With a topic: required skills weighted 70%, preferred 30%.
 *    A required skill covered (level>=3) earns partial credit; strong (>=4) full.
 *  - Without a topic: general balance across CORE_SKILL_KEYS.
 */
export function scoreSkill(
  members: NormalizedStudent[],
  topic: NormalizedTopic | null
): SkillScoreResult {
  if (members.length === 0) {
    return { score: 0, missingRequired: [], weakRequired: [], coveredPreferred: 0, totalPreferred: 0 };
  }

  if (topic && (topic.requiredSkills.length > 0 || topic.preferredSkills.length > 0)) {
    const missingRequired: string[] = [];
    const weakRequired: string[] = [];

    let requiredScore = 1; // default full if no required skills declared
    if (topic.requiredSkills.length > 0) {
      let acc = 0;
      for (const sk of topic.requiredSkills) {
        const level = bestLevel(members, sk);
        if (level >= SKILL_STRONG_LEVEL) acc += 1;
        else if (level >= SKILL_COVERED_LEVEL) {
          acc += 0.6;
          weakRequired.push(sk);
        } else {
          missingRequired.push(sk);
        }
      }
      requiredScore = acc / topic.requiredSkills.length;
    }

    let coveredPreferred = 0;
    let preferredScore = 1;
    if (topic.preferredSkills.length > 0) {
      for (const sk of topic.preferredSkills) {
        if (bestLevel(members, sk) >= SKILL_COVERED_LEVEL) coveredPreferred += 1;
      }
      preferredScore = coveredPreferred / topic.preferredSkills.length;
    }

    const score = clampScore((requiredScore * 0.7 + preferredScore * 0.3) * 100);
    return {
      score,
      missingRequired,
      weakRequired,
      coveredPreferred,
      totalPreferred: topic.preferredSkills.length,
    };
  }

  // No topic: reward general coverage across core skills.
  let covered = 0;
  for (const sk of CORE_SKILL_KEYS) {
    if (bestLevel(members, sk) >= SKILL_COVERED_LEVEL) covered += 1;
  }
  const score = clampScore((covered / CORE_SKILL_KEYS.length) * 100);
  return { score, missingRequired: [], weakRequired: [], coveredPreferred: covered, totalPreferred: CORE_SKILL_KEYS.length };
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export type ScheduleScoreResult = {
  score: number;
  sharedUsableSlots: number;
};

/**
 * Schedule score (0–100) based on shared usable availability slots.
 * A "shared usable" slot is one where at least ~70% of members are AVAILABLE or
 * PREFERRED. ~5 shared slots maps to a full score.
 */
export function scoreSchedule(members: NormalizedStudent[]): ScheduleScoreResult {
  if (members.length <= 1) return { score: 100, sharedUsableSlots: 0 };

  const usableThreshold = Math.max(2, Math.ceil(members.length * 0.7));
  const slotUsableCount = new Map<string, number>();

  for (const m of members) {
    for (const a of m.availability) {
      if (a.weight >= SCHEDULE_USABLE_LEVEL) {
        const key = `${a.dayOfWeek}:${a.block}`;
        slotUsableCount.set(key, (slotUsableCount.get(key) ?? 0) + 1);
      }
    }
  }

  let sharedUsableSlots = 0;
  for (const count of Array.from(slotUsableCount.values())) {
    if (count >= usableThreshold) sharedUsableSlots += 1;
  }

  const score = clampScore((sharedUsableSlots / 5) * 100);
  return { score, sharedUsableSlots };
}

// ── Roles ───────────────────────────────────────────────────────────────────

export type RoleSuggestion = {
  studentProfileId: string;
  roleKey: string | null;
  roleLabel: string | null;
  confidence: number; // 0–100
};

export type RoleScoreResult = {
  score: number;
  suggestions: Map<string, RoleSuggestion>;
  coveredRoles: string[];
  hasClearLeader: boolean;
};

/** Strength a student brings to a role (0 if avoided / no preference). */
function roleStrength(student: NormalizedStudent, roleKey: string): number {
  const rp = student.rolePreferences.find((r) => r.roleKey === roleKey);
  if (!rp || rp.avoid) return 0;
  // preference (1–5) and confidence (1–5) → 0–25.
  return rp.preferenceLevel * rp.confidenceLevel;
}

/**
 * Deterministically suggest one primary role per student and score coverage.
 * Greedy: walk TEAM_ROLES in fixed order, assign each to its strongest willing,
 * still-unassigned member; then give leftover members their best non-avoid role.
 */
export function scoreRoles(members: NormalizedStudent[]): RoleScoreResult {
  const suggestions = new Map<string, RoleSuggestion>();
  if (members.length === 0) {
    return { score: 0, suggestions, coveredRoles: [], hasClearLeader: false };
  }

  const assigned = new Set<string>();
  const coveredRoles: string[] = [];

  // Sort members by id for stable tie-breaking.
  const ordered = [...members].sort((a, b) => a.studentProfileId.localeCompare(b.studentProfileId));

  for (const role of TEAM_ROLES) {
    let best: NormalizedStudent | null = null;
    let bestStrength = 0;
    for (const m of ordered) {
      if (assigned.has(m.studentProfileId)) continue;
      const strength = roleStrength(m, role.key);
      if (strength > bestStrength) {
        bestStrength = strength;
        best = m;
      }
    }
    if (best && bestStrength > 0) {
      assigned.add(best.studentProfileId);
      coveredRoles.push(role.key);
      suggestions.set(best.studentProfileId, {
        studentProfileId: best.studentProfileId,
        roleKey: role.key,
        roleLabel: role.label,
        confidence: clampScore((bestStrength / 25) * 100),
      });
    }
  }

  // Leftover members → their strongest non-avoid preference, else nothing.
  for (const m of ordered) {
    if (suggestions.has(m.studentProfileId)) continue;
    let best: { key: string; label: string; strength: number } | null = null;
    for (const rp of m.rolePreferences) {
      if (rp.avoid) continue;
      const strength = rp.preferenceLevel * rp.confidenceLevel;
      if (!best || strength > best.strength) best = { key: rp.roleKey, label: rp.roleLabel, strength };
    }
    suggestions.set(m.studentProfileId, {
      studentProfileId: m.studentProfileId,
      roleKey: best?.key ?? null,
      roleLabel: best?.label ?? null,
      confidence: best ? clampScore((best.strength / 25) * 100) : 0,
    });
  }

  // A clear leader exists if someone covers team_leader with reasonable strength.
  const hasClearLeader = coveredRoles.includes('team_leader');

  // Score = fraction of the 8 canonical roles covered, lightly bounded so small
  // teams aren't punished for not filling all 8.
  const target = Math.min(TEAM_ROLES.length, Math.max(4, members.length + 1));
  const score = clampScore((coveredRoles.length / target) * 100);

  return { score, suggestions, coveredRoles, hasClearLeader };
}

// ── Preference ──────────────────────────────────────────────────────────────

/** Preference score (0–100): average rank match against the assigned topic. */
export function scorePreference(members: NormalizedStudent[], topic: NormalizedTopic | null): number {
  if (members.length === 0) return 0;
  if (!topic) return 40; // no topic to compare against — neutral-ish
  let total = 0;
  for (const m of members) {
    const rank = m.topicRanks[topic.id];
    if (rank === 1) total += 100;
    else if (rank === 2) total += 80;
    else if (rank === 3) total += 60;
    else if (rank && rank > 3) total += 40;
    else total += 20; // not ranked
  }
  return clampScore(total / members.length);
}

// ── Capacity ──────────────────────────────────────────────────────────────────

export type CapacityScoreResult = {
  score: number;
  spreadHours: number;
  minHours: number;
  maxHours: number;
};

/** Capacity score (0–100): penalises high variance in weekly capacity hours. */
export function scoreCapacity(members: NormalizedStudent[]): CapacityScoreResult {
  if (members.length === 0) return { score: 0, spreadHours: 0, minHours: 0, maxHours: 0 };
  if (members.length === 1) {
    const h = members[0].weeklyCapacityHours;
    return { score: 100, spreadHours: 0, minHours: h, maxHours: h };
  }
  const hours = members.map((m) => m.weeklyCapacityHours);
  const minHours = Math.min(...hours);
  const maxHours = Math.max(...hours);
  const spreadHours = maxHours - minHours;
  // 0 spread = 100; each hour of spread costs ~6 points (spread of ~16h ≈ 0).
  const score = clampScore(100 - spreadHours * 6);
  return { score, spreadHours, minHours, maxHours };
}

// ── Support compatibility (safe, non-diagnostic) ───────────────────────────────

export type SupportScoreResult = {
  score: number;
  routineHints: string[]; // generic, non-diagnostic team routine suggestions
  hasMismatch: boolean;
};

/**
 * Support compatibility (0–100) using ONLY safe work-pattern flags.
 * Rewards shared preferences (good basis for a team routine). Never penalises an
 * individual; a low score only signals "agree on working norms". No diagnosis.
 */
export function scoreSupport(members: NormalizedStudent[]): SupportScoreResult {
  if (members.length <= 1) {
    return { score: 100, routineHints: [], hasMismatch: false };
  }

  const flagCounts = new Map<string, number>();
  for (const m of members) {
    for (const [flag, on] of Object.entries(m.safeSupportPreferences)) {
      if (on) flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
    }
  }

  const routineHints: string[] = [];
  let sharedFlags = 0;
  // Stable order for deterministic hint output.
  const sortedFlags = Array.from(flagCounts.entries()).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  for (const [flag, count] of sortedFlags) {
    if (count >= 2) {
      sharedFlags += 1;
      const hint = SUPPORT_ROUTINE_HINTS[flag];
      if (hint && routineHints.length < 4) routineHints.push(hint);
    }
  }

  const anyFlags = flagCounts.size > 0;
  // Many distinct flags but none shared → members work quite differently.
  const hasMismatch = anyFlags && sharedFlags === 0 && flagCounts.size >= 3;

  // Base 60 (compatible by default), +10 per shared routine up to +40.
  const score = clampScore(60 + Math.min(4, sharedFlags) * 10);
  return { score, routineHints, hasMismatch };
}

// ── Supervisor capacity ─────────────────────────────────────────────────────

/**
 * Supervisor capacity score (0–100). Approximates load by how many draft teams
 * in this run are already assigned to the same supervisor (plus existing teams).
 */
export function scoreSupervisorCapacity(
  supervisorProfileId: string | null,
  draftTeamsForSupervisor: number,
  existingTeamsForSupervisor: number
): number {
  if (!supervisorProfileId) return 60; // no supervisor yet — neutral
  const load = draftTeamsForSupervisor + existingTeamsForSupervisor;
  if (load <= SUPERVISOR_DRAFT_TEAM_SOFT_CAP) return 100;
  // Each team over the soft cap costs 30 points.
  return clampScore(100 - (load - SUPERVISOR_DRAFT_TEAM_SOFT_CAP) * 30);
}

// ── Overall ───────────────────────────────────────────────────────────────────

export function computeOverall(
  parts: Omit<TeamScoreBreakdown, 'overallScore'>,
  weights: FormationWeights
): TeamScoreBreakdown {
  const totalWeight =
    weights.skillWeight +
    weights.scheduleWeight +
    weights.roleWeight +
    weights.preferenceWeight +
    weights.capacityWeight +
    weights.supportCompatibilityWeight +
    weights.supervisorCapacityWeight;

  const weighted =
    parts.skillScore * weights.skillWeight +
    parts.scheduleScore * weights.scheduleWeight +
    parts.roleScore * weights.roleWeight +
    parts.preferenceScore * weights.preferenceWeight +
    parts.capacityScore * weights.capacityWeight +
    parts.supportCompatibilityScore * weights.supportCompatibilityWeight +
    parts.supervisorCapacityScore * weights.supervisorCapacityWeight;

  const overallScore = totalWeight > 0 ? clampScore(weighted / totalWeight) : 0;
  return { ...parts, overallScore };
}

// ── Placement score (greedy assignment) ─────────────────────────────────────

/**
 * Marginal placement score for adding `candidate` to a team that currently has
 * `current` members and the given topic. Higher = better fit. Deterministic.
 * This is a lightweight blend reused from the team scoring components so the
 * greedy assignment optimises the same signals the final scores measure.
 */
export function placementScore(
  candidate: NormalizedStudent,
  current: NormalizedStudent[],
  topic: NormalizedTopic | null,
  weights: FormationWeights
): number {
  const withCandidate = [...current, candidate];

  const skill = scoreSkill(withCandidate, topic).score;
  const schedule = scoreSchedule(withCandidate).score;
  const role = scoreRoles(withCandidate).score;
  const preference = scorePreference(withCandidate, topic);
  const capacity = scoreCapacity(withCandidate).score;
  const support = scoreSupport(withCandidate).score;

  const totalWeight =
    weights.skillWeight +
    weights.scheduleWeight +
    weights.roleWeight +
    weights.preferenceWeight +
    weights.capacityWeight +
    weights.supportCompatibilityWeight;

  const weighted =
    skill * weights.skillWeight +
    schedule * weights.scheduleWeight +
    role * weights.roleWeight +
    preference * weights.preferenceWeight +
    capacity * weights.capacityWeight +
    support * weights.supportCompatibilityWeight;

  return totalWeight > 0 ? weighted / totalWeight : 0;
}

/** Per-member fit score: how strongly this member's own preference matched. */
export function memberFitScore(
  member: DraftMemberPlan['student'],
  topic: NormalizedTopic | null
): number {
  return scorePreference([member], topic);
}
