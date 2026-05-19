import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const raiseSchema = z.object({
  projectId: z.string().min(1),
  question: z.string().min(10, 'Question must be at least 10 characters').max(1000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

const resolveSchema = z.object({
  questionId: z.string().min(1),
  resolution: z.string().min(5, 'Please describe how this was resolved').max(2000),
});

/**
 * POST /api/project-brain/questions
 * Raises a new OpenQuestion for a project.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = raiseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { projectId, question, priority } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      team: {
        include: {
          members: { select: { userId: true } },
          // supervisorId references SupervisorProfile.id; include userId for notifications
          supervisor: { select: { id: true, userId: true } },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const isMember = project.team.members.some((m) => m.userId === user.id);
  // Correct check: compare via SupervisorProfile.userId
  const isSupervisor =
    user.role === 'SUPERVISOR' && project.team.supervisor?.userId === user.id;

  if (!isMember && !isSupervisor && user.role !== 'COORDINATOR') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const raised = await prisma.openQuestion.create({
    data: { projectId, raisedBy: user.id, question, priority },
    include: { raisedByUser: { select: { name: true } } },
  });

  // Notify supervisor if priority is HIGH or URGENT
  // Use supervisor.userId (User.id), not supervisor.id (SupervisorProfile.id)
  if ((priority === 'HIGH' || priority === 'URGENT') && project.team.supervisor) {
    await prisma.notification.create({
      data: {
        userId: project.team.supervisor.userId,
        type: 'TEAM_UPDATE',
        title: `${priority === 'URGENT' ? 'Urgent' : 'High-priority'} question raised`,
        body: `"${question.slice(0, 120)}${question.length > 120 ? '…' : ''}"`,
        link: '/dashboard/project-brain',
      },
    });
  }

  return NextResponse.json({ question: raised }, { status: 201 });
}

/**
 * PATCH /api/project-brain/questions
 * Marks an open question as resolved.
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { questionId, resolution } = parsed.data;

  const question = await prisma.openQuestion.findUnique({
    where: { id: questionId },
    include: {
      project: {
        include: {
          team: {
            include: {
              members: { select: { userId: true } },
              supervisor: { select: { userId: true } },
            },
          },
        },
      },
    },
  });

  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  if (question.resolvedAt) {
    return NextResponse.json({ error: 'Question is already resolved' }, { status: 400 });
  }

  const isMember = question.project.team.members.some((m) => m.userId === user.id);
  // Correct check: compare via SupervisorProfile.userId
  const isSupervisor =
    user.role === 'SUPERVISOR' && question.project.team.supervisor?.userId === user.id;

  if (!isMember && !isSupervisor && user.role !== 'COORDINATOR') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const updated = await prisma.openQuestion.update({
    where: { id: questionId },
    data: { resolvedAt: new Date(), resolution },
  });

  return NextResponse.json({ question: updated });
}
