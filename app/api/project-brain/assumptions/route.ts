import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  projectId: z.string().min(1),
  statement: z.string().min(10, 'Assumption must be at least 10 characters').max(1000),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  source: z.string().max(200).optional(),
});

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

  const { projectId, statement } = parsed.data;

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

  const assumption = await prisma.assumptionRecord.create({
    data: {
      projectId,
      statement,
      loggedBy: user.id,
    },
  });

  return NextResponse.json({ assumption }, { status: 201 });
}
