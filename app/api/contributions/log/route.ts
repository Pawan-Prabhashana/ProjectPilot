import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import type { ContributionType } from '@prisma/client';

const schema = z.object({
  projectId: z.string().min(1),
  description: z.string().min(10, 'Please describe your contribution in at least 10 characters').max(1000),
  contributionType: z.enum([
    'CODE', 'DESIGN', 'RESEARCH', 'WRITING', 'PLANNING', 'TESTING',
    'COORDINATION', 'REVIEW', 'DOCUMENTATION', 'CLARIFICATION',
    'MEETING_PREP', 'UNBLOCKING_SUPPORT', 'OTHER',
  ]),
  hours: z.number().min(0.25).max(24).nullable().optional(),
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

  const { projectId, description, contributionType, hours } = parsed.data;

  // Verify access
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { include: { members: { select: { userId: true } } } } },
  });

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const isMember = project.team.members.some((m) => m.userId === user.id);
  if (!isMember && user.role !== 'COORDINATOR') {
    return NextResponse.json({ error: 'Access denied — you must be a team member to log contributions' }, { status: 403 });
  }

  const log = await prisma.contributionLog.create({
    data: {
      projectId,
      userId: user.id,
      description,
      contributionType: contributionType as ContributionType,
      hours: hours ?? null,
    },
  });

  // Keep the summary breakdown in sync
  await prisma.contributionTypeBreakdown.upsert({
    where: {
      projectId_userId_contributionType: {
        projectId,
        userId: user.id,
        contributionType: contributionType as ContributionType,
      },
    },
    update: {
      count: { increment: 1 },
      totalHours: { increment: hours ?? 0 },
      lastLoggedAt: new Date(),
    },
    create: {
      projectId,
      userId: user.id,
      contributionType: contributionType as ContributionType,
      count: 1,
      totalHours: hours ?? 0,
    },
  });

  return NextResponse.json({ log: { id: log.id, contributionType: log.contributionType } }, { status: 201 });
}
