import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/shared/page-header';
import { InfoCallout } from '@/components/shared/info-callout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MeetingNotesForm } from '@/components/consultations/meeting-notes-form';
import { GenerateBriefButton } from '@/components/consultations/generate-brief-button';
import { ConfirmBookingButton } from '@/components/consultations/confirm-booking-button';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  LayoutGrid,
  CheckCircle,
  AlertCircle,
  FileText,
  AlertTriangle,
  ChevronRight,
  Zap,
  Eye,
  EyeOff,
  HelpCircle,
  Target,
  ArrowLeft,
  Heart,
  Focus,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import type {
  ActionItem,
  QualityExpectation,
  DeadlineWarning,
  AgendaItem,
  RiskHighlight,
} from '@/lib/services/supervisor-bridge';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Consultation · ${id.slice(0, 8)}` };
}

const modeIcon: Record<string, React.ElementType> = {
  online: Video,
  'in-person': MapPin,
  hybrid: LayoutGrid,
};

const priorityClasses: Record<string, string> = {
  urgent: 'border-l-red-500 bg-red-50',
  high:   'border-l-amber-500 bg-amber-50',
  medium: 'border-l-sky-400 bg-sky-50',
  low:    'border-l-slate-300 bg-slate-50',
};

const priorityBadge: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-amber-100 text-amber-700',
  medium: 'bg-sky-100 text-sky-700',
  low:    'bg-slate-100 text-slate-600',
};

export default async function ConsultationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  const booking = await prisma.consultationBooking.findUnique({
    where: { id },
    include: {
      team: {
        include: {
          members: { include: { user: { select: { id: true, name: true } } } },
          supervisor: {
            select: {
              userId: true,
              user: { select: { name: true } },
            },
          },
          project: { select: { id: true, title: true } },
        },
      },
      availability: {
        select: {
          meetingMode: true,
          locationOrLink: true,
          supervisor: {
            select: { user: { select: { name: true } } },
          },
        },
      },
      brief: true,
      meetingNote: {
        select: {
          content: true,
          privateNote: true,
          createdAt: true,
          authorId: true,
        },
      },
      feedbackParse: true,
    },
  });

  if (!booking) notFound();

  // Access control: students must be members of the team
  const isMember = booking.team.members.some((m) => m.user.id === user.id);
  const isSupervisor = booking.team.supervisor?.userId === user.id;
  const isCoordinator = user.role === 'COORDINATOR';

  if (!isMember && !isSupervisor && !isCoordinator) notFound();

  const isPast = booking.slotStart <= new Date() || booking.status === 'COMPLETED';
  const isSupervisorView = user.role === 'SUPERVISOR' || user.role === 'COORDINATOR';
  const ModeIcon = modeIcon[booking.availability?.meetingMode ?? 'in-person'] ?? MapPin;

  const brief = booking.brief;
  const feedbackParse = booking.feedbackParse;

  const agendaItems = (brief?.suggestedAgendaItems as AgendaItem[] | null) ?? [];
  const risks = (brief?.risksToHighlight as RiskHighlight[] | null) ?? [];
  const unresolvedQuestions = (brief?.unresolvedQuestions as string[] | null) ?? [];

  const actionItems = (feedbackParse?.actionItems as ActionItem[] | null) ?? [];
  const qualityExpectations = (feedbackParse?.qualityExpectations as QualityExpectation[] | null) ?? [];
  const deadlineWarnings = (feedbackParse?.deadlineWarnings as DeadlineWarning[] | null) ?? [];
  const hiddenAssumptions = (feedbackParse?.hiddenAssumptions as string[] | null) ?? [];
  const ambiguities = (feedbackParse?.ambiguities as string[] | null) ?? [];
  const suggestedFirstSteps = (feedbackParse?.suggestedFirstSteps as string[] | null) ?? [];

  const clarityScore = feedbackParse?.clarityScore ?? null;

  return (
    <div className="space-y-6 pb-10">
      {/* Back nav */}
      <Link href="/dashboard/consultations">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          All consultations
        </Button>
      </Link>

      {/* Header */}
      <PageHeader
        title={`Consultation — ${booking.team.name}`}
        description={`${formatDateTime(booking.slotStart)} · ${booking.team.project?.title ?? 'No project'}`}
      />

      {/* Meeting metadata strip */}
      <div className="rounded-xl border bg-card px-4 py-4">
        <div className="flex flex-wrap gap-4 items-start">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{formatDateTime(booking.slotStart)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {new Date(booking.slotEnd).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              {' '}&mdash; {Math.round((booking.slotEnd.getTime() - booking.slotStart.getTime()) / 60000)} min
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ModeIcon className="h-4 w-4 text-muted-foreground" />
            <span className="capitalize">{booking.availability?.meetingMode ?? 'in-person'}</span>
            {booking.availability?.locationOrLink && (
              <span className="text-muted-foreground">· {booking.availability.locationOrLink}</span>
            )}
          </div>
          <div className="ml-auto">
            <StatusBadge status={booking.status} />
          </div>
        </div>

        {/* Actions for supervisor */}
        {isSupervisorView && booking.status === 'PENDING' && (
          <div className="mt-3 pt-3 border-t">
            <ConfirmBookingButton bookingId={booking.id} />
          </div>
        )}
      </div>

      {/* Team context (booking intent) */}
      {(booking.agenda || booking.purpose || booking.blockerContext || booking.topicsForSupervisor) && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Team&apos;s meeting context
          </h2>
          <Card>
            <CardContent className="pt-4 space-y-3 text-sm">
              {booking.purpose && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
                    <Target className="h-3 w-3" /> Meeting purpose
                  </p>
                  <p className="text-foreground">{booking.purpose}</p>
                </div>
              )}
              {booking.blockerContext && (
                <div>
                  <p className="text-xs font-medium text-amber-600 mb-0.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Current blockers
                  </p>
                  <p className="text-foreground">{booking.blockerContext}</p>
                </div>
              )}
              {booking.topicsForSupervisor && (
                <div>
                  <p className="text-xs font-medium text-violet-600 mb-0.5 flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" /> Questions for supervisor
                  </p>
                  <p className="text-foreground">{booking.topicsForSupervisor}</p>
                </div>
              )}
              {booking.agenda && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Agenda summary</p>
                  <p className="text-foreground">{booking.agenda}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ─── PRE-MEETING BRIEF ─────────────────────────────────────────────── */}
      {!isPast && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Pre-meeting brief
            </h2>
            {!brief && (
              <GenerateBriefButton bookingId={booking.id} />
            )}
          </div>

          {!brief ? (
            <InfoCallout variant="info" title="Brief not yet generated">
              A pre-meeting brief will be automatically generated from your project&apos;s current state.
              It will be available once the consultation is confirmed.
            </InfoCallout>
          ) : (
            <div className="space-y-4">
              {/* Progress summary */}
              <Card className="border-sky-200 bg-sky-50/50">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-1.5">Project status</p>
                  <p className="text-sm text-slate-700">{brief.teamProgressSummary}</p>
                </CardContent>
              </Card>

              {/* Risks */}
              {risks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Risks to highlight</p>
                  {risks.map((r, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-2.5 rounded-lg border-l-4 px-3 py-2.5 text-sm',
                        r.severity === 'critical' ? 'border-l-red-500 bg-red-50' :
                        r.severity === 'high' ? 'border-l-amber-500 bg-amber-50' :
                        'border-l-slate-300 bg-slate-50'
                      )}
                    >
                      <AlertTriangle className={cn('h-4 w-4 mt-0.5 shrink-0', r.severity === 'critical' ? 'text-red-500' : r.severity === 'high' ? 'text-amber-500' : 'text-slate-400')} />
                      <p>{r.risk}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggested agenda */}
              {agendaItems.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Suggested agenda</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-1.5">
                    {agendaItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-sm">
                        <span className={cn(
                          'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
                          item.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                          item.priority === 'medium' ? 'bg-sky-100 text-sky-700' :
                          'bg-slate-100 text-slate-600'
                        )}>
                          {item.priority}
                        </span>
                        <span>{item.topic}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Open questions */}
              {unresolvedQuestions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Open questions to resolve</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-1.5">
                    {unresolvedQuestions.map((q, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <HelpCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-violet-400" />
                        <span>{q}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </section>
      )}

      {/* ─── SUPERVISOR NOTES SECTION ──────────────────────────────────────── */}
      {isPast && isSupervisorView && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {booking.meetingNote ? 'Meeting notes' : 'Add meeting notes'}
          </h2>
          {!booking.meetingNote && (
            <InfoCallout variant="info" title="Notes not yet added">
              Add meeting notes to generate translated action items for the team.
              The bridge system will automatically extract action items, quality expectations, and ambiguities.
            </InfoCallout>
          )}
          <Card className="mt-3">
            <CardContent className="pt-4">
              <MeetingNotesForm
                bookingId={booking.id}
                existingContent={booking.meetingNote?.content}
                existingPrivateNote={booking.meetingNote?.privateNote ?? undefined}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {/* ─── MEETING RECOVERY MODE (student only) ─────────────────────────── */}
      {isPast && feedbackParse && !isSupervisorView && (
        <MeetingRecoverySection
          actionItems={actionItems}
          suggestedFirstSteps={suggestedFirstSteps}
          ambiguities={ambiguities}
          deadlineWarnings={deadlineWarnings}
          consultationId={booking.id}
        />
      )}

      {/* ─── POST-MEETING TRANSLATED FEEDBACK ─────────────────────────────── */}
      {isPast && feedbackParse && (
        <section id="translated-feedback" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Translated feedback
            </h2>
            {clarityScore !== null && (
              <ClarityBadge score={clarityScore} />
            )}
          </div>

          {/* Student summary card */}
          {feedbackParse.studentSummary && (
            <Card className="border-violet-200 bg-violet-50/60">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1.5">
                  Summary
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {feedbackParse.studentSummary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Suggested first steps */}
          {suggestedFirstSteps.length > 0 && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-800 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Start here — first steps
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {suggestedFirstSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-white text-xs font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-green-900">{step}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Action items */}
          {actionItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Action items ({actionItems.length})
              </p>
              {actionItems.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl border-l-4 px-4 py-3 text-sm',
                    priorityClasses[item.priority] ?? 'border-l-slate-300 bg-slate-50'
                  )}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                    <p className="font-medium text-foreground flex-1">{item.title}</p>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', priorityBadge[item.priority])}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                    {item.suggestedOwnerLabel && (
                      <span className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        Owner: <strong className="text-foreground">{item.suggestedOwnerLabel}</strong>
                      </span>
                    )}
                    {item.dueHint && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Clock className="h-3 w-3" />
                        {item.dueHint}
                      </span>
                    )}
                    {item.riskIfIgnored && (
                      <span className="flex items-center gap-1 text-red-500">
                        <AlertTriangle className="h-3 w-3" />
                        {item.riskIfIgnored}
                      </span>
                    )}
                  </div>
                  {item.whatGoodLooksLike && (
                    <div className="mt-2 rounded-md bg-white/70 border px-2.5 py-2 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">What &apos;done well&apos; looks like: </span>
                      {item.whatGoodLooksLike}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Deadline warnings */}
          {deadlineWarnings.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timeline warnings
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {deadlineWarnings.map((dw, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <span className={cn(
                      'shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium',
                      dw.urgencyLevel === 'urgent' ? 'bg-red-100 text-red-700' :
                      dw.urgencyLevel === 'high' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    )}>
                      {dw.urgencyLevel}
                    </span>
                    <div>
                      <p className="font-medium text-slate-700">{dw.extractedDate}</p>
                      <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">&ldquo;{dw.text}&rdquo;</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quality expectations */}
          {qualityExpectations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet-500" />
                  Quality expectations
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {qualityExpectations.map((qe, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium text-foreground">{qe.area}</p>
                    <p className="mt-0.5 text-muted-foreground">{qe.standard}</p>
                    {qe.example && (
                      <p className="mt-0.5 text-xs text-violet-600 italic">{qe.example}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Hidden assumptions */}
          {hiddenAssumptions.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-orange-800 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Surfaced hidden assumptions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <p className="text-xs text-orange-700 mb-2">
                  These are things the supervisor assumed but may not have stated explicitly.
                  Check the whole team understands these.
                </p>
                {hiddenAssumptions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <EyeOff className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-500" />
                    <p className="text-orange-900">{a}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Ambiguities / things to clarify */}
          {ambiguities.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-slate-400" />
                  Things to clarify at next meeting
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                {ambiguities.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="shrink-0 text-slate-300 font-medium">{i + 1}.</span>
                    <span>{a}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Raw supervisor notes — collapsible */}
          {booking.meetingNote && (
            <details className="group">
              <summary className="cursor-pointer rounded-xl border px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2">
                <FileText className="h-4 w-4" />
                View raw supervisor notes
                <ChevronRight className="h-4 w-4 ml-auto group-open:rotate-90 transition-transform" />
              </summary>
              <Card className="mt-2 border-slate-200">
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    Original notes from {booking.meetingNote.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
                    The translation above was derived from these.
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {booking.meetingNote.content}
                  </p>
                </CardContent>
              </Card>
            </details>
          )}
        </section>
      )}

      {/* Student: upcoming meeting — no notes yet */}
      {isPast && !feedbackParse && !isSupervisorView && (
        <InfoCallout variant="info" title="Meeting notes not yet available">
          Your supervisor will add meeting notes after the consultation.
          Once added, the bridge system will translate the feedback into clear action items for your team.
        </InfoCallout>
      )}

      {/* Pre-meeting brief for past meetings (supervisor-side) */}
      {isPast && isSupervisorView && brief && (
        <details className="group">
          <summary className="cursor-pointer rounded-xl border px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2">
            <FileText className="h-4 w-4" />
            View pre-meeting brief (generated before meeting)
            <ChevronRight className="h-4 w-4 ml-auto group-open:rotate-90 transition-transform" />
          </summary>
          <Card className="mt-2 border-sky-200">
            <CardContent className="pt-4 space-y-3 text-sm">
              <div>
                <p className="font-medium text-xs text-sky-700 mb-1">Project status at time of booking</p>
                <p>{brief.teamProgressSummary}</p>
              </div>
              {agendaItems.length > 0 && (
                <div>
                  <p className="font-medium text-xs text-muted-foreground mb-1">Suggested agenda items</p>
                  <ul className="space-y-1">
                    {agendaItems.map((item, i) => (
                      <li key={i} className="text-muted-foreground flex items-start gap-1.5">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                        {item.topic}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </details>
      )}
    </div>
  );
}

// ─── Meeting Recovery Mode Component ─────────────────────────────────────────

function MeetingRecoverySection({
  actionItems,
  suggestedFirstSteps,
  ambiguities,
  deadlineWarnings,
  consultationId,
}: {
  actionItems: ActionItem[];
  suggestedFirstSteps: string[];
  ambiguities: string[];
  deadlineWarnings: DeadlineWarning[];
  consultationId: string;
}) {
  const urgentActions = actionItems.filter(
    (a) => a.priority === 'urgent' || a.priority === 'high'
  );
  const deferableActions = actionItems.filter(
    (a) => a.priority === 'low'
  );
  const topActions = urgentActions.slice(0, 3);
  const lowEnergyStart = suggestedFirstSteps[0]
    ?? topActions[0]?.title
    ?? 'Read through the meeting summary and write down one question you want clarified.';
  const hasContent = actionItems.length > 0 || suggestedFirstSteps.length > 0;

  if (!hasContent) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Heart className="h-4 w-4 text-rose-400" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Meeting Recovery
        </h2>
      </div>

      <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/60 to-white overflow-hidden shadow-sm">
        <div className="px-5 pt-5 pb-2">
          <p className="text-sm font-medium text-slate-700 leading-relaxed">
            Meetings can be a lot. Here is a simplified view to help you re-enter calmly.
            You do not need to act on everything at once.
          </p>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Re-entry step */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              If you need to start gently
            </p>
            <p className="text-sm text-emerald-900 font-medium leading-relaxed">
              {lowEnergyStart}
            </p>
            <Link
              href="/dashboard/support-tools/low-energy"
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:underline"
            >
              <Focus className="h-3 w-3" />
              Open Low-Energy Mode for a smaller step
            </Link>
          </div>

          {/* Top 3 actions */}
          {topActions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Your top {topActions.length} action{topActions.length !== 1 ? 's' : ''} from this meeting
              </p>
              {topActions.map((a, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-white border border-border/50 px-3 py-2.5">
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    {a.suggestedOwnerLabel && (
                      <p className="text-xs text-muted-foreground mt-0.5">Owner: {a.suggestedOwnerLabel}</p>
                    )}
                    {a.dueHint && (
                      <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {a.dueHint}
                      </p>
                    )}
                  </div>
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                    a.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                    a.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  )}>
                    {a.priority}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* What can wait */}
          {deferableActions.length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                These can wait
              </p>
              <ul className="space-y-1">
                {deferableActions.slice(0, 3).map((a, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                    {a.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Deadline warnings condensed */}
          {deadlineWarnings.filter(d => d.urgencyLevel === 'urgent' || d.urgencyLevel === 'high').length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Time-sensitive items
              </p>
              {deadlineWarnings.filter(d => d.urgencyLevel === 'urgent' || d.urgencyLevel === 'high').map((dw, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-amber-800">
                  <Clock className="h-3 w-3 shrink-0" />
                  {dw.extractedDate}
                </div>
              ))}
            </div>
          )}

          {/* Clarifications needed */}
          {ambiguities.length > 0 && (
            <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                Ask about these before acting
              </p>
              <ul className="space-y-1">
                {ambiguities.slice(0, 2).map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-violet-800">
                    <HelpCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Link to full detail */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              Full meeting detail and all action items are below.
            </p>
            <a
              href="#translated-feedback"
              className="text-xs text-primary hover:underline underline-offset-2 flex items-center gap-1"
            >
              See full feedback
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING:   { label: 'Pending confirmation', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    CONFIRMED: { label: 'Confirmed',             className: 'bg-green-100 text-green-700 border-green-200' },
    COMPLETED: { label: 'Completed',             className: 'bg-slate-100 text-slate-600 border-slate-200' },
    CANCELLED: { label: 'Cancelled',             className: 'bg-red-100 text-red-700 border-red-200' },
    NO_SHOW:   { label: 'No show',               className: 'bg-red-100 text-red-700 border-red-200' },
  };
  const cfg = map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600 border-slate-200' };

  return (
    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  );
}

function ClarityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const className =
    pct >= 70 ? 'bg-green-100 text-green-700' :
    pct >= 50 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700';

  return (
    <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium flex items-center gap-1', className)}>
      <CheckCircle className="h-3 w-3" />
      Clarity {pct}%
    </span>
  );
}
