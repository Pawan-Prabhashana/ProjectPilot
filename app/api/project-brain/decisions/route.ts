import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { createEvent } from '@/lib/events/create-event';
import { EVENT_TYPES } from '@/lib/events/types';

const schema = z.object({
  projectId: z.string().min(1),
  title:     z.string().min(5, 'Title must be at least 5 characters').max(300),
  rationale: z.string().min(10, 'Rationale must be at least 10 characters').max(2000),
});

/**
 * POST /api/project-brain/decisions
 *
 * Logs a new DecisionLog entry. Title + rationale are required to
 * encourage thoughtful documentation — a core neurodivergent-friendly
 * design principle (explicit communication, no hidden reasoning).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { projectId, title, rationale } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      team: {
        include: {
          members: { select: { userId: true } },
          // supervisorId references SupervisorProfile.id, not User.id
          supervisor: { select: { userId: true } },
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

  const decision = await prisma.decisionLog.create({
    data: { projectId, madeBy: user.id, title, rationale },
    include: { author: { select: { name: true, role: true } } },
  });

  // Notify team members and supervisor about logged decision
  await createEvent({
    type:       EVENT_TYPES.PROJECT_BRAIN_DECISION_CREATED,
    title:      `Decision logged: ${title}`,
    message:    `${user.name ?? user.email} logged a new project decision.`,
    actorId:    user.id,
    teamId:     project.teamId,
    projectId,
    entityType: 'DecisionLog',
    entityId:   decision.id,
    visibility: 'SUPERVISOR',
    notify: {
      includeTeamMembers: true,
      includeSupervisor:  true,
      href: `/dashboard/project-brain?teamId=${project.teamId}`,
    },
  }).catch((err) => console.error('[decisions POST] event error:', err));

  return NextResponse.json({ decision }, { status: 201 });
}
