import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { createEvent } from '@/lib/events/create-event';
import { EVENT_TYPES } from '@/lib/events/types';

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
              members: { select: { userId: true, role: true } },
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

  const newStatus = parsed.data.status;
  const oldStatus = task.status;

  const updated = await prisma.task.update({
    where: { id: params.id },
    data:  { status: newStatus },
    select: { id: true, status: true, title: true },
  });

  // Fire event: task status changed
  // Notify team leaders and supervisor — status changes are visible to leadership
  const leaderIds = task.project.team.members
    .filter((m) => m.role === 'LEADER' || m.role === 'CO_LEADER')
    .map((m) => m.userId);

  const supervisorUserId = task.project.team.supervisor?.userId;

  const notifyTargets = [
    ...leaderIds,
    ...(supervisorUserId ? [supervisorUserId] : []),
  ].filter((id) => id !== user.id);

  const statusLabel: Record<string, string> = {
    TODO: 'To Do', IN_PROGRESS: 'In Progress', REVIEW: 'In Review',
    DONE: 'Done', CANCELLED: 'Cancelled',
  };

  await createEvent({
    type: EVENT_TYPES.TASK_STATUS_CHANGED,
    title: `Task status changed: ${task.title}`,
    message: `${user.name ?? user.email} moved "${task.title}" from ${statusLabel[oldStatus] ?? oldStatus} to ${statusLabel[newStatus] ?? newStatus}.`,
    actorId: user.id,
    teamId:  task.project.team.id,
    projectId: task.projectId,
    entityType: 'Task',
    entityId:   task.id,
    visibility: 'TEAM',
    notify: notifyTargets.length > 0
      ? {
          targetUserIds: notifyTargets,
          href: `/dashboard/tasks/${task.id}?teamId=${task.project.team.id}`,
        }
      : false,
  }).catch((err) => console.error('[task/status] event error:', err));

  return NextResponse.json({ task: updated });
}
