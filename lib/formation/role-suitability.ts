/**
 * Role Suitability Engine — Part 7
 *
 * Deterministic, explainable role assignment for draft teams. Given a team's
 * members and (optional) project topic, it scores each student against a fixed
 * role catalogue, assigns one primary role per student covering the critical
 * roles first, computes role coverage, and produces transparent warnings.
 *
 * NO AI. Same inputs ⇒ same outputs.
 *
 * PRIVACY (hard rules):
 *   - CognitiveProfile is never read.
 *   - privateSupportNotes is never read or stored.
 *   - Only operational profile data (skills, role preferences, capacity) and the
 *     project topic's skills are used. No diagnosis or neurodivergent labels.
 */

import type {
  NormalizedStudent,
  NormalizedTopic,
  RoleAssignment,
  RoleCoverage,
  RoleScoreBreakdown,
  RoleWarning,
} from './team-formation-types';

// ── Role catalogue ───────────────────────────────────────────────────────────

export type RoleType =
  | 'coordination'
  | 'technical'
  | 'design'
  | 'quality'
  | 'communication'
  | 'research';

export type RoleDefinition = {
  key: string;
  label: string;
  coreSkills: string[];
  usefulSkills: string[];
  roleType: RoleType;
  /** Roles primarily inferred from skills; a missing StudentRolePreference is fine. */
  skillDerived: boolean;
};

export const ROLE_ASSIGNMENT_VERSION = 'role-suitability-v1';

const ROLE_CATALOGUE: RoleDefinition[] = [
  { key: 'team_leader', label: 'Team Leader', coreSkills: ['project_management', 'presentation', 'documentation'], usefulSkills: ['research', 'frontend', 'backend'], roleType: 'coordination', skillDerived: false },
  { key: 'frontend_developer', label: 'Frontend Developer', coreSkills: ['frontend', 'ui_ux'], usefulSkills: ['testing', 'documentation'], roleType: 'technical', skillDerived: false },
  { key: 'backend_developer', label: 'Backend Developer', coreSkills: ['backend', 'database'], usefulSkills: ['devops', 'testing'], roleType: 'technical', skillDerived: false },
  { key: 'database_designer', label: 'Database Designer', coreSkills: ['database', 'backend'], usefulSkills: ['documentation', 'testing'], roleType: 'technical', skillDerived: false },
  { key: 'ui_ux_designer', label: 'UI/UX Designer', coreSkills: ['ui_ux', 'frontend'], usefulSkills: ['research', 'presentation'], roleType: 'design', skillDerived: false },
  { key: 'qa_tester', label: 'QA / Testing Lead', coreSkills: ['testing', 'documentation'], usefulSkills: ['frontend', 'backend'], roleType: 'quality', skillDerived: false },
  { key: 'documentation_lead', label: 'Documentation Lead', coreSkills: ['documentation', 'research'], usefulSkills: ['presentation', 'project_management'], roleType: 'communication', skillDerived: false },
  { key: 'research_lead', label: 'Research Lead', coreSkills: ['research', 'documentation'], usefulSkills: ['presentation', 'ai_ml'], roleType: 'research', skillDerived: false },
  { key: 'presentation_lead', label: 'Presentation Lead', coreSkills: ['presentation', 'documentation'], usefulSkills: ['ui_ux', 'project_management'], roleType: 'communication', skillDerived: false },
  { key: 'client_communication_lead', label: 'Client / Supervisor Communication Lead', coreSkills: ['presentation', 'project_management', 'documentation'], usefulSkills: ['research'], roleType: 'communication', skillDerived: false },
  { key: 'ai_ml_specialist', label: 'AI / ML Specialist', coreSkills: ['ai_ml', 'backend'], usefulSkills: ['database', 'research'], roleType: 'technical', skillDerived: true },
  { key: 'mobile_developer', label: 'Mobile Developer', coreSkills: ['mobile_development', 'frontend'], usefulSkills: ['ui_ux', 'testing'], roleType: 'technical', skillDerived: true },
  { key: 'devops_support', label: 'DevOps Support', coreSkills: ['devops', 'backend'], usefulSkills: ['testing', 'database'], roleType: 'technical', skillDerived: true },
];

const ROLE_BY_KEY = new Map(ROLE_CATALOGUE.map((r) => [r.key, r]));
const ROLE_INDEX = new Map(ROLE_CATALOGUE.map((r, i) => [r.key, i]));

/** Returns the deterministic role catalogue (defensive copy). */
export function getRoleCatalogue(): RoleDefinition[] {
  return ROLE_CATALOGUE.map((r) => ({ ...r, coreSkills: [...r.coreSkills], usefulSkills: [...r.usefulSkills] }));
}

export function getRoleDefinition(key: string): RoleDefinition | undefined {
  return ROLE_BY_KEY.get(key);
}

// ── Tunables ─────────────────────────────────────────────────────────────────

const WEIGHTS = {
  skill: 0.4,
  preference: 0.25,
  confidence: 0.2,
  projectRelevance: 0.1,
  capacity: 0.05,
} as const;

const AVOID_PENALTY = 55; // subtracted from a role the student marked avoid=true
const NEUTRAL = 60; // neutral score for missing preference/confidence
const ACCEPTABLE_SUITABILITY = 55; // a role counts as "covered" at/above this
const LOW_SUITABILITY = 45; // assigned below this ⇒ LOW_ROLE_CONFIDENCE
const LEADER_VIABLE = 50; // team_leader suitability needed to count as a clear leader

export type RoleTeamContext = {
  members: NormalizedStudent[];
  topic: NormalizedTopic | null;
};

export type RoleSuitability = {
  score: number;
  breakdown: RoleScoreBreakdown;
  matchedSkills: string[];
  weakSkills: string[];
  avoided: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, min = 0, max = 100): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function skillLevel(student: NormalizedStudent, key: string): number {
  return student.skills.find((s) => s.skillKey === key)?.level ?? 0;
}

function skillInterest(student: NormalizedStudent, key: string): number {
  return student.skills.find((s) => s.skillKey === key)?.interest ?? 3;
}

/** Per-skill contribution (0–100): level dominates, interest is a small ±8 nudge. */
function skillContribution(level: number, interest: number): number {
  let base: number;
  if (level >= 4) base = 100;
  else if (level >= 3) base = 70;
  else if (level === 2) base = 35;
  else if (level === 1) base = 15;
  else base = 0;
  if (level > 0) base += Math.max(-8, Math.min(8, (interest - 3) * 4));
  return clamp(base);
}

function rolePref(student: NormalizedStudent, roleKey: string) {
  return student.rolePreferences.find((r) => r.roleKey === roleKey) ?? null;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Scores a single student for a single role (0–100) with a transparent breakdown.
 * Weights: 40% skill, 25% preference, 20% confidence, 10% project relevance,
 * 5% capacity. An avoided role gets a large penalty.
 */
export function scoreStudentForRole(
  student: NormalizedStudent,
  role: RoleDefinition,
  ctx: RoleTeamContext
): RoleSuitability {
  // Skill match — core skills weigh more than useful skills.
  const coreContribs = role.coreSkills.map((k) => skillContribution(skillLevel(student, k), skillInterest(student, k)));
  const usefulContribs = role.usefulSkills.map((k) => skillContribution(skillLevel(student, k), skillInterest(student, k)));
  const coreAvg = coreContribs.length ? coreContribs.reduce((a, b) => a + b, 0) / coreContribs.length : 0;
  const usefulAvg = usefulContribs.length ? usefulContribs.reduce((a, b) => a + b, 0) / usefulContribs.length : coreAvg;
  const skillScore = clamp(coreAvg * 0.75 + usefulAvg * 0.25);

  const matchedSkills = [...role.coreSkills, ...role.usefulSkills].filter(
    (k, i, arr) => arr.indexOf(k) === i && skillLevel(student, k) >= 3
  );
  const weakSkills = role.coreSkills.filter((k) => skillLevel(student, k) < 3);

  // Preference & confidence — neutral (not zero) when the student has no record.
  const rp = rolePref(student, role.key);
  const preferenceScore = rp ? clamp(rp.preferenceLevel * 20, 20, 100) : NEUTRAL;
  const confidenceScore = rp ? clamp(rp.confidenceLevel * 20, 20, 100) : NEUTRAL;

  // Project relevance — boosted when the role's core skills are required by the topic.
  let projectRelevanceScore: number;
  if (!ctx.topic) {
    projectRelevanceScore = 50;
  } else {
    let s = 40;
    for (const ck of role.coreSkills) {
      if (ctx.topic.requiredSkills.includes(ck)) s += 30;
      else if (ctx.topic.preferredSkills.includes(ck)) s += 12;
    }
    projectRelevanceScore = clamp(s);
  }

  // Capacity fit — soft signal; never excludes anyone.
  const h = student.weeklyCapacityHours;
  const leadership = role.roleType === 'coordination' || role.roleType === 'communication';
  let capacityFitScore: number;
  if (leadership) capacityFitScore = h >= 12 ? 100 : h >= 9 ? 85 : h >= 6 ? 65 : 45;
  else capacityFitScore = h >= 10 ? 85 : h >= 6 ? 75 : 60;

  const avoided = rp?.avoid === true;
  let raw =
    skillScore * WEIGHTS.skill +
    preferenceScore * WEIGHTS.preference +
    confidenceScore * WEIGHTS.confidence +
    projectRelevanceScore * WEIGHTS.projectRelevance +
    capacityFitScore * WEIGHTS.capacity;
  if (avoided) raw -= AVOID_PENALTY;

  return {
    score: clamp(raw),
    breakdown: { skillScore, preferenceScore, confidenceScore, projectRelevanceScore, capacityFitScore },
    matchedSkills,
    weakSkills,
    avoided,
  };
}

// ── Required roles ───────────────────────────────────────────────────────────

/** Topic-required skill → the technical role that should cover it (priority order). */
const SKILL_TO_TECH_ROLE: [string, string][] = [
  ['ai_ml', 'ai_ml_specialist'],
  ['mobile_development', 'mobile_developer'],
  ['backend', 'backend_developer'],
  ['database', 'database_designer'],
  ['frontend', 'frontend_developer'],
  ['ui_ux', 'ui_ux_designer'],
  ['testing', 'qa_tester'],
  ['devops', 'devops_support'],
];

/** Critical technical roles whose absence is more serious when the topic needs them. */
const CRITICAL_TECH_ROLES = new Set([
  'ai_ml_specialist',
  'mobile_developer',
  'backend_developer',
  'database_designer',
  'frontend_developer',
  'ui_ux_designer',
  'qa_tester',
  'devops_support',
]);

const KEY_ROLES = ['team_leader', 'documentation_lead', 'presentation_lead', 'client_communication_lead'];

/**
 * Deterministically computes the roles a team should cover, ordered by priority:
 * team_leader, then topic-driven technical roles, then documentation & presentation.
 */
export function computeRequiredRoles(topic: NormalizedTopic | null): string[] {
  const out: string[] = ['team_leader'];
  if (topic) {
    const req = topic.requiredSkills;
    for (const [skill, roleKey] of SKILL_TO_TECH_ROLE) {
      if (req.includes(skill)) out.push(roleKey);
    }
    if (req.includes('research') || topic.preferredSkills.includes('research')) out.push('research_lead');
  }
  out.push('documentation_lead', 'presentation_lead');
  return out.filter((r, i, arr) => arr.indexOf(r) === i);
}

// ── Assignment ───────────────────────────────────────────────────────────────

function memberOrder(members: NormalizedStudent[]): NormalizedStudent[] {
  return [...members].sort(
    (a, b) =>
      a.email.localeCompare(b.email) ||
      a.name.localeCompare(b.name) ||
      a.studentProfileId.localeCompare(b.studentProfileId)
  );
}

function maxCoreLevel(student: NormalizedStudent, role: RoleDefinition): number {
  return role.coreSkills.reduce((m, k) => Math.max(m, skillLevel(student, k)), 0);
}

function buildAssignment(
  student: NormalizedStudent,
  role: RoleDefinition,
  suit: RoleSuitability,
  topic: NormalizedTopic | null
): RoleAssignment {
  return {
    studentProfileId: student.studentProfileId,
    roleKey: role.key,
    roleLabel: role.label,
    score: suit.score,
    breakdown: suit.breakdown,
    matchedSkills: suit.matchedSkills,
    weakSkills: suit.weakSkills,
    avoidedRole: suit.avoided,
    assignmentReason: buildRoleSuitabilityExplanation(student, role, suit, topic),
  };
}

/**
 * Assigns one primary role per student. Critical roles are covered first by their
 * best-suited member; remaining members get their single best catalogue role.
 * Deterministic tie-breakers throughout. Returns a map keyed by studentProfileId.
 */
export function assignRolesForDraftTeam(ctx: RoleTeamContext): Map<string, RoleAssignment> {
  const assigned = new Map<string, RoleAssignment>();
  const used = new Set<string>();
  const ordered = memberOrder(ctx.members);
  const required = computeRequiredRoles(ctx.topic);

  // Phase 1 — cover required roles with the best available member.
  for (const roleKey of required) {
    const role = ROLE_BY_KEY.get(roleKey);
    if (!role) continue;

    let bestStudent: NormalizedStudent | null = null;
    let bestSuit: RoleSuitability | null = null;
    for (const student of ordered) {
      if (used.has(student.studentProfileId)) continue;
      const suit = scoreStudentForRole(student, role, ctx);
      if (
        !bestStudent ||
        !bestSuit ||
        suit.score > bestSuit.score ||
        (suit.score === bestSuit.score && maxCoreLevel(student, role) > maxCoreLevel(bestStudent, role)) ||
        (suit.score === bestSuit.score &&
          maxCoreLevel(student, role) === maxCoreLevel(bestStudent, role) &&
          (rolePref(student, role.key)?.preferenceLevel ?? 0) > (rolePref(bestStudent, role.key)?.preferenceLevel ?? 0))
      ) {
        bestStudent = student;
        bestSuit = suit;
      }
    }

    if (bestStudent && bestSuit) {
      assigned.set(bestStudent.studentProfileId, buildAssignment(bestStudent, role, bestSuit, ctx.topic));
      used.add(bestStudent.studentProfileId);
    }
  }

  // Phase 2 — every remaining member gets their single best catalogue role.
  for (const student of ordered) {
    if (used.has(student.studentProfileId)) continue;
    let bestRole: RoleDefinition | null = null;
    let bestSuit: RoleSuitability | null = null;
    for (const role of ROLE_CATALOGUE) {
      const suit = scoreStudentForRole(student, role, ctx);
      if (
        !bestRole ||
        !bestSuit ||
        suit.score > bestSuit.score ||
        (suit.score === bestSuit.score &&
          (rolePref(student, role.key)?.preferenceLevel ?? 0) > (rolePref(student, bestRole.key)?.preferenceLevel ?? 0)) ||
        (suit.score === bestSuit.score &&
          (rolePref(student, role.key)?.preferenceLevel ?? 0) === (rolePref(student, bestRole.key)?.preferenceLevel ?? 0) &&
          (ROLE_INDEX.get(role.key) ?? 99) < (ROLE_INDEX.get(bestRole.key) ?? 99))
      ) {
        bestRole = role;
        bestSuit = suit;
      }
    }
    if (bestRole && bestSuit) {
      assigned.set(student.studentProfileId, buildAssignment(student, bestRole, bestSuit, ctx.topic));
      used.add(student.studentProfileId);
    }
  }

  return assigned;
}

// ── Coverage ─────────────────────────────────────────────────────────────────

/** Computes role coverage for a team given its assignments. */
export function calculateRoleCoverage(
  ctx: RoleTeamContext,
  assignments: Map<string, RoleAssignment>
): RoleCoverage {
  const required = computeRequiredRoles(ctx.topic);
  const byRole = new Map<string, RoleAssignment[]>();
  for (const a of Array.from(assignments.values())) {
    if (!byRole.has(a.roleKey)) byRole.set(a.roleKey, []);
    byRole.get(a.roleKey)!.push(a);
  }

  const covered: string[] = [];
  const weak: string[] = [];
  const missing: string[] = [];

  for (const roleKey of required) {
    const holders = byRole.get(roleKey) ?? [];
    if (holders.length === 0) {
      missing.push(roleKey);
      continue;
    }
    const best = holders.reduce((m, h) => (h.score > m.score ? h : m), holders[0]);
    if (best.score >= ACCEPTABLE_SUITABILITY && best.weakSkills.length === 0) covered.push(roleKey);
    else weak.push(roleKey);
  }

  const roleCoverageScore =
    required.length > 0 ? clamp(((covered.length + 0.5 * weak.length) / required.length) * 100) : 100;

  return {
    requiredRoles: required,
    coveredRoles: covered,
    missingRoles: missing,
    weakRoles: weak,
    roleCoverageScore,
    roleAssignmentVersion: ROLE_ASSIGNMENT_VERSION,
  };
}

// ── Team role score (feeds DraftTeam.roleScore) ──────────────────────────────

export type TeamRoleScoreResult = {
  score: number;
  hasClearLeader: boolean;
  avoidedAssignments: RoleAssignment[];
  avgSuitability: number;
};

/**
 * Computes the team-level roleScore (0–100) from coverage, average suitability,
 * key-role coverage, and an avoided-role penalty. Replaces the Part 5 heuristic.
 */
export function computeTeamRoleScore(
  assignments: Map<string, RoleAssignment>,
  coverage: RoleCoverage
): TeamRoleScoreResult {
  const list = Array.from(assignments.values());
  const avgSuitability = list.length ? Math.round(list.reduce((a, b) => a + b.score, 0) / list.length) : 0;

  const leader = list.find((a) => a.roleKey === 'team_leader');
  const hasClearLeader = !!leader && leader.score >= LEADER_VIABLE && !leader.avoidedRole;

  const keyRoles = ['team_leader', 'documentation_lead', 'presentation_lead'];
  const keyCovered = keyRoles.filter(
    (r) => coverage.coveredRoles.includes(r) || coverage.weakRoles.includes(r)
  ).length;
  const keyCoverageScore = (keyCovered / keyRoles.length) * 100;

  const avoidedAssignments = list.filter((a) => a.avoidedRole);

  let score =
    coverage.roleCoverageScore * 0.45 + avgSuitability * 0.35 + keyCoverageScore * 0.2;
  score -= avoidedAssignments.length * 10;

  return { score: clamp(score), hasClearLeader, avoidedAssignments, avgSuitability };
}

// ── Explanations ─────────────────────────────────────────────────────────────

/** Builds a deterministic, privacy-safe "why this role" explanation. */
export function buildRoleSuitabilityExplanation(
  student: NormalizedStudent,
  role: RoleDefinition,
  suit: RoleSuitability,
  topic: NormalizedTopic | null
): string {
  const parts: string[] = [];

  const strong = role.coreSkills
    .filter((k) => skillLevel(student, k) >= 3)
    .map((k) => `${k} (${skillLevel(student, k)})`);
  if (strong.length > 0) parts.push(`strong in ${strong.join(', ')}`);
  else if (suit.weakSkills.length > 0) parts.push(`limited coverage of ${suit.weakSkills.join(', ')}`);

  const rp = rolePref(student, role.key);
  if (rp?.avoid) parts.push('NOTE: student marked this role as avoid, assigned only because no better fit was available');
  else if (rp) parts.push(`stated preference ${rp.preferenceLevel}/5, confidence ${rp.confidenceLevel}/5`);
  else if (role.skillDerived) parts.push('matched on skills (no explicit role preference needed)');
  else parts.push('no stated preference — matched on skills');

  if (topic && suit.breakdown.projectRelevanceScore >= 70) parts.push("aligns with the project's required skills");

  return `${role.label}: ${parts.join('; ')}. Suitability ${suit.score}/100.`;
}

// ── Warnings ─────────────────────────────────────────────────────────────────

/**
 * Builds role-coverage warnings for a team. Returns generic warning descriptors;
 * the engine attaches the draft-team index. No private data is referenced.
 */
export function buildRoleSuitabilityWarnings(
  teamName: string,
  ctx: RoleTeamContext,
  assignments: Map<string, RoleAssignment>,
  coverage: RoleCoverage,
  roleScore: TeamRoleScoreResult
): RoleWarning[] {
  const warnings: RoleWarning[] = [];
  const topicId = ctx.topic?.id ?? null;
  if (ctx.members.length === 0) return warnings;

  // 1. No clear team leader.
  if (!roleScore.hasClearLeader) {
    warnings.push({
      studentProfileId: null,
      topicId,
      type: 'NO_CLEAR_LEADER',
      severity: 'HIGH',
      title: 'No clear team leader',
      message: `${teamName} has no member with a strong, non-avoided fit for Team Leader. Consider nominating a lead before publishing.`,
    });
  }

  // 2 & 5. Missing required roles (technical roles required by the topic are most serious).
  for (const roleKey of coverage.missingRoles) {
    if (roleKey === 'team_leader') continue; // covered by NO_CLEAR_LEADER
    const role = ROLE_BY_KEY.get(roleKey);
    const topicNeedsTech = !!ctx.topic && CRITICAL_TECH_ROLES.has(roleKey);
    const severity = topicNeedsTech ? 'CRITICAL' : CRITICAL_TECH_ROLES.has(roleKey) ? 'HIGH' : 'MEDIUM';
    warnings.push({
      studentProfileId: null,
      topicId,
      type: 'MISSING_ROLE_COVERAGE',
      severity,
      title: `Missing role coverage: ${role?.label ?? roleKey}`,
      message: `${teamName} has no member suited to ${role?.label ?? roleKey}${topicNeedsTech ? `, which the project requires` : ''}. Review the team's skill mix.`,
      metadata: { roleKey, topicRequired: topicNeedsTech },
    });
  }

  // 3. Low-suitability assignments (per member).
  for (const a of Array.from(assignments.values())) {
    if (a.score < LOW_SUITABILITY) {
      warnings.push({
        studentProfileId: a.studentProfileId,
        topicId,
        type: 'LOW_ROLE_CONFIDENCE',
        severity: 'MEDIUM',
        title: `Low suitability for ${a.roleLabel}`,
        message: `A member of ${teamName} was assigned ${a.roleLabel} with a low suitability score (${a.score}/100). Consider reassigning or supporting this role.`,
        metadata: { roleKey: a.roleKey, score: a.score },
      });
    }
  }

  // 4. Avoided role assigned (per member).
  for (const a of roleScore.avoidedAssignments) {
    warnings.push({
      studentProfileId: a.studentProfileId,
      topicId,
      type: 'ROLE_AVOIDANCE_CONFLICT',
      severity: 'HIGH',
      title: `Assigned an avoided role: ${a.roleLabel}`,
      message: `A member of ${teamName} was assigned ${a.roleLabel} even though they marked it as a role to avoid, because no better fit was available. Manual review recommended.`,
      metadata: { roleKey: a.roleKey },
    });
  }

  // 5b. Required technical role assigned but the holder's core skills are weak.
  for (const roleKey of coverage.weakRoles) {
    const role = ROLE_BY_KEY.get(roleKey);
    if (!role || !CRITICAL_TECH_ROLES.has(roleKey)) continue;
    const holder = Array.from(assignments.values()).find((a) => a.roleKey === roleKey);
    if (holder && holder.weakSkills.length > 0) {
      warnings.push({
        studentProfileId: holder.studentProfileId,
        topicId,
        type: 'ROLE_SKILL_MISMATCH',
        severity: ctx.topic ? 'HIGH' : 'MEDIUM',
        title: `Weak skills for ${role.label}`,
        message: `${teamName}'s ${role.label} has limited coverage of ${holder.weakSkills.join(', ')}. This role may need additional support.`,
        metadata: { roleKey, weakSkills: holder.weakSkills },
      });
    }
  }

  // 6. Concentration: one student is the top fit for most key (leadership/comm) roles.
  if (ctx.members.length >= 3) {
    const topByKeyRole = new Map<string, string>(); // roleKey -> studentProfileId
    for (const roleKey of KEY_ROLES) {
      const role = ROLE_BY_KEY.get(roleKey);
      if (!role) continue;
      let bestId: string | null = null;
      let bestScore = -1;
      for (const s of memberOrder(ctx.members)) {
        const score = scoreStudentForRole(s, role, ctx).score;
        if (score > bestScore) {
          bestScore = score;
          bestId = s.studentProfileId;
        }
      }
      if (bestId) topByKeyRole.set(roleKey, bestId);
    }
    const counts = new Map<string, number>();
    for (const id of Array.from(topByKeyRole.values())) counts.set(id, (counts.get(id) ?? 0) + 1);
    const concentrated = Array.from(counts.values()).some((c) => c >= 3);
    if (concentrated) {
      warnings.push({
        studentProfileId: null,
        topicId,
        type: 'LOW_ROLE_CONFIDENCE',
        severity: 'MEDIUM',
        title: 'Leadership / communication depth is thin',
        message: `${teamName} relies heavily on a single member for most leadership and communication roles. Consider developing a second lead to spread the burden.`,
      });
    }
  }

  // 7. Low overall role coverage.
  if (coverage.roleCoverageScore < 50) {
    warnings.push({
      studentProfileId: null,
      topicId,
      type: 'MISSING_ROLE_COVERAGE',
      severity: 'MEDIUM',
      title: 'Low role coverage',
      message: `${teamName} covers only ${coverage.coveredRoles.length} of ${coverage.requiredRoles.length} required roles well (coverage score ${coverage.roleCoverageScore}/100).`,
      metadata: { roleCoverageScore: coverage.roleCoverageScore },
    });
  }

  return warnings;
}
