import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { generateConsultationBrief } from '@/lib/services/supervisor-bridge';

/**
 * POST /api/consultations/[id]/confirm
 *
 * Allows a SUPERVISOR or COORDINATOR to confirm a PENDING booking.
 * A ConsultationBrief is auto-generated on confirmation so the supervisor
 * arrives prepared with a structured summary of team progress.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (user.role === 'STUDENT') {
    return NextResponse.json({ error: 'Only supervisors can confirm bookings' }, { status: 403 });
  }

  const booking = await prisma.consultationBooking.findUnique({
    where: { id: params.id },
    include: {
      team: {
        include: {
          // supervisorId references SupervisorProfile.id; include userId for User.id comparison
          supervisor: { select: { userId: true } },
        },
      },
    },
  });

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Booking is already ${booking.status.toLowerCase()}` },
      { status: 400 }
    );
  }
  // Correct check: Team.supervisorId → SupervisorProfile → User.id
  if (user.role === 'SUPERVISOR' && booking.team.supervisor?.userId !== user.id) {
    return NextResponse.json({ error: 'You do not supervise this team' }, { status: 403 });
  }

  const updated = await prisma.consultationBooking.update({
    where: { id: params.id },
    data: { status: 'CONFIRMED' },
  });

  // Auto-generate brief if none exists
  const existingBrief = await prisma.consultationBrief.findUnique({
    where: { bookingId: params.id },
  });
  if (!existingBrief) {
    try {
      await generateConsultationBrief(params.id);
    } catch {
      // Brief generation is best-effort; confirmation still succeeds
    }
  }

  // Notify team members
  const members = await prisma.teamMember.findMany({
    where: { teamId: booking.teamId },
    select: { userId: true },
  });
  await prisma.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId,
      type: 'CONSULTATION_BOOKED' as const,
      title: 'Consultation confirmed',
      body: `Your consultation on ${booking.slotStart.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })} has been confirmed.`,
      link: '/dashboard/consultations',
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ booking: { id: updated.id, status: updated.status } });
}
