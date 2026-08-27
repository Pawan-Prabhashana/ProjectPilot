import type { Metadata } from 'next';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { resolveActiveWorkspace } from '@/lib/services/workspace-access';
import { getTeamContributionSummary, CONTRIBUTION_LABELS, HIDDEN_CONTRIBUTION_TYPES } from '@/lib/services/contribution-intelligence';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Progress } from '@/components/ui/progress';
import { LogContributionForm } from '@/components/contributions/log-contribution-form';
import {
  BarChart3, Users, Clock, Zap, Eye, CheckCircle, AlertTriangle,
  Crown, User, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import type { ContributionType } from '@prisma/client';

export const metadata: Metadata = { title: 'Contribution Intelligence' };

const TYPE_COLORS: Partial<Record<ContributionType, string>> = {
  CODE:               'bg-sky-500',
  DESIGN:             'bg-violet-500',
  RESEARCH:           'bg-emerald-500',
  WRITING:            'bg-amber-500',
  PLANNING:           'bg-indigo-500',
  TESTING:            'bg-rose-500',
  COORDINATION:       'bg-teal-500',
  REVIEW:             'bg-orange-500',
  DOCUMENTATION:      'bg-cyan-500',
  CLARIFICATION:      'bg-yellow-500',
  MEETING_PREP:       'bg-purple-500',
  UNBLOCKING_SUPPORT: 'bg-pink-500',
  OTHER:              'bg-slate-400',
};

const TYPE_BG: Partial<Record<ContributionType, string>> = {
  CODE:               'bg-sky-100 text-sky-800',
  DESIGN:             'bg-violet-100 text-violet-800',
  RESEARCH:           'bg-emerald-100 text-emerald-800',
  WRITING:            'bg-amber-100 text-amber-800',
  PLANNING:           'bg-indigo-100 text-indigo-800',
  TESTING:            'bg-rose-100 text-rose-800',
  COORDINATION:       'bg-teal-100 text-teal-800',
  REVIEW:             'bg-orange-100 text-orange-800',
  DOCUMENTATION:      'bg-cyan-100 text-cyan-800',
  CLARIFICATION:      'bg-yellow-100 text-yellow-800',
  MEETING_PREP:       'bg-purple-100 text-purple-800',
  UNBLOCKING_SUPPORT: 'bg-pink-100 text-pink-800',
  OTHER:              'bg-slate-100 text-slate-800',
};

export default async function ContributionsPage({
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
        : "No teams are assigned to you yet.";
    return (
      <div className="space-y-6">
        <PageHeader
          title="Contribution Intelligence"
          description="Fair, multi-dimensional visibility into what each team member contributes."
        />
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title="No project linked"
          description={description}
        />
      </div>
    );
  }

  const project = await prisma.project.findUnique({ where: { id: workspace.projectId } });
  if (!project) {
    return (
      <div className="space-y-6">
        <PageHeader title="Contribution Intelligence" description="Fair, multi-dimensional visibility into contributions." />
        <EmptyState icon={<BarChart3 className="h-8 w-8" />} title="Project not found" description="The linked project could not be found." />
      </div>
    );
  }

  const summary = await getTeamContributionSummary(workspace.teamId, workspace.projectId!);

  const hiddenWorkCount = summary.teamTypeMix
    .filter((t) => HIDDEN_CONTRIBUTION_TYPES.includes(t.type))
    .reduce((s, t) => s + t.count, 0);
  const hiddenWorkPct = summary.totalEntries > 0 ? Math.round((hiddenWorkCount / summary.totalEntries) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <BarChart3 className="h-6 w-6 text-sky-500" />
          Contribution Intelligence
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Fair, transparent visibility into how <span className="font-medium text-foreground">{project?.title ?? workspace.teamName}</span> work is distributed.
          All contribution types count — code, research, support, and coordination all matter.
        </p>
      </div>

      {/* ── Top stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Total Contributions"
          value={String(summary.totalEntries)}
          sub={`${summary.recentActivityCount} this week`}
          icon={<Sparkles className="h-4 w-4 text-amber-500" />}
        />
        <StatTile
          label="Hours Logged"
          value={`${summary.totalHours}h`}
          sub="across all types"
          icon={<Clock className="h-4 w-4 text-sky-500" />}
        />
        <StatTile
          label="Team Members"
          value={String(summary.memberProfiles.length)}
          sub={summary.distributionIsFair ? 'Balanced load' : 'Imbalance detected'}
          icon={<Users className="h-4 w-4 text-emerald-500" />}
          highlight={summary.distributionIsFair ? 'success' : 'warning'}
        />
        <StatTile
          label="Hidden Work"
          value={`${hiddenWorkPct}%`}
          sub="support, review, prep"
          icon={<Eye className="h-4 w-4 text-violet-500" />}
        />
      </div>

      {/* Fairness / imbalance alerts */}
      {!summary.distributionIsFair && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Contribution imbalance detected</p>
              <p className="mt-0.5 text-xs text-amber-700">
                This is a signal to check in as a team — it doesn&apos;t mean anyone is doing the wrong thing.
                Some members may be doing important invisible work not yet logged.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Team type mix ──────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-sky-500" />
          Team Contribution Mix
        </h2>
        <div className="rounded-xl border bg-card p-5">
          {summary.teamTypeMix.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contributions logged yet.</p>
          ) : (
            <div className="space-y-2.5">
              {summary.teamTypeMix.map((t) => {
                const isHidden = HIDDEN_CONTRIBUTION_TYPES.includes(t.type);
                return (
                  <div key={t.type} className="flex items-center gap-3">
                    <div className="w-32 shrink-0">
                      <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', TYPE_BG[t.type] ?? 'bg-muted text-muted-foreground')}>
                        {isHidden && <Eye className="h-3 w-3" />}
                        {t.label}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full transition-all', TYPE_COLORS[t.type] ?? 'bg-slate-400')}
                          style={{ width: `${t.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-10 text-right text-xs text-muted-foreground">{t.percentage}%</span>
                    <span className="w-8 text-right text-xs font-medium">{t.count}</span>
                  </div>
                );
              })}
            </div>
          )}
          {hiddenWorkPct > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              {hiddenWorkPct}% of contributions are support/coordination work that often goes unrecognised.
            </div>
          )}
        </div>
      </section>

      {/* ── Per-member profiles ───────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          Member Profiles
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summary.memberProfiles.map((member) => {
            const isOverloaded = summary.overloadedMembers.includes(member.userId);
            const isUnder = summary.underContributingMembers.includes(member.userId);
            const maxContrib = Math.max(...summary.memberProfiles.map((m) => m.totalEntries), 1);

            return (
              <div
                key={member.userId}
                className={cn(
                  'rounded-xl border p-5 space-y-4',
                  isOverloaded ? 'border-amber-200 bg-amber-50/40' : 'border-border bg-card'
                )}
              >
                {/* Member header */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    isOverloaded ? 'bg-amber-200 text-amber-800' : 'bg-primary/10 text-primary'
                  )}>
                    {member.teamRole === 'lead' ? <Crown className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {member.name ?? member.email.split('@')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{member.teamRole}</p>
                  </div>
                  {isOverloaded && (
                    <span className="text-xs text-amber-700 font-medium flex items-center gap-0.5">
                      <Zap className="h-3 w-3" />
                      High load
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold">{member.totalEntries}</p>
                    <p className="text-xs text-muted-foreground">Entries</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{member.totalHours.toFixed(1)}h</p>
                    <p className="text-xs text-muted-foreground">Logged</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{Math.round(member.diversityScore * 100)}%</p>
                    <p className="text-xs text-muted-foreground">Diversity</p>
                  </div>
                </div>

                {/* Contribution bar */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Relative load</span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round((member.totalEntries / maxContrib) * 100)}% of most active
                    </span>
                  </div>
                  <Progress
                    value={Math.round((member.totalEntries / maxContrib) * 100)}
                    variant={isOverloaded ? 'warning' : isUnder ? 'danger' : 'success'}
                  />
                </div>

                {/* Type mix (top 3) */}
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Top contribution types</p>
                  <div className="flex flex-wrap gap-1.5">
                    {member.contributionMix.slice(0, 4).map((t) => (
                      <span
                        key={t.type}
                        className={cn('rounded-md px-2 py-0.5 text-xs font-medium', TYPE_BG[t.type] ?? 'bg-muted text-muted-foreground')}
                        title={`${t.count} entries, ${t.totalHours.toFixed(1)}h`}
                      >
                        {t.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Last active */}
                {member.lastActiveAt && (
                  <p className="text-xs text-muted-foreground">
                    Last active: {formatDate(member.lastActiveAt)}
                  </p>
                )}

                {/* Recent entry preview */}
                {member.recentEntries[0] && (
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      <span className={cn('rounded px-1.5 py-0.5 mr-1 font-medium', TYPE_BG[member.recentEntries[0].type] ?? 'bg-muted text-muted-foreground text-xs')}>
                        {CONTRIBUTION_LABELS[member.recentEntries[0].type]}
                      </span>
                      {member.recentEntries[0].description}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Log a contribution ────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-sm font-semibold">Log your contribution</h2>
        <p className="text-xs text-muted-foreground mb-3">
          All work counts — not just code. Log research, support, planning, and coordination so it&apos;s visible to the team.
        </p>
        <LogContributionForm projectId={project.id} />
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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
  highlight?: 'success' | 'warning';
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      highlight === 'success' && 'border-emerald-200 bg-emerald-50/50',
      highlight === 'warning' && 'border-amber-200 bg-amber-50/50',
      !highlight && 'border-border bg-card',
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

// ── Data helper ────────────────────────────────────────────────────────────────

