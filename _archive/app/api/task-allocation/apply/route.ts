import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageTeam } from '@/lib/rbac/team-permissions';
import { applyTaskAllocationDecision } from '@/lib/services/tasks/task-allocation';
import { createEvent } from '@/lib/events/create-event';
import { EVENT_TYPES } from '@/lib/events/types';
import { log } from '@/lib/logger';
import type { AuthenticatedUser } from '@/lib/rbac';
import type { TaskAssigneeRecommendation } from '@/lib/task-allocation/types';

/**
 * POST /api/task-allocation/apply
 *
 * Applies a chosen assignee to an EXISTING task — always an explicit, human-
 * confirmed action. Body: { taskId, userId, studentProfileId?, recommendation? }.
 * Manual override (picking a non-recommended candidate) is equally supported;
 * `recommendation` is optional and only used to record rationale/scores.
 *
 * Uses getServerSession directly to avoid NEXT_REDIRECT issues in route handlers.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as AuthenticatedUser;

  try {
    const body = await req.json();
    const { taskId, userId, studentProfileId, recommendation } = body as {
      taskId?: string;
      userId?: string;
      studentProfileId?: string | null;
      recommendation?: TaskAssigneeRecommendation | null;
    };

    if (!taskId || !userId) {
      return NextResponse.json({ message: 'taskId and userId are required.' }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, project: { select: { id: true, teamId: true } } },
    });
    if (!task) return NextResponse.json({ message: 'Task not found.' }, { status: 404 });

    const teamId = task.project.teamId;
    const allowed = await canManageTeam(user, teamId);
    if (!allowed) {
      return NextResponse.json({ message: 'Only team leaders, supervisors, and coordinators can assign tasks.' }, { status: 403 });
    }

    const isMember = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
    if (!isMember) {
      return NextResponse.json({ message: 'The chosen assignee is not a member of this team.' }, { status: 400 });
    }

    const result = await applyTaskAllocationDecision({
      taskId,
      userId,
      studentProfileId: studentProfileId ?? isMember.profileId,
      teamId,
      projectId: task.project.id,
      recommendation: recommendation ?? null,
      actorUserId: user.id,
    });

    if (userId !== user.id) {
      await createEvent({
        type: EVENT_TYPES.TASK_ASSIGNED,
        title: `Task assigned to you: ${task.title}`,
        message: `${user.name ?? user.email} assigned you a task.`,
        actorId: user.id,
        teamId,
        projectId: task.project.id,
        entityType: 'Task',
        entityId: task.id,
        visibility: 'PRIVATE',
        notify: { targetUserIds: [userId], href: `/dashboard/tasks/${task.id}?teamId=${teamId}` },
      }).catch((err) => log.error('task-allocation.apply.event_failed', { error: String(err) }));
    }

    return NextResponse.json(result);
  } catch (error) {
    log.error('task-allocation.apply.failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Failed to apply recommendation.' }, { status: 500 });
  }
}
