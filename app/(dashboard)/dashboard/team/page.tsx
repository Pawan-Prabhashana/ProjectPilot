import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { getWorkspaceSnapshot } from '@/lib/services/workspace';
import { buildTeamIntelligenceDashboard } from '@/lib/services/team-intelligence';
import { resolveActiveWorkspace } from '@/lib/services/workspace-access';
import { PageHeader } from '@/components/shared/page-header';
import { HealthBadge } from '@/components/shared/health-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Users, AlertTriangle, CheckCircle, Clock, Brain, Calendar,
  ArrowRight, Crown, User, Zap, Activity, Target, Lock, TrendingUp,
  BarChart3, Lightbulb, GitBranch, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Team Workspace' };

// --- Milestone status display config ---
const milestoneStatusConfig: Record<string, { label: string; className: string }> = {
  PENDING:     { label: 'Pending',     className: 'bg-slate-100 text-slate-600 border-slate-200' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  COMPLETED:   { label: 'Completed',   className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DELAYED:     { label: 'Delayed',     className: 'bg-red-50 text-red-700 border-red-200' },
};

// --- Priority display config ---
const priorityConfig: Record<string, { label: string; className: string }> = {
  LOW:    { label: 'Low',    className: 'bg-slate-100 text-slate-600' },
  MEDIUM: { label: 'Medium', className: 'bg-sky-50 text-sky-700' },
  HIGH:   { label: 'High',   className: 'bg-amber-50 text-amber-700' },
  URGENT: { label: 'Urgent', className: 'bg-red-100 text-red-700' },
};

export default async function TeamWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const user = await requireAuth();
  const { teamId } = await searchParams;

  const workspace = await resolveActiveWorkspace(user, teamId);

  if (!workspace || !workspace.projectId) {
    const description =
      user.role === 'STUDENT'
        ? "You are not assigned to a team yet. Please contact your coordinator."
        : user.role === 'SUPERVISOR'
        ? "No teams are assigned to you yet."
        : "No teams exist yet. Create or import teams from Team Management.";
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team Workspace"
          description="The shared operating environment for your project team."
        />
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No team or project found"
          description={description}
        />
      </div>
    );
  }

  const [snapshot, intelligence] = await Promise.all([
    getWorkspaceSnapshot(workspace.teamId, workspace.projectId),
    buildTeamIntelligenceDashboard(workspace.teamId),
  ]);

  const completedMilestone = snapshot.milestones.filter((m) => m.status === 'COMPLETED');
  const activeMilestone = snapshot.milestones.find((m) => m.status === 'IN_PROGRESS');
  const nextMilestone = snapshot.milestones.find((m) => m.status === 'PENDING');

  return (
    <div className="space-y-8">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{snapshot.project.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {snapshot.team.name} ·{' '}
            <span className="capitalize">{snapshot.project.status.toLowerCase().replace('_', ' ')}</span>
          </p>
          {snapshot.project.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">
              {snapshot.project.description}
            </p>
          )}
        </div>
        <HealthBadge status={snapshot.team.healthStatus as 'ON_TRACK' | 'AT_RISK' | 'CRITICAL'} />
      </div>

      {/* ── Top stat row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Overall Progress" value={`${snapshot.taskStats.completionRate}%`}
          sub={`${snapshot.taskStats.done}/${snapshot.taskStats.total} tasks`}
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          highlight={snapshot.taskStats.completionRate >= 50 ? 'success' : 'neutral'}
        />
        <StatTile label="Active Tasks" value={String(snapshot.taskStats.inProgress)}
          sub={`${snapshot.taskStats.todo} queued`}
          icon={<Activity className="h-4 w-4 text-sky-500" />}
        />
        <StatTile
          label="Overdue" value={String(snapshot.taskStats.overdue)}
          sub={snapshot.taskStats.overdue === 0 ? 'None — great!' : 'need attention'}
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          highlight={snapshot.taskStats.overdue > 0 ? 'warning' : 'success'}
        />
        <StatTile label="Open Questions" value={String(snapshot.openQuestionsCount)}
          sub={snapshot.openQuestionsCount === 0 ? 'All resolved' : 'in Project Brain'}
          icon={<Brain className="h-4 w-4 text-violet-500" />}
          highlight={snapshot.openQuestionsCount > 2 ? 'warning' : 'neutral'}
        />
      </div>

      {/* ── Blockers (if any) ─────────────────────────────────────── */}
      {snapshot.blockers.length > 0 && (
        <section>
          <SectionHeading icon={<Lock className="h-4 w-4 text-red-500" />} title="Blockers" count={snapshot.blockers.length} urgent />
          <div className="space-y-2">
            {snapshot.blockers.map((b) => (
              <Link key={b.taskId} href={`/dashboard/tasks/${b.taskId}`} className="block">
                <div className="group flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 hover:border-red-300 hover:bg-red-50 transition-colors">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-red-900">{b.taskTitle}</span>
                      <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', priorityConfig[b.priority]?.className)}>
                        {priorityConfig[b.priority]?.label}
                      </span>
                      {b.daysOverdue !== null && b.daysOverdue > 0 && (
                        <span className="text-xs text-red-600 font-medium">
                          {b.daysOverdue}d overdue
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-red-700 line-clamp-1">{b.blockerNote}</p>
                    {b.assigneeName && (
                      <p className="mt-1 text-xs text-muted-foreground">Owner: {b.assigneeName}</p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Milestones ────────────────────────────────────────────── */}
      <section>
        <SectionHeading icon={<Target className="h-4 w-4 text-indigo-500" />} title="Milestones" />
        <div className="space-y-2">
          {snapshot.milestones.map((m) => {
            const sc = milestoneStatusConfig[m.status] ?? milestoneStatusConfig.PENDING;
            return (
              <div
                key={m.id}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  m.isOverdue ? 'border-red-200 bg-red-50/40' : 'border-border bg-card'
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', sc.className)}>
                        {sc.label}
                      </span>
                      <span className="text-sm font-semibold">{m.title}</span>
                      {m.isOverdue && (
                        <span className="text-xs text-red-600 font-medium flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" />
                          Overdue
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due {formatDate(m.dueDate)}
                      </span>
                      <span>{m.completedTaskCount}/{m.taskCount} tasks done</span>
                    </div>
                  </div>
                  {m.taskCount > 0 && (
                    <div className="sm:w-36">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{m.progress}%</span>
                      </div>
                      <Progress
                        value={m.progress}
                        variant={m.progress >= 70 ? 'success' : m.progress >= 30 ? 'default' : 'danger'}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Team Workload ──────────────────────────────────────── */}
        <section>
          <SectionHeading icon={<Users className="h-4 w-4 text-sky-500" />} title="Team Workload" />
          <Card>
            <CardContent className="divide-y divide-border pt-2">
              {snapshot.workload.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 py-3 first:pt-2 last:pb-2">
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    m.isOverloaded
                      ? 'bg-red-100 text-red-700'
                      : 'bg-primary/10 text-primary'
                  )}>
                    {m.role === 'lead' ? <Crown className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {m.name ?? m.email}
                        {m.userId === user.id && (
                          <span className="ml-1 text-xs text-muted-foreground font-normal">(you)</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {m.openTaskCount} task{m.openTaskCount !== 1 ? 's' : ''}
                        {m.estimatedHoursRemaining > 0 && ` · ~${m.estimatedHoursRemaining}h`}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1">
                        <Progress
                          value={Math.min(100, (m.openTaskCount / Math.max(1, snapshot.workload.reduce((mx, w) => Math.max(mx, w.openTaskCount), 1))) * 100)}
                          variant={m.isOverloaded ? 'danger' : m.overdueTaskCount > 0 ? 'warning' : 'success'}
                        />
                      </div>
                      {m.overdueTaskCount > 0 && (
                        <span className="shrink-0 text-xs text-amber-600 font-medium">
                          {m.overdueTaskCount} overdue
                        </span>
                      )}
                      {m.isOverloaded && (
                        <span className="shrink-0 text-xs text-red-600 font-medium flex items-center gap-0.5">
                          <Zap className="h-3 w-3" />
                          High load
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* ── Recent Activity ────────────────────────────────────── */}
        <section>
          <SectionHeading icon={<Activity className="h-4 w-4 text-emerald-500" />} title="Recent Activity" />
          <Card>
            <CardContent className="pt-2">
              {snapshot.recentActivity.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No activity logged yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {snapshot.recentActivity.slice(0, 6).map((a, i) => (
                    <li key={i} className="flex items-start gap-3 py-3 first:pt-2 last:pb-2">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {(a.name ?? a.userId)[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{a.name ?? 'Unknown'}</span>
                          {' · '}
                          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs">
                            {a.contributionType.replace('_', ' ').toLowerCase()}
                          </span>
                          {a.hours && ` · ${a.hours}h`}
                        </p>
                        <p className="mt-0.5 text-xs text-foreground/80 line-clamp-1">
                          {a.description}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(a.loggedAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Separator className="my-2" />
              <Link
                href="/dashboard/contributions"
                className="flex items-center justify-between pt-1 text-xs font-medium text-primary hover:underline underline-offset-2"
              >
                View full contribution history
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* ── Consultation Readiness ─────────────────────────────────── */}
      {snapshot.nextConsultation && (
        <section>
          <SectionHeading icon={<Calendar className="h-4 w-4 text-violet-500" />} title="Next Consultation" />
          <div className={cn(
            'rounded-xl border p-5',
            snapshot.consultationReadiness === 'NEEDS_PREP'
              ? 'border-amber-200 bg-amber-50'
              : 'border-green-200 bg-green-50/60'
          )}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {snapshot.consultationReadiness === 'READY' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                  <span className={cn(
                    'text-sm font-semibold',
                    snapshot.consultationReadiness === 'READY' ? 'text-green-800' : 'text-amber-800'
                  )}>
                    {snapshot.consultationReadiness === 'READY' ? 'Ready for consultation' : 'Preparation recommended'}
                  </span>
                </div>
                <p className={cn('mt-1 text-sm', snapshot.consultationReadiness === 'READY' ? 'text-green-700' : 'text-amber-700')}>
                  {formatDateTime(snapshot.nextConsultation.slotStart)}
                  {snapshot.nextConsultation.agenda && (
                    <> · <span className="line-clamp-1">{snapshot.nextConsultation.agenda}</span></>
                  )}
                </p>
                {snapshot.nextConsultation.hasBrief && (
                  <p className="mt-1 text-xs text-green-700">Pre-meeting brief has been generated.</p>
                )}
                {!snapshot.nextConsultation.hasBrief && (
                  <p className="mt-1 text-xs text-amber-700">
                    Brief not yet generated. Review open questions and project progress before the meeting.
                  </p>
                )}
              </div>
              <Link
                href="/dashboard/consultations"
                className="self-start sm:self-center shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/50"
              >
                View consultations
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Team Intelligence Snapshot ──────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold">Team Intelligence</h2>
          </div>
          <Link
            href="/dashboard/team-insights"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2"
          >
            Full insights
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Signal summary strip */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 mb-3">
          <div className={cn(
            'rounded-xl border p-3',
            intelligence.health.status === 'CRITICAL' ? 'border-red-200 bg-red-50/50' :
            intelligence.health.status === 'AT_RISK' ? 'border-amber-200 bg-amber-50/50' :
            'border-emerald-200 bg-emerald-50/50'
          )}>
            <p className="text-xs text-muted-foreground">Health</p>
            <p className={cn(
              'text-sm font-semibold mt-0.5',
              intelligence.health.status === 'CRITICAL' ? 'text-red-700' :
              intelligence.health.status === 'AT_RISK' ? 'text-amber-700' : 'text-emerald-700'
            )}>
              {intelligence.health.status === 'ON_TRACK' ? 'On Track' :
               intelligence.health.status === 'AT_RISK' ? 'At Risk' : 'Critical'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {intelligence.health.signals.length} signal{intelligence.health.signals.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className={cn(
            'rounded-xl border p-3',
            intelligence.ambiguity.totalItems >= 3 ? 'border-amber-200 bg-amber-50/50' : 'border-border bg-card'
          )}>
            <p className="text-xs text-muted-foreground">Ambiguity</p>
            <p className={cn(
              'text-sm font-semibold mt-0.5',
              intelligence.ambiguity.totalItems >= 3 ? 'text-amber-700' : 'text-foreground'
            )}>
              {intelligence.ambiguity.totalItems} task{intelligence.ambiguity.totalItems !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">need clarification</p>
          </div>

          <div className={cn(
            'rounded-xl border p-3',
            intelligence.dependencies.risks.filter(r => r.severity === 'critical').length > 0 ? 'border-red-200 bg-red-50/50' :
            intelligence.dependencies.totalBlockedTasks > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-border bg-card'
          )}>
            <p className="text-xs text-muted-foreground">Blockers</p>
            <p className={cn(
              'text-sm font-semibold mt-0.5',
              intelligence.dependencies.totalBlockedTasks > 0 ? 'text-amber-700' : 'text-foreground'
            )}>
              {intelligence.dependencies.totalBlockedTasks} blocked
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {intelligence.dependencies.risks.filter(r => r.severity === 'critical').length > 0
                ? `${intelligence.dependencies.risks.filter(r => r.severity === 'critical').length} critical`
                : 'dependency risks'}
            </p>
          </div>

          <div className={cn(
            'rounded-xl border p-3',
            !intelligence.workload.isFair ? 'border-amber-200 bg-amber-50/50' : 'border-border bg-card'
          )}>
            <p className="text-xs text-muted-foreground">Load balance</p>
            <p className={cn(
              'text-sm font-semibold mt-0.5',
              !intelligence.workload.isFair ? 'text-amber-700' : 'text-emerald-700'
            )}>
              {intelligence.workload.isFair ? 'Balanced' : 'Uneven'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">~{intelligence.workload.meanOpenTasks} tasks/member</p>
          </div>
        </div>

        {/* Top recommendations */}
        {intelligence.recommendations.length > 0 && (
          <div className="space-y-2">
            {intelligence.recommendations.slice(0, 2).map((rec, i) => (
              <div
                key={rec.id}
                className={cn(
                  'flex items-start gap-3 rounded-xl border px-4 py-3',
                  rec.urgency === 'high' ? 'border-red-200 bg-red-50/40' :
                  rec.urgency === 'medium' ? 'border-amber-200 bg-amber-50/40' : 'border-border bg-card'
                )}
              >
                <Lightbulb className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  rec.urgency === 'high' ? 'text-red-500' :
                  rec.urgency === 'medium' ? 'text-amber-500' : 'text-muted-foreground'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{rec.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Source: {rec.tracedTo}</p>
                </div>
                <span className={cn(
                  'text-xs font-medium rounded-full border px-2 py-0.5 shrink-0',
                  rec.urgency === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                  rec.urgency === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-muted text-muted-foreground border-border'
                )}>
                  {rec.urgency}
                </span>
              </div>
            ))}
            {intelligence.recommendations.length > 2 && (
              <Link
                href="/dashboard/team-insights"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2 pl-1 pt-1"
              >
                +{intelligence.recommendations.length - 2} more recommendation{intelligence.recommendations.length - 2 !== 1 ? 's' : ''} in full insights
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </section>

      {/* ── Project Brain Preview ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold">Project Brain</h2>
          </div>
          <Link
            href="/dashboard/project-brain"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2"
          >
            Open full view
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <BrainTile
            label="Open Questions"
            count={snapshot.openQuestionsCount}
            description={snapshot.openQuestionsCount === 0 ? 'All resolved' : 'Need answers before implementation continues'}
            urgent={snapshot.openQuestionsCount > 0}
          />
          <BrainTile
            label="Active Milestone"
            count={activeMilestone ? 1 : 0}
            description={activeMilestone ? activeMilestone.title : (nextMilestone ? `Next: ${nextMilestone.title}` : 'All milestones completed')}
          />
          <BrainTile
            label="Completed Milestones"
            count={completedMilestone.length}
            description={`${completedMilestone.length} of ${snapshot.milestones.length} milestones done`}
          />
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeading({
  icon,
  title,
  count,
  urgent = false,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  urgent?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h2 className="text-sm font-semibold">{title}</h2>
      {count !== undefined && (
        <span className={cn('ml-1 rounded-full px-2 py-0.5 text-xs font-medium', urgent ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground')}>
          {count}
        </span>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  highlight?: 'success' | 'warning' | 'neutral';
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      highlight === 'success' && 'border-emerald-200 bg-emerald-50/50',
      highlight === 'warning' && 'border-amber-200 bg-amber-50/50',
      (!highlight || highlight === 'neutral') && 'border-border bg-card',
    )}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function BrainTile({
  label,
  count,
  description,
  urgent = false,
}: {
  label: string;
  count: number;
  description: string;
  urgent?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      urgent ? 'border-amber-200 bg-amber-50/50' : 'border-border bg-card'
    )}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold mt-0.5', urgent && 'text-amber-700')}>{count}</p>
      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
    </div>
  );
}

