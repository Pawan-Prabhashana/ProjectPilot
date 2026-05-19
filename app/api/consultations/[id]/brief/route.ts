import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { generateConsultationBrief } from '@/lib/services/supervisor-bridge';

/**
 * POST /api/consultations/[id]/brief
 * (Re)generates the consultation brief for a booking.
 * Accessible by both supervisors and team members of that booking.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const booking = await prisma.consultationBooking.findUnique({
    where: { id: params.id },
    include: {
      team: {
        include: {
          members: { select: { userId: true } },
          supervisor: { select: { userId: true } },
        },
      },
    },
  });

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const isMember = booking.team.members.some((m) => m.userId === user.id);
  const isSupervisor = booking.team.supervisor?.userId === user.id;
  const isCoordinator = user.role === 'COORDINATOR';

  if (!isMember && !isSupervisor && !isCoordinator) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const brief = await generateConsultationBrief(params.id);
    return NextResponse.json({ brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Brief generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
