import type { Metadata } from 'next';
import { requireAuth } from '@/lib/rbac';
import { getFormationSetupData } from '@/lib/services/formation/setup';
import { getFormationProfileReadiness } from '@/lib/services/formation/student-profile';
import { InfoCallout } from '@/components/shared/info-callout';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HealthBadge } from '@/components/shared/health-badge';
import { Progress } from '@/components/ui/progress';
import {
  Calendar,
  Users,
  Layers,
  Settings,
  CheckCircle,
  AlertTriangle,
  Shield,
  BookOpen,
  BarChart3,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamHealthStatus } from '@prisma/client';

export const metadata: Metadata = { title: 'Formation Setup' };

export default async function FormationSetupPage() {
  const user = await requireAuth();

  if (user.role !== 'COORDINATOR') {
    return (
      <div className="space-y-6">
        <PageHeader title="Formation Setup" description="Coordinator-only setup tool." />
        <InfoCallout variant="warning">
          This page is only accessible to coordinators.
        </InfoCallout>
      </div>
    );
  }

  const data = await getFormationSetupData();
  const { activeTerm, intakeSummary, batches, linkedTeams } = data;

  // Fetch aggregate formation profile readiness (no private data)
  const profileReadiness = activeTerm
    ? await getFormationProfileReadiness(activeTerm.id)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formation Setup"
        description="Academic terms, student intake, formation batches, and profile readiness — the foundation for intelligent team formation."
      />

      <InfoCallout variant="info" title="Formation engine coming in Part 5">
        This setup layer prepares the system for the intelligent formation engine. Today it shows
        the active term, intake status, batch configuration, rule weights, and student profile
        readiness. The matching algorithm — which will use skill, schedule, role, and capacity data
        to form balanced teams — is a planned next module built on top of this foundation.
      </InfoCallout>

      {/* ── No active term ── */}
      {!activeTerm && (
        <Card className="bg-muted/30">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium text-foreground">No active academic term found</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Run <code className="text-xs bg-muted rounded px-1">npm run db:setup</code> to seed
                  demo data, or create an AcademicTerm with status ACTIVE to begin.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTerm && (
        <>
          {/* ── Section 1: Active academic term ── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Active Academic Term
            </h2>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{activeTerm.name}</p>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                        ACTIVE
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{activeTerm.code}</p>
                    {activeTerm.semesterLabel && activeTerm.academicYear && (
                      <p className="text-xs text-muted-foreground">
                        {activeTerm.semesterLabel} · {activeTerm.academicYear}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 text-right">
                    {activeTerm.startsAt && (
                      <p>Starts: {activeTerm.startsAt.toLocaleDateString()}</p>
                    )}
                    {activeTerm.endsAt && (
                      <p>Ends: {activeTerm.endsAt.toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ── Section 2: Intake summary ── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
              <Users className="h-4 w-4 text-muted-foreground" />
              Student Intake
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {intakeSummary.total} students
              </span>
            </h2>
            {intakeSummary.total === 0 ? (
              <Card className="bg-muted/30">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-muted-foreground">
                    No intake records for this term yet. Run{' '}
                    <code className="text-xs bg-muted rounded px-1">npm run db:setup</code> to seed
                    demo intake data.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <IntakeStatBlock
                  label="Ready for Formation"
                  value={intakeSummary.byStatus.READY_FOR_FORMATION}
                  icon={<CheckCircle className="h-4 w-4 text-sky-500" />}
                />
                <IntakeStatBlock
                  label="Assigned to Team"
                  value={intakeSummary.byStatus.ASSIGNED_TO_TEAM}
                  icon={<Users className="h-4 w-4 text-emerald-500" />}
                />
                <IntakeStatBlock
                  label="Profile Pending"
                  value={intakeSummary.byStatus.PROFILE_PENDING}
                  icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                  highlight={intakeSummary.byStatus.PROFILE_PENDING > 0}
                />
                <IntakeStatBlock
                  label="Invited / Withdrawn"
                  value={intakeSummary.byStatus.INVITED + intakeSummary.byStatus.WITHDRAWN}
                  icon={<BookOpen className="h-4 w-4 text-slate-400" />}
                />
              </div>
            )}
          </section>

          {/* ── Section 3: Formation profile readiness (Part 3) ── */}
          {profileReadiness && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Formation Profile Readiness
              </h2>
              <Card>
                <CardContent className="pt-4 pb-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <IntakeStatBlock
                      label="Profiles Submitted"
                      value={profileReadiness.submitted}
                      icon={<CheckCircle className="h-4 w-4 text-emerald-500" />}
                    />
                    <IntakeStatBlock
                      label="Still Draft"
                      value={profileReadiness.draft}
                      icon={<FileText className="h-4 w-4 text-sky-500" />}
                      highlight={profileReadiness.draft > 0}
                    />
                    <IntakeStatBlock
                      label="No Profile Yet"
                      value={profileReadiness.noProfile}
                      icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                      highlight={profileReadiness.noProfile > 0}
                    />
                    <IntakeStatBlock
                      label="No Skills Recorded"
                      value={profileReadiness.withNoSkills}
                      icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
                      highlight={profileReadiness.withNoSkills > 0}
                    />
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-4 py-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-xs font-medium text-foreground">
                        Average completion score
                      </span>
                      <span className="text-sm font-bold tabular-nums">
                        {profileReadiness.avgCompletionScore}/100
                      </span>
                    </div>
                    <Progress value={profileReadiness.avgCompletionScore} className="h-2" />
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {profileReadiness.submitted} of {profileReadiness.totalIntake} students have submitted a formation profile.
                      Score reflects skills, availability, roles, capacity, and domain preferences filled in.
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground border-t pt-3">
                    <span className="font-medium text-foreground">Privacy note:</span>{' '}
                    This section shows aggregate readiness counts only. Private support notes and
                    individual cognitive profile details are never shown here.
                  </p>
                </CardContent>
              </Card>
            </section>
          )}

          {/* ── Section 4: Formation batches ── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Formation Batches
            </h2>
            {batches.length === 0 ? (
              <Card className="bg-muted/30">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-muted-foreground">No formation batches for this term yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {batches.map((batch) => (
                  <Card key={batch.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1">{batch.name}</span>
                        <BatchStatusBadge status={batch.status} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Team size config */}
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-lg bg-muted/40 px-3 py-2">
                          <p className="text-xs text-muted-foreground mb-0.5">Min size</p>
                          <p className="text-lg font-bold text-foreground">{batch.minTeamSize}</p>
                        </div>
                        <div className="rounded-lg bg-primary/8 px-3 py-2 border border-primary/20">
                          <p className="text-xs text-muted-foreground mb-0.5">Target size</p>
                          <p className="text-lg font-bold text-primary">{batch.targetTeamSize}</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 px-3 py-2">
                          <p className="text-xs text-muted-foreground mb-0.5">Max size</p>
                          <p className="text-lg font-bold text-foreground">{batch.maxTeamSize}</p>
                        </div>
                      </div>

                      {/* Student counts */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Students in batch ({batch.studentCount})
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {batch.byStudentStatus.ASSIGNED > 0 && (
                            <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 font-medium">
                              {batch.byStudentStatus.ASSIGNED} assigned
                            </span>
                          )}
                          {batch.byStudentStatus.INCLUDED > 0 && (
                            <span className="rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 font-medium">
                              {batch.byStudentStatus.INCLUDED} included
                            </span>
                          )}
                          {batch.byStudentStatus.LOCKED > 0 && (
                            <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-medium">
                              {batch.byStudentStatus.LOCKED} locked
                            </span>
                          )}
                          {batch.byStudentStatus.EXCLUDED > 0 && (
                            <span className="rounded-full bg-red-100 text-red-800 px-2 py-0.5 font-medium">
                              {batch.byStudentStatus.EXCLUDED} excluded
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Rule set weights */}
                      {batch.ruleSet && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                            <Settings className="h-3 w-3" />
                            Formation Weights
                            <span className="font-normal normal-case text-muted-foreground/60">
                              (total: {batch.ruleSet.totalWeight})
                            </span>
                          </p>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
                            <WeightRow label="Skill coverage" value={batch.ruleSet.skillWeight} total={batch.ruleSet.totalWeight} />
                            <WeightRow label="Schedule overlap" value={batch.ruleSet.scheduleWeight} total={batch.ruleSet.totalWeight} />
                            <WeightRow label="Role suitability" value={batch.ruleSet.roleWeight} total={batch.ruleSet.totalWeight} />
                            <WeightRow label="Project preference" value={batch.ruleSet.preferenceWeight} total={batch.ruleSet.totalWeight} />
                            <WeightRow label="Capacity balance" value={batch.ruleSet.capacityWeight} total={batch.ruleSet.totalWeight} />
                            <WeightRow label="Supervisor capacity" value={batch.ruleSet.supervisorCapacityWeight} total={batch.ruleSet.totalWeight} />
                            <WeightRow
                              label="Support compatibility"
                              value={batch.ruleSet.supportCompatibilityWeight}
                              total={batch.ruleSet.totalWeight}
                              note="Uses safe, non-diagnostic support preferences only"
                            />
                          </div>
                        </div>
                      )}

                      {batch.createdByName && (
                        <p className="text-xs text-muted-foreground">
                          Created by {batch.createdByName}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* ── Section 5: Teams linked to this term ── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Teams in This Term
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {linkedTeams.length}
              </span>
            </h2>
            {linkedTeams.length === 0 ? (
              <Card className="bg-muted/30">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-muted-foreground">
                    No teams are linked to this term yet. Run{' '}
                    <code className="text-xs bg-muted rounded px-1">npm run db:setup</code> to link
                    the demo teams.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="grid grid-cols-5 gap-2 bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="col-span-2">Team</span>
                  <span>Supervisor</span>
                  <span className="text-center">Members</span>
                  <span className="text-right">Health</span>
                </div>
                {linkedTeams.map((team, i) => (
                  <div
                    key={team.id}
                    className={cn(
                      'grid grid-cols-5 gap-2 items-center px-4 py-2.5 text-sm',
                      i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                    )}
                  >
                    <p className="col-span-2 font-medium truncate text-foreground">{team.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {team.supervisorName ?? <span className="text-amber-600">None</span>}
                    </p>
                    <p className="text-center text-sm font-medium tabular-nums">{team.memberCount}</p>
                    <div className="flex justify-end">
                      <HealthBadge status={team.healthStatus as TeamHealthStatus} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Privacy reminder */}
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Privacy note:</span>{' '}
          Formation setup pages show only operational data (intake status, team counts, batch
          configuration, and aggregate profile readiness scores). Individual student cognitive
          profiles, private support notes, and accessibility data are never exposed here.
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function IntakeStatBlock({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  const isHighlighted = highlight && value > 0;
  return (
    <Card className={cn(isHighlighted ? 'border-amber-300 bg-amber-50/30' : '')}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-1">{icon}</div>
        <p className={cn('text-2xl font-bold', isHighlighted ? 'text-amber-700' : 'text-foreground')}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function BatchStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-muted text-muted-foreground border-border',
    READY: 'bg-sky-100 text-sky-800 border-sky-200',
    RUNNING: 'bg-blue-100 text-blue-800 border-blue-200',
    REVIEW: 'bg-amber-100 text-amber-800 border-amber-200',
    APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    PUBLISHED: 'bg-green-100 text-green-800 border-green-200',
    ARCHIVED: 'bg-muted text-muted-foreground/70 border-border',
  };
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px]', styles[status] ?? 'bg-muted text-muted-foreground')}
    >
      {status}
    </Badge>
  );
}

function WeightRow({
  label,
  value,
  total,
  note,
}: {
  label: string;
  value: number;
  total: number;
  note?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="text-muted-foreground truncate">{label}</span>
          <span className="font-medium tabular-nums text-foreground shrink-0">
            {value} <span className="text-muted-foreground font-normal">({pct}%)</span>
          </span>
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
        </div>
        {note && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{note}</p>}
      </div>
    </div>
  );
}
