'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ArrowRight,
  RefreshCw,
  Loader2,
  Users,
  BookOpen,
  Layers,
  BarChart3,
  Zap,
  Shield,
  GitMerge,
  ChevronRight,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConflictGapDashboardResult, ConflictGapRiskItem, RiskSeverity, RiskSource } from '@/lib/services/formation/conflict-gap-dashboard';
import type { ExplainabilityResult } from '@/lib/services/explainability/types';

// ── Constants ──────────────────────────────────────────────────────────────────

const SEV_BADGE: Record<RiskSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200',
  LOW: 'bg-sky-100 text-sky-800 border-sky-200',
  INFO: 'bg-muted text-muted-foreground border-border',
};

const SEV_BORDER: Record<RiskSeverity, string> = {
  CRITICAL: 'border-red-300 bg-red-50/30',
  HIGH: 'border-orange-300 bg-orange-50/20',
  MEDIUM: 'border-amber-200 bg-amber-50/20',
  LOW: 'border-sky-200 bg-sky-50/10',
  INFO: 'border-border bg-muted/10',
};

const SEV_ICON: Record<RiskSeverity, React.ReactNode> = {
  CRITICAL: <XCircle className="h-4 w-4 text-red-600 shrink-0" />,
  HIGH: <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />,
  MEDIUM: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />,
  LOW: <Info className="h-4 w-4 text-sky-600 shrink-0" />,
  INFO: <Info className="h-4 w-4 text-muted-foreground shrink-0" />,
};

const SOURCE_LABELS: Record<RiskSource, string> = {
  FORMATION_READINESS: 'Formation Readiness',
  PROJECT_SELECTION: 'Project Selection',
  DRAFT_FORMATION: 'Draft Formation',
  PUBLISHED_TEAM: 'Published Teams',
  WORKLOAD_TASK: 'Workload & Tasks',
  SUPERVISOR_CAPACITY: 'Supervisor Capacity',
  TEAM_HEALTH: 'Team Health',
};

const SOURCE_BADGE: Record<RiskSource, string> = {
  FORMATION_READINESS: 'bg-violet-100 text-violet-800',
  PROJECT_SELECTION: 'bg-sky-100 text-sky-800',
  DRAFT_FORMATION: 'bg-indigo-100 text-indigo-800',
  PUBLISHED_TEAM: 'bg-emerald-100 text-emerald-800',
  WORKLOAD_TASK: 'bg-amber-100 text-amber-800',
  SUPERVISOR_CAPACITY: 'bg-pink-100 text-pink-800',
  TEAM_HEALTH: 'bg-rose-100 text-rose-800',
};

const SOURCE_ICON: Record<RiskSource, React.ReactNode> = {
  FORMATION_READINESS: <Layers className="h-3.5 w-3.5" />,
  PROJECT_SELECTION: <BookOpen className="h-3.5 w-3.5" />,
  DRAFT_FORMATION: <GitMerge className="h-3.5 w-3.5" />,
  PUBLISHED_TEAM: <Users className="h-3.5 w-3.5" />,
  WORKLOAD_TASK: <Zap className="h-3.5 w-3.5" />,
  SUPERVISOR_CAPACITY: <Shield className="h-3.5 w-3.5" />,
  TEAM_HEALTH: <BarChart3 className="h-3.5 w-3.5" />,
};

const ALL_SEVERITIES: RiskSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const ALL_SOURCES: RiskSource[] = [
  'FORMATION_READINESS', 'PROJECT_SELECTION', 'DRAFT_FORMATION',
  'PUBLISHED_TEAM', 'WORKLOAD_TASK', 'SUPERVISOR_CAPACITY', 'TEAM_HEALTH',
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ConflictGapDashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [data, setData] = useState<ConflictGapDashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<RiskSeverity | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<RiskSource | 'all'>('all');
  const [showExplain, setShowExplain] = useState(false);
  const [explain, setExplain] = useState<ExplainabilityResult | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  // Role guard
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role && role !== 'COORDINATOR') {
      router.replace('/dashboard/coordinator');
    }
  }, [session, sessionStatus, router]);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/coordinator/conflicts');
      if (!res.ok) throw new Error('Failed to load dashboard.');
      const json = await res.json() as ConflictGapDashboardResult;
      setData(json);
    } catch {
      // silently keep previous data on refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'authenticated') loadData();
  }, [sessionStatus, loadData]);

  const handleExplain = async () => {
    setShowExplain((v) => !v);
    if (explain) return;
    setExplainLoading(true);
    try {
      const res = await fetch('/api/explainability/conflicts');
      if (res.ok) setExplain(await res.json());
    } catch {
      // fall through
    } finally {
      setExplainLoading(false);
    }
  };

  const filteredRisks = (data?.risks ?? []).filter((r) => {
    if (severityFilter !== 'all' && r.severity !== severityFilter) return false;
    if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
    return true;
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summary = data?.summary;
  const hasNoCriticalOrHigh = (summary?.critical ?? 0) === 0 && (summary?.high ?? 0) === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Conflict & Gap Detection"
          description="Aggregated risks across formation readiness, project selection, team composition, workload, and team health."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="gap-2 shrink-0"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Term / Batch banner */}
      {data?.term && (
        <div className="flex flex-wrap gap-4 text-sm bg-muted/30 rounded-lg px-4 py-3 border border-border">
          <span>
            <span className="text-muted-foreground">Term: </span>
            <span className="font-medium">{data.term.name}</span>
          </span>
          {data.batch && (
            <span>
              <span className="text-muted-foreground">Batch: </span>
              <span className="font-medium">{data.batch.name}</span>
              <Badge className="ml-2 text-xs">{data.batch.status}</Badge>
            </span>
          )}
        </div>
      )}

      {/* Empty state */}
      {hasNoCriticalOrHigh && (summary?.total ?? 0) === 0 && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="py-10 text-center">
            <CheckCircle className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
            <p className="font-medium text-emerald-800">No critical conflicts detected</p>
            <p className="text-sm text-emerald-700 mt-1">
              Continue monitoring workload and team health as the term progresses.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      {(summary?.total ?? 0) > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className={cn((summary?.critical ?? 0) > 0 ? 'border-red-300 bg-red-50/20' : '')}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Critical</span>
              </div>
              <p className={cn('text-2xl font-bold', (summary?.critical ?? 0) > 0 ? 'text-red-700' : 'text-foreground')}>
                {summary?.critical ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card className={cn((summary?.high ?? 0) > 0 ? 'border-orange-300 bg-orange-50/20' : '')}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">High</span>
              </div>
              <p className={cn('text-2xl font-bold', (summary?.high ?? 0) > 0 ? 'text-orange-700' : 'text-foreground')}>
                {summary?.high ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card className={cn((summary?.medium ?? 0) > 0 ? 'border-amber-200 bg-amber-50/20' : '')}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Medium</span>
              </div>
              <p className={cn('text-2xl font-bold', (summary?.medium ?? 0) > 0 ? 'text-amber-700' : 'text-foreground')}>
                {summary?.medium ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary?.total ?? 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Risk by source summary */}
      {summary && summary.total > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Risks by Source
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {ALL_SOURCES.map((src) => {
              const count = summary.bySource[src] ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={src}
                  onClick={() => setSourceFilter(sourceFilter === src ? 'all' : src)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-opacity',
                    SOURCE_BADGE[src],
                    sourceFilter !== 'all' && sourceFilter !== src ? 'opacity-40' : 'opacity-100'
                  )}
                >
                  {SOURCE_ICON[src]}
                  {SOURCE_LABELS[src]}
                  <span className="ml-1 font-bold">{count}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recommended actions */}
      {(data?.recommendedActions ?? []).length > 0 && (
        <Card className="border-sky-200 bg-sky-50/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-sky-800">
              <Zap className="h-4 w-4" />
              Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.recommendedActions.map((action) => (
                <div key={action.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-sky-100 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                    <span className="text-sm text-sky-800 truncate">{action.action}</span>
                    {action.count > 1 && (
                      <Badge className="bg-sky-100 text-sky-700 text-xs ml-1">{action.count}</Badge>
                    )}
                  </div>
                  {action.href && (
                    <Link href={action.href} className="shrink-0 text-xs text-sky-700 hover:text-sky-900 flex items-center gap-1">
                      Go <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* What should I fix first — Explain panel */}
      {data && (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50">
          <button
            onClick={handleExplain}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-50 transition-colors rounded-xl"
          >
            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
            What should I fix first? (explain)
            {showExplain ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
          </button>
          {showExplain && (
            <div className="border-t border-amber-200 px-4 pb-4 pt-3">
              {explainLoading ? (
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating explanation…
                </div>
              ) : explain ? (
                <div className="space-y-3 text-sm">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                    Deterministic explanation — Based on ProjectPilot&apos;s risk aggregation data
                  </p>
                  <p className="text-amber-900">{explain.summary}</p>
                  {explain.keyReasons.length > 0 && (
                    <ul className="space-y-1">
                      {explain.keyReasons.map((r) => (
                        <li key={r} className="flex items-start gap-2 text-amber-800">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                  {explain.recommendedActions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-700 mb-1">Priority actions</p>
                      <ul className="space-y-1">
                        {explain.recommendedActions.map((a) => (
                          <li key={a} className="flex items-start gap-2 text-amber-800">
                            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-amber-700">Explanation unavailable.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      {(data?.risks ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Severity:</span>
          {(['all', ...ALL_SEVERITIES] as ('all' | RiskSeverity)[]).map((sev) => (
            <Button
              key={sev}
              size="sm"
              variant={severityFilter === sev ? 'default' : 'outline'}
              onClick={() => setSeverityFilter(sev)}
              className="h-7 text-xs capitalize"
            >
              {sev === 'all' ? 'All' : sev}
            </Button>
          ))}
          {sourceFilter !== 'all' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSourceFilter('all')}
              className="h-7 text-xs text-muted-foreground ml-2"
            >
              Clear source filter
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-2">
            Showing {filteredRisks.length} of {data?.risks.length ?? 0} risks
          </span>
        </div>
      )}

      {/* Risk list */}
      {filteredRisks.length > 0 ? (
        <div className="space-y-2">
          {filteredRisks.map((risk) => (
            <RiskCard key={risk.id} risk={risk} />
          ))}
        </div>
      ) : (data?.risks ?? []).length > 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No risks match the current filters.
          </CardContent>
        </Card>
      ) : null}

      {/* No active term */}
      {!data?.term && !loading && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No active academic term found</p>
            <p className="text-xs mt-1">
              Set up an academic term in{' '}
              <Link href="/dashboard/coordinator/formation-setup" className="underline text-sky-600">
                Formation Setup
              </Link>{' '}
              to see conflict detection data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Risk card sub-component ────────────────────────────────────────────────────

function RiskCard({ risk }: { risk: ConflictGapRiskItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn('border', SEV_BORDER[risk.severity])}>
      <button
        className="w-full text-left px-4 pt-3 pb-2"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2 min-w-0">
            {SEV_ICON[risk.severity]}
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{risk.title}</p>
              {risk.entityLabel && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {risk.entityType ? `${risk.entityType}: ` : ''}{risk.entityLabel}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={cn('text-xs border', SEV_BADGE[risk.severity])}>
              {risk.severity}
            </Badge>
            <Badge className={cn('text-xs flex items-center gap-1', SOURCE_BADGE[risk.source])}>
              {SOURCE_ICON[risk.source]}
              {SOURCE_LABELS[risk.source]}
            </Badge>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 text-sm">
          <p className="text-muted-foreground">{risk.message}</p>
          <div className="flex items-start gap-2 bg-background/60 rounded px-3 py-2">
            <ChevronRight className="h-3.5 w-3.5 text-sky-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sky-800 text-xs uppercase tracking-wide">Recommended action: </span>
              <span className="text-xs text-foreground">{risk.recommendedAction}</span>
            </div>
            {risk.href && (
              <Link
                href={risk.href}
                className="text-xs text-sky-700 hover:text-sky-900 flex items-center gap-1 shrink-0 ml-2"
              >
                Open <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
