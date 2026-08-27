import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma, Prisma } from '@/lib/db';
import { z } from 'zod';
import { checkTaskAmbiguity } from '@/lib/services/task-intelligence';
import { createEvent } from '@/lib/events/create-event';
import { EVENT_TYPES } from '@/lib/events/types';

const allocationScoreSchema = z.object({
  score: z.number(),
  skillScore: z.number(),
  roleScore: z.number(),
  capacityScore: z.number(),
  currentLoadScore: z.number(),
  dueDateScore: z.number(),
  supportFitScore: z.number(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
}).passthrough();

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(3, 'Title must be at least 3 characters').max(300),
  description: z.string().max(5000).nullable().optional(),
  doneCriteria: z.string().max(2000).nullable().optional(),
  blockerNote: z.string().max(1000).nullable().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assigneeId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(14400).nullable().optional(),
  cognitiveLoad: z.number().int().min(1).max(5).nullable().optional(),
  // Part 8: capacity-aware task allocation — all optional, additive.
  requiredSkills: z.array(z.string()).max(12).nullable().optional(),
  suggestedRoleKey: z.string().nullable().optional(),
  // Present only when the creator applied an allocation recommendation.
  appliedRecommendation: allocationScoreSchema.nullable().optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const {
    projectId, title, description, doneCriteria, blockerNote, status, priority,
    assigneeId, milestoneId, dueDate, estimatedMinutes, cognitiveLoad,
    requiredSkills, suggestedRoleKey, appliedRecommendation,
  } = parsed.data;

  // Verify access: must be team member, supervisor of the team, or coordinator
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      team: {
        include: {
          members: { select: { userId: true, profileId: true } },
          supervisor: { select: { userId: true } },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const isMember = project.team.members.some((m) => m.userId === user.id);
  const isSupervisor = project.team.supervisor?.userId === user.id;

  if (!isMember && !isSupervisor && user.role !== 'COORDINATOR') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      milestoneId: milestoneId ?? null,
      title,
      description: description ?? null,
      doneCriteria: doneCriteria ?? null,
      blockerNote: blockerNote ?? null,
      cognitiveLoad: cognitiveLoad ?? null,
      status,
      priority,
      assigneeId: assigneeId ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedMinutes: estimatedMinutes ?? null,
      // Part 8: capacity-aware task allocation metadata, only set when provided.
      requiredSkills: requiredSkills && requiredSkills.length > 0 ? (requiredSkills as Prisma.InputJsonValue) : Prisma.JsonNull,
      suggestedRoleKey: suggestedRoleKey ?? null,
      allocationRationale:
        appliedRecommendation && assigneeId
          ? buildAppliedRationale(appliedRecommendation)
          : null,
      allocationScore:
        appliedRecommendation && assigneeId ? (appliedRecommendation as Prisma.InputJsonValue) : Prisma.JsonNull,
      allocationUpdatedAt: appliedRecommendation && assigneeId ? new Date() : null,
    },
    select: {
      id: true, title: true, status: true, priority: true, dueDate: true,
      assigneeId: true, milestoneId: true,
    },
  });

  // Audit trail: record the accepted recommendation, same as a post-creation "apply".
  if (appliedRecommendation && assigneeId) {
    const assigneeMembership = project.team.members.find((m) => m.userId === assigneeId);
    await prisma.taskAllocationRecommendation.create({
      data: {
        taskId: task.id,
        teamId: project.teamId,
        projectId,
        recommendedUserId: assigneeId,
        recommendedStudentProfileId: assigneeMembership?.profileId ?? null,
        score: appliedRecommendation.score,
        skillScore: appliedRecommendation.skillScore,
        roleScore: appliedRecommendation.roleScore,
        capacityScore: appliedRecommendation.capacityScore,
        currentLoadScore: appliedRecommendation.currentLoadScore,
        dueDateScore: appliedRecommendation.dueDateScore,
        supportFitScore: appliedRecommendation.supportFitScore,
        rationale: buildAppliedRationale(appliedRecommendation),
        metadata: { riskLevel: appliedRecommendation.riskLevel, warnings: appliedRecommendation.warnings } as Prisma.InputJsonValue,
        accepted: true,
      },
    }).catch((err) => console.error('[tasks] allocation audit error:', err));
  }

  // Fire events and check ambiguity in background — never fail the primary action
  await Promise.allSettled([
    checkTaskAmbiguity(task.id),

    // Event: task created — notify team leaders/supervisors
    createEvent({
      type: EVENT_TYPES.TASK_CREATED,
      title: `Task created: ${title}`,
      message: `${user.name ?? user.email} created a new task.`,
      actorId: user.id,
      teamId: project.teamId,
      projectId,
      entityType: 'Task',
      entityId: task.id,
      visibility: 'TEAM',
      notify: {
        includeSupervisor: true,
        includeTeamMembers: false, // only leaders will be notified via assignee path
        href: `/dashboard/tasks/${task.id}?teamId=${project.teamId}`,
      },
    }),

    // Event: task assigned — notify only the assignee (if different from actor)
    ...(assigneeId && assigneeId !== user.id
      ? [createEvent({
          type: EVENT_TYPES.TASK_ASSIGNED,
          title: `Task assigned to you: ${title}`,
          message: `${user.name ?? user.email} assigned you a task.`,
          actorId: user.id,
          teamId: project.teamId,
          projectId,
          entityType: 'Task',
          entityId: task.id,
          visibility: 'PRIVATE',
          notify: {
            targetUserIds: [assigneeId],
            href: `/dashboard/tasks/${task.id}?teamId=${project.teamId}`,
          },
        })]
      : []),
  ]);

  return NextResponse.json({ task }, { status: 201 });
}

/** Builds a plain-text rationale string from an applied allocation recommendation. */
function buildAppliedRationale(rec: z.infer<typeof allocationScoreSchema>): string {
  const parts = [...rec.reasons];
  if (rec.warnings.length > 0) parts.push(...rec.warnings.map((w) => `Caution: ${w}`));
  parts.push(`Overall fit ${rec.score}/100 (risk: ${rec.riskLevel}).`);
  return parts.join(' ');
}
