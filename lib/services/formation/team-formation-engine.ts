/**
 * Team Formation Engine — Service (Part 5)
 *
 * A deterministic, explainable team-formation engine. Given a FormationBatch it
 * produces DRAFT teams (pre-approval "what-if" results), suggests a project topic
 * and a primary role per student, computes transparent 0–100 scores, and raises
 * warnings for gaps and conflicts.
 *
 * WHAT THIS IS NOT:
 *   - It never creates or modifies operational Team / TeamMember / Project rows.
 *   - It never publishes final teams. Part 6 will review/approve/publish drafts.
 *   - It uses NO AI/LLM. Same input ⇒ same output, every time.
 *
 * PRIVACY (hard rules):
 *   - CognitiveProfile is NEVER queried.
 *   - privateSupportNotes is NEVER selected, stored, or surfaced.
 *   - Only StudentFormationProfile.safeSupportPreferences (non-diagnostic
 *     work-pattern flags) is read, and only to compute compatibility and produce
 *     generic team-routine hints. No diagnosis or neurodivergent labels appear.
 */

import { prisma, Prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import type {
  AvailabilityLevel,
  FormationWarningSeverity,
  FormationWarningType,
} from '@prisma/client';
import {
  ALGORITHM_VERSION,
  AVAILABILITY_WEIGHT,
  CAPACITY_SPREAD_WARN_HOURS,
  DEFAULT_WEIGHTS,
  SCHEDULE_STRONG_SHARED_SLOTS,
  SUPERVISOR_DRAFT_TEAM_SOFT_CAP,
  SKILL_STRONG_LEVEL,
  draftTeamName,
  type FormationWeights,
} from '@/lib/formation/team-formation-options';
import {
  computeOverall,
  memberFitScore,
  placementScore,
  scoreCapacity,
  scorePreference,
  scoreSchedule,
  scoreSkill,
  scoreSupervisorCapacity,
  scoreSupport,
} from '@/lib/formation/team-formation-scoring';
import {
  assignRolesForDraftTeam,
  buildRoleSuitabilityWarnings,
  calculateRoleCoverage,
  computeTeamRoleScore,
  type RoleTeamContext,
} from '@/lib/formation/role-suitability';
import type {
  DraftMemberPlan,
  DraftTeamPlan,
  DraftWarningDraft,
  FormationRunDetails,
  FormationRunOverview,
  NormalizedStudent,
  NormalizedTopic,
  RoleCoverage,
  RunSummary,
} from '@/lib/formation/team-formation-types';

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Runs the deterministic engine for a batch and persists a new TeamFormationRun
 * with its draft teams, members, and warnings. Returns the run id.
 * Previous runs are kept (a new run is created each time).
 */
export async function runTeamFormationEngine(
  batchId: string,
  createdById?: string
): Promise<{ runId: string; status: 'COMPLETED' | 'FAILED' }> {
  const batch = await prisma.formationBatch.findUnique({
    where: { id: batchId },
    include: { ruleSet: true, term: true },
  });
  if (!batch) throw new Error('Formation batch not found.');

  const weights = resolveWeights(batch.ruleSet);

  // Create the run up-front (RUNNING) so failures are still recorded.
  const run = await prisma.teamFormationRun.create({
    data: {
      termId: batch.termId,
      batchId: batch.id,
      status: 'RUNNING',
      algorithmVersion: ALGORITHM_VERSION,
      createdById: createdById ?? null,
      startedAt: new Date(),
      settingsSnapshot: {
        weights,
        targetTeamSize: batch.targetTeamSize,
        minTeamSize: batch.minTeamSize,
        maxTeamSize: batch.maxTeamSize,
      } as Prisma.InputJsonValue,
    },
  });

  try {
    const students = await loadEligibleStudents(batch.id, batch.termId);

    if (students.length === 0) {
      await prisma.teamFormationRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason:
            'No eligible students found for this batch. Ensure students are INCLUDED/ASSIGNED/LOCKED in the batch and their intake is READY_FOR_FORMATION or ASSIGNED_TO_TEAM.',
        },
      });
      log.warn('formation-engine.run.no-students', { runId: run.id, batchId: batch.id });
      return { runId: run.id, status: 'FAILED' };
    }

    const topics = await loadTopicsWithDemand(batch.termId, students);
    const existingSupervisorLoad = await loadExistingSupervisorLoad(batch.termId);

    const teamCount = Math.max(1, Math.ceil(students.length / batch.targetTeamSize));

    // 1. Topic selection → one topic per team where sensible.
    const { topicByTeam, topicWarnings } = selectTopicsForTeams(topics, teamCount, batch.targetTeamSize);

    // 2. Greedy, balanced student assignment.
    const teams = assignStudents(students, topicByTeam, weights, batch.maxTeamSize, batch.targetTeamSize);

    // 3. Score teams, suggest roles, collect warnings.
    const warnings: DraftWarningDraft[] = [...topicWarnings];
    const draftSupervisorCount = new Map<string, number>();
    for (const team of teams) {
      if (team.supervisorProfileId) {
        draftSupervisorCount.set(
          team.supervisorProfileId,
          (draftSupervisorCount.get(team.supervisorProfileId) ?? 0) + 1
        );
      }
    }

    for (const team of teams) {
      finalizeTeam(team, weights, draftSupervisorCount, existingSupervisorLoad, batch.minTeamSize, batch.maxTeamSize, warnings);
    }

    // 4. Student-level profile completeness warnings.
    for (const s of students) {
      if (!s.hasProfile || !s.profileSubmitted) {
        warnings.push({
          draftTeamIndex: teams.findIndex((t) => t.members.some((m) => m.student.studentProfileId === s.studentProfileId)),
          studentProfileId: s.studentProfileId,
          topicId: null,
          type: 'INCOMPLETE_STUDENT_PROFILE',
          severity: 'LOW',
          title: 'Incomplete formation profile',
          message: `${s.name} ${s.hasProfile ? 'has not submitted' : 'has no'} formation profile. They were placed using available data; results may improve once the profile is complete.`,
          metadata: { completionScore: s.completionScore },
        });
      }
    }

    // 5. Persist everything + summary.
    await persistRun(run.id, batch.termId, batch.id, teams, warnings);

    const summary = buildSummary(students, teams, warnings);
    await prisma.teamFormationRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        summary: summary as unknown as Prisma.InputJsonValue,
      },
    });

    log.info('formation-engine.run.completed', {
      runId: run.id,
      batchId: batch.id,
      teams: teams.length,
      students: students.length,
      warnings: warnings.length,
    });
    return { runId: run.id, status: 'COMPLETED' };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await prisma.teamFormationRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', failedAt: new Date(), failureReason: reason },
    });
    log.error('formation-engine.run.failed', { runId: run.id, batchId: batch.id, error: reason });
    return { runId: run.id, status: 'FAILED' };
  }
}

/** Returns an overview of the most recent run for a batch (or null). */
export async function getLatestFormationRun(batchId: string): Promise<FormationRunOverview | null> {
  const run = await prisma.teamFormationRun.findFirst({
    where: { batchId },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { name: true } } },
  });
  if (!run) return null;
  return shapeRunOverview(run);
}

/** Returns full details (teams, members, warnings) for a run. */
export async function getFormationRunDetails(runId: string): Promise<FormationRunDetails | null> {
  const run = await prisma.teamFormationRun.findUnique({
    where: { id: runId },
    include: {
      createdBy: { select: { name: true } },
      draftTeams: {
        orderBy: { overallScore: 'desc' },
        include: {
          topic: { select: { title: true } },
          supervisorProfile: { select: { user: { select: { name: true } } } },
          members: {
            orderBy: { fitScore: 'desc' },
            include: { studentProfile: { select: { user: { select: { name: true } } } } },
          },
          warnings: {
            include: {
              studentProfile: { select: { user: { select: { name: true } } } },
              topic: { select: { title: true } },
            },
          },
        },
      },
      warnings: {
        where: { draftTeamId: null },
        include: {
          studentProfile: { select: { user: { select: { name: true } } } },
          topic: { select: { title: true } },
        },
      },
    },
  });
  if (!run) return null;

  const draftTeams = run.draftTeams.map((t) => {
    const metadata = (t.metadata ?? {}) as {
      supportRoutineHints?: string[];
      roleCoverage?: RoleCoverage | null;
    };
    return {
      id: t.id,
      name: t.name,
      status: t.status,
      topicTitle: t.topic?.title ?? null,
      supervisorName: t.supervisorProfile?.user?.name ?? null,
      overallScore: t.overallScore,
      scores: {
        skillScore: t.skillScore,
        scheduleScore: t.scheduleScore,
        roleScore: t.roleScore,
        preferenceScore: t.preferenceScore,
        capacityScore: t.capacityScore,
        supportCompatibilityScore: t.supportCompatibilityScore,
        supervisorCapacityScore: t.supervisorCapacityScore,
        overallScore: t.overallScore,
      },
      explanation: t.explanation,
      supportRoutineHints: Array.isArray(metadata.supportRoutineHints) ? metadata.supportRoutineHints : [],
      roleCoverage: metadata.roleCoverage ?? null,
      members: t.members.map((m) => ({
        id: m.id,
        studentProfileId: m.studentProfileId,
        name: m.studentProfile?.user?.name ?? 'Student',
        suggestedRoleKey: m.suggestedRoleKey,
        suggestedRoleLabel: m.suggestedRoleLabel,
        roleConfidence: m.roleConfidence,
        fitScore: m.fitScore,
        explanation: m.explanation,
      })),
      warnings: t.warnings.map((w) => shapeWarning(w)),
    };
  });

  return {
    run: shapeRunOverview(run),
    draftTeams,
    runWarnings: run.warnings.map((w) => shapeWarning(w)),
  };
}

/**
 * Resolves the default batch to run when none is supplied: the active term's
 * most recent READY batch, else its most recent DRAFT batch, else most recent.
 */
export async function resolveDefaultBatchId(): Promise<string | null> {
  const term = await prisma.academicTerm.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!term) return null;

  const ready = await prisma.formationBatch.findFirst({
    where: { termId: term.id, status: 'READY' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (ready) return ready.id;

  const draft = await prisma.formationBatch.findFirst({
    where: { termId: term.id, status: 'DRAFT' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (draft) return draft.id;

  const any = await prisma.formationBatch.findFirst({
    where: { termId: term.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return any?.id ?? null;
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadEligibleStudents(batchId: string, termId: string): Promise<NormalizedStudent[]> {
  const rows = await prisma.formationBatchStudent.findMany({
    where: {
      batchId,
      status: { in: ['INCLUDED', 'ASSIGNED', 'LOCKED'] },
      studentIntake: { status: { in: ['READY_FOR_FORMATION', 'ASSIGNED_TO_TEAM'] } },
    },
    select: {
      studentIntakeId: true,
      studentIntake: {
        select: {
          studentProfileId: true,
          studentProfile: {
            select: {
              id: true,
              user: { select: { name: true, email: true } },
              // NOTE: privateSupportNotes and CognitiveProfile are intentionally NOT selected.
              formationProfile: {
                select: {
                  status: true,
                  completionScore: true,
                  weeklyCapacityHours: true,
                  maxConcurrentTasks: true,
                  safeSupportPreferences: true,
                  skills: { select: { skillKey: true, level: true, interest: true } },
                  availability: { select: { dayOfWeek: true, block: true, level: true } },
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

  // Submitted project preferences for these students in this term.
  const studentProfileIds = rows.map((r) => r.studentIntake.studentProfileId);
  const prefs = await prisma.projectPreference.findMany({
    where: { termId, studentProfileId: { in: studentProfileIds }, status: 'SUBMITTED' },
    select: { studentProfileId: true, topicId: true, rank: true },
  });
  const ranksByStudent = new Map<string, Record<string, number>>();
  for (const p of prefs) {
    if (!ranksByStudent.has(p.studentProfileId)) ranksByStudent.set(p.studentProfileId, {});
    ranksByStudent.get(p.studentProfileId)![p.topicId] = p.rank;
  }

  const students: NormalizedStudent[] = rows.map((r) => {
    const sp = r.studentIntake.studentProfile;
    const fp = sp.formationProfile;
    const skills = (fp?.skills ?? []).map((s) => ({ skillKey: s.skillKey, level: s.level, interest: s.interest }));
    const safeSupport = normalizeSupportFlags(fp?.safeSupportPreferences);
    return {
      studentProfileId: sp.id,
      studentIntakeId: r.studentIntakeId,
      name: sp.user?.name ?? 'Student',
      email: sp.user?.email ?? '',
      hasProfile: !!fp,
      profileSubmitted: fp?.status === 'SUBMITTED',
      completionScore: fp?.completionScore ?? 0,
      weeklyCapacityHours: fp?.weeklyCapacityHours ?? 8,
      maxConcurrentTasks: fp?.maxConcurrentTasks ?? 2,
      skills,
      availability: (fp?.availability ?? []).map((a) => ({
        dayOfWeek: a.dayOfWeek,
        block: a.block,
        weight: AVAILABILITY_WEIGHT[a.level as AvailabilityLevel] ?? 0,
      })),
      rolePreferences: (fp?.rolePreferences ?? []).map((rp) => ({
        roleKey: rp.roleKey,
        roleLabel: rp.roleLabel,
        preferenceLevel: rp.preferenceLevel,
        confidenceLevel: rp.confidenceLevel,
        avoid: rp.avoid,
      })),
      safeSupportPreferences: safeSupport,
      topicRanks: ranksByStudent.get(sp.id) ?? {},
      strongSkillCount: skills.filter((s) => s.level >= SKILL_STRONG_LEVEL).length,
    };
  });

  return students;
}

async function loadTopicsWithDemand(termId: string, students: NormalizedStudent[]): Promise<NormalizedTopic[]> {
  const topics = await prisma.projectTopic.findMany({
    where: { termId, status: 'OPEN' },
    include: { supervisorProfile: { select: { id: true, user: { select: { name: true } } } } },
  });

  const firstChoice = new Map<string, number>();
  const total = new Map<string, number>();
  for (const s of students) {
    for (const [topicId, rank] of Object.entries(s.topicRanks)) {
      total.set(topicId, (total.get(topicId) ?? 0) + 1);
      if (rank === 1) firstChoice.set(topicId, (firstChoice.get(topicId) ?? 0) + 1);
    }
  }

  return topics.map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    difficulty: t.difficulty,
    maxTeams: t.maxTeams,
    requiredSkills: Array.isArray(t.requiredSkills) ? (t.requiredSkills as string[]) : [],
    preferredSkills: Array.isArray(t.preferredSkills) ? (t.preferredSkills as string[]) : [],
    supervisorProfileId: t.supervisorProfile?.id ?? null,
    supervisorName: t.supervisorProfile?.user?.name ?? null,
    firstChoiceDemand: firstChoice.get(t.id) ?? 0,
    totalDemand: total.get(t.id) ?? 0,
  }));
}

async function loadExistingSupervisorLoad(termId: string): Promise<Map<string, number>> {
  const grouped = await prisma.team.groupBy({
    by: ['supervisorId'],
    where: { academicTermId: termId, supervisorId: { not: null } },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const g of grouped) {
    if (g.supervisorId) map.set(g.supervisorId, g._count._all);
  }
  return map;
}

// ── Topic selection ──────────────────────────────────────────────────────────

function selectTopicsForTeams(
  topics: NormalizedTopic[],
  teamCount: number,
  targetTeamSize: number
): { topicByTeam: (NormalizedTopic | null)[]; topicWarnings: DraftWarningDraft[] } {
  const warnings: DraftWarningDraft[] = [];

  // Only consider topics that have any demand; order by first-choice then total.
  const demanded = topics
    .filter((t) => t.totalDemand > 0)
    .sort((a, b) => b.firstChoiceDemand - a.firstChoiceDemand || b.totalDemand - a.totalDemand || a.title.localeCompare(b.title));

  const assignedCount = new Map<string, number>();
  const topicByTeam: (NormalizedTopic | null)[] = [];

  for (let i = 0; i < teamCount; i++) {
    // Pick the highest-demand topic still under its maxTeams cap.
    let chosen: NormalizedTopic | null = null;
    for (const t of demanded) {
      if ((assignedCount.get(t.id) ?? 0) < t.maxTeams) {
        chosen = t;
        break;
      }
    }
    // If every demanded topic is at cap, reuse the highest-demand one (forced).
    if (!chosen && demanded.length > 0) {
      chosen = demanded[0];
      warnings.push({
        draftTeamIndex: i,
        studentProfileId: null,
        topicId: chosen.id,
        type: 'DUPLICATE_TOPIC_PRESSURE',
        severity: 'MEDIUM',
        title: `Topic reused beyond capacity: ${chosen.title}`,
        message: `There are more draft teams than topic slots, so "${chosen.title}" was assigned to more teams than its configured maximum of ${chosen.maxTeams}. Consider adding more topics or team slots.`,
        metadata: { topicId: chosen.id, maxTeams: chosen.maxTeams },
      });
    }
    if (chosen) assignedCount.set(chosen.id, (assignedCount.get(chosen.id) ?? 0) + 1);
    topicByTeam.push(chosen);
  }

  // Over-selection warnings: demand far exceeds the slots actually given.
  for (const t of demanded) {
    const slots = assignedCount.get(t.id) ?? 0;
    const capacity = slots * targetTeamSize;
    if (capacity > 0 && t.totalDemand > capacity * 1.5) {
      warnings.push({
        draftTeamIndex: null,
        studentProfileId: null,
        topicId: t.id,
        type: 'PROJECT_OVER_SELECTED',
        severity: t.totalDemand > capacity * 2.5 ? 'HIGH' : 'MEDIUM',
        title: `High demand for topic: ${t.title}`,
        message: `"${t.title}" was selected by ${t.totalDemand} students (${t.firstChoiceDemand} as first choice) but only ${slots} draft team${slots === 1 ? '' : 's'} (~${capacity} seats) could be allocated. Some students will be placed on other topics.`,
        metadata: { totalDemand: t.totalDemand, firstChoiceDemand: t.firstChoiceDemand, slots },
      });
    }
  }

  return { topicByTeam, topicWarnings: warnings };
}

// ── Student assignment ───────────────────────────────────────────────────────

type WorkingTeam = {
  index: number;
  topic: NormalizedTopic | null;
  supervisorProfileId: string | null;
  members: NormalizedStudent[];
};

function assignStudents(
  students: NormalizedStudent[],
  topicByTeam: (NormalizedTopic | null)[],
  weights: FormationWeights,
  maxTeamSize: number,
  targetTeamSize: number
): DraftTeamPlan[] {
  const teams: WorkingTeam[] = topicByTeam.map((topic, index) => ({
    index,
    topic,
    supervisorProfileId: topic?.supervisorProfileId ?? null,
    members: [],
  }));

  // Deterministic sort: students with fewer strong skills first (so they get the
  // best pick of complementary teammates), then lower completion, then email/name/id.
  const ordered = [...students].sort(
    (a, b) =>
      a.strongSkillCount - b.strongSkillCount ||
      a.completionScore - b.completionScore ||
      a.email.localeCompare(b.email) ||
      a.name.localeCompare(b.name) ||
      a.studentProfileId.localeCompare(b.studentProfileId)
  );

  for (const student of ordered) {
    // Balance first: fill teams up to target before allowing any to exceed it.
    let pool = teams.filter((t) => t.members.length < targetTeamSize);
    if (pool.length === 0) pool = teams.filter((t) => t.members.length < maxTeamSize);
    if (pool.length === 0) pool = teams; // forced overflow (rare)

    let best: WorkingTeam | null = null;
    let bestScore = -Infinity;
    for (const t of pool) {
      const score = placementScore(student, t.members, t.topic, weights);
      // Tie-break: prefer the smaller team (balance), then lower index.
      const adjusted = score - t.members.length * 0.001;
      if (adjusted > bestScore) {
        bestScore = adjusted;
        best = t;
      }
    }
    (best ?? teams[0]).members.push(student);
  }

  // Build draft plans (scores filled later in finalizeTeam).
  return teams.map((t) => ({
    index: t.index,
    name: draftTeamName(t.index),
    topic: t.topic,
    supervisorProfileId: t.supervisorProfileId,
    members: t.members.map((student) => ({
      student,
      suggestedRoleKey: null,
      suggestedRoleLabel: null,
      roleConfidence: 0,
      fitScore: 0,
      explanation: '',
    })),
    scores: {
      skillScore: 0,
      scheduleScore: 0,
      roleScore: 0,
      preferenceScore: 0,
      capacityScore: 0,
      supportCompatibilityScore: 0,
      supervisorCapacityScore: 0,
      overallScore: 0,
    },
    explanation: '',
    supportRoutineHints: [],
  }));
}

// ── Team finalisation (scores, roles, warnings, explanation) ──────────────────

function finalizeTeam(
  team: DraftTeamPlan,
  weights: FormationWeights,
  draftSupervisorCount: Map<string, number>,
  existingSupervisorLoad: Map<string, number>,
  minTeamSize: number,
  maxTeamSize: number,
  warnings: DraftWarningDraft[]
): void {
  const members = team.members.map((m) => m.student);
  const topic = team.topic;

  const skill = scoreSkill(members, topic);
  const schedule = scoreSchedule(members);
  const preference = scorePreference(members, topic);
  const capacity = scoreCapacity(members);
  const support = scoreSupport(members);
  const supervisorScore = scoreSupervisorCapacity(
    team.supervisorProfileId,
    team.supervisorProfileId ? draftSupervisorCount.get(team.supervisorProfileId) ?? 0 : 0,
    team.supervisorProfileId ? existingSupervisorLoad.get(team.supervisorProfileId) ?? 0 : 0
  );

  // Part 7: deterministic role suitability — assign roles, coverage, and roleScore.
  const roleCtx: RoleTeamContext = { members, topic };
  const roleAssignments = assignRolesForDraftTeam(roleCtx);
  const roleCoverage = calculateRoleCoverage(roleCtx, roleAssignments);
  const roleResult = computeTeamRoleScore(roleAssignments, roleCoverage);
  team.roleCoverage = roleCoverage;

  team.scores = computeOverall(
    {
      skillScore: skill.score,
      scheduleScore: schedule.score,
      roleScore: roleResult.score,
      preferenceScore: preference,
      capacityScore: capacity.score,
      supportCompatibilityScore: support.score,
      supervisorCapacityScore: supervisorScore,
    },
    weights
  );
  team.supportRoutineHints = support.routineHints;

  // Apply role suggestions + per-member evidence/explanation (privacy-safe).
  for (const m of team.members) {
    const a = roleAssignments.get(m.student.studentProfileId);
    m.suggestedRoleKey = a?.roleKey ?? null;
    m.suggestedRoleLabel = a?.roleLabel ?? null;
    m.roleConfidence = a?.score ?? 0;
    m.fitScore = memberFitScore(m.student, topic);
    m.explanation = a?.assignmentReason ?? buildMemberExplanation(m, topic);
    m.roleMetadata = a
      ? {
          roleSuitabilityScore: a.score,
          roleSuitabilityBreakdown: a.breakdown,
          matchedSkills: a.matchedSkills,
          weakSkills: a.weakSkills,
          avoidedRole: a.avoidedRole,
          assignmentReason: a.assignmentReason,
        }
      : null;
  }

  team.explanation = buildTeamExplanation(team, skill, schedule, roleCoverage, roleResult.score, preference, capacity);

  // Part 7: role-coverage warnings (engine attaches the draft-team index).
  for (const rw of buildRoleSuitabilityWarnings(team.name, roleCtx, roleAssignments, roleCoverage, roleResult)) {
    warnings.push({
      draftTeamIndex: team.index,
      studentProfileId: rw.studentProfileId,
      topicId: rw.topicId,
      type: rw.type,
      severity: rw.severity,
      title: rw.title,
      message: rw.message,
      metadata: rw.metadata,
    });
  }

  // ── Warnings ──
  const idx = team.index;

  if (topic) {
    for (const sk of skill.missingRequired) {
      warnings.push({
        draftTeamIndex: idx, studentProfileId: null, topicId: topic.id,
        type: 'MISSING_CRITICAL_SKILL', severity: 'HIGH',
        title: `Missing required skill: ${sk}`,
        message: `No member of ${team.name} has ${sk} at a working level (3+), which "${topic.title}" requires.`,
        metadata: { skillKey: sk, topicId: topic.id },
      });
    }
    if (skill.weakRequired.length > 0) {
      warnings.push({
        draftTeamIndex: idx, studentProfileId: null, topicId: topic.id,
        type: 'WEAK_SKILL_COVERAGE', severity: 'MEDIUM',
        title: `Weak coverage of required skills`,
        message: `${team.name} covers ${skill.weakRequired.join(', ')} only at a basic level (no member at 4+). Consider strengthening the team for "${topic.title}".`,
        metadata: { weakSkills: skill.weakRequired, topicId: topic.id },
      });
    }
    if (skill.missingRequired.length >= 2) {
      warnings.push({
        draftTeamIndex: idx, studentProfileId: null, topicId: topic.id,
        type: 'TOPIC_SKILL_GAP', severity: 'HIGH',
        title: `Topic skill gap: ${topic.title}`,
        message: `${team.name} is missing ${skill.missingRequired.length} of "${topic.title}"'s required skills. This pairing may need review.`,
        metadata: { missingRequired: skill.missingRequired, topicId: topic.id },
      });
    }
  }

  if (members.length > 1 && schedule.sharedUsableSlots < SCHEDULE_STRONG_SHARED_SLOTS) {
    warnings.push({
      draftTeamIndex: idx, studentProfileId: null, topicId: topic?.id ?? null,
      type: 'SCHEDULE_CONFLICT', severity: schedule.sharedUsableSlots === 0 ? 'HIGH' : 'MEDIUM',
      title: 'Weak schedule overlap',
      message: `${team.name} shares only ${schedule.sharedUsableSlots} reliable availability slot(s). Agreeing on fixed meeting times early is recommended.`,
      metadata: { sharedUsableSlots: schedule.sharedUsableSlots },
    });
  }

  if (capacity.spreadHours > CAPACITY_SPREAD_WARN_HOURS) {
    warnings.push({
      draftTeamIndex: idx, studentProfileId: null, topicId: topic?.id ?? null,
      type: 'CAPACITY_IMBALANCE', severity: 'MEDIUM',
      title: 'Large capacity imbalance',
      message: `${team.name} has a wide spread in weekly capacity (${capacity.minHours}–${capacity.maxHours}h). Balance task allocation to avoid overloading lower-capacity members.`,
      metadata: { minHours: capacity.minHours, maxHours: capacity.maxHours, spreadHours: capacity.spreadHours },
    });
  }

  if (support.hasMismatch) {
    warnings.push({
      draftTeamIndex: idx, studentProfileId: null, topicId: topic?.id ?? null,
      type: 'SUPPORT_COMPATIBILITY_RISK', severity: 'LOW',
      title: 'Differing work-pattern preferences',
      message: `${team.name}'s members have varied working-style preferences with little overlap. Agree on shared team routines (e.g. how instructions and updates are shared) early. This is a routine suggestion only.`,
    });
  }

  if (preference < 40 && members.length > 0) {
    warnings.push({
      draftTeamIndex: idx, studentProfileId: null, topicId: topic?.id ?? null,
      type: 'LOW_PREFERENCE_MATCH', severity: 'LOW',
      title: 'Low project preference match',
      message: `Members of ${team.name} did not rank ${topic ? `"${topic.title}"` : 'this allocation'} highly. Confirm the topic fit before approval.`,
      metadata: { preferenceScore: preference },
    });
  }

  if (members.length < minTeamSize || members.length > maxTeamSize) {
    warnings.push({
      draftTeamIndex: idx, studentProfileId: null, topicId: topic?.id ?? null,
      type: 'TEAM_SIZE_OUT_OF_RANGE', severity: members.length < minTeamSize ? 'MEDIUM' : 'LOW',
      title: 'Team size outside configured range',
      message: `${team.name} has ${members.length} member(s), outside the configured range of ${minTeamSize}–${maxTeamSize}.`,
      metadata: { size: members.length, minTeamSize, maxTeamSize },
    });
  }

  if (members.length === 0) {
    warnings.push({
      draftTeamIndex: idx, studentProfileId: null, topicId: topic?.id ?? null,
      type: 'STUDENT_UNASSIGNED', severity: 'INFO',
      title: 'Empty draft team',
      message: `${team.name} ended up with no members and can be removed or merged.`,
    });
  }

  // Supervisor capacity risk (raised once per overloaded supervisor at run level).
  if (team.supervisorProfileId) {
    const load = (draftSupervisorCount.get(team.supervisorProfileId) ?? 0) + (existingSupervisorLoad.get(team.supervisorProfileId) ?? 0);
    if (load > SUPERVISOR_DRAFT_TEAM_SOFT_CAP && topic) {
      warnings.push({
        draftTeamIndex: idx, studentProfileId: null, topicId: topic.id,
        type: 'SUPERVISOR_CAPACITY_RISK', severity: 'MEDIUM',
        title: 'Supervisor capacity risk',
        message: `${topic.supervisorName ?? 'The assigned supervisor'} is linked to ${load} team(s) this term (existing + draft), above the soft cap of ${SUPERVISOR_DRAFT_TEAM_SOFT_CAP}. Review supervisor allocation in Part 6.`,
        metadata: { supervisorProfileId: team.supervisorProfileId, load },
      });
    }
  }
}

// ── Persistence ──────────────────────────────────────────────────────────────

async function persistRun(
  runId: string,
  termId: string,
  batchId: string,
  teams: DraftTeamPlan[],
  warnings: DraftWarningDraft[]
): Promise<void> {
  const teamIdByIndex = new Map<number, string>();

  for (const team of teams) {
    const created = await prisma.draftTeam.create({
      data: {
        runId,
        termId,
        batchId,
        topicId: team.topic?.id ?? null,
        supervisorProfileId: team.supervisorProfileId,
        name: team.name,
        status: 'DRAFT',
        overallScore: team.scores.overallScore,
        skillScore: team.scores.skillScore,
        scheduleScore: team.scores.scheduleScore,
        roleScore: team.scores.roleScore,
        preferenceScore: team.scores.preferenceScore,
        capacityScore: team.scores.capacityScore,
        supportCompatibilityScore: team.scores.supportCompatibilityScore,
        supervisorCapacityScore: team.scores.supervisorCapacityScore,
        explanation: team.explanation,
        metadata: {
          memberCount: team.members.length,
          supportRoutineHints: team.supportRoutineHints,
          topicSlug: team.topic?.slug ?? null,
          roleCoverage: team.roleCoverage ?? null,
        } as Prisma.InputJsonValue,
      },
    });
    teamIdByIndex.set(team.index, created.id);

    if (team.members.length > 0) {
      await prisma.draftTeamMember.createMany({
        data: team.members.map((m) => ({
          runId,
          draftTeamId: created.id,
          studentIntakeId: m.student.studentIntakeId,
          studentProfileId: m.student.studentProfileId,
          suggestedRoleKey: m.suggestedRoleKey,
          suggestedRoleLabel: m.suggestedRoleLabel,
          roleConfidence: m.roleConfidence,
          fitScore: m.fitScore,
          explanation: m.explanation,
          metadata: (m.roleMetadata ?? undefined) as Prisma.InputJsonValue | undefined,
        })),
      });
    }
  }

  if (warnings.length > 0) {
    await prisma.draftTeamWarning.createMany({
      data: warnings.map((w) => ({
        runId,
        draftTeamId: w.draftTeamIndex !== null && w.draftTeamIndex >= 0 ? teamIdByIndex.get(w.draftTeamIndex) ?? null : null,
        studentProfileId: w.studentProfileId,
        topicId: w.topicId,
        type: w.type as FormationWarningType,
        severity: w.severity as FormationWarningSeverity,
        title: w.title,
        message: w.message,
        metadata: (w.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        resolved: false,
      })),
    });
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

function buildSummary(
  students: NormalizedStudent[],
  teams: DraftTeamPlan[],
  warnings: DraftWarningDraft[]
): RunSummary {
  const assigned = new Set<string>();
  for (const t of teams) for (const m of t.members) assigned.add(m.student.studentProfileId);
  const unassignedStudents = students.filter((s) => !assigned.has(s.studentProfileId)).length;

  const nonEmptyTeams = teams.filter((t) => t.members.length > 0);
  const averageOverallScore =
    nonEmptyTeams.length > 0
      ? Math.round(nonEmptyTeams.reduce((sum, t) => sum + t.scores.overallScore, 0) / nonEmptyTeams.length)
      : 0;

  const warningCountsBySeverity: Record<string, number> = {};
  const warningCountsByType: Record<string, number> = {};
  for (const w of warnings) {
    warningCountsBySeverity[w.severity] = (warningCountsBySeverity[w.severity] ?? 0) + 1;
    warningCountsByType[w.type] = (warningCountsByType[w.type] ?? 0) + 1;
  }

  const topicUsageMap = new Map<string, { title: string; teamCount: number }>();
  for (const t of teams) {
    if (t.topic) {
      const e = topicUsageMap.get(t.topic.id) ?? { title: t.topic.title, teamCount: 0 };
      e.teamCount += 1;
      topicUsageMap.set(t.topic.id, e);
    }
  }

  return {
    totalStudents: students.length,
    totalDraftTeams: teams.length,
    averageOverallScore,
    unassignedStudents,
    warningCountsBySeverity,
    warningCountsByType,
    topicUsage: Array.from(topicUsageMap.entries()).map(([topicId, v]) => ({ topicId, title: v.title, teamCount: v.teamCount })),
    algorithmVersion: ALGORITHM_VERSION,
  };
}

// ── Explanations ─────────────────────────────────────────────────────────────

function buildTeamExplanation(
  team: DraftTeamPlan,
  skill: ReturnType<typeof scoreSkill>,
  schedule: ReturnType<typeof scoreSchedule>,
  roleCoverage: RoleCoverage,
  roleScore: number,
  preference: number,
  capacity: ReturnType<typeof scoreCapacity>
): string {
  const parts: string[] = [];
  parts.push(`${team.members.length} member(s)${team.topic ? `, suggested topic "${team.topic.title}"` : ', no topic assigned'}.`);
  parts.push(`Overall ${team.scores.overallScore}/100 (skill ${skill.score}, schedule ${schedule.score}, roles ${roleScore}, preference ${preference}, capacity ${capacity.score}).`);
  if (roleCoverage.coveredRoles.length > 0) parts.push(`Roles covered: ${roleCoverage.coveredRoles.join(', ')}.`);
  if (roleCoverage.missingRoles.length > 0) parts.push(`Missing roles: ${roleCoverage.missingRoles.join(', ')}.`);
  if (team.topic && skill.missingRequired.length === 0 && team.topic.requiredSkills.length > 0) {
    parts.push('All required topic skills are covered.');
  }
  if (team.supportRoutineHints.length > 0) {
    parts.push(`Suggested routines: ${team.supportRoutineHints.join('; ')}.`);
  }
  return parts.join(' ');
}

function buildMemberExplanation(member: DraftMemberPlan, topic: NormalizedTopic | null): string {
  const parts: string[] = [];
  if (member.suggestedRoleLabel) {
    parts.push(`Suggested role: ${member.suggestedRoleLabel} (confidence ${member.roleConfidence}/100).`);
  } else {
    parts.push('No clear role preference recorded.');
  }
  if (topic) {
    const rank = member.student.topicRanks[topic.id];
    if (rank) parts.push(`Ranked this topic #${rank}.`);
    else parts.push('Did not rank this topic.');
  }
  return parts.join(' ');
}

// ── Shaping helpers ──────────────────────────────────────────────────────────

function resolveWeights(ruleSet: {
  skillWeight: number;
  scheduleWeight: number;
  roleWeight: number;
  preferenceWeight: number;
  capacityWeight: number;
  supportCompatibilityWeight: number;
  supervisorCapacityWeight: number;
} | null): FormationWeights {
  if (!ruleSet) return { ...DEFAULT_WEIGHTS };
  return {
    skillWeight: ruleSet.skillWeight,
    scheduleWeight: ruleSet.scheduleWeight,
    roleWeight: ruleSet.roleWeight,
    preferenceWeight: ruleSet.preferenceWeight,
    capacityWeight: ruleSet.capacityWeight,
    supportCompatibilityWeight: ruleSet.supportCompatibilityWeight,
    supervisorCapacityWeight: ruleSet.supervisorCapacityWeight,
  };
}

function normalizeSupportFlags(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function shapeRunOverview(run: {
  id: string;
  termId: string;
  batchId: string;
  status: FormationRunOverview['status'];
  algorithmVersion: string;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  summary: unknown;
  settingsSnapshot: unknown;
  createdAt: Date;
  createdBy?: { name: string | null } | null;
}): FormationRunOverview {
  const snapshot = (run.settingsSnapshot ?? {}) as { weights?: FormationWeights };
  return {
    id: run.id,
    termId: run.termId,
    batchId: run.batchId,
    status: run.status,
    algorithmVersion: run.algorithmVersion,
    createdByName: run.createdBy?.name ?? null,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    failedAt: run.failedAt,
    failureReason: run.failureReason,
    summary: (run.summary as RunSummary | null) ?? null,
    weights: snapshot.weights ?? { ...DEFAULT_WEIGHTS },
    createdAt: run.createdAt,
  };
}

function shapeWarning(w: {
  id: string;
  type: FormationWarningType;
  severity: FormationWarningSeverity;
  title: string;
  message: string;
  draftTeamId: string | null;
  resolved: boolean;
  studentProfile?: { user: { name: string | null } | null } | null;
  topic?: { title: string } | null;
}): FormationRunDetails['runWarnings'][number] {
  return {
    id: w.id,
    type: w.type,
    severity: w.severity,
    title: w.title,
    message: w.message,
    draftTeamId: w.draftTeamId,
    studentName: w.studentProfile?.user?.name ?? null,
    topicTitle: w.topic?.title ?? null,
    resolved: w.resolved,
  };
}
