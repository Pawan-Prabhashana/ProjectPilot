/**
 * Formation Setup Service
 *
 * Queries the academic term, student intake, and formation batch data needed
 * by the coordinator formation-setup page.
 *
 * Privacy rule: CognitiveProfile is NEVER queried here.
 * Only operational fields from AcademicTerm, StudentIntake, FormationBatch,
 * FormationBatchStudent, Team, StudentProfile (basic academic fields), and
 * User (name/email only) are included.
 */

import { prisma } from '@/lib/db';
import type {
  AcademicTermStatus,
  FormationBatchStatus,
  StudentIntakeStatus,
  FormationBatchStudentStatus,
} from '@prisma/client';

// ── Return types ──────────────────────────────────────────────────────────────

export type ActiveTermSummary = {
  id: string;
  name: string;
  code: string;
  academicYear: number | null;
  semesterLabel: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  status: AcademicTermStatus;
};

export type IntakeSummary = {
  total: number;
  byStatus: Record<StudentIntakeStatus, number>;
};

export type BatchSummary = {
  id: string;
  name: string;
  status: FormationBatchStatus;
  targetTeamSize: number;
  minTeamSize: number;
  maxTeamSize: number;
  createdByName: string | null;
  studentCount: number;
  byStudentStatus: Record<FormationBatchStudentStatus, number>;
  ruleSet: RuleSetSummary | null;
};

export type RuleSetSummary = {
  skillWeight: number;
  scheduleWeight: number;
  roleWeight: number;
  preferenceWeight: number;
  capacityWeight: number;
  supportCompatibilityWeight: number;
  supervisorCapacityWeight: number;
  totalWeight: number;
  notes: string | null;
};

export type LinkedTeamSummary = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  supervisorName: string | null;
  healthStatus: string;
};

export type FormationSetupData = {
  activeTerm: ActiveTermSummary | null;
  intakeSummary: IntakeSummary;
  batches: BatchSummary[];
  linkedTeams: LinkedTeamSummary[];
};

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns all data needed by the Formation Setup page.
 * Looks for the currently ACTIVE term; if multiple exist, takes the most
 * recently created one.
 */
export async function getFormationSetupData(): Promise<FormationSetupData> {
  // 1. Find the active academic term
  const term = await prisma.academicTerm.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  if (!term) {
    return {
      activeTerm: null,
      intakeSummary: { total: 0, byStatus: emptyIntakeStatusMap() },
      batches: [],
      linkedTeams: [],
    };
  }

  const activeTerm: ActiveTermSummary = {
    id: term.id,
    name: term.name,
    code: term.code,
    academicYear: term.academicYear,
    semesterLabel: term.semesterLabel,
    startsAt: term.startsAt,
    endsAt: term.endsAt,
    status: term.status,
  };

  // 2. Intake summary for this term
  const intakes = await prisma.studentIntake.findMany({
    where: { termId: term.id },
    select: { status: true },
  });

  const intakeSummary: IntakeSummary = {
    total: intakes.length,
    byStatus: emptyIntakeStatusMap(),
  };
  for (const i of intakes) {
    intakeSummary.byStatus[i.status] = (intakeSummary.byStatus[i.status] ?? 0) + 1;
  }

  // 3. Formation batches for this term (with rule sets and student counts)
  const rawBatches = await prisma.formationBatch.findMany({
    where: { termId: term.id },
    orderBy: { createdAt: 'asc' },
    include: {
      createdBy: { select: { name: true } },
      students: { select: { status: true } },
      ruleSet: true,
    },
  });

  const batches: BatchSummary[] = rawBatches.map((b) => {
    const byStudentStatus = emptyBatchStudentStatusMap();
    for (const s of b.students) {
      byStudentStatus[s.status] = (byStudentStatus[s.status] ?? 0) + 1;
    }

    const ruleSet: RuleSetSummary | null = b.ruleSet
      ? {
          skillWeight: b.ruleSet.skillWeight,
          scheduleWeight: b.ruleSet.scheduleWeight,
          roleWeight: b.ruleSet.roleWeight,
          preferenceWeight: b.ruleSet.preferenceWeight,
          capacityWeight: b.ruleSet.capacityWeight,
          supportCompatibilityWeight: b.ruleSet.supportCompatibilityWeight,
          supervisorCapacityWeight: b.ruleSet.supervisorCapacityWeight,
          totalWeight:
            b.ruleSet.skillWeight +
            b.ruleSet.scheduleWeight +
            b.ruleSet.roleWeight +
            b.ruleSet.preferenceWeight +
            b.ruleSet.capacityWeight +
            b.ruleSet.supportCompatibilityWeight +
            b.ruleSet.supervisorCapacityWeight,
          notes: b.ruleSet.notes,
        }
      : null;

    return {
      id: b.id,
      name: b.name,
      status: b.status,
      targetTeamSize: b.targetTeamSize,
      minTeamSize: b.minTeamSize,
      maxTeamSize: b.maxTeamSize,
      createdByName: b.createdBy?.name ?? null,
      studentCount: b.students.length,
      byStudentStatus,
      ruleSet,
    };
  });

  // 4. Teams linked to this term
  const rawTeams = await prisma.team.findMany({
    where: { academicTermId: term.id },
    orderBy: { createdAt: 'asc' },
    include: {
      members: { select: { id: true } },
      supervisor: { include: { user: { select: { name: true } } } },
    },
  });

  const linkedTeams: LinkedTeamSummary[] = rawTeams.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    memberCount: t.members.length,
    supervisorName: t.supervisor?.user.name ?? null,
    healthStatus: t.healthStatus,
  }));

  return { activeTerm, intakeSummary, batches, linkedTeams };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyIntakeStatusMap(): Record<StudentIntakeStatus, number> {
  return {
    INVITED: 0,
    PROFILE_PENDING: 0,
    READY_FOR_FORMATION: 0,
    ASSIGNED_TO_TEAM: 0,
    WITHDRAWN: 0,
  };
}

function emptyBatchStudentStatusMap(): Record<FormationBatchStudentStatus, number> {
  return {
    INCLUDED: 0,
    EXCLUDED: 0,
    LOCKED: 0,
    ASSIGNED: 0,
  };
}
