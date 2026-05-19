import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED']),
});

/**
 * PATCH /api/tasks/[id]/status
 *
 * Updates a task's status. The user must be a team member, the team's
 * supervisor, or a coordinator.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid status' },
      { status: 400 }
    );
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      project: {
        include: {
          team: {
            include: {
              members: { select: { userId: true } },
              // supervisorId references SupervisorProfile.id, not User.id
              supervisor: { select: { userId: true } },
            },
          },
        },
      },
    },
  });

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const isMember = task.project.team.members.some((m) => m.userId === user.id);
  // Correct check: compare supervisor's User.id via SupervisorProfile.userId
  const isSupervisor =
    user.role === 'SUPERVISOR' && task.project.team.supervisor?.userId === user.id;

  if (!isMember && !isSupervisor && user.role !== 'COORDINATOR') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const updated = await prisma.task.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
    select: { id: true, status: true, title: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'task.status_updated',
      entity: 'Task',
      entityId: params.id,
      metadata: { newStatus: parsed.data.status, taskTitle: task.title },
    },
  });

  return NextResponse.json({ task: updated });
}
