import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { createEvent } from '@/lib/events/create-event';
import { EVENT_TYPES } from '@/lib/events/types';

const bookSchema = z.object({
  availabilityId: z.string().min(1),
  agenda: z
    .string()
    .min(10, 'Please write at least 10 characters so your supervisor can prepare')
    .max(2000),
  purpose: z.string().max(1000).optional().nullable(),
  blockerContext: z.string().max(2000).optional().nullable(),
  topicsForSupervisor: z.string().max(1000).optional().nullable(),
});

/**
 * POST /api/consultations/book
 *
 * Creates a PENDING ConsultationBooking for the student's team.
 * Structured pre-consultation input reduces anxiety for neurodivergent students
 * and surfaces blockers proactively to the supervisor.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Only students can book consultations' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { availabilityId, agenda, purpose, blockerContext, topicsForSupervisor } = parsed.data;

  const membership = await prisma.teamMember.findFirst({
    where:  { userId: user.id },
    select: { teamId: true },
  });
  if (!membership) {
    return NextResponse.json({ error: 'You are not a member of any team' }, { status: 400 });
  }

  const slot = await prisma.consultationAvailability.findUnique({
    where: { id: availabilityId },
    include: {
      _count: { select: { bookings: true } },
      supervisor: { select: { userId: true } },
    },
  });

  if (!slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  if (slot.isClosed) return NextResponse.json({ error: 'This slot is no longer available' }, { status: 409 });
  if (slot.startTime <= new Date()) {
    return NextResponse.json({ error: 'This slot is in the past' }, { status: 400 });
  }
  if (slot._count.bookings > 0) {
    return NextResponse.json({ error: 'This slot has already been booked' }, { status: 409 });
  }

  const slotEnd = new Date(slot.startTime);
  slotEnd.setMinutes(slotEnd.getMinutes() + slot.slotMinutes);

  const booking = await prisma.consultationBooking.create({
    data: {
      teamId:             membership.teamId,
      availabilityId,
      slotStart:          slot.startTime,
      slotEnd,
      status:             'PENDING',
      agenda,
      purpose:            purpose ?? null,
      blockerContext:     blockerContext ?? null,
      topicsForSupervisor: topicsForSupervisor ?? null,
    },
  });

  // Get team info for event messaging
  const team = await prisma.team.findUnique({
    where:   { id: membership.teamId },
    select:  { name: true, project: { select: { id: true } } },
  });

  // Fire event: consultation requested
  // Notifies the supervisor (and team leader so they know it's been requested)
  await createEvent({
    type:       EVENT_TYPES.CONSULTATION_REQUESTED,
    title:      'Consultation requested',
    message:    `${team?.name ?? 'A team'} has requested a consultation. Please confirm or decline.`,
    actorId:    user.id,
    teamId:     membership.teamId,
    projectId:  team?.project?.id ?? null,
    entityType: 'ConsultationBooking',
    entityId:   booking.id,
    visibility: 'SUPERVISOR',
    notify: {
      includeSupervisor: true,
      href: '/dashboard/consultations',
    },
  }).catch((err) => console.error('[consultations/book] event error:', err));

  return NextResponse.json({ booking: { id: booking.id, status: booking.status } }, { status: 201 });
}
