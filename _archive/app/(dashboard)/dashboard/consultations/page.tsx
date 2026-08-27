import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/shared/page-header';
import { InfoCallout } from '@/components/shared/info-callout';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StructuredBookingForm } from '@/components/consultations/structured-booking-form';
import { ConfirmBookingButton } from '@/components/consultations/confirm-booking-button';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  MapPin,
  Video,
  LayoutGrid,
  ChevronRight,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '@prisma/client';

export const metadata: Metadata = { title: 'Consultations' };

const statusConfig: Record<BookingStatus, { label: string; icon: React.ElementType; className: string }> = {
  PENDING:   { label: 'Pending',   icon: AlertCircle, className: 'text-amber-700 bg-amber-50 border-amber-200' },
  CONFIRMED: { label: 'Confirmed', icon: CheckCircle,  className: 'text-green-700 bg-green-50 border-green-200' },
  COMPLETED: { label: 'Completed', icon: CheckCircle,  className: 'text-slate-600 bg-slate-50 border-slate-200' },
  CANCELLED: { label: 'Cancelled', icon: XCircle,      className: 'text-red-700 bg-red-50 border-red-200' },
  NO_SHOW:   { label: 'No Show',   icon: XCircle,      className: 'text-red-700 bg-red-50 border-red-200' },
};

const modeIcon: Record<string, React.ElementType> = {
  online: Video,
  'in-person': MapPin,
  hybrid: LayoutGrid,
};

export default async function ConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const user = await requireAuth();
  const { teamId } = await searchParams;

  const bookings =
    user.role === 'STUDENT'
      ? await getStudentBookings(user.id, teamId)
      : user.role === 'SUPERVISOR'
      ? await getSupervisorBookings(user.id)
      : await getAllBookings();

  const now = new Date();
  const upcoming = bookings.filter(
    (b) => b.slotStart > now && (b.status === 'CONFIRMED' || b.status === 'PENDING')
  );
  const past = bookings.filter(
    (b) => b.slotStart <= now || b.status === 'COMPLETED'
  );
  const pendingForSupervisor =
    (user.role === 'SUPERVISOR' || user.role === 'COORDINATOR')
      ? bookings.filter((b) => b.status === 'PENDING')
      : [];

  // Available slots (for student booking form)
  const availableSlots =
    user.role === 'STUDENT' ? await getAvailableSlotsForStudent(user.id, teamId) : [];

  const completedWithNotes = past.filter((b) => b.status === 'COMPLETED' && b.feedbackParse);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consultations"
        description={
          user.role === 'STUDENT'
            ? 'Request and manage meetings with your supervisor. Review your pre-meeting briefs and post-meeting action items here.'
            : user.role === 'SUPERVISOR'
            ? 'Manage consultation requests from your teams. Add meeting notes to generate translated student action items.'
            : 'System-wide consultation overview.'
        }
      />

      {/* ─── STUDENT: summary strip ──────────────────────────────────────── */}
      {user.role === 'STUDENT' && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Upcoming</p>
            <p className="mt-0.5 text-2xl font-bold">{upcoming.length}</p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Past</p>
            <p className="mt-0.5 text-2xl font-bold">{past.length}</p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">With feedback</p>
            <p className="mt-0.5 text-2xl font-bold">{completedWithNotes.length}</p>
          </div>
        </div>
      )}

      {/* ─── STUDENT: Book a consultation ─────────────────────────────────── */}
      {user.role === 'STUDENT' && (
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Request a consultation
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Structured preparation helps your supervisor understand your team&apos;s needs before the meeting.
            </p>
          </div>

          <InfoCallout variant="info" title="How it works">
            1. Choose a slot → 2. Describe what you need → 3. Your supervisor confirms → 4. A pre-meeting brief is generated automatically → 5. After the meeting, see your translated action items.
          </InfoCallout>

          <Card className="mt-3">
            <CardContent className="pt-5">
              <StructuredBookingForm slots={availableSlots} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* ─── SUPERVISOR: Pending requests ─────────────────────────────────── */}
      {pendingForSupervisor.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
              Awaiting confirmation ({pendingForSupervisor.length})
            </h2>
          </div>
          <div className="space-y-2">
            {pendingForSupervisor.map((booking) => (
              <BookingCard key={booking.id} booking={booking} showConfirm />
            ))}
          </div>
        </section>
      )}

      {/* ─── SUPERVISOR: Link to slot management ──────────────────────────── */}
      {(user.role === 'SUPERVISOR' || user.role === 'COORDINATOR') && (
        <div className="rounded-xl border bg-muted/30 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Availability slots</p>
            <p className="text-xs text-muted-foreground mt-0.5">Manage your published availability for team consultations.</p>
          </div>
          <Link href="/dashboard/supervisor-workspace">
            <Button variant="outline" size="sm">
              Manage slots
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* ─── Upcoming confirmed ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Upcoming ({upcoming.filter((b) => b.status === 'CONFIRMED').length} confirmed)
        </h2>
        {upcoming.filter((b) => b.status === 'CONFIRMED').length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8" />}
            title="No confirmed consultations"
            description={
              user.role === 'STUDENT'
                ? 'Request a consultation above. It will appear here once confirmed.'
                : 'No confirmed upcoming consultations.'
            }
          />
        ) : (
          <div className="space-y-2">
            {upcoming
              .filter((b) => b.status === 'CONFIRMED')
              .map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
          </div>
        )}
      </section>

      {/* ─── Past consultations ───────────────────────────────────────────── */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Past ({past.length})
          </h2>
          <div className="space-y-2">
            {past.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                showFeedbackSignal={user.role === 'STUDENT'}
                showNotesAction={user.role === 'SUPERVISOR' || user.role === 'COORDINATOR'}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── BookingCard ─────────────────────────────────────────────────────────────

type BookingData = Awaited<ReturnType<typeof getStudentBookings>>[number];

function BookingCard({
  booking,
  showConfirm = false,
  showFeedbackSignal = false,
  showNotesAction = false,
}: {
  booking: BookingData;
  showConfirm?: boolean;
  showFeedbackSignal?: boolean;
  showNotesAction?: boolean;
}) {
  const sc = statusConfig[booking.status];
  const StatusIcon = sc.icon;
  const ModeIcon = modeIcon[booking.availability?.meetingMode ?? 'in-person'] ?? MapPin;
  const hasFeedback = !!booking.feedbackParse;
  const hasBrief = !!booking.brief;
  const needsNotes = showNotesAction && booking.status === 'COMPLETED' && !booking.meetingNote;

  return (
    <Card className={cn(
      'border transition-shadow hover:shadow-sm',
      booking.status === 'CONFIRMED' && 'border-green-200',
      needsNotes && 'border-amber-200'
    )}>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1 min-w-0">
            {/* Status + team */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', sc.className)}>
                <StatusIcon className="h-3 w-3" />
                {sc.label}
              </span>
              <span className="text-sm font-medium truncate">{booking.team.name}</span>
              {booking.team.project?.title && (
                <span className="text-xs text-muted-foreground truncate">· {booking.team.project.title}</span>
              )}
            </div>

            {/* Time + mode */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDateTime(booking.slotStart)} –{' '}
                {new Date(booking.slotEnd).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="flex items-center gap-1">
                <ModeIcon className="h-3.5 w-3.5" />
                <span className="capitalize">{booking.availability?.meetingMode ?? 'in-person'}</span>
                {booking.availability?.locationOrLink && (
                  <span className="text-muted-foreground/60">· {booking.availability.locationOrLink}</span>
                )}
              </span>
            </div>

            {/* Agenda */}
            {booking.agenda && (
              <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">
                <span className="font-medium text-foreground/70">Agenda:</span> {booking.agenda}
              </p>
            )}

            {/* Purpose (team context) */}
            {booking.purpose && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                <span className="font-medium text-foreground/70">Purpose:</span> {booking.purpose}
              </p>
            )}
          </div>

          {/* Right-side signals and actions */}
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {hasBrief && booking.status === 'CONFIRMED' && (
              <span className="flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1.5 text-xs text-sky-700 font-medium">
                <FileText className="h-3.5 w-3.5" />
                Brief ready
              </span>
            )}

            {showFeedbackSignal && hasFeedback && (
              <span className="flex items-center gap-1 rounded-lg bg-violet-50 border border-violet-200 px-2.5 py-1.5 text-xs text-violet-700 font-medium">
                <Zap className="h-3.5 w-3.5" />
                Feedback translated
              </span>
            )}

            {needsNotes && (
              <span className="flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Notes needed
              </span>
            )}

            {showConfirm && booking.status === 'PENDING' && (
              <ConfirmBookingButton bookingId={booking.id} />
            )}

            <Link href={`/dashboard/consultations/${booking.id}`}>
              <Button variant="outline" size="sm">
                {booking.status === 'COMPLETED' && hasFeedback ? 'View feedback' :
                 booking.status === 'COMPLETED' ? 'Add notes' :
                 'View details'}
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function getStudentBookings(userId: string, teamId?: string) {
  const member = await prisma.teamMember.findFirst({
    where: { userId, ...(teamId ? { teamId } : {}) },
    select: { teamId: true },
  });
  if (!member) return [];
  return prisma.consultationBooking.findMany({
    where: { teamId: member.teamId },
    include: {
      team: { select: { name: true, project: { select: { title: true } } } },
      availability: { select: { meetingMode: true, locationOrLink: true } },
      meetingNote: { select: { id: true } },
      brief: { select: { id: true } },
      feedbackParse: { select: { id: true, clarityScore: true } },
    },
    orderBy: { slotStart: 'desc' },
  });
}

async function getSupervisorBookings(userId: string) {
  const profile = await prisma.supervisorProfile.findUnique({
    where: { userId },
    include: { supervisedTeams: { select: { id: true } } },
  });
  const teamIds = profile?.supervisedTeams.map((t) => t.id) ?? [];
  return prisma.consultationBooking.findMany({
    where: { teamId: { in: teamIds } },
    include: {
      team: { select: { name: true, project: { select: { title: true } } } },
      availability: { select: { meetingMode: true, locationOrLink: true } },
      meetingNote: { select: { id: true } },
      brief: { select: { id: true } },
      feedbackParse: { select: { id: true, clarityScore: true } },
    },
    orderBy: { slotStart: 'desc' },
  });
}

async function getAllBookings() {
  return prisma.consultationBooking.findMany({
    include: {
      team: { select: { name: true, project: { select: { title: true } } } },
      availability: { select: { meetingMode: true, locationOrLink: true } },
      meetingNote: { select: { id: true } },
      brief: { select: { id: true } },
      feedbackParse: { select: { id: true, clarityScore: true } },
    },
    orderBy: { slotStart: 'desc' },
    take: 50,
  });
}

async function getAvailableSlotsForStudent(userId: string, teamId?: string) {
  // Find the student's team's supervisor; use teamId if provided for multi-team users
  const member = await prisma.teamMember.findFirst({
    where: { userId, ...(teamId ? { teamId } : {}) },
    include: { team: { include: { supervisor: { include: { user: { select: { name: true } } } } } } },
  });

  if (!member?.team?.supervisor) return [];

  const now = new Date();
  const slots = await prisma.consultationAvailability.findMany({
    where: {
      supervisorId: member.team.supervisor.id,
      startTime: { gte: now },
      isClosed: false,
      bookings: { none: {} }, // no existing bookings
    },
    orderBy: { startTime: 'asc' },
    take: 10,
  });

  return slots.map((s) => ({
    id: s.id,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    slotMinutes: s.slotMinutes,
    meetingMode: s.meetingMode,
    locationOrLink: s.locationOrLink,
    notes: s.notes,
    supervisorName: member.team.supervisor?.user.name ?? 'Supervisor',
  }));
}
