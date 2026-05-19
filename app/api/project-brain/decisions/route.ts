import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(5, 'Title must be at least 5 characters').max(300),
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

  return NextResponse.json({ decision }, { status: 201 });
}
