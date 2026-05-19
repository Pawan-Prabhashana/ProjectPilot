import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { parseSupervisorFeedback } from '@/lib/services/supervisor-bridge';

const schema = z.object({
  content: z.string().min(50, 'Notes must be at least 50 characters').max(10000),
  privateNote: z.string().max(5000).optional().nullable(),
});

/**
 * POST /api/consultations/[id]/meeting-notes
 * Supervisor submits meeting notes. Triggers bridge parsing automatically.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (user.role === 'STUDENT') {
    return NextResponse.json({ error: 'Only supervisors can add meeting notes' }, { status: 403 });
  }

  const booking = await prisma.consultationBooking.findUnique({
    where: { id: params.id },
    include: {
      team: {
        include: {
          supervisor: { select: { userId: true } },
        },
      },
      meetingNote: { select: { id: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  // Only the supervising supervisor or a coordinator can add notes
  if (user.role === 'SUPERVISOR' && booking.team.supervisor?.userId !== user.id) {
    return NextResponse.json({ error: 'You do not supervise this team' }, { status: 403 });
  }

  if (booking.meetingNote) {
    return NextResponse.json({ error: 'Meeting notes already exist for this booking. Use PATCH to update.' }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const note = await prisma.meetingNote.create({
    data: {
      bookingId: params.id,
      authorId: user.id,
      content: parsed.data.content,
      privateNote: parsed.data.privateNote ?? null,
    },
  });

  // Mark booking as COMPLETED
  await prisma.consultationBooking.update({
    where: { id: params.id },
    data: { status: 'COMPLETED' },
  });

  // Auto-trigger bridge parsing — best effort (doesn't fail the request if it fails)
  try {
    await parseSupervisorFeedback(params.id, parsed.data.content);
  } catch {
    // Bridge parsing failure doesn't block note saving
  }

  // Notify team members that notes are available
  const members = await prisma.teamMember.findMany({
    where: { teamId: booking.teamId },
    select: { userId: true },
  });

  await prisma.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId,
      type: 'CONSULTATION_BOOKED' as const,
      title: 'Meeting notes available',
      body: 'Your supervisor has added notes from your consultation. Review your translated action items.',
      link: `/dashboard/consultations/${params.id}`,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ note: { id: note.id }, message: 'Notes saved and bridge parsing triggered.' }, { status: 201 });
}

/**
 * PATCH /api/consultations/[id]/meeting-notes
 * Update existing meeting notes and re-trigger bridge parsing.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (user.role === 'STUDENT') {
    return NextResponse.json({ error: 'Only supervisors can edit meeting notes' }, { status: 403 });
  }

  const note = await prisma.meetingNote.findUnique({
    where: { bookingId: params.id },
    include: { booking: { include: { team: { include: { supervisor: { select: { userId: true } } } } } } },
  });

  if (!note) return NextResponse.json({ error: 'Meeting notes not found' }, { status: 404 });
  if (user.role === 'SUPERVISOR' && note.booking.team.supervisor?.userId !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const updated = await prisma.meetingNote.update({
    where: { bookingId: params.id },
    data: { content: parsed.data.content, privateNote: parsed.data.privateNote ?? null },
  });

  // Re-trigger bridge parsing with updated content
  try {
    await parseSupervisorFeedback(params.id, parsed.data.content);
  } catch {
    // Best effort
  }

  return NextResponse.json({ note: { id: updated.id } });
}
