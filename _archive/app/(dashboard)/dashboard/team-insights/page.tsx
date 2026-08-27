import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { buildTeamIntelligenceDashboard } from '@/lib/services/team-intelligence';
import { PageHeader } from '@/components/shared/page-header';
import { InfoCallout } from '@/components/shared/info-callout';
import { HealthBadge } from '@/components/shared/health-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3, Users, AlertTriangle, CheckCircle, Lightbulb,
  GitBranch, MessageSquare, TrendingUp, Shield, ArrowRight,
  Info, Circle,
} from 'lucide-react';
import type {
  TeamIntelligenceDashboard,
  HealthSignalItem,
  AmbiguityItem,
  WorkloadProfile,
  DependencyRiskItem,
  ClarificationProfile,
  FrictionSignal,
  TeamRecommendation,
} from '@/lib/services/team-intelligence';

export const metadata: Metadata = { title: 'Team Insights — ProjectPilot' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityColor(severity: string): string {
  return severity === 'critical' || severity === 'high'
    ? 'text-red-700 bg-red-50 border-red-200'
    : severity === 'warning' || severity === 'medium'
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-blue-700 bg-blue-50 border-blue-200';
}

function severityDot(severity: string): string {
  return severity === 'critical' || severity === 'high'
    ? 'bg-red-500'
    : severity === 'warning' || severity === 'medium'
    ? 'bg-amber-500'
    : 'bg-blue-400';
}

function urgencyBadge(urgency: string): string {
  return urgency === 'high'
    ? 'bg-red-100 text-red-700 border-red-200'
    : urgency === 'medium'
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';
}

function categoryIcon(category: string) {
  const map: Record<string, React.ReactNode> = {
    workload: <Users className="h-4 w-4" />,
    ambiguity: <MessageSquare className="h-4 w-4" />,
    blocker: <AlertTriangle className="h-4 w-4" />,
    dependency: <GitBranch className="h-4 w-4" />,
    engagement: <TrendingUp className="h-4 w-4" />,
    coordination: <Shield className="h-4 w-4" />,
  };
  return map[category] ?? <Info className="h-4 w-4" />;
}

function priorityLabel(p: string): string {
  return { URGENT: 'Urgent', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' }[p] ?? p;
}

// ─── Signal Card ─────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: HealthSignalItem }) {
  const colors = severityColor(signal.severity);
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${colors}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{categoryIcon(signal.category)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm leading-snug">{signal.title}</p>
            <span className="text-xs font-mono opacity-70 shrink-0">{signal.metric}</span>
          </div>
          <p className="text-xs mt-1 opacity-85 leading-relaxed">{signal.explanation}</p>
        </div>
      </div>
      {signal.recommendation && (
        <div className="pl-7">
          <p className="text-xs opacity-75 flex items-start gap-1.5">
            <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{signal.recommendation}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Ambiguity Row ────────────────────────────────────────────────────────────

function AmbiguityRow({ item }: { item: AmbiguityItem }) {
  const sevColors = { high: 'text-red-700', medium: 'text-amber-700', low: 'text-slate-500' };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{item.taskTitle}</span>
          <span className={`text-xs font-medium ${sevColors[item.severity]}`}>
            {item.severity}
          </span>
          {item.isBlockingOthers && (
            <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5">
              blocking others
            </span>
          )}
          <span className="text-xs text-muted-foreground">{priorityLabel(item.priority)} priority</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item.reasons.map((reason, i) => (
            <span
              key={i}
              className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full"
            >
              {reason}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Workload Bar ─────────────────────────────────────────────────────────────

function WorkloadBar({ profile, mean }: { profile: WorkloadProfile; mean: number }) {
  const maxTasks = Math.max(mean * 2.5, profile.openTaskCount, 1);
  const pct = Math.round((profile.openTaskCount / maxTasks) * 100);
  const barColor = profile.isConcentrated
    ? 'bg-amber-400'
    : profile.overdueTaskCount > 0
    ? 'bg-amber-300'
    : 'bg-emerald-400';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">{profile.name ?? 'Unknown'}</span>
          {profile.isConcentrated && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              overloaded
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{profile.openTaskCount} open</span>
          {profile.overdueTaskCount > 0 && (
            <span className="text-amber-700 font-medium">{profile.overdueTaskCount} overdue</span>
          )}
          {profile.estimatedHoursRemaining > 0 && (
            <span>~{profile.estimatedHoursRemaining}h est.</span>
          )}
          {profile.hiddenWorkScore > 0 && (
            <span className="text-purple-600">+{profile.hiddenWorkScore} support</span>
          )}
        </div>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {profile.concentrationReason && (
        <p className="text-xs text-amber-700">{profile.concentrationReason}</p>
      )}
    </div>
  );
}

// ─── Dependency Risk Row ──────────────────────────────────────────────────────

function DependencyRiskRow({ risk }: { risk: DependencyRiskItem }) {
  const isCritical = risk.severity === 'critical';
  return (
    <div
      className={`rounded-lg border px-4 py-3 space-y-1 ${
        isCritical ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 h-2 w-2 rounded-full ${isCritical ? 'bg-red-500' : 'bg-amber-500'}`} />
        <div className="flex-1">
          <p className={`text-sm font-semibold ${isCritical ? 'text-red-800' : 'text-amber-800'}`}>
            {risk.taskTitle}
          </p>
          <p className={`text-xs mt-0.5 ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
            {risk.riskDescription}
          </p>
          {risk.assigneeName && (
            <p className="text-xs text-muted-foreground mt-0.5">Assigned to {risk.assigneeName}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Clarification Profile Row ────────────────────────────────────────────────

function ClarificationRow({ profile }: { profile: ClarificationProfile }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{profile.name ?? 'Unknown'}</span>
          {profile.isConcentrated && (
            <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5">
              carrying {Math.round(profile.shareOfTeamHiddenWork * 100)}% of coordination work
            </span>
          )}
          {profile.hiddenWorkTotal === 0 && (
            <span className="text-xs text-muted-foreground">No support work logged</span>
          )}
        </div>
        {profile.breakdown.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {profile.breakdown.map((b) => (
              <span
                key={b.type}
                className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full"
              >
                {b.label}: {b.count}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="text-sm font-semibold text-muted-foreground shrink-0">
        {profile.hiddenWorkTotal} total
      </span>
    </div>
  );
}

// ─── Friction Signal Card ─────────────────────────────────────────────────────

function FrictionCard({ signal }: { signal: FrictionSignal }) {
  const colors = severityColor(signal.severity);
  return (
    <div className={`rounded-xl border p-4 space-y-2.5 ${colors}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${severityDot(signal.severity)}`} />
        <div className="flex-1">
          <p className="text-sm font-semibold">{signal.pattern}</p>
          <p className="text-xs mt-1 opacity-85 leading-relaxed">{signal.description}</p>
          <p className="text-xs mt-0.5 opacity-60">Area: {signal.affectedArea}</p>
        </div>
      </div>
      <div className="pl-4 border-l-2 border-current/20">
        <p className="text-xs opacity-75 flex items-start gap-1.5">
          <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{signal.recommendation}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Recommendation Card ──────────────────────────────────────────────────────

function RecommendationCard({ rec, index }: { rec: TeamRecommendation; index: number }) {
  const catIcon: Record<string, React.ReactNode> = {
    ownership: <Users className="h-4 w-4" />,
    clarity: <MessageSquare className="h-4 w-4" />,
    load: <BarChart3 className="h-4 w-4" />,
    blocker: <AlertTriangle className="h-4 w-4" />,
    coordination: <Shield className="h-4 w-4" />,
    preparation: <Lightbulb className="h-4 w-4" />,
  };
  const badgeColors = urgencyBadge(rec.urgency);

  return (
    <div className="flex items-start gap-4 py-4 border-b border-border/50 last:border-0">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold text-sm shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="text-muted-foreground">{catIcon[rec.category]}</span>
          <span className={`text-xs font-medium rounded-full border px-2 py-0.5 ${badgeColors}`}>
            {rec.urgency}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{rec.text}</p>
        <p className="text-xs text-muted-foreground mt-1">From: {rec.tracedTo}</p>
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  summary,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  summary?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-semibold">{title}</h2>
          {badge}
        </div>
        {summary && (
          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{summary}</p>
        )}
      </div>
    </div>
  );
}

// ─── Student-only limited view ────────────────────────────────────────────────

async function StudentInsightsView({ userId }: { userId: string }) {
  const member = await prisma.teamMember.findFirst({
    where: { userId },
    select: {
      team: {
        select: {
          id: true,
          name: true,
          healthStatus: true,
          project: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!member?.team?.project) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-8 w-8" />}
        title="No team found"
        description="You are not currently assigned to a project team."
      />
    );
  }

  const teamId = member.team.id;
  const data = await buildTeamIntelligenceDashboard(teamId);

  const sharedSignals = data.health.signals.filter(
    (s) => s.category !== 'workload' && s.category !== 'engagement'
  );

  return (
    <div className="space-y-8">
      {/* Team header */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-xl border bg-muted/30">
        <div>
          <p className="text-xs text-muted-foreground">Your team</p>
          <p className="font-semibold">{member.team.name}</p>
          <p className="text-sm text-muted-foreground">{member.team.project.title}</p>
        </div>
        <HealthBadge status={data.health.status} />
      </div>

      {/* Health summary */}
      {sharedSignals.length > 0 ? (
        <section className="space-y-4">
          <SectionHeader
            icon={<Shield className="h-5 w-5" />}
            title="Team Health Signals"
            summary={data.health.signalSummary}
          />
          <div className="space-y-3">
            {sharedSignals.map((s) => <SignalCard key={s.id} signal={s} />)}
          </div>
        </section>
      ) : (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle className="h-4 w-4 shrink-0" />
          No significant health signals. The team is on track.
        </div>
      )}

      {/* Ambiguity */}
      {data.ambiguity.totalItems > 0 && (
        <section className="space-y-4">
          <SectionHeader
            icon={<MessageSquare className="h-5 w-5" />}
            title="Task Clarity"
            summary={data.ambiguity.summary}
            badge={
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                {data.ambiguity.totalItems} item{data.ambiguity.totalItems !== 1 ? 's' : ''} flagged
              </span>
            }
          />
          <Card>
            <CardContent className="p-0 divide-y divide-border/50">
              {data.ambiguity.items.slice(0, 6).map((item) => (
                <div key={item.taskId} className="px-4">
                  <AmbiguityRow item={item} />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            icon={<Lightbulb className="h-5 w-5" />}
            title="Recommended Actions"
            summary="Actionable next steps based on the current state of your project."
          />
          <Card>
            <CardContent className="p-0 px-4">
              {data.recommendations.slice(0, 4).map((rec, i) => (
                <RecommendationCard key={rec.id} rec={rec} index={i} />
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <InfoCallout variant="info" title="Full team analytics">
        Detailed workload comparisons, dependency risk maps, and coordination patterns are available
        to your supervisor and coordinator. This helps protect team dynamics while keeping oversight available.
      </InfoCallout>
    </div>
  );
}

// ─── Supervisor / Coordinator full view ───────────────────────────────────────

async function FullInsightsView({
  teamId,
  teamName,
  projectTitle,
}: {
  teamId: string;
  teamName: string;
  projectTitle: string | null;
}) {
  const data = await buildTeamIntelligenceDashboard(teamId);

  return (
    <div className="space-y-10">
      {/* Team header strip */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-xl border bg-muted/30">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Team</p>
          <p className="font-semibold">{teamName}</p>
          {projectTitle && <p className="text-sm text-muted-foreground">{projectTitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <HealthBadge status={data.health.status} />
          <span className="text-xs text-muted-foreground">
            Generated {data.generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* ── Health Signals ── */}
      <section className="space-y-4">
        <SectionHeader
          icon={<Shield className="h-5 w-5" />}
          title="Health Signals"
          summary={data.health.signalSummary}
          badge={
            data.health.signals.filter((s) => s.severity === 'critical').length > 0 ? (
              <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                {data.health.signals.filter((s) => s.severity === 'critical').length} critical
              </span>
            ) : undefined
          }
        />
        {data.health.signals.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle className="h-4 w-4" />
            No significant health signals. Team appears to be on track.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.health.signals.map((s) => <SignalCard key={s.id} signal={s} />)}
          </div>
        )}
      </section>

      {/* ── Recommendations ── */}
      {data.recommendations.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            icon={<Lightbulb className="h-5 w-5" />}
            title="Recommended Actions"
            summary={`${data.recommendations.length} actionable recommendation${data.recommendations.length !== 1 ? 's' : ''}, each traced to a specific signal.`}
          />
          <Card>
            <CardContent className="p-0 px-4">
              {data.recommendations.map((rec, i) => (
                <RecommendationCard key={rec.id} rec={rec} index={i} />
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Ambiguity ── */}
      <section className="space-y-4">
        <SectionHeader
          icon={<MessageSquare className="h-5 w-5" />}
          title="Task Clarity Analysis"
          summary={data.ambiguity.summary}
          badge={
            data.ambiguity.totalItems > 0 ? (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                {data.ambiguity.totalItems} flagged
              </span>
            ) : undefined
          }
        />
        {data.ambiguity.items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle className="h-4 w-4" />
            All active tasks have clear ownership and documented criteria.
          </div>
        ) : (
          <Card>
            <CardContent className="p-0 px-4">
              {data.ambiguity.items.map((item) => (
                <AmbiguityRow key={item.taskId} item={item} />
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Workload Distribution ── */}
      <section className="space-y-4">
        <SectionHeader
          icon={<Users className="h-5 w-5" />}
          title="Workload Distribution"
          summary={data.workload.summary}
          badge={
            !data.workload.isFair ? (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                Imbalanced
              </span>
            ) : (
              <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                Balanced
              </span>
            )
          }
        />
        <Card>
          <CardContent className="p-4 space-y-5">
            {data.workload.profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No member data available.</p>
            ) : (
              <>
                {data.workload.profiles.map((p) => (
                  <WorkloadBar key={p.userId} profile={p} mean={data.workload.meanOpenTasks} />
                ))}
                <div className="border-t border-border/50 pt-3 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Normal load
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400" /> Overloaded (&gt;1.75× mean)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-purple-400" /> Support/coordination work
                  </span>
                  <span className="ml-auto">Mean: {data.workload.meanOpenTasks} tasks/member</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Dependency Risk ── */}
      <section className="space-y-4">
        <SectionHeader
          icon={<GitBranch className="h-5 w-5" />}
          title="Dependency &amp; Blocker Risk"
          summary={data.dependencies.summary}
          badge={
            data.dependencies.risks.filter((r) => r.severity === 'critical').length > 0 ? (
              <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                {data.dependencies.risks.filter((r) => r.severity === 'critical').length} critical
              </span>
            ) : undefined
          }
        />
        {data.dependencies.risks.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle className="h-4 w-4" />
            No significant dependency risks detected.
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.dependencies.risks.map((risk) => (
              <DependencyRiskRow key={risk.taskId} risk={risk} />
            ))}
          </div>
        )}
      </section>

      {/* ── Clarification Burden ── */}
      <section className="space-y-4">
        <SectionHeader
          icon={<TrendingUp className="h-5 w-5" />}
          title="Coordination &amp; Support Visibility"
          summary={data.clarification.summary}
          badge={
            data.clarification.isConcentrated ? (
              <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                Concentrated
              </span>
            ) : undefined
          }
        />
        <InfoCallout variant="info">
          This section makes invisible coordination work visible — not for surveillance, but for fair recognition.
          Clarification, meeting prep, and unblocking work are real contributions that deserve acknowledgement.
        </InfoCallout>
        <Card>
          <CardContent className="p-0 px-4">
            {data.clarification.profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No member data available.</p>
            ) : (
              data.clarification.profiles.map((p) => (
                <ClarificationRow key={p.userId} profile={p} />
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Friction Signals ── */}
      <section className="space-y-4">
        <SectionHeader
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Coordination Patterns"
          summary={data.friction.summary}
        />
        <InfoCallout variant="info">
          These signals describe observable coordination patterns — not individual diagnoses. They are
          intended to prompt preventive conversations, not assign blame.
        </InfoCallout>
        {data.friction.signals.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle className="h-4 w-4" />
            No friction patterns detected. Team coordination appears smooth.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.friction.signals.map((s) => <FrictionCard key={s.id} signal={s} />)}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TeamInsightsPage() {
  const user = await requireAuth();

  if (user.role === 'STUDENT') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team Insights"
          description="Team health signals and actionable recommendations for your project."
        />
        <StudentInsightsView userId={user.id} />
      </div>
    );
  }

  // Supervisor / Coordinator: pick teams to show
  const teams = await getTeamsForRole(user.id, user.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Insights"
        description={
          user.role === 'COORDINATOR'
            ? 'Intelligence signals across all supervised teams.'
            : 'Health analysis, workload distribution, and coordination signals for your teams.'
        }
      />

      <InfoCallout variant="info" title="How signals are computed">
        All signals are deterministic and rule-based — fully explainable. Each signal includes the
        exact reason it was raised so nothing feels opaque. AI-augmented explanations are planned for
        Phase 2. Friction signals describe observable patterns, not individual behaviour.
      </InfoCallout>

      {teams.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title="No teams to analyse"
          description="No teams found for your account."
        />
      ) : (
        <div className="space-y-12">
          {teams.map((team) => (
            <section key={team.id} className="space-y-2">
              <FullInsightsView
                teamId={team.id}
                teamName={team.name}
                projectTitle={team.project?.title ?? null}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Data helpers ──────────────────────────────────────────────────────────────

async function getTeamsForRole(userId: string, role: string) {
  if (role === 'COORDINATOR') {
    return prisma.team.findMany({
      select: { id: true, name: true, project: { select: { title: true } } },
      orderBy: { name: 'asc' },
    });
  }
  const profile = await prisma.supervisorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return [];
  return prisma.team.findMany({
    where: { supervisorId: profile.id },
    select: { id: true, name: true, project: { select: { title: true } } },
    orderBy: { name: 'asc' },
  });
}
