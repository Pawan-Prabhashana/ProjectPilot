import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { parseSupervisorFeedback } from '@/lib/services/supervisor-bridge';
import { createEvent } from '@/lib/events/create-event';
import { EVENT_TYPES } from '@/lib/events/types';

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
          project:    { select: { id: true } },
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
    return NextResponse.json({
      error: 'Meeting notes already exist for this booking. Use PATCH to update.',
    }, { status: 409 });
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
      bookingId:   params.id,
      authorId:    user.id,
      content:     parsed.data.content,
      privateNote: parsed.data.privateNote ?? null,
    },
  });

  // Mark booking as COMPLETED
  await prisma.consultationBooking.update({
    where: { id: params.id },
    data:  { status: 'COMPLETED' },
  });

  // Auto-trigger bridge parsing — best effort
  try {
    await parseSupervisorFeedback(params.id, parsed.data.content);
  } catch {
    // Bridge parsing failure doesn't block note saving
  }

  // Fire event: meeting notes added — notify team members
  await createEvent({
    type:       EVENT_TYPES.MEETING_NOTES_ADDED,
    title:      'Meeting notes available',
    message:    'Your supervisor has added notes from your consultation. Review your translated action items.',
    actorId:    user.id,
    teamId:     booking.teamId,
    projectId:  booking.team.project?.id ?? null,
    entityType: 'MeetingNote',
    entityId:   note.id,
    visibility: 'TEAM',
    notify: {
      includeTeamMembers: true,
      href: `/dashboard/consultations/${params.id}`,
    },
  }).catch((err) => console.error('[meeting-notes] event error:', err));

  return NextResponse.json({
    note:    { id: note.id },
    message: 'Notes saved and bridge parsing triggered.',
  }, { status: 201 });
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
    where:   { bookingId: params.id },
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
    data:  { content: parsed.data.content, privateNote: parsed.data.privateNote ?? null },
  });

  // Re-trigger bridge parsing with updated content
  try {
    await parseSupervisorFeedback(params.id, parsed.data.content);
  } catch {
    // Best effort
  }

  // Fire event: meeting notes updated
  await createEvent({
    type:       EVENT_TYPES.MEETING_NOTES_UPDATED,
    title:      'Meeting notes updated',
    message:    'Your supervisor has updated the consultation notes.',
    actorId:    user.id,
    teamId:     note.booking.teamId,
    entityType: 'MeetingNote',
    entityId:   updated.id,
    visibility: 'TEAM',
    notify:     false, // Don't spam for updates; major change is the initial add
  }).catch((err) => console.error('[meeting-notes PATCH] event error:', err));

  return NextResponse.json({ note: { id: updated.id } });
}
