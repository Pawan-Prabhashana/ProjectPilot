/**
 * Project Topic Catalogue Service — Part 4
 *
 * Handles project topic catalogue queries, student preference saving/submitting,
 * and deterministic conflict detection.
 *
 * Privacy rules:
 *  - Students cannot see other students' preferences (only their own).
 *  - Coordinator sees aggregate demand counts, NOT individual student selections.
 *  - CognitiveProfile is NEVER queried here.
 */

import { prisma, Prisma } from '@/lib/db';
import type {
  ProjectTopicStatus,
  ProjectTopicDifficulty,
  ProjectPreferenceStatus,
  ProjectSelectionConflictType,
  ProjectSelectionConflictSeverity,
} from '@prisma/client';

// ── Input types ───────────────────────────────────────────────────────────────

export type CreateTopicInput = {
  title: string;
  slug: string;
  description: string;
  domain?: string;
  difficulty?: ProjectTopicDifficulty;
  status?: ProjectTopicStatus;
  minTeams?: number;
  maxTeams?: number;
  maxStudents?: number;
  requiredSkills?: string[];
  preferredSkills?: string[];
  deliverables?: string[];
  tags?: string[];
  supervisorProfileId?: string;
  createdById?: string;
};

export type PreferenceInput = {
  topicId: string;
  rank: number;
  motivation?: string;
};

// ── Return types ──────────────────────────────────────────────────────────────

export type TopicSummary = {
  id: string;
  title: string;
  slug: string;
  description: string;
  domain: string | null;
  difficulty: ProjectTopicDifficulty;
  status: ProjectTopicStatus;
  minTeams: number;
  maxTeams: number;
  maxStudents: number | null;
  requiredSkills: string[];
  preferredSkills: string[];
  tags: string[];
  supervisorName: string | null;
  supervisorDepartment: string | null;
  createdAt: Date;
};

export type TopicDemand = {
  topicId: string;
  firstChoiceCount: number;
  totalSubmittedCount: number;
  capacityStatus: 'OK' | 'AT_CAPACITY' | 'OVER_CAPACITY' | 'NO_INTEREST';
};

export type CoordinatorTopicView = TopicSummary & {
  demand: TopicDemand;
};

export type ConflictSummary = {
  id: string;
  type: ProjectSelectionConflictType;
  severity: ProjectSelectionConflictSeverity;
  title: string;
  message: string;
  topicTitle: string | null;
  resolved: boolean;
  createdAt: Date;
};

export type StudentPreference = {
  id: string;
  topicId: string;
  rank: number;
  status: ProjectPreferenceStatus;
  motivation: string | null;
  topic: TopicSummary;
};

export type ProjectPreferenceReadiness = {
  openTopics: number;
  submittedStudents: number;
  missingPreferences: number;
  unresolvedConflicts: number;
};

// ── Topic queries ─────────────────────────────────────────────────────────────

/**
 * Returns open project topics for the active term — used on the student page.
 * Only OPEN topics are shown to students.
 */
export async function getOpenTopicsForTerm(termId: string): Promise<TopicSummary[]> {
  const topics = await prisma.projectTopic.findMany({
    where: { termId, status: 'OPEN' },
    orderBy: { title: 'asc' },
    include: {
      supervisorProfile: {
        select: { user: { select: { name: true } }, department: true },
      },
    },
  });
  return topics.map(shapeTopic);
}

/**
 * Returns all topics for the active term — used on the coordinator page.
 */
export async function getAllTopicsForTerm(termId: string): Promise<TopicSummary[]> {
  const topics = await prisma.projectTopic.findMany({
    where: { termId },
    orderBy: [{ status: 'asc' }, { title: 'asc' }],
    include: {
      supervisorProfile: {
        select: { user: { select: { name: true } }, department: true },
      },
    },
  });
  return topics.map(shapeTopic);
}

/**
 * Returns the coordinator-facing topic view with demand counts.
 * Never exposes individual student identities.
 */
export async function getCoordinatorTopicCatalogue(termId: string): Promise<{
  topics: CoordinatorTopicView[];
  conflicts: ConflictSummary[];
  readiness: ProjectPreferenceReadiness;
}> {
  const [topics, rawPreferences, conflicts, intakes] = await Promise.all([
    prisma.projectTopic.findMany({
      where: { termId },
      orderBy: [{ status: 'asc' }, { title: 'asc' }],
      include: {
        supervisorProfile: { select: { user: { select: { name: true } }, department: true } },
      },
    }),
    prisma.projectPreference.findMany({
      where: { termId, status: 'SUBMITTED' },
      select: { topicId: true, rank: true, studentProfileId: true },
    }),
    prisma.projectSelectionConflict.findMany({
      where: { termId, resolved: false },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      include: { topic: { select: { title: true } } },
    }),
    prisma.studentIntake.findMany({
      where: {
        termId,
        status: { in: ['READY_FOR_FORMATION', 'ASSIGNED_TO_TEAM'] },
      },
      select: { studentProfileId: true },
    }),
  ]);

  // Build demand map
  const firstChoiceCounts = new Map<string, number>();
  const totalCounts = new Map<string, Set<string>>();

  for (const pref of rawPreferences) {
    if (pref.rank === 1) {
      firstChoiceCounts.set(pref.topicId, (firstChoiceCounts.get(pref.topicId) ?? 0) + 1);
    }
    if (!totalCounts.has(pref.topicId)) totalCounts.set(pref.topicId, new Set());
    totalCounts.get(pref.topicId)!.add(pref.studentProfileId);
  }

  // Students who submitted any preferences
  const studentsWithPrefs = new Set(rawPreferences.map(p => p.studentProfileId));
  const eligibleStudents = new Set(intakes.map(i => i.studentProfileId));
  const missingPreferences = Array.from(eligibleStudents).filter(id => !studentsWithPrefs.has(id)).length;

  const coordinatorTopics: CoordinatorTopicView[] = topics.map(t => {
    const firstChoice = firstChoiceCounts.get(t.id) ?? 0;
    const total = totalCounts.get(t.id)?.size ?? 0;
    let capacityStatus: TopicDemand['capacityStatus'] = 'OK';
    if (t.status === 'OPEN' && total === 0) capacityStatus = 'NO_INTEREST';
    else if (t.maxStudents && total > t.maxStudents) capacityStatus = 'OVER_CAPACITY';
    else if (total >= t.maxTeams * 4) capacityStatus = 'AT_CAPACITY';

    return {
      ...shapeTopic(t),
      demand: { topicId: t.id, firstChoiceCount: firstChoice, totalSubmittedCount: total, capacityStatus },
    };
  });

  const conflictSummaries: ConflictSummary[] = conflicts.map(c => ({
    id: c.id,
    type: c.type,
    severity: c.severity,
    title: c.title,
    message: c.message,
    topicTitle: c.topic?.title ?? null,
    resolved: c.resolved,
    createdAt: c.createdAt,
  }));

  const readiness: ProjectPreferenceReadiness = {
    openTopics: topics.filter(t => t.status === 'OPEN').length,
    submittedStudents: studentsWithPrefs.size,
    missingPreferences,
    unresolvedConflicts: conflicts.length,
  };

  return { topics: coordinatorTopics, conflicts: conflictSummaries, readiness };
}

// ── Topic mutations ───────────────────────────────────────────────────────────

/**
 * Creates a new project topic for the given term.
 */
export async function createProjectTopic(
  termId: string,
  input: CreateTopicInput
): Promise<TopicSummary> {
  const existing = await prisma.projectTopic.findFirst({
    where: { termId, slug: input.slug },
  });
  if (existing) throw new Error(`A topic with slug "${input.slug}" already exists for this term.`);

  const maxTeams = Math.max(input.maxTeams ?? 1, input.minTeams ?? 0);

  const topic = await prisma.projectTopic.create({
    data: {
      termId,
      title: input.title,
      slug: input.slug,
      description: input.description,
      domain: input.domain ?? null,
      difficulty: input.difficulty ?? 'MEDIUM',
      status: input.status ?? 'DRAFT',
      minTeams: input.minTeams ?? 0,
      maxTeams,
      maxStudents: input.maxStudents ?? null,
      requiredSkills: input.requiredSkills ? (input.requiredSkills as Prisma.InputJsonValue) : Prisma.JsonNull,
      preferredSkills: input.preferredSkills ? (input.preferredSkills as Prisma.InputJsonValue) : Prisma.JsonNull,
      deliverables: input.deliverables ? (input.deliverables as Prisma.InputJsonValue) : Prisma.JsonNull,
      tags: input.tags ? (input.tags as Prisma.InputJsonValue) : Prisma.JsonNull,
      supervisorProfileId: input.supervisorProfileId ?? null,
      createdById: input.createdById ?? null,
    },
    include: { supervisorProfile: { select: { user: { select: { name: true } }, department: true } } },
  });
  return shapeTopic(topic);
}

// ── Student preference mutations ──────────────────────────────────────────────

/**
 * Returns the current student's preferences for the active term (their own only).
 */
export async function getStudentPreferences(
  termId: string,
  studentProfileId: string
): Promise<StudentPreference[]> {
  const prefs = await prisma.projectPreference.findMany({
    where: { termId, studentProfileId },
    orderBy: { rank: 'asc' },
    include: {
      topic: {
        include: {
          supervisorProfile: { select: { user: { select: { name: true } }, department: true } },
        },
      },
    },
  });
  return prefs.map(p => ({
    id: p.id,
    topicId: p.topicId,
    rank: p.rank,
    status: p.status,
    motivation: p.motivation,
    topic: shapeTopic(p.topic),
  }));
}

/**
 * Saves a student's draft preferences (replaces existing for this term).
 * Validates no duplicate topics, unique ranks.
 */
export async function savePreferenceDraft(
  termId: string,
  studentProfileId: string,
  preferences: PreferenceInput[]
): Promise<void> {
  // Validate uniqueness
  const topicIds = preferences.map(p => p.topicId);
  const ranks = preferences.map(p => p.rank);
  if (new Set(topicIds).size !== topicIds.length) throw new Error('Duplicate topic selections are not allowed.');
  if (new Set(ranks).size !== ranks.length) throw new Error('Duplicate rank values are not allowed.');
  if (preferences.some(p => p.rank < 1)) throw new Error('Rank must be at least 1.');

  // Verify topics exist and are OPEN
  const topics = await prisma.projectTopic.findMany({
    where: { id: { in: topicIds }, termId, status: 'OPEN' },
    select: { id: true },
  });
  if (topics.length !== topicIds.length) throw new Error('One or more selected topics are not open for this term.');

  // Delete existing drafts (keep submitted — student can only re-draft all)
  await prisma.projectPreference.deleteMany({
    where: { termId, studentProfileId, status: 'DRAFT' },
  });

  // Upsert each preference
  for (const pref of preferences) {
    await prisma.projectPreference.upsert({
      where: { termId_studentProfileId_topicId: { termId, studentProfileId, topicId: pref.topicId } },
      update: { rank: pref.rank, motivation: pref.motivation ?? null, status: 'DRAFT' },
      create: { termId, studentProfileId, topicId: pref.topicId, rank: pref.rank, motivation: pref.motivation ?? null, status: 'DRAFT' },
    });
  }
}

/**
 * Submits a student's draft preferences.
 * Marks all current entries for this term as SUBMITTED.
 */
export async function submitPreferences(
  termId: string,
  studentProfileId: string
): Promise<void> {
  const drafts = await prisma.projectPreference.findMany({
    where: { termId, studentProfileId },
    select: { id: true },
  });
  if (drafts.length === 0) throw new Error('No preferences to submit. Save preferences first.');

  await prisma.projectPreference.updateMany({
    where: { termId, studentProfileId },
    data: { status: 'SUBMITTED' },
  });
}

// ── Conflict detection ────────────────────────────────────────────────────────

/**
 * Recalculates all unresolved project selection conflicts for the given term.
 * Deterministic — clears previous unresolved conflicts and regenerates.
 */
export async function recalculateConflicts(termId: string): Promise<ConflictSummary[]> {
  // Clear old unresolved conflicts for this term
  await prisma.projectSelectionConflict.deleteMany({
    where: { termId, resolved: false },
  });

  const [topics, submittedPrefs, intakes] = await Promise.all([
    prisma.projectTopic.findMany({
      where: { termId },
      include: { supervisorProfile: { select: { user: { select: { name: true } }, department: true } } },
    }),
    prisma.projectPreference.findMany({
      where: { termId, status: 'SUBMITTED' },
      select: { topicId: true, rank: true, studentProfileId: true },
    }),
    prisma.studentIntake.findMany({
      where: { termId, status: { in: ['READY_FOR_FORMATION', 'ASSIGNED_TO_TEAM'] } },
      select: {
        studentProfileId: true,
        studentProfile: {
          select: {
            formationProfile: {
              select: { skills: { select: { skillKey: true, level: true } } },
            },
          },
        },
      },
    }),
  ]);

  const conflicts: Prisma.ProjectSelectionConflictCreateManyInput[] = [];

  const firstChoiceCounts = new Map<string, number>();
  const interestedStudents = new Map<string, Set<string>>();

  for (const pref of submittedPrefs) {
    if (pref.rank === 1) firstChoiceCounts.set(pref.topicId, (firstChoiceCounts.get(pref.topicId) ?? 0) + 1);
    if (!interestedStudents.has(pref.topicId)) interestedStudents.set(pref.topicId, new Set());
    interestedStudents.get(pref.topicId)!.add(pref.studentProfileId);
  }

  const studentsWithPrefs = new Set(submittedPrefs.map(p => p.studentProfileId));
  const eligibleStudentIds = intakes.map(i => i.studentProfileId);

  for (const topic of topics) {
    if (topic.status !== 'OPEN') continue;

    const totalInterested = interestedStudents.get(topic.id)?.size ?? 0;
    const firstChoice = firstChoiceCounts.get(topic.id) ?? 0;

    // NO_INTEREST
    if (totalInterested === 0) {
      conflicts.push({
        termId, topicId: topic.id, studentProfileId: null,
        type: 'NO_INTEREST' as ProjectSelectionConflictType,
        severity: 'MEDIUM' as ProjectSelectionConflictSeverity,
        title: `No student interest: ${topic.title}`,
        message: `No students have selected "${topic.title}" in their submitted preferences. Consider reviewing the topic or reaching out to students.`,
        metadata: { topicSlug: topic.slug } as Prisma.InputJsonValue,
        resolved: false,
      });
      continue;
    }

    // OVER_SELECTED — first-choice demand greatly exceeds maxTeams
    const overSelectionThreshold = topic.maxTeams * 6;
    if (firstChoice > overSelectionThreshold || totalInterested > overSelectionThreshold * 1.5) {
      const severity: ProjectSelectionConflictSeverity = firstChoice > topic.maxTeams * 10 ? 'HIGH' : 'MEDIUM';
      conflicts.push({
        termId, topicId: topic.id, studentProfileId: null,
        type: 'OVER_SELECTED' as ProjectSelectionConflictType,
        severity,
        title: `High demand: ${topic.title}`,
        message: `"${topic.title}" has ${firstChoice} first-choice selection${firstChoice !== 1 ? 's' : ''} but only ${topic.maxTeams} team slot${topic.maxTeams !== 1 ? 's' : ''}. ${totalInterested} student${totalInterested !== 1 ? 's' : ''} have it in their preferences. Consider opening an additional team slot or redirecting students.`,
        metadata: { firstChoiceCount: firstChoice, totalInterested, maxTeams: topic.maxTeams } as Prisma.InputJsonValue,
        resolved: false,
      });
    }

    // CAPACITY_EXCEEDED
    if (topic.maxStudents && totalInterested > topic.maxStudents) {
      conflicts.push({
        termId, topicId: topic.id, studentProfileId: null,
        type: 'CAPACITY_EXCEEDED' as ProjectSelectionConflictType,
        severity: 'HIGH' as ProjectSelectionConflictSeverity,
        title: `Capacity exceeded: ${topic.title}`,
        message: `"${topic.title}" has ${totalInterested} interested students but a capacity of ${topic.maxStudents}. ${totalInterested - topic.maxStudents} student${totalInterested - topic.maxStudents !== 1 ? 's' : ''} may not be accommodated.`,
        metadata: { totalInterested, maxStudents: topic.maxStudents } as Prisma.InputJsonValue,
        resolved: false,
      });
    }

    // SKILL_GAP — check required skills
    if (topic.requiredSkills && Array.isArray(topic.requiredSkills)) {
      const requiredKeys = topic.requiredSkills as string[];
      const interestedProfileIds = Array.from(interestedStudents.get(topic.id) ?? []);

      const skillCoverage = await prisma.studentSkill.groupBy({
        by: ['skillKey'],
        where: {
          profile: { studentProfileId: { in: interestedProfileIds } },
          skillKey: { in: requiredKeys },
          level: { gte: 3 },
        },
        _count: { _all: true },
      });

      const coverageMap = new Map(skillCoverage.map(s => [s.skillKey, s._count._all]));
      const weakSkills = requiredKeys.filter(sk => (coverageMap.get(sk) ?? 0) < 2);

      if (weakSkills.length > 0) {
        conflicts.push({
          termId, topicId: topic.id, studentProfileId: null,
          type: 'SKILL_GAP' as ProjectSelectionConflictType,
          severity: weakSkills.length > 2 ? 'HIGH' : 'MEDIUM' as ProjectSelectionConflictSeverity,
          title: `Skill gap detected: ${topic.title}`,
          message: `"${topic.title}" requires ${weakSkills.join(', ')} but fewer than 2 interested students have level ≥ 3 in these skills. Formation may produce an underqualified team.`,
          metadata: { weakSkills, requiredSkills: requiredKeys } as Prisma.InputJsonValue,
          resolved: false,
        });
      }
    }
  }

  // STUDENT_MISSING_PREFERENCES
  for (const studentProfileId of eligibleStudentIds) {
    if (!studentsWithPrefs.has(studentProfileId)) {
      conflicts.push({
        termId, topicId: null, studentProfileId,
        type: 'STUDENT_MISSING_PREFERENCES' as ProjectSelectionConflictType,
        severity: 'LOW' as ProjectSelectionConflictSeverity,
        title: 'Student has not submitted project preferences',
        message: 'This student is marked as ready for formation but has not submitted any project topic preferences. They may be automatically placed in a lower-demand topic.',
        metadata: Prisma.JsonNull,
        resolved: false,
      });
    }
  }

  if (conflicts.length > 0) {
    await prisma.projectSelectionConflict.createMany({ data: conflicts });
  }

  const created = await prisma.projectSelectionConflict.findMany({
    where: { termId, resolved: false },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    include: { topic: { select: { title: true } } },
  });

  return created.map(c => ({
    id: c.id, type: c.type, severity: c.severity,
    title: c.title, message: c.message,
    topicTitle: c.topic?.title ?? null,
    resolved: c.resolved, createdAt: c.createdAt,
  }));
}

/**
 * Returns project preference readiness stats for the coordinator formation-setup page.
 */
export async function getProjectPreferenceReadiness(termId: string): Promise<ProjectPreferenceReadiness> {
  const [openTopics, submittedPrefs, intakes, conflicts] = await Promise.all([
    prisma.projectTopic.count({ where: { termId, status: 'OPEN' } }),
    prisma.projectPreference.findMany({ where: { termId, status: 'SUBMITTED' }, select: { studentProfileId: true } }),
    prisma.studentIntake.findMany({
      where: { termId, status: { in: ['READY_FOR_FORMATION', 'ASSIGNED_TO_TEAM'] } },
      select: { studentProfileId: true },
    }),
    prisma.projectSelectionConflict.count({ where: { termId, resolved: false } }),
  ]);

  const studentsWithPrefs = new Set(submittedPrefs.map(p => p.studentProfileId));
  const eligible = new Set(intakes.map(i => i.studentProfileId));
  const missingPreferences = Array.from(eligible).filter(id => !studentsWithPrefs.has(id)).length;

  return {
    openTopics,
    submittedStudents: studentsWithPrefs.size,
    missingPreferences,
    unresolvedConflicts: conflicts,
  };
}

// ── Helper ────────────────────────────────────────────────────────────────────

function shapeTopic(t: {
  id: string; title: string; slug: string; description: string;
  domain: string | null; difficulty: ProjectTopicDifficulty;
  status: ProjectTopicStatus; minTeams: number; maxTeams: number;
  maxStudents: number | null; requiredSkills: unknown; preferredSkills: unknown;
  tags: unknown; createdAt: Date;
  supervisorProfile?: { user: { name: string | null } | null; department: string | null } | null;
}): TopicSummary {
  return {
    id: t.id, title: t.title, slug: t.slug, description: t.description,
    domain: t.domain, difficulty: t.difficulty, status: t.status,
    minTeams: t.minTeams, maxTeams: t.maxTeams, maxStudents: t.maxStudents,
    requiredSkills: Array.isArray(t.requiredSkills) ? (t.requiredSkills as string[]) : [],
    preferredSkills: Array.isArray(t.preferredSkills) ? (t.preferredSkills as string[]) : [],
    tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
    supervisorName: t.supervisorProfile?.user?.name ?? null,
    supervisorDepartment: t.supervisorProfile?.department ?? null,
    createdAt: t.createdAt,
  };
}
