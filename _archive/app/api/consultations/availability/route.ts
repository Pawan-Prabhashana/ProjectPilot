import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createSlotSchema = z.object({
  startTime: z.string().min(1, 'Start time is required'),
  slotMinutes: z.number().int().min(15).max(120).default(30),
  meetingMode: z.enum(['in-person', 'online', 'hybrid']).default('in-person'),
  locationOrLink: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

/**
 * GET /api/consultations/availability
 * Returns all availability slots for the current supervisor.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (user.role !== 'SUPERVISOR' && user.role !== 'COORDINATOR') {
    return NextResponse.json({ error: 'Only supervisors can manage availability' }, { status: 403 });
  }

  const profile = await prisma.supervisorProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ slots: [] });

  const now = new Date();
  const slots = await prisma.consultationAvailability.findMany({
    where: {
      supervisorId: profile.id,
      isClosed: false,
    },
    include: {
      _count: { select: { bookings: true } },
      bookings: {
        include: { team: { select: { name: true } } },
      },
    },
    orderBy: { startTime: 'asc' },
  });

  return NextResponse.json({
    slots: slots.map((s) => ({
      id: s.id,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      slotMinutes: s.slotMinutes,
      meetingMode: s.meetingMode,
      locationOrLink: s.locationOrLink,
      notes: s.notes,
      isBooked: s._count.bookings > 0,
      isPast: s.startTime < now,
      teamName: s.bookings[0]?.team?.name ?? null,
    })),
  });
}

/**
 * POST /api/consultations/availability
 * Creates a new consultation availability slot for the supervisor.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (user.role !== 'SUPERVISOR' && user.role !== 'COORDINATOR') {
    return NextResponse.json({ error: 'Only supervisors can create availability slots' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSlotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const profile = await prisma.supervisorProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: 'Supervisor profile not found' }, { status: 404 });

  const startTime = new Date(parsed.data.startTime);
  if (isNaN(startTime.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }
  if (startTime <= new Date()) {
    return NextResponse.json({ error: 'Slot must be in the future' }, { status: 400 });
  }

  const endTime = new Date(startTime.getTime() + parsed.data.slotMinutes * 60 * 1000);

  const slot = await prisma.consultationAvailability.create({
    data: {
      supervisorId: profile.id,
      startTime,
      endTime,
      slotMinutes: parsed.data.slotMinutes,
      meetingMode: parsed.data.meetingMode,
      locationOrLink: parsed.data.locationOrLink ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  return NextResponse.json({ slot }, { status: 201 });
}
