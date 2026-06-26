/**
 * Coordinator Formation Workspace — Service (Part 6)
 *
 * Provides read and write operations for the coordinator formation workspace:
 *   - Inspecting draft teams from a formation run
 *   - Making lightweight manual adjustments (rename, status, role, move member)
 *   - Validating and publishing a run into operational Team / TeamMember / Project records
 *
 * PRIVACY (hard rules):
 *   - CognitiveProfile is NEVER queried.
 *   - privateSupportNotes is NEVER selected or returned.
 *   - Only public student identity (name, email) surfaces in workspace views.
 */

import { prisma, Prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import type {
  DraftTeamStatus,
  TeamMemberRole,
  FormationWarningSeverity,
} from '@prisma/client';
import type {
  DraftTeamView,
  DraftMemberView,
  DraftWarningView,
  FormationRunOverview,
  FormationRunDetails,
} from '@/lib/formation/team-formation-types';

// ── Types ────────────────────────────────────────────────────────────────────

export type WorkspaceOverview = {
  term: {
    id: string;
    name: string;
    code: string;
    status: string;
  } | null;
  batch: {
    id: string;
    name: string;
    status: string;
    targetTeamSize: number;
    minTeamSize: number;
    maxTeamSize: number;
  } | null;
  latestRun: FormationRunOverview | null;
  isPublished: boolean;
};

export type PublishValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  teamReadiness: {
    draftTeamId: string;
    name: string;
    status: DraftTeamStatus;
    memberCount: number;
    isReady: boolean;
    issues: string[];
  }[];
};

export type PublishSummary = {
  publishedTeams: number;
  publishedMembers: number;
  publishedProjects: number;
  publishedAt: string;
};

// ── Workspace overview ───────────────────────────────────────────────────────

export async function getCoordinatorFormationWorkspace(): Promise<WorkspaceOverview> {
  // Find active academic term
  const term = await prisma.academicTerm.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  if (!term) {
    return { term: null, batch: null, latestRun: null, isPublished: false };
  }

  // Find active/ready formation batch for this term
  const batch = await prisma.formationBatch.findFirst({
    where: {
      termId: term.id,
      status: { in: ['DRAFT', 'READY', 'RUNNING', 'REVIEW', 'APPROVED', 'PUBLISHED'] },
    },
    orderBy: { createdAt: 'desc' },
    include: { ruleSet: true },
  });

  if (!batch) {
    return {
      term: { id: term.id, name: term.name, code: term.code, status: term.status },
      batch: null,
      latestRun: null,
      isPublished: false,
    };
  }

  // Find the latest formation run for this batch
  const latestRun = await prisma.teamFormationRun.findFirst({
    where: { batchId: batch.id },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { name: true } },
      publishedBy: { select: { name: true } },
      _count: { select: { draftTeams: true } },
    },
  });

  const runOverview: FormationRunOverview | null = latestRun
    ? {
        id: latestRun.id,
        termId: latestRun.termId,
        batchId: latestRun.batchId,
        status: latestRun.status,
        algorithmVersion: latestRun.algorithmVersion,
        createdByName: latestRun.createdBy?.name ?? null,
        startedAt: latestRun.startedAt,
        completedAt: latestRun.completedAt,
        failedAt: latestRun.failedAt,
        failureReason: latestRun.failureReason,
        summary: (latestRun.summary as Record<string, unknown> | null) as FormationRunOverview['summary'],
        weights: ((latestRun.settingsSnapshot as Record<string, unknown> | null)?.weights as FormationRunOverview['weights']) ?? null,
        createdAt: latestRun.createdAt,
      }
    : null;

  return {
    term: { id: term.id, name: term.name, code: term.code, status: term.status },
    batch: {
      id: batch.id,
      name: batch.name,
      status: batch.status,
      targetTeamSize: batch.targetTeamSize,
      minTeamSize: batch.minTeamSize,
      maxTeamSize: batch.maxTeamSize,
    },
    latestRun: runOverview,
    isPublished: !!(latestRun?.publishedAt),
  };
}

// ── Run details for workspace ────────────────────────────────────────────────

export async function getFormationWorkspaceRun(runId: string): Promise<FormationRunDetails | null> {
  const run = await prisma.teamFormationRun.findUnique({
    where: { id: runId },
    include: {
      createdBy: { select: { name: true } },
      publishedBy: { select: { name: true } },
      draftTeams: {
        orderBy: { overallScore: 'desc' },
        include: {
          topic: { select: { id: true, title: true, slug: true } },
          supervisorProfile: { select: { id: true, user: { select: { name: true } } } },
          members: {
            include: {
              studentProfile: {
                select: { id: true, user: { select: { name: true, email: true } } },
              },
            },
          },
          warnings: {
            orderBy: { severity: 'desc' },
            include: {
              studentProfile: { select: { user: { select: { name: true } } } },
              topic: { select: { title: true } },
            },
          },
        },
      },
      warnings: {
        where: { draftTeamId: null },
        orderBy: { severity: 'desc' },
        include: {
          studentProfile: { select: { user: { select: { name: true } } } },
          topic: { select: { title: true } },
        },
      },
    },
  });

  if (!run) return null;

  const toWarningView = (w: {
    id: string;
    type: FormationRunDetails['runWarnings'][number]['type'];
    severity: FormationWarningSeverity;
    title: string;
    message: string;
    draftTeamId?: string | null;
    resolved: boolean;
    studentProfile?: { user: { name: string | null } } | null;
    topic?: { title: string } | null;
  }): DraftWarningView => ({
    id: w.id,
    type: w.type,
    severity: w.severity,
    title: w.title,
    message: w.message,
    draftTeamId: w.draftTeamId ?? null,
    studentName: w.studentProfile?.user?.name ?? null,
    topicTitle: w.topic?.title ?? null,
    resolved: w.resolved,
  });

  const draftTeams: DraftTeamView[] = run.draftTeams.map((dt) => ({
    id: dt.id,
    name: dt.name,
    status: dt.status,
    topicId: dt.topicId ?? null,
    topicTitle: dt.topic?.title ?? null,
    supervisorName: dt.supervisorProfile?.user?.name ?? null,
    overallScore: dt.overallScore,
    scores: {
      skillScore: dt.skillScore,
      scheduleScore: dt.scheduleScore,
      roleScore: dt.roleScore,
      preferenceScore: dt.preferenceScore,
      capacityScore: dt.capacityScore,
      supportCompatibilityScore: dt.supportCompatibilityScore,
      supervisorCapacityScore: dt.supervisorCapacityScore,
      overallScore: dt.overallScore,
    },
    explanation: dt.explanation,
    supportRoutineHints: [],
    members: dt.members.map(
      (m): DraftMemberView => ({
        id: m.id,
        studentProfileId: m.studentProfileId,
        name: m.studentProfile?.user?.name ?? 'Unknown',
        suggestedRoleKey: m.suggestedRoleKey,
        suggestedRoleLabel: m.suggestedRoleLabel,
        roleConfidence: m.roleConfidence,
        fitScore: m.fitScore,
        explanation: m.explanation,
      })
    ),
    warnings: dt.warnings.map(toWarningView),
  }));

  const runOverview: FormationRunOverview = {
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
    summary: (run.summary as FormationRunOverview['summary']) ?? null,
    weights: ((run.settingsSnapshot as Record<string, unknown> | null)?.weights as FormationRunOverview['weights']) ?? null,
    createdAt: run.createdAt,
  };

  return {
    run: runOverview,
    draftTeams,
    runWarnings: run.warnings.map(toWarningView),
  };
}

// ── Draft team mutations ─────────────────────────────────────────────────────

export async function updateDraftTeam(
  draftTeamId: string,
  data: { name?: string; status?: DraftTeamStatus; topicId?: string | null }
): Promise<{ id: string; name: string; status: DraftTeamStatus }> {
  const updated = await prisma.draftTeam.update({
    where: { id: draftTeamId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.topicId !== undefined && { topicId: data.topicId }),
    },
    select: { id: true, name: true, status: true },
  });
  return updated;
}

// ── Draft member mutations ───────────────────────────────────────────────────

export async function updateDraftTeamMember(
  memberId: string,
  data: { suggestedRoleKey?: string; suggestedRoleLabel?: string }
): Promise<{ id: string; suggestedRoleKey: string | null; suggestedRoleLabel: string | null }> {
  const updated = await prisma.draftTeamMember.update({
    where: { id: memberId },
    data: {
      ...(data.suggestedRoleKey !== undefined && { suggestedRoleKey: data.suggestedRoleKey }),
      ...(data.suggestedRoleLabel !== undefined && { suggestedRoleLabel: data.suggestedRoleLabel }),
    },
    select: { id: true, suggestedRoleKey: true, suggestedRoleLabel: true },
  });
  return updated;
}

export async function moveDraftTeamMember(
  memberId: string,
  targetDraftTeamId: string
): Promise<{ success: boolean; message: string }> {
  const member = await prisma.draftTeamMember.findUnique({
    where: { id: memberId },
    select: { id: true, runId: true, draftTeamId: true, studentProfileId: true },
  });
  if (!member) return { success: false, message: 'Member not found.' };
  if (member.draftTeamId === targetDraftTeamId) {
    return { success: false, message: 'Member is already in this team.' };
  }

  // Verify target team belongs to the same run
  const targetTeam = await prisma.draftTeam.findUnique({
    where: { id: targetDraftTeamId },
    select: { runId: true },
  });
  if (!targetTeam || targetTeam.runId !== member.runId) {
    return { success: false, message: 'Target team is not in the same formation run.' };
  }

  // Check no duplicate: student already in target team
  const existingInTarget = await prisma.draftTeamMember.findFirst({
    where: { draftTeamId: targetDraftTeamId, studentProfileId: member.studentProfileId },
  });
  if (existingInTarget) {
    return { success: false, message: 'Student is already a member of the target team.' };
  }

  await prisma.draftTeamMember.update({
    where: { id: memberId },
    data: { draftTeamId: targetDraftTeamId },
  });

  return { success: true, message: 'Member moved successfully.' };
}

// ── Publish validation ───────────────────────────────────────────────────────

export async function validateRunForPublish(runId: string): Promise<PublishValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const run = await prisma.teamFormationRun.findUnique({
    where: { id: runId },
    include: {
      batch: { select: { minTeamSize: true, maxTeamSize: true } },
      draftTeams: {
        include: {
          members: { select: { id: true, studentProfileId: true } },
          warnings: {
            where: { resolved: false },
            select: { severity: true },
          },
        },
      },
    },
  });

  if (!run) {
    return { valid: false, errors: ['Formation run not found.'], warnings: [], teamReadiness: [] };
  }

  if (run.status !== 'COMPLETED') {
    errors.push(`Run status is "${run.status}". Only COMPLETED runs can be published.`);
  }

  if (run.publishedAt) {
    errors.push('This run has already been published.');
  }

  // Check if any Team already exists sourced from this run
  const existingPublishedTeams = await prisma.team.count({
    where: { sourceDraftTeamId: { in: run.draftTeams.map((dt) => dt.id) } },
  });
  if (existingPublishedTeams > 0) {
    errors.push(
      `${existingPublishedTeams} team(s) from this run have already been published. Cannot publish again.`
    );
  }

  if (run.draftTeams.length === 0) {
    errors.push('No draft teams found in this run.');
  }

  // Check all students appear only once across the run
  const allStudentIds = run.draftTeams.flatMap((dt) => dt.members.map((m) => m.studentProfileId));
  const uniqueStudentIds = new Set(allStudentIds);
  if (allStudentIds.length !== uniqueStudentIds.size) {
    errors.push('Duplicate student detected across draft teams. Fix before publishing.');
  }

  const teamReadiness = run.draftTeams.map((dt) => {
    const issues: string[] = [];
    const memberCount = dt.members.length;

    if (dt.status !== 'READY' && dt.status !== 'LOCKED') {
      issues.push(`Status is "${dt.status}" — must be READY or LOCKED to publish.`);
    }
    if (memberCount === 0) {
      issues.push('Team has no members.');
    }
    if (memberCount < run.batch.minTeamSize) {
      issues.push(
        `Team has ${memberCount} member(s) but minimum is ${run.batch.minTeamSize}.`
      );
    }
    if (memberCount > run.batch.maxTeamSize) {
      issues.push(
        `Team has ${memberCount} member(s) but maximum is ${run.batch.maxTeamSize}.`
      );
    }

    const criticalWarnings = dt.warnings.filter((w) => w.severity === 'CRITICAL');
    const highWarnings = dt.warnings.filter((w) => w.severity === 'HIGH');

    if (criticalWarnings.length > 0) {
      issues.push(
        `${criticalWarnings.length} CRITICAL unresolved warning(s) must be resolved.`
      );
    }
    if (highWarnings.length > 0) {
      warnings.push(
        `Team "${dt.name}" has ${highWarnings.length} HIGH severity warning(s).`
      );
    }

    return {
      draftTeamId: dt.id,
      name: dt.name,
      status: dt.status,
      memberCount,
      isReady: issues.length === 0,
      issues,
    };
  });

  // Accumulate team-level errors into top-level
  const teamsNotReady = teamReadiness.filter((t) => !t.isReady);
  if (teamsNotReady.length > 0) {
    teamsNotReady.forEach((t) => {
      t.issues.forEach((issue) => errors.push(`[${t.name}] ${issue}`));
    });
  }

  return { valid: errors.length === 0, errors, warnings, teamReadiness };
}

// ── Publish run ──────────────────────────────────────────────────────────────

function mapRoleKey(suggestedRoleKey: string | null): TeamMemberRole {
  if (!suggestedRoleKey) return 'MEMBER';
  const k = suggestedRoleKey.toLowerCase();
  if (k === 'team_leader' || k === 'leader') return 'LEADER';
  if (k === 'co_leader' || k === 'co-leader') return 'CO_LEADER';
  return 'MEMBER';
}

function slugify(name: string, id: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base}-${id.slice(-6)}`;
}

export async function publishFormationRun(
  runId: string,
  coordinatorUserId: string
): Promise<{ success: boolean; message: string; summary?: PublishSummary }> {
  // Pre-flight validation
  const validation = await validateRunForPublish(runId);
  if (!validation.valid) {
    return {
      success: false,
      message: `Publish blocked: ${validation.errors[0]}`,
    };
  }

  // First fetch termId only, to use in the intake filter of the full query
  const runMeta = await prisma.teamFormationRun.findUnique({
    where: { id: runId },
    select: { termId: true, batchId: true },
  });

  if (!runMeta) {
    return { success: false, message: 'Formation run not found.' };
  }

  const termId = runMeta.termId;

  const runFull = await prisma.teamFormationRun.findUnique({
    where: { id: runId },
    include: {
      term: { select: { id: true } },
      batch: { select: { id: true, minTeamSize: true, maxTeamSize: true } },
      draftTeams: {
        include: {
          topic: {
            select: { id: true, title: true, description: true, supervisorProfileId: true },
          },
          supervisorProfile: {
            select: { id: true, user: { select: { id: true } } },
          },
          members: {
            include: {
              studentProfile: {
                select: {
                  id: true,
                  userId: true,
                  intakeRecords: {
                    where: { termId },
                    select: {
                      id: true,
                      status: true,
                      batchMemberships: { select: { id: true, status: true } },
                    },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!runFull) {
    return { success: false, message: 'Formation run not found (detail query).' };
  }

  try {
    const publishedAt = new Date();
    let publishedTeamCount = 0;
    let publishedMemberCount = 0;
    let publishedProjectCount = 0;

    await prisma.$transaction(
      async (tx) => {
        for (const draftTeam of runFull.draftTeams) {
          const teamSlug = slugify(draftTeam.name, draftTeam.id);

          // 1. Create operational Team
          const team = await tx.team.create({
            data: {
              name: draftTeam.name,
              slug: teamSlug,
              academicTermId: runFull.termId,
              formationBatchId: runFull.batchId,
              sourceDraftTeamId: draftTeam.id,
              supervisorId: draftTeam.supervisorProfile?.id ?? null,
            },
          });
          publishedTeamCount++;

          // 2. Create TeamMember records
          for (const member of draftTeam.members) {
            const role = mapRoleKey(member.suggestedRoleKey);
            await tx.teamMember.create({
              data: {
                teamId: team.id,
                userId: member.studentProfile.userId,
                profileId: member.studentProfile.id,
                role,
              },
            });
            publishedMemberCount++;

            // 3a. Update StudentIntake status
            const intake = member.studentProfile.intakeRecords[0];
            if (intake) {
              await tx.studentIntake.update({
                where: { id: intake.id },
                data: { status: 'ASSIGNED_TO_TEAM' },
              });

              // 3b. Update FormationBatchStudent status
              const batchMembership = intake.batchMemberships[0];
              if (batchMembership) {
                await tx.formationBatchStudent.update({
                  where: { id: batchMembership.id },
                  data: { status: 'ASSIGNED' },
                });
              }
            }
          }

          // 4. Create operational Project
          const projectTitle = draftTeam.topic?.title ?? `${draftTeam.name} Project`;
          const projectDescription =
            draftTeam.topic?.description ?? `Project for team ${draftTeam.name}.`;

          await tx.project.create({
            data: {
              teamId: team.id,
              title: projectTitle,
              description: projectDescription,
              status: 'ACTIVE',
            },
          });
          publishedProjectCount++;

          // 5. Lock the draft team
          await tx.draftTeam.update({
            where: { id: draftTeam.id },
            data: { status: 'LOCKED' },
          });
        }

        // 6. Update FormationBatch to PUBLISHED
        await tx.formationBatch.update({
          where: { id: runFull.batchId },
          data: { status: 'PUBLISHED' },
        });

        // 7. Mark TeamFormationRun as published
        const publishSummary: PublishSummary = {
          publishedTeams: publishedTeamCount,
          publishedMembers: publishedMemberCount,
          publishedProjects: publishedProjectCount,
          publishedAt: publishedAt.toISOString(),
        };

        await tx.teamFormationRun.update({
          where: { id: runId },
          data: {
            publishedAt,
            publishedById: coordinatorUserId,
            publishSummary: publishSummary as Prisma.InputJsonValue,
          },
        });
      },
      { timeout: 30000 }
    );

    log.info(`Formation run ${runId} published by ${coordinatorUserId}.`);

    return {
      success: true,
      message: `Successfully published ${publishedTeamCount} teams, ${publishedMemberCount} members, and ${publishedProjectCount} projects.`,
      summary: {
        publishedTeams: publishedTeamCount,
        publishedMembers: publishedMemberCount,
        publishedProjects: publishedProjectCount,
        publishedAt: publishedAt.toISOString(),
      },
    };
  } catch (err) {
    log.error('publishFormationRun error', { error: String(err) });
    return {
      success: false,
      message: err instanceof Error ? err.message : 'An unexpected error occurred during publishing.',
    };
  }
}
