import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { checkTaskAmbiguity } from '@/lib/services/task-intelligence';

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
  } = parsed.data;

  // Verify access: must be team member, supervisor of the team, or coordinator
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      team: {
        include: {
          members: { select: { userId: true } },
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
    },
    select: {
      id: true, title: true, status: true, priority: true, dueDate: true,
      assigneeId: true, milestoneId: true,
    },
  });

  // Background: check for ambiguity and log activity
  await Promise.allSettled([
    checkTaskAmbiguity(task.id),
    prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'task.created',
        entity: 'Task',
        entityId: task.id,
        metadata: { taskTitle: title, projectId },
      },
    }),
  ]);

  return NextResponse.json({ task }, { status: 201 });
}
