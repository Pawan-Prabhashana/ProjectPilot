import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * POST /api/notifications/read-all
 *
 * Marks all unread notifications as read for the authenticated user.
 * Optional body: { teamId: string } — restrict to a specific team.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const teamId = typeof body?.teamId === 'string' ? body.teamId : undefined;

  const now = new Date();
  const { count } = await prisma.notification.updateMany({
    where: {
      userId: user.id,
      read:   false,
      ...(teamId ? { teamId } : {}),
    },
    data: { read: true, readAt: now },
  });

  return NextResponse.json({ ok: true, markedRead: count });
}
