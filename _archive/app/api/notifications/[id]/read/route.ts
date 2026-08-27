import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * POST /api/notifications/[id]/read
 *
 * Marks a single notification as read for the authenticated user.
 * Validates ownership before updating.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, read: true },
  });

  if (!notification) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }
  if (notification.userId !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  if (notification.read) {
    return NextResponse.json({ ok: true }); // already read, no-op
  }

  await prisma.notification.update({
    where: { id: params.id },
    data:  { read: true, readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
