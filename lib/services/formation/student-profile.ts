/**
 * Student Formation Profile Service
 *
 * Provides all server-side data access for the student formation profile:
 * fetch, upsert (draft save), submit, and completion score calculation.
 *
 * Privacy rules (enforced here):
 *   - privateSupportNotes is returned ONLY for the owning student.
 *   - safeSupportPreferences is returned to the student only; aggregate
 *     readiness counts are safe for coordinator views.
 *   - CognitiveProfile is NEVER queried here.
 */

import { prisma, Prisma } from '@/lib/db';
import type {
  FormationProfileStatus,
  SkillLevelSource,
  Weekday,
  AvailabilityBlock,
  AvailabilityLevel,
} from '@prisma/client';

// ── Input types ───────────────────────────────────────────────────────────────

export type SkillInput = {
  skillKey: string;
  skillLabel: string;
  category: string;
  level: number;         // 1–5
  interest: number;      // 1–5
  source?: SkillLevelSource;
  evidence?: string;
};

export type AvailabilityInput = {
  dayOfWeek: Weekday;
  block: AvailabilityBlock;
  level: AvailabilityLevel;
  note?: string;
};

export type RolePreferenceInput = {
  roleKey: string;
  roleLabel: string;
  preferenceLevel: number;  // 1–5
  confidenceLevel: number;  // 1–5
  avoid?: boolean;
  note?: string;
};

export type ProfileDraftInput = {
  weeklyCapacityHours?: number;
  maxConcurrentTasks?: number;
  preferredTeamSize?: number;
  meetingPreference?: string;
  communicationPreference?: string;
  workStylePreferences?: Record<string, unknown>;
  domainPreferences?: string[];
  safeSupportPreferences?: Record<string, boolean>;
  privateSupportNotes?: string;
};

// ── Return types ──────────────────────────────────────────────────────────────

export type StudentFormationProfileFull = {
  id: string;
  studentProfileId: string;
  status: FormationProfileStatus;
  weeklyCapacityHours: number;
  maxConcurrentTasks: number;
  preferredTeamSize: number | null;
  meetingPreference: string | null;
  communicationPreference: string | null;
  workStylePreferences: Record<string, unknown> | null;
  domainPreferences: string[] | null;
  safeSupportPreferences: Record<string, boolean> | null;
  privateSupportNotes: string | null;
  completionScore: number;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  skills: {
    id: string;
    skillKey: string;
    skillLabel: string;
    category: string;
    level: number;
    interest: number;
    source: SkillLevelSource;
    evidence: string | null;
  }[];
  availability: {
    id: string;
    dayOfWeek: Weekday;
    block: AvailabilityBlock;
    level: AvailabilityLevel;
    note: string | null;
  }[];
  rolePreferences: {
    id: string;
    roleKey: string;
    roleLabel: string;
    preferenceLevel: number;
    confidenceLevel: number;
    avoid: boolean;
    note: string | null;
  }[];
};

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns the full formation profile for the given studentProfileId,
 * including skills, availability, and role preferences.
 * Returns null if no profile exists yet.
 *
 * privateSupportNotes is included — call this ONLY in student-owned contexts.
 */
export async function getStudentFormationProfile(
  studentProfileId: string
): Promise<StudentFormationProfileFull | null> {
  const raw = await prisma.studentFormationProfile.findUnique({
    where: { studentProfileId },
    include: {
      skills: { orderBy: [{ category: 'asc' }, { skillKey: 'asc' }] },
      availability: { orderBy: [{ dayOfWeek: 'asc' }, { block: 'asc' }] },
      rolePreferences: { orderBy: [{ preferenceLevel: 'desc' }] },
    },
  });
  if (!raw) return null;
  return shapeProfile(raw);
}

/**
 * Resolves the StudentProfile for a given userId, then returns the
 * formation profile. Returns null if no StudentProfile or no formation profile.
 */
export async function getFormationProfileForUser(
  userId: string
): Promise<{ studentProfileId: string; profile: StudentFormationProfileFull | null }> {
  const sp = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!sp) return { studentProfileId: '', profile: null };
  const profile = await getStudentFormationProfile(sp.id);
  return { studentProfileId: sp.id, profile };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Creates or updates the base formation profile (no skills/availability/roles).
 * Sets status to DRAFT if not yet submitted.
 * Recalculates completionScore.
 */
export async function upsertProfileDraft(
  studentProfileId: string,
  input: ProfileDraftInput
): Promise<StudentFormationProfileFull> {
  const existing = await prisma.studentFormationProfile.findUnique({
    where: { studentProfileId },
    select: { status: true },
  });

  const safeCapacity = clamp(input.weeklyCapacityHours ?? 8, 1, 40);
  const safeTasks = clamp(input.maxConcurrentTasks ?? 2, 1, 10);

  const jsonOrUndefined = <T>(val: T | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined =>
    val === undefined ? undefined : (val as Prisma.InputJsonValue);

  const data = {
    weeklyCapacityHours: safeCapacity,
    maxConcurrentTasks: safeTasks,
    preferredTeamSize: input.preferredTeamSize ?? null,
    meetingPreference: input.meetingPreference ?? null,
    communicationPreference: input.communicationPreference ?? null,
    workStylePreferences: jsonOrUndefined(input.workStylePreferences),
    domainPreferences: jsonOrUndefined(input.domainPreferences),
    safeSupportPreferences: jsonOrUndefined(input.safeSupportPreferences),
    privateSupportNotes: input.privateSupportNotes ?? null,
    // Keep existing status unless still DRAFT
    status: existing?.status ?? ('DRAFT' as FormationProfileStatus),
  };

  const upserted = await prisma.studentFormationProfile.upsert({
    where: { studentProfileId },
    update: data,
    create: { ...data, studentProfileId },
    include: {
      skills: { orderBy: [{ category: 'asc' }, { skillKey: 'asc' }] },
      availability: { orderBy: [{ dayOfWeek: 'asc' }, { block: 'asc' }] },
      rolePreferences: { orderBy: [{ preferenceLevel: 'desc' }] },
    },
  });

  // Recalculate and persist completion score
  const score = calcCompletionScore(upserted);
  if (score !== upserted.completionScore) {
    await prisma.studentFormationProfile.update({
      where: { id: upserted.id },
      data: { completionScore: score },
    });
    upserted.completionScore = score;
  }

  return shapeProfile(upserted);
}

/**
 * Upserts all skills for a profile — replaces existing entries by skillKey.
 */
export async function upsertSkills(
  profileId: string,
  skills: SkillInput[]
): Promise<void> {
  for (const sk of skills) {
    const level = clamp(sk.level, 1, 5);
    const interest = clamp(sk.interest, 1, 5);
    await prisma.studentSkill.upsert({
      where: { profileId_skillKey: { profileId, skillKey: sk.skillKey } },
      update: { skillLabel: sk.skillLabel, category: sk.category, level, interest, source: sk.source ?? 'SELF_ASSESSED', evidence: sk.evidence ?? null },
      create: { profileId, skillKey: sk.skillKey, skillLabel: sk.skillLabel, category: sk.category, level, interest, source: sk.source ?? 'SELF_ASSESSED', evidence: sk.evidence ?? null },
    });
  }
  await recalcScore(profileId);
}

/**
 * Upserts all role preferences for a profile.
 */
export async function upsertRolePreferences(
  profileId: string,
  roles: RolePreferenceInput[]
): Promise<void> {
  for (const r of roles) {
    const pref = clamp(r.preferenceLevel, 1, 5);
    const conf = clamp(r.confidenceLevel, 1, 5);
    await prisma.studentRolePreference.upsert({
      where: { profileId_roleKey: { profileId, roleKey: r.roleKey } },
      update: { roleLabel: r.roleLabel, preferenceLevel: pref, confidenceLevel: conf, avoid: r.avoid ?? false, note: r.note ?? null },
      create: { profileId, roleKey: r.roleKey, roleLabel: r.roleLabel, preferenceLevel: pref, confidenceLevel: conf, avoid: r.avoid ?? false, note: r.note ?? null },
    });
  }
  await recalcScore(profileId);
}

/**
 * Upserts all availability slots for a profile.
 */
export async function upsertAvailability(
  profileId: string,
  slots: AvailabilityInput[]
): Promise<void> {
  for (const slot of slots) {
    await prisma.studentAvailabilitySlot.upsert({
      where: { profileId_dayOfWeek_block: { profileId, dayOfWeek: slot.dayOfWeek, block: slot.block } },
      update: { level: slot.level, note: slot.note ?? null },
      create: { profileId, dayOfWeek: slot.dayOfWeek, block: slot.block, level: slot.level, note: slot.note ?? null },
    });
  }
  await recalcScore(profileId);
}

/**
 * Submits the formation profile. Sets status to SUBMITTED, records submittedAt.
 * Also upgrades StudentIntake status to READY_FOR_FORMATION if it is PROFILE_PENDING.
 */
export async function submitFormationProfile(
  studentProfileId: string
): Promise<StudentFormationProfileFull> {
  const profile = await prisma.studentFormationProfile.findUnique({
    where: { studentProfileId },
    include: {
      skills: true,
      availability: true,
      rolePreferences: true,
    },
  });

  if (!profile) {
    throw new Error('Formation profile not found. Save a draft first.');
  }

  const score = calcCompletionScore(profile);

  const updated = await prisma.studentFormationProfile.update({
    where: { studentProfileId },
    data: { status: 'SUBMITTED', submittedAt: new Date(), completionScore: score },
    include: {
      skills: { orderBy: [{ category: 'asc' }, { skillKey: 'asc' }] },
      availability: { orderBy: [{ dayOfWeek: 'asc' }, { block: 'asc' }] },
      rolePreferences: { orderBy: [{ preferenceLevel: 'desc' }] },
    },
  });

  // Upgrade StudentIntake status if still PROFILE_PENDING
  const intake = await prisma.studentIntake.findFirst({
    where: { studentProfileId, status: 'PROFILE_PENDING' },
    select: { id: true },
  });
  if (intake) {
    await prisma.studentIntake.update({
      where: { id: intake.id },
      data: { status: 'READY_FOR_FORMATION' },
    });
  }

  return shapeProfile(updated);
}

// ── Coordinator aggregate (no private data) ───────────────────────────────────

export type FormationProfileReadiness = {
  submitted: number;
  draft: number;
  needsReview: number;
  noProfile: number;
  totalIntake: number;
  avgCompletionScore: number;
  withNoSkills: number;
};

/**
 * Returns aggregate formation profile readiness counts for a term's student
 * intake. Never returns privateSupportNotes or CognitiveProfile data.
 */
export async function getFormationProfileReadiness(
  termId: string
): Promise<FormationProfileReadiness> {
  const intakes = await prisma.studentIntake.findMany({
    where: { termId },
    select: {
      studentProfile: {
        select: {
          formationProfile: {
            select: {
              status: true,
              completionScore: true,
              skills: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  let submitted = 0, draft = 0, needsReview = 0, noProfile = 0;
  let totalScore = 0, withNoSkills = 0;

  for (const intake of intakes) {
    const fp = intake.studentProfile?.formationProfile;
    if (!fp) {
      noProfile++;
    } else {
      totalScore += fp.completionScore;
      if (fp.skills.length === 0) withNoSkills++;
      if (fp.status === 'SUBMITTED') submitted++;
      else if (fp.status === 'NEEDS_REVIEW') needsReview++;
      else draft++;
    }
  }

  const withProfile = submitted + draft + needsReview;
  const avgCompletionScore = withProfile > 0 ? Math.round(totalScore / withProfile) : 0;

  return {
    submitted,
    draft,
    needsReview,
    noProfile,
    totalIntake: intakes.length,
    avgCompletionScore,
    withNoSkills,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

async function recalcScore(profileId: string): Promise<void> {
  const profile = await prisma.studentFormationProfile.findUnique({
    where: { id: profileId },
    include: { skills: true, availability: true, rolePreferences: true },
  });
  if (!profile) return;
  const score = calcCompletionScore(profile);
  await prisma.studentFormationProfile.update({
    where: { id: profileId },
    data: { completionScore: score },
  });
}

type ProfileForScore = {
  weeklyCapacityHours: number;
  domainPreferences: unknown;
  safeSupportPreferences: unknown;
  skills: unknown[];
  availability: unknown[];
  rolePreferences: unknown[];
};

/**
 * Completion score (0–100) based on how many sections are filled.
 * Breakdown:
 *   - Capacity set (non-default): 10 pts
 *   - At least 3 skills: 25 pts
 *   - At least 1 role preference: 20 pts
 *   - At least 6 availability slots: 20 pts
 *   - Domain preferences set: 10 pts
 *   - Support preferences set: 15 pts
 */
function calcCompletionScore(profile: ProfileForScore): number {
  let score = 0;
  if (profile.weeklyCapacityHours !== 8) score += 10;
  if (profile.skills.length >= 3) score += 25;
  if (profile.rolePreferences.length >= 1) score += 20;
  if (profile.availability.length >= 6) score += 20;
  if (Array.isArray(profile.domainPreferences) && (profile.domainPreferences as unknown[]).length > 0) score += 10;
  if (profile.safeSupportPreferences && Object.keys(profile.safeSupportPreferences as object).length > 0) score += 15;
  return Math.min(100, score);
}

// Shape raw Prisma result to typed return
function shapeProfile(raw: {
  id: string;
  studentProfileId: string;
  status: FormationProfileStatus;
  weeklyCapacityHours: number;
  maxConcurrentTasks: number;
  preferredTeamSize: number | null;
  meetingPreference: string | null;
  communicationPreference: string | null;
  workStylePreferences: unknown;
  domainPreferences: unknown;
  safeSupportPreferences: unknown;
  privateSupportNotes: string | null;
  completionScore: number;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  skills: {
    id: string;
    skillKey: string;
    skillLabel: string;
    category: string;
    level: number;
    interest: number;
    source: SkillLevelSource;
    evidence: string | null;
  }[];
  availability: {
    id: string;
    dayOfWeek: Weekday;
    block: AvailabilityBlock;
    level: AvailabilityLevel;
    note: string | null;
  }[];
  rolePreferences: {
    id: string;
    roleKey: string;
    roleLabel: string;
    preferenceLevel: number;
    confidenceLevel: number;
    avoid: boolean;
    note: string | null;
  }[];
}): StudentFormationProfileFull {
  return {
    ...raw,
    workStylePreferences: raw.workStylePreferences as Record<string, unknown> | null,
    domainPreferences: raw.domainPreferences as string[] | null,
    safeSupportPreferences: raw.safeSupportPreferences as Record<string, boolean> | null,
  };
}
