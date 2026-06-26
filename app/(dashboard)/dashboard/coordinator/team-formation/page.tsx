'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Play,
  Lock,
  Send,
  ArrowRight,
  BarChart3,
  Pencil,
  X,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkspaceOverview } from '@/lib/services/formation/formation-workspace';
import type { FormationRunDetails, DraftTeamView, DraftMemberView } from '@/lib/formation/team-formation-types';
import type { DraftTeamStatus } from '@prisma/client';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<DraftTeamStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-800',
  READY: 'bg-emerald-100 text-emerald-800',
  LOCKED: 'bg-sky-100 text-sky-800',
};

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  LOW: 'bg-sky-100 text-sky-800',
  INFO: 'bg-muted text-muted-foreground',
};

const SCORE_COLOR = (s: number) =>
  s >= 70 ? 'text-emerald-600' : s >= 50 ? 'text-amber-600' : 'text-red-600';

// Aligned with the Part 7 role suitability catalogue (lib/formation/role-suitability.ts),
// plus co_leader which the publish step maps to CO_LEADER.
const ROLE_OPTIONS = [
  { key: 'team_leader', label: 'Team Leader' },
  { key: 'co_leader', label: 'Co-Leader' },
  { key: 'frontend_developer', label: 'Frontend Developer' },
  { key: 'backend_developer', label: 'Backend Developer' },
  { key: 'database_designer', label: 'Database Designer' },
  { key: 'ui_ux_designer', label: 'UI/UX Designer' },
  { key: 'qa_tester', label: 'QA / Testing Lead' },
  { key: 'documentation_lead', label: 'Documentation Lead' },
  { key: 'research_lead', label: 'Research Lead' },
  { key: 'presentation_lead', label: 'Presentation Lead' },
  { key: 'client_communication_lead', label: 'Client / Supervisor Communication Lead' },
  { key: 'ai_ml_specialist', label: 'AI / ML Specialist' },
  { key: 'mobile_developer', label: 'Mobile Developer' },
  { key: 'devops_support', label: 'DevOps Support' },
];

const DRAFT_STATUS_OPTIONS: DraftTeamStatus[] = ['DRAFT', 'NEEDS_REVIEW', 'READY', 'LOCKED'];

/** Human-friendly label for a role key (falls back to a title-cased key). */
function roleLabel(key: string): string {
  return (
    ROLE_OPTIONS.find((r) => r.key === key)?.label ??
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

type Filter = 'all' | 'needs_review' | 'ready' | 'has_warnings';

// ── Component ─────────────────────────────────────────────────────────────────

export default function TeamFormationWorkspacePage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // Page state
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [runDetails, setRunDetails] = useState<FormationRunDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningEngine, setRunningEngine] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Inline edit state
  const [editingTeamName, setEditingTeamName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingMemberRole, setEditingMemberRole] = useState<string | null>(null);
  const [editRoleKey, setEditRoleKey] = useState('');
  const [movingMember, setMovingMember] = useState<{ memberId: string; memberName: string } | null>(null);
  const [moveTargetTeamId, setMoveTargetTeamId] = useState('');

  // Publish validation state
  const [publishValidation, setPublishValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    teamReadiness: { draftTeamId: string; name: string; status: string; isReady: boolean; issues: string[] }[];
  } | null>(null);
  const [showPublishSection, setShowPublishSection] = useState(false);

  // Role guard
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role && role !== 'COORDINATOR') {
      router.replace('/dashboard/coordinator');
    }
  }, [session, sessionStatus, router]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadOverview = useCallback(async () => {
    const res = await fetch('/api/formation-workspace/overview');
    if (!res.ok) throw new Error('Failed to load workspace overview.');
    return res.json() as Promise<WorkspaceOverview>;
  }, []);

  const loadRunDetails = useCallback(async (runId: string) => {
    const res = await fetch(`/api/formation-workspace/run/${runId}`);
    if (!res.ok) throw new Error('Failed to load run details.');
    return res.json() as Promise<FormationRunDetails>;
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const ov = await loadOverview();
      setOverview(ov);

      if (ov.latestRun?.id) {
        const details = await loadRunDetails(ov.latestRun.id);
        setRunDetails(details);
      } else {
        setRunDetails(null);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load workspace.');
    } finally {
      setLoading(false);
    }
  }, [loadOverview, loadRunDetails]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      loadData();
    }
  }, [sessionStatus, loadData]);

  // ── Engine run ────────────────────────────────────────────────────────────

  const handleRunEngine = async () => {
    if (!overview?.batch?.id) return;
    setRunningEngine(true);
    try {
      const res = await fetch('/api/formation-engine/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: overview.batch.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Engine run failed.');
      showToast('success', 'Draft formation completed successfully.');
      await loadData();
      setPublishValidation(null);
      setShowPublishSection(false);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to run formation engine.');
    } finally {
      setRunningEngine(false);
    }
  };

  // ── Team updates ──────────────────────────────────────────────────────────

  const saveTeamName = async (teamId: string) => {
    if (!editNameValue.trim()) return;
    try {
      const res = await fetch(`/api/formation-workspace/draft-team/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editNameValue.trim() }),
      });
      if (!res.ok) throw new Error('Failed to save team name.');
      showToast('success', 'Team name updated.');
      setEditingTeamName(null);
      if (runDetails?.run?.id) await loadRunDetails(runDetails.run.id).then(setRunDetails);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const saveTeamStatus = async (teamId: string, newStatus: DraftTeamStatus) => {
    try {
      const res = await fetch(`/api/formation-workspace/draft-team/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update team status.');
      showToast('success', `Team marked as ${newStatus}.`);
      if (runDetails?.run?.id) await loadRunDetails(runDetails.run.id).then(setRunDetails);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Update failed.');
    }
  };

  // ── Member updates ────────────────────────────────────────────────────────

  const saveMemberRole = async (memberId: string) => {
    const roleOption = ROLE_OPTIONS.find((r) => r.key === editRoleKey);
    try {
      const res = await fetch(`/api/formation-workspace/member/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestedRoleKey: editRoleKey,
          suggestedRoleLabel: roleOption?.label ?? editRoleKey,
        }),
      });
      if (!res.ok) throw new Error('Failed to save member role.');
      showToast('success', 'Member role updated.');
      setEditingMemberRole(null);
      if (runDetails?.run?.id) await loadRunDetails(runDetails.run.id).then(setRunDetails);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleMoveMember = async () => {
    if (!movingMember || !moveTargetTeamId) return;
    try {
      const res = await fetch('/api/formation-workspace/move-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: movingMember.memberId, targetDraftTeamId: moveTargetTeamId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Move failed.');
      showToast('success', json.message ?? 'Member moved.');
      setMovingMember(null);
      setMoveTargetTeamId('');
      if (runDetails?.run?.id) await loadRunDetails(runDetails.run.id).then(setRunDetails);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Move failed.');
    }
  };

  // ── Publish ───────────────────────────────────────────────────────────────

  const handleValidate = async () => {
    if (!runDetails?.run?.id) return;
    setValidating(true);
    try {
      const res = await fetch('/api/formation-workspace/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: runDetails.run.id, validateOnly: true }),
      });
      const json = await res.json();
      setPublishValidation(json.validation);
      setShowPublishSection(true);
    } catch {
      showToast('error', 'Validation request failed.');
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async () => {
    if (!runDetails?.run?.id) return;
    const confirmed = window.confirm(
      'This will create real operational Team, TeamMember, and Project records from the draft. This action cannot be undone. Proceed?'
    );
    if (!confirmed) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/formation-workspace/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: runDetails.run.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Publish failed.');
      showToast('success', json.message ?? 'Published successfully!');
      await loadData();
      setPublishValidation(null);
      setShowPublishSection(false);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  };

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filteredTeams: DraftTeamView[] = (runDetails?.draftTeams ?? []).filter((team) => {
    if (filter === 'needs_review') return team.status === 'NEEDS_REVIEW';
    if (filter === 'ready') return team.status === 'READY' || team.status === 'LOCKED';
    if (filter === 'has_warnings')
      return team.warnings.some((w) => w.severity === 'HIGH' || w.severity === 'CRITICAL');
    return true;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  const isPublished = !!overview?.isPublished;
  const hasCompletedRun = overview?.latestRun?.status === 'COMPLETED';
  const run = runDetails?.run;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-lg',
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          )}
        >
          {toast.msg}
        </div>
      )}

      <PageHeader
        title="Team Formation Workspace"
        description="Review draft teams, make adjustments, and publish operational teams."
      />

      {/* Term & Batch Banner */}
      <Card className="border-sky-200 bg-sky-50/40">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Academic Term</span>
              <p className="font-medium mt-0.5">
                {overview?.term?.name ?? <span className="text-muted-foreground">No active term</span>}
              </p>
            </div>
            {overview?.batch && (
              <div>
                <span className="text-muted-foreground">Formation Batch</span>
                <p className="font-medium mt-0.5">
                  {overview.batch.name}{' '}
                  <Badge className="ml-1 text-xs">{overview.batch.status}</Badge>
                </p>
              </div>
            )}
            {overview?.batch && (
              <div>
                <span className="text-muted-foreground">Team Size</span>
                <p className="font-medium mt-0.5">
                  {overview.batch.minTeamSize}–{overview.batch.maxTeamSize} students (target {overview.batch.targetTeamSize})
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Run summary */}
      {run ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Latest Formation Run</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {run.createdAt ? new Date(run.createdAt).toLocaleString() : '—'} &middot; by{' '}
                  {run.createdByName ?? 'system'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    run.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : run.status === 'FAILED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  )}
                >
                  {run.status}
                </Badge>
                {isPublished && (
                  <Badge className="bg-sky-100 text-sky-800">
                    <Lock className="h-3 w-3 mr-1" /> PUBLISHED
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {run.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-3">
                <div>
                  <span className="text-muted-foreground">Draft Teams</span>
                  <p className="text-xl font-semibold">{run.summary.totalDraftTeams}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Score</span>
                  <p className={cn('text-xl font-semibold', SCORE_COLOR(run.summary.averageOverallScore))}>
                    {run.summary.averageOverallScore}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Students</span>
                  <p className="text-xl font-semibold">{run.summary.totalStudents}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Unassigned</span>
                  <p className={cn('text-xl font-semibold', run.summary.unassignedStudents > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                    {run.summary.unassignedStudents}
                  </p>
                </div>
              </div>
            )}
            {run.summary?.warningCountsBySeverity && (
              <div className="flex flex-wrap gap-2 text-xs mt-1">
                {Object.entries(run.summary.warningCountsBySeverity)
                  .filter(([, count]) => (count as number) > 0)
                  .map(([sev, count]) => (
                    <Badge key={sev} className={SEVERITY_BADGE[sev]}>
                      {sev}: {count as number}
                    </Badge>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No formation run found</p>
            <p className="text-sm mt-1">Run the formation engine to generate draft teams.</p>
          </CardContent>
        </Card>
      )}

      {/* Run / Re-run button */}
      {!isPublished && overview?.batch && (
        <div className="flex items-center gap-3">
          <Button
            onClick={handleRunEngine}
            disabled={runningEngine}
            className="gap-2"
            variant={hasCompletedRun ? 'outline' : 'default'}
          >
            {runningEngine ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {runningEngine ? 'Running engine…' : hasCompletedRun ? 'Re-run Formation Engine' : 'Run Formation Engine'}
          </Button>
          {hasCompletedRun && (
            <p className="text-xs text-muted-foreground">
              Re-running will create a new draft; the previous draft is kept.
            </p>
          )}
        </div>
      )}

      {/* Draft teams section */}
      {runDetails && runDetails.draftTeams.length > 0 && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Filter:</span>
            {(['all', 'needs_review', 'ready', 'has_warnings'] as Filter[]).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'default' : 'outline'}
                onClick={() => setFilter(f)}
                className="h-7 text-xs"
              >
                {f === 'all' ? 'All Teams' : f === 'needs_review' ? 'Needs Review' : f === 'ready' ? 'Ready / Locked' : 'Has Warnings'}
              </Button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              Showing {filteredTeams.length} of {runDetails.draftTeams.length} teams
            </span>
          </div>

          {/* Team cards */}
          <div className="space-y-3">
            {filteredTeams.map((team) => {
              const isExpanded = expandedTeam === team.id;
              const criticalWarnings = team.warnings.filter((w) => w.severity === 'CRITICAL');
              const highWarnings = team.warnings.filter((w) => w.severity === 'HIGH');

              return (
                <Card key={team.id} className={cn('border', criticalWarnings.length > 0 ? 'border-red-300' : highWarnings.length > 0 ? 'border-orange-300' : '')}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      {/* Team name & status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {editingTeamName === team.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              className="border rounded px-2 py-0.5 text-sm w-48 focus:ring-1 focus:ring-sky-400 outline-none"
                              value={editNameValue}
                              onChange={(e) => setEditNameValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveTeamName(team.id); if (e.key === 'Escape') setEditingTeamName(null); }}
                              autoFocus
                            />
                            <button onClick={() => saveTeamName(team.id)} className="text-emerald-600 hover:text-emerald-800">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => setEditingTeamName(null)} className="text-muted-foreground hover:text-foreground">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-semibold text-sm">{team.name}</h3>
                            {!isPublished && (
                              <button
                                onClick={() => { setEditingTeamName(team.id); setEditNameValue(team.name); }}
                                className="text-muted-foreground hover:text-foreground"
                                title="Rename team"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                        <Badge className={STATUS_BADGE[team.status]}>{team.status.replace('_', ' ')}</Badge>
                      </div>

                      {/* Score & expand */}
                      <div className="flex items-center gap-3">
                        <span className={cn('text-sm font-semibold tabular-nums', SCORE_COLOR(team.overallScore))}>
                          Score: {team.overallScore}
                        </span>
                        {team.warnings.length > 0 && (
                          <span className="text-xs flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> {team.warnings.length}
                          </span>
                        )}
                        <button
                          onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Topic & supervisor row */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-1">
                      {team.topicTitle && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium text-foreground">Topic:</span> {team.topicTitle}
                        </span>
                      )}
                      {team.supervisorName && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium text-foreground">Supervisor:</span> {team.supervisorName}
                        </span>
                      )}
                      <span>{team.members.length} member{team.members.length !== 1 ? 's' : ''}</span>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0 space-y-4">
                      {/* Score breakdown */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Score Breakdown</p>
                        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-xs text-center">
                          {[
                            ['Skill', team.scores.skillScore],
                            ['Schedule', team.scores.scheduleScore],
                            ['Role', team.scores.roleScore],
                            ['Pref', team.scores.preferenceScore],
                            ['Capacity', team.scores.capacityScore],
                            ['Support', team.scores.supportCompatibilityScore],
                            ['Supervisor', team.scores.supervisorCapacityScore],
                          ].map(([label, score]) => (
                            <div key={String(label)} className="bg-muted/40 rounded p-1">
                              <p className="text-muted-foreground">{label}</p>
                              <p className={cn('font-semibold', SCORE_COLOR(score as number))}>{score}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Role coverage (Part 7) */}
                      {team.roleCoverage && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground">Role Coverage</p>
                            <span className={cn('text-xs font-semibold tabular-nums', SCORE_COLOR(team.roleCoverage.roleCoverageScore))}>
                              {team.roleCoverage.roleCoverageScore}/100
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {team.roleCoverage.coveredRoles.map((r) => (
                              <Badge key={`c-${r}`} className="bg-emerald-100 text-emerald-800 text-[10px]">
                                {roleLabel(r)}
                              </Badge>
                            ))}
                            {team.roleCoverage.weakRoles.map((r) => (
                              <Badge key={`w-${r}`} className="bg-amber-100 text-amber-800 text-[10px]">
                                {roleLabel(r)} (weak)
                              </Badge>
                            ))}
                            {team.roleCoverage.missingRoles.map((r) => (
                              <Badge key={`m-${r}`} className="bg-red-100 text-red-800 text-[10px]">
                                {roleLabel(r)} (missing)
                              </Badge>
                            ))}
                            {team.roleCoverage.coveredRoles.length === 0 &&
                              team.roleCoverage.weakRoles.length === 0 &&
                              team.roleCoverage.missingRoles.length === 0 && (
                                <span className="text-[11px] text-muted-foreground">No required roles for this team.</span>
                              )}
                          </div>
                        </div>
                      )}

                      {/* Members */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Members</p>
                        <div className="space-y-2">
                          {team.members.map((member: DraftMemberView) => (
                            <div key={member.id} className="bg-muted/20 rounded-lg px-3 py-2">
                             <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2 min-w-0">
                                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium truncate">{member.name}</span>
                                <span className={cn('text-xs tabular-nums', SCORE_COLOR(member.fitScore))}>
                                  fit: {member.fitScore}
                                </span>
                                <span
                                  className={cn('text-xs tabular-nums', SCORE_COLOR(member.roleConfidence))}
                                  title="Role suitability / confidence (0–100)"
                                >
                                  role: {member.roleConfidence}
                                </span>
                              </div>

                              {/* Role display / edit */}
                              <div className="flex items-center gap-2">
                                {editingMemberRole === member.id ? (
                                  <div className="flex items-center gap-1">
                                    <select
                                      className="text-xs border rounded px-1 py-0.5 bg-background"
                                      value={editRoleKey}
                                      onChange={(e) => setEditRoleKey(e.target.value)}
                                    >
                                      {ROLE_OPTIONS.map((r) => (
                                        <option key={r.key} value={r.key}>{r.label}</option>
                                      ))}
                                    </select>
                                    <button onClick={() => saveMemberRole(member.id)} className="text-emerald-600 hover:text-emerald-800">
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => setEditingMemberRole(null)} className="text-muted-foreground hover:text-foreground">
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Badge className="bg-muted text-muted-foreground text-xs">
                                      {member.suggestedRoleLabel ?? member.suggestedRoleKey ?? 'No role'}
                                    </Badge>
                                    {!isPublished && (
                                      <button
                                        onClick={() => {
                                          setEditingMemberRole(member.id);
                                          setEditRoleKey(member.suggestedRoleKey ?? 'team_leader');
                                        }}
                                        className="text-muted-foreground hover:text-foreground"
                                        title="Change role"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                )}

                                {/* Move member */}
                                {!isPublished && (
                                  <button
                                    onClick={() => {
                                      setMovingMember({ memberId: member.id, memberName: member.name });
                                      setMoveTargetTeamId('');
                                    }}
                                    className="text-xs text-sky-600 hover:text-sky-800 underline"
                                    title="Move to another team"
                                  >
                                    Move
                                  </button>
                                )}
                              </div>
                             </div>
                             {/* Why this role? — deterministic, privacy-safe role suitability evidence */}
                             {member.explanation && (
                               <p className="text-[11px] text-muted-foreground mt-1 pl-6">
                                 <span className="font-medium text-foreground/70">Why this role:</span> {member.explanation}
                               </p>
                             )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Warnings */}
                      {team.warnings.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Warnings</p>
                          <div className="space-y-1.5">
                            {team.warnings.map((w) => (
                              <div
                                key={w.id}
                                className="flex items-start gap-2 text-xs bg-muted/30 rounded px-3 py-2"
                              >
                                <Badge className={cn('mt-0.5 shrink-0', SEVERITY_BADGE[w.severity])}>
                                  {w.severity}
                                </Badge>
                                <div>
                                  <p className="font-medium">{w.title}</p>
                                  <p className="text-muted-foreground">{w.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Explanation */}
                      {team.explanation && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Engine Explanation</p>
                          <p className="text-xs text-muted-foreground bg-muted/20 rounded px-3 py-2 italic">
                            {team.explanation}
                          </p>
                        </div>
                      )}

                      {/* Status actions */}
                      {!isPublished && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">Mark as:</span>
                          {DRAFT_STATUS_OPTIONS.map((s) => (
                            <Button
                              key={s}
                              size="sm"
                              variant={team.status === s ? 'default' : 'outline'}
                              className="h-6 text-xs px-2"
                              onClick={() => saveTeamStatus(team.id, s)}
                            >
                              {s.replace('_', ' ')}
                            </Button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Move member modal */}
      {movingMember && runDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold">Move Member</h3>
            <p className="text-sm text-muted-foreground">
              Move <strong>{movingMember.memberName}</strong> to another team in this run.
            </p>
            <select
              className="w-full border rounded px-3 py-2 text-sm bg-background"
              value={moveTargetTeamId}
              onChange={(e) => setMoveTargetTeamId(e.target.value)}
            >
              <option value="">Select target team…</option>
              {runDetails.draftTeams
                .filter((t) => !t.members.find((m) => m.id === movingMember.memberId))
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setMovingMember(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={!moveTargetTeamId} onClick={handleMoveMember}>
                Move
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Publish section */}
      {hasCompletedRun && !isPublished && (
        <Card className="border-2 border-dashed border-emerald-300 bg-emerald-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-5 w-5 text-emerald-600" />
              Publish Draft Teams
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Publishing converts draft teams into real operational Team, TeamMember, and Project
              records. Student and batch statuses are updated automatically. This action cannot be
              reversed.
            </p>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={validating}
                className="gap-2"
              >
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Check Readiness
              </Button>
              {publishValidation && (
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={!publishValidation.valid || publishing}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {publishing ? 'Publishing…' : 'Publish Teams'}
                </Button>
              )}
            </div>

            {/* Validation result */}
            {showPublishSection && publishValidation && (
              <div className="space-y-3 mt-2">
                <div className="flex items-center gap-2">
                  {publishValidation.valid ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">All teams are ready to publish.</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-medium text-red-700">
                        {publishValidation.errors.length} issue{publishValidation.errors.length !== 1 ? 's' : ''} must be resolved.
                      </span>
                    </>
                  )}
                </div>

                {publishValidation.errors.length > 0 && (
                  <ul className="space-y-1 text-xs text-red-700 list-disc list-inside bg-red-50 rounded px-3 py-2">
                    {publishValidation.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}

                {publishValidation.warnings.length > 0 && (
                  <ul className="space-y-1 text-xs text-amber-700 list-disc list-inside bg-amber-50 rounded px-3 py-2">
                    {publishValidation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}

                {/* Team readiness checklist */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Team Readiness Checklist</p>
                  <div className="space-y-1.5">
                    {publishValidation.teamReadiness.map((t) => (
                      <div key={t.draftTeamId} className="flex items-start gap-2 text-xs">
                        {t.isReady ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="font-medium">{t.name}</span>
                          {t.issues.length > 0 && (
                            <ul className="text-red-600 list-disc list-inside mt-0.5">
                              {t.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Already published notice */}
      {isPublished && (
        <Card className="border-sky-300 bg-sky-50/40">
          <CardContent className="py-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-sky-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-sky-800">This formation run has been published.</p>
              <p className="text-xs text-sky-700 mt-0.5">
                Operational teams, members, and projects have been created. Draft data is kept for reference.
              </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto gap-1 shrink-0" onClick={() => router.push('/dashboard/coordinator')}>
              <ArrowRight className="h-3.5 w-3.5" />
              Dashboard
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No batch warning */}
      {!overview?.batch && !loading && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No formation batch found for the active term.</p>
            <p className="text-xs mt-1">
              Visit{' '}
              <button
                className="underline text-sky-600"
                onClick={() => router.push('/dashboard/coordinator/formation-setup')}
              >
                Formation Setup
              </button>{' '}
              to configure a batch.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
