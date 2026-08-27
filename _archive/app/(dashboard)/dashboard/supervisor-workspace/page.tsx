import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/shared/page-header';
import { InfoCallout } from '@/components/shared/info-callout';
import { HealthBadge } from '@/components/shared/health-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateSlotForm } from '@/components/consultations/create-slot-form';
import {
  Users,
  Calendar,
  BarChart3,
  FileText,
  Brain,
  BookOpen,
  MapPin,
  Video,
  LayoutGrid,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { formatDate, formatDateTime, cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Supervisor Hub' };

const modeIcon: Record<string, React.ElementType> = {
  online: Video,
  'in-person': MapPin,
  hybrid: LayoutGrid,
};

export default async function SupervisorWorkspacePage() {
  const user = await requireAuth();

  if (user.role === 'STUDENT') {
    return (
      <div className="space-y-6">
        <PageHeader title="Supervisor Hub" description="This area is for supervisors and coordinators." />
        <InfoCallout variant="warning">
          This page is only available to supervisors and coordinators.
        </InfoCallout>
      </div>
    );
  }

  const [teamsData, slots, pendingBookings] = await Promise.all([
    getSupervisedTeamsData(user.id, user.role),
    getSupervisorSlots(user.id, user.role),
    getPendingBookings(user.id, user.role),
  ]);

  const upcomingSlots = slots.filter((s) => !s.isPast && !s.isBooked && !s.isClosed);
  const bookedSlots = slots.filter((s) => s.isBooked);
  const pastSlots = slots.filter((s) => s.isPast && !s.isBooked);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Supervisor Hub"
        description="Your consultation schedule, team overviews, and meeting management in one place."
      />

      {/* ─── Summary strip ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Teams</p>
          <p className="mt-0.5 text-2xl font-bold">{teamsData.length}</p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Open slots</p>
          <p className="mt-0.5 text-2xl font-bold">{upcomingSlots.length}</p>
        </div>
        <div className="rounded-xl border bg-amber-50 border-amber-200 px-4 py-3">
          <p className="text-xs text-amber-600">Pending requests</p>
          <p className="mt-0.5 text-2xl font-bold text-amber-700">{pendingBookings.length}</p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Booked meetings</p>
          <p className="mt-0.5 text-2xl font-bold">{bookedSlots.length}</p>
        </div>
      </div>

      {/* ─── Pending requests ───────────────────────────────────────────── */}
      {pendingBookings.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
              Consultation requests ({pendingBookings.length})
            </h2>
          </div>
          <div className="space-y-2">
            {pendingBookings.map((booking) => (
              <div key={booking.id} className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{booking.team.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(booking.slotStart)} · {booking.team.project?.title ?? ''}
                    </p>
                    {booking.purpose && (
                      <p className="text-xs text-amber-700 mt-1 line-clamp-1">
                        Purpose: {booking.purpose}
                      </p>
                    )}
                  </div>
                  <Link href={`/dashboard/consultations/${booking.id}`}>
                    <Button size="sm" variant="outline">
                      Review
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Upcoming booked slots ──────────────────────────────────────── */}
      {bookedSlots.filter((s) => !s.isPast).length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Upcoming meetings ({bookedSlots.filter((s) => !s.isPast).length})
          </h2>
          <div className="space-y-2">
            {bookedSlots
              .filter((s) => !s.isPast)
              .map((slot) => {
                const ModeIcon = modeIcon[slot.meetingMode ?? 'in-person'] ?? MapPin;
                return (
                  <div key={slot.id} className="rounded-xl border border-green-200 bg-green-50/40 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          {slot.teamName ?? 'Team'}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(slot.startTime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })},&nbsp;
                            {new Date(slot.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            –{new Date(slot.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <ModeIcon className="h-3 w-3" />
                            <span className="capitalize">{slot.meetingMode ?? 'in-person'}</span>
                          </span>
                          {slot.locationOrLink && (
                            <span className="text-muted-foreground/60">{slot.locationOrLink}</span>
                          )}
                        </div>
                      </div>
                      {slot.bookingId && (
                        <Link href={`/dashboard/consultations/${slot.bookingId}`}>
                          <Button size="sm" variant="outline">
                            View
                            <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* ─── Publish new slot ───────────────────────────────────────────── */}
      {user.role === 'SUPERVISOR' && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Publish consultation availability
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add new slot
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Students will see your published slots when booking a consultation.
                </p>
              </CardHeader>
              <CardContent>
                <CreateSlotForm />
              </CardContent>
            </Card>

            {/* Published open slots */}
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Open slots ({upcomingSlots.length})
              </p>
              {upcomingSlots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                  <Calendar className="mx-auto h-7 w-7 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">No open slots published</p>
                  <p className="text-xs text-slate-400 mt-0.5">Add a slot using the form to let teams book consultations.</p>
                </div>
              ) : (
                upcomingSlots.map((slot) => {
                  const ModeIcon = modeIcon[slot.meetingMode ?? 'in-person'] ?? MapPin;
                  return (
                    <div key={slot.id} className="rounded-xl border bg-card px-3 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(slot.startTime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })},&nbsp;
                        {new Date(slot.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        &nbsp;–&nbsp;
                        {new Date(slot.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ModeIcon className="h-3 w-3" />
                          <span className="capitalize">{slot.meetingMode ?? 'in-person'}</span>
                        </span>
                        <span>{slot.slotMinutes} min</span>
                        {slot.locationOrLink && <span className="truncate max-w-[180px]">{slot.locationOrLink}</span>}
                      </div>
                      {slot.notes && (
                        <p className="mt-1 text-xs text-muted-foreground/70 italic line-clamp-1">{slot.notes}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── Supervised teams overview ──────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Supervised teams
        </h2>

        {teamsData.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-8 w-8" />}
            title="No teams assigned"
            description="You don't have any teams assigned yet. Ask the coordinator to assign teams."
          />
        ) : (
          <div className="space-y-4">
            {teamsData.map((team) => (
              <Card key={team.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{team.name}</CardTitle>
                      {team.project && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{team.project.title}</p>
                      )}
                    </div>
                    <HealthBadge status={team.healthStatus} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Members</p>
                      <p className="font-semibold mt-0.5">{team._count.members}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Open tasks</p>
                      <p className="font-semibold mt-0.5">{team.project?._count?.tasks ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Open questions</p>
                      <p className="font-semibold mt-0.5">{team.project?._count?.openQuestions ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Consultations</p>
                      <p className="font-semibold mt-0.5">{team._count.consultationBookings}</p>
                    </div>
                  </div>

                  {/* Next milestone */}
                  {team.project?.milestones?.[0] && (
                    <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-muted-foreground text-xs">Next Milestone:</span>
                        <span className="ml-1 font-medium">{team.project.milestones[0].title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          due {formatDate(team.project.milestones[0].dueDate)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Upcoming consultation */}
                  {team.upcomingBooking && (
                    <Link href={`/dashboard/consultations/${team.upcomingBooking.id}`}>
                      <div className="flex items-center gap-3 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2.5 text-sm hover:bg-sky-100 transition-colors cursor-pointer">
                        <FileText className="h-4 w-4 text-sky-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sky-700 text-xs font-medium">Next consultation:</span>
                          <span className="ml-1 text-sky-800">{formatDate(team.upcomingBooking.slotStart)}</span>
                          {team.upcomingBooking.brief && (
                            <span className="ml-2 text-xs text-sky-600">· Brief ready</span>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-sky-400 shrink-0" />
                      </div>
                    </Link>
                  )}

                  {/* Past meeting needing notes */}
                  {team.pastBookingNeedingNotes && (
                    <Link href={`/dashboard/consultations/${team.pastBookingNeedingNotes.id}`}>
                      <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm hover:bg-amber-100 transition-colors cursor-pointer">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        <div className="flex-1">
                          <span className="text-amber-700 text-xs font-medium">Meeting notes needed:</span>
                          <span className="ml-1 text-amber-800 text-xs">{formatDate(team.pastBookingNeedingNotes.slotStart)}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-amber-400 shrink-0" />
                      </div>
                    </Link>
                  )}

                  {/* Quick navigation */}
                  <div className="flex gap-2 flex-wrap">
                    <Link href="/dashboard/team-insights">
                      <Button variant="outline" size="sm">
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Insights
                      </Button>
                    </Link>
                    <Link href="/dashboard/consultations">
                      <Button variant="outline" size="sm">
                        <Calendar className="h-4 w-4 mr-1" />
                        Consultations
                      </Button>
                    </Link>
                    <Link href="/dashboard/project-brain">
                      <Button variant="outline" size="sm">
                        <Brain className="h-4 w-4 mr-1" />
                        Project Brain
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function getSupervisedTeamsData(userId: string, role: string) {
  const now = new Date();
  const teamIds: string[] = [];

  if (role === 'COORDINATOR') {
    const all = await prisma.team.findMany({ select: { id: true } });
    teamIds.push(...all.map((t) => t.id));
  } else {
    const profile = await prisma.supervisorProfile.findUnique({ where: { userId } });
    if (profile) {
      const supervised = await prisma.team.findMany({
        where: { supervisorId: profile.id },
        select: { id: true },
      });
      teamIds.push(...supervised.map((t) => t.id));
    }
  }

  if (teamIds.length === 0) return [];

  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    include: {
      _count: { select: { members: true, consultationBookings: true } },
      project: {
        include: {
          milestones: {
            where: { status: { notIn: ['COMPLETED', 'DELAYED'] } },
            orderBy: { dueDate: 'asc' },
            take: 1,
          },
          _count: { select: { tasks: true, openQuestions: true } },
        },
      },
      consultationBookings: {
        where: { status: 'CONFIRMED', slotStart: { gte: now } },
        orderBy: { slotStart: 'asc' },
        take: 1,
        include: { brief: { select: { id: true } } },
      },
    },
  });

  // Get past bookings needing notes (completed but no meeting note)
  const pastBookingsNeedingNotes = await prisma.consultationBooking.findMany({
    where: {
      teamId: { in: teamIds },
      status: 'COMPLETED',
      meetingNote: null,
      slotStart: { lte: now },
    },
    orderBy: { slotStart: 'desc' },
    take: 1,
    select: { id: true, slotStart: true, teamId: true },
  });

  return teams.map((team) => ({
    ...team,
    upcomingBooking: team.consultationBookings?.[0] ?? null,
    pastBookingNeedingNotes: pastBookingsNeedingNotes.find((b) => b.teamId === team.id) ?? null,
  }));
}

async function getSupervisorSlots(userId: string, role: string) {
  const now = new Date();

  let supervisorId: string | null = null;
  if (role === 'SUPERVISOR') {
    const profile = await prisma.supervisorProfile.findUnique({ where: { userId } });
    supervisorId = profile?.id ?? null;
  }

  if (!supervisorId && role !== 'COORDINATOR') return [];

  const slots = await prisma.consultationAvailability.findMany({
    where: role === 'COORDINATOR' ? {} : { supervisorId: supervisorId! },
    include: {
      bookings: {
        include: { team: { select: { name: true } } },
        take: 1,
      },
    },
    orderBy: { startTime: 'asc' },
    take: 50,
  });

  return slots.map((s) => ({
    id: s.id,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    slotMinutes: s.slotMinutes,
    meetingMode: s.meetingMode,
    locationOrLink: s.locationOrLink,
    notes: s.notes,
    isClosed: s.isClosed,
    isBooked: s.bookings.length > 0,
    isPast: s.startTime < now,
    teamName: s.bookings[0]?.team?.name ?? null,
    bookingId: s.bookings[0]?.id ?? null,
  }));
}

async function getPendingBookings(userId: string, role: string) {
  const teamIds: string[] = [];

  if (role === 'COORDINATOR') {
    const all = await prisma.team.findMany({ select: { id: true } });
    teamIds.push(...all.map((t) => t.id));
  } else if (role === 'SUPERVISOR') {
    const profile = await prisma.supervisorProfile.findUnique({ where: { userId } });
    if (profile) {
      const supervised = await prisma.team.findMany({
        where: { supervisorId: profile.id },
        select: { id: true },
      });
      teamIds.push(...supervised.map((t) => t.id));
    }
  }

  if (teamIds.length === 0) return [];

  return prisma.consultationBooking.findMany({
    where: { teamId: { in: teamIds }, status: 'PENDING' },
    include: {
      team: { select: { name: true, project: { select: { title: true } } } },
    },
    orderBy: { slotStart: 'asc' },
  });
}
