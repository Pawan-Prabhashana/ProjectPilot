import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * GET /api/consultations/available-slots
 *
 * Returns unbooked ConsultationAvailability slots for the student's
 * team supervisor. Team.supervisorId is a FK to SupervisorProfile.id,
 * which is also the FK used by ConsultationAvailability.supervisorId.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Only students can browse available slots' }, { status: 403 });
  }

  // 1. Find the student's team (and the supervisor profile ID)
  const membership = await prisma.teamMember.findFirst({
    where: { userId: user.id },
    select: {
      teamId: true,
      team: { select: { supervisorId: true } },
    },
  });

  if (!membership?.team.supervisorId) {
    return NextResponse.json({ slots: [] });
  }

  const supervisorProfileId = membership.team.supervisorId;
  const now = new Date();

  // 2. Availability slots in the future with no existing bookings
  const slots = await prisma.consultationAvailability.findMany({
    where: {
      supervisorId: supervisorProfileId,
      startTime: { gt: now },
    },
    include: { _count: { select: { bookings: true } } },
    orderBy: { startTime: 'asc' },
  });

  const available = slots.filter((s) => s._count.bookings === 0);

  return NextResponse.json({
    slots: available.map((s) => ({
      id: s.id,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      slotMinutes: s.slotMinutes,
      notes: s.notes,
    })),
  });
}
