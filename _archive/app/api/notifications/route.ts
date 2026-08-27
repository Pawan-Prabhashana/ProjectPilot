import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * GET /api/notifications
 *
 * Returns notifications for the authenticated user.
 * Query params:
 *   unreadOnly=true — only return unread notifications
 *   limit=20        — max items (default 20, max 50)
 *   teamId=xxx      — filter by team
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const rawLimit   = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const limit      = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 50);
  const teamId     = url.searchParams.get('teamId') ?? undefined;

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      ...(unreadOnly ? { read: false } : {}),
      ...(teamId ? { teamId } : {}),
    },
    select: {
      id:        true,
      type:      true,
      title:     true,
      body:      true,
      link:      true,
      read:      true,
      readAt:    true,
      createdAt: true,
      teamId:    true,
      projectId: true,
      team:      { select: { name: true } },
      project:   { select: { title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, read: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}
