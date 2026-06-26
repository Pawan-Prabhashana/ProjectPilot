'use client';

/**
 * Formation Engine Preview (Part 5) — coordinator-only client island.
 *
 * Minimal control to run the deterministic engine and inspect the latest draft
 * result. Part 6 will replace this with the full review/approval workspace.
 *
 * Privacy: renders only engine output (scores, suggested roles, generic routine
 * hints, warnings). It never shows cognitive profile data or private notes.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InfoCallout } from '@/components/shared/info-callout';
import {
  Cpu,
  Play,
  Loader2,
  AlertTriangle,
  Users,
  Trophy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  FormationRunDetails,
  FormationRunOverview,
  DraftTeamView,
} from '@/lib/formation/team-formation-types';

type LatestResponse = {
  batchId: string | null;
  run: FormationRunOverview | null;
  details: FormationRunDetails | null;
};

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200',
  LOW: 'bg-sky-100 text-sky-800 border-sky-200',
  INFO: 'bg-muted text-muted-foreground border-border',
};

export function FormationEnginePreview() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LatestResponse | null>(null);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/formation-engine/latest');
      if (!res.ok) throw new Error((await res.json()).message ?? 'Failed to load.');
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load latest run.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  const runEngine = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/formation-engine/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to run engine.');
      setData((prev) => ({ batchId: prev?.batchId ?? null, run: json.details?.run ?? null, details: json.details ?? null }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run engine.');
    } finally {
      setRunning(false);
    }
  }, []);

  const run = data?.run ?? null;
  const details = data?.details ?? null;
  const summary = run?.summary ?? null;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
        <Cpu className="h-4 w-4 text-muted-foreground" />
        Formation Engine Preview
        <Badge variant="outline" className="text-[10px] font-normal">
          Part 5 · deterministic draft
        </Badge>
      </h2>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Run a deterministic draft formation and inspect the latest result.
            </CardTitle>
            <Button onClick={runEngine} disabled={running} size="sm">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? 'Running…' : 'Run Draft Formation'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoCallout variant="info">
            These are <strong>draft</strong> teams only — a transparent &ldquo;what-if&rdquo; based on
            skills, schedule, roles, preferences, capacity and safe support routines. No real teams are
            created or published. Approval and publishing arrive in Part 6.
          </InfoCallout>

          {error && (
            <InfoCallout variant="error" title="Something went wrong">
              {error}
            </InfoCallout>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading latest run…
            </div>
          ) : !run ? (
            <p className="text-sm text-muted-foreground py-2">
              No formation run yet. Click <span className="font-medium text-foreground">Run Draft Formation</span> to generate one.
            </p>
          ) : (
            <>
              {/* Run status row */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <RunStatusBadge status={run.status} />
                <span className="text-muted-foreground">
                  {run.algorithmVersion}
                  {run.completedAt && ` · ${new Date(run.completedAt).toLocaleString()}`}
                </span>
              </div>

              {run.status === 'FAILED' && run.failureReason && (
                <InfoCallout variant="warning" title="Run failed">
                  {run.failureReason}
                </InfoCallout>
              )}

              {/* Summary stats */}
              {summary && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatBlock label="Draft Teams" value={summary.totalDraftTeams} icon={<Users className="h-4 w-4 text-sky-500" />} />
                  <StatBlock label="Students" value={summary.totalStudents} icon={<Users className="h-4 w-4 text-emerald-500" />} />
                  <StatBlock label="Avg Score" value={`${summary.averageOverallScore}/100`} icon={<Trophy className="h-4 w-4 text-amber-500" />} />
                  <StatBlock
                    label="Unassigned"
                    value={summary.unassignedStudents}
                    icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
                    highlight={summary.unassignedStudents > 0}
                  />
                </div>
              )}

              {/* Warning counts */}
              {summary && Object.keys(summary.warningCountsBySeverity).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).map((sev) =>
                    summary.warningCountsBySeverity[sev] ? (
                      <Badge key={sev} variant="outline" className={cn('text-[10px]', SEVERITY_STYLES[sev])}>
                        {summary.warningCountsBySeverity[sev]} {sev.toLowerCase()}
                      </Badge>
                    ) : null
                  )}
                </div>
              )}

              {/* Draft teams */}
              {details && details.draftTeams.length > 0 && (
                <div className="space-y-3">
                  {details.draftTeams.map((team) => (
                    <DraftTeamCard key={team.id} team={team} />
                  ))}
                </div>
              )}

              {/* Run-level warnings */}
              {details && details.runWarnings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Run-level warnings
                  </p>
                  {details.runWarnings.map((w) => (
                    <WarningRow key={w.id} severity={w.severity} title={w.title} message={w.message} />
                  ))}
                </div>
              )}
            </>
          )}

          <p className="text-[10px] text-muted-foreground border-t pt-3">
            <span className="font-medium text-foreground">Privacy note:</span> This preview shows only
            engine output — scores, suggested roles, generic work-routine hints, and warnings. It never
            exposes cognitive profiles, diagnoses, or private support notes.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DraftTeamCard({ team }: { team: DraftTeamView }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-background">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{team.name}</span>
            {team.topicTitle ? (
              <Badge variant="outline" className="text-[10px]">{team.topicTitle}</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-amber-600">No topic</Badge>
            )}
            {team.warnings.length > 0 && (
              <span className="text-[10px] text-orange-600 inline-flex items-center gap-0.5">
                <AlertTriangle className="h-3 w-3" /> {team.warnings.length}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {team.members.length} member(s){team.supervisorName ? ` · ${team.supervisorName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold tabular-nums">{team.overallScore}<span className="text-muted-foreground font-normal">/100</span></span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Score breakdown */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            <ScoreRow label="Skill" value={team.scores.skillScore} />
            <ScoreRow label="Schedule" value={team.scores.scheduleScore} />
            <ScoreRow label="Roles" value={team.scores.roleScore} />
            <ScoreRow label="Preference" value={team.scores.preferenceScore} />
            <ScoreRow label="Capacity" value={team.scores.capacityScore} />
            <ScoreRow label="Support" value={team.scores.supportCompatibilityScore} />
          </div>

          {team.explanation && <p className="text-xs text-muted-foreground">{team.explanation}</p>}

          {team.supportRoutineHints.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {team.supportRoutineHints.map((h) => (
                <Badge key={h} variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">
                  {h}
                </Badge>
              ))}
            </div>
          )}

          {/* Members */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Members</p>
            {team.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 text-xs py-0.5">
                <span className="font-medium text-foreground truncate">{m.name}</span>
                <span className="text-muted-foreground shrink-0">
                  {m.suggestedRoleLabel ?? 'No role'}{' '}
                  <span className="text-muted-foreground/60">({m.roleConfidence}%)</span>
                </span>
              </div>
            ))}
          </div>

          {/* Team warnings */}
          {team.warnings.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {team.warnings.map((w) => (
                <WarningRow key={w.id} severity={w.severity} title={w.title} message={w.message} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function WarningRow({ severity, title, message }: { severity: string; title: string; message: string }) {
  return (
    <div className="rounded border border-border bg-muted/20 px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={cn('text-[9px]', SEVERITY_STYLES[severity])}>{severity}</Badge>
        <span className="text-xs font-medium text-foreground">{title}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{message}</p>
    </div>
  );
}

function StatBlock({ label, value, icon, highlight }: { label: string; value: string | number; icon: React.ReactNode; highlight?: boolean }) {
  const isHighlighted = highlight && Number(value) > 0;
  return (
    <div className={cn('rounded-lg border px-3 py-2.5', isHighlighted ? 'border-amber-300 bg-amber-50/30' : 'bg-muted/20')}>
      <div className="mb-1">{icon}</div>
      <p className={cn('text-xl font-bold tabular-nums', isHighlighted ? 'text-amber-700' : 'text-foreground')}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    QUEUED: 'bg-muted text-muted-foreground border-border',
    RUNNING: 'bg-blue-100 text-blue-800 border-blue-200',
    COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    FAILED: 'bg-red-100 text-red-800 border-red-200',
    ARCHIVED: 'bg-muted text-muted-foreground/70 border-border',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px]', styles[status] ?? 'bg-muted text-muted-foreground')}>
      {status}
    </Badge>
  );
}
