'use client';

/**
 * Task Allocation Panel (Part 8) — coordinator/leader/supervisor-facing.
 *
 * Computes and displays deterministic, explainable assignee recommendations
 * for a draft task. Never auto-assigns — the human always clicks "Use this
 * candidate" to apply a suggestion, and manual assignee selection always
 * remains available alongside it.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskAllocationRecommendationResult, TaskAssigneeRecommendation } from '@/lib/task-allocation/types';

type DraftTaskFields = {
  teamId: string;
  requiredSkills: string[];
  estimatedMinutes: number | null;
  cognitiveLoad: number | null;
  dueDate: string | null;
  priority: string;
};

type Props = {
  draft: DraftTaskFields;
  appliedUserId: string | null;
  onApply: (rec: TaskAssigneeRecommendation, suggestedRoleKey: string | null) => void;
};

const RISK_BADGE: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200',
  HIGH: 'bg-red-100 text-red-800 border-red-200',
};

export function TaskAllocationPanel({ draft, appliedUserId, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TaskAllocationRecommendationResult | null>(null);

  const getRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/task-allocation/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: draft.teamId,
          requiredSkills: draft.requiredSkills,
          estimatedMinutes: draft.estimatedMinutes,
          cognitiveLoad: draft.cognitiveLoad,
          dueDate: draft.dueDate,
          priority: draft.priority,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to get recommendations.');
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get recommendations.');
    } finally {
      setLoading(false);
    }
  }, [draft]);

  const top3 = result ? result.candidates.slice(0, 3) : [];

  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <p className="text-sm font-medium text-foreground">Allocation recommendations</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={getRecommendations} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? 'Scoring…' : result ? 'Refresh' : 'Get recommendations'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Deterministic, explainable — based on skills, role fit, capacity, current workload, and due
        date. Nothing is assigned automatically; pick a candidate below or assign manually.
      </p>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {result && result.notes.length > 0 && (
        <div className="space-y-1">
          {result.notes.map((n, i) => (
            <p key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">{n}</p>
          ))}
        </div>
      )}

      {top3.length > 0 && (
        <div className="space-y-2">
          {top3.map((c, i) => (
            <CandidateCard
              key={c.userId}
              candidate={c}
              rank={i + 1}
              applied={appliedUserId === c.userId}
              onApply={() => onApply(c, result?.suggestedRoleKey ?? null)}
            />
          ))}
        </div>
      )}

      {result && top3.length === 0 && (
        <p className="text-xs text-muted-foreground">No eligible team members found.</p>
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  rank,
  applied,
  onApply,
}: {
  candidate: TaskAssigneeRecommendation;
  rank: number;
  applied: boolean;
  onApply: () => void;
}) {
  return (
    <div className={cn('rounded-lg border p-3 bg-background', applied ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-border')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{candidate.name}</span>
            {candidate.recommended && rank === 1 && (
              <Badge className="bg-violet-100 text-violet-800 text-[10px]">Top pick</Badge>
            )}
            <Badge variant="outline" className={cn('text-[10px]', RISK_BADGE[candidate.riskLevel])}>
              {candidate.riskLevel} risk
            </Badge>
            {applied && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                <CheckCircle2 className="h-3 w-3" /> Applied
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Score {candidate.score}/100 · skill {candidate.skillScore} · role {candidate.roleScore} · capacity {candidate.capacityScore} · load {candidate.currentLoadScore} · due-date {candidate.dueDateScore}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {candidate.currentAssignedHours}h current → {candidate.projectedAssignedHours}h projected ({candidate.availableCapacityHours}h available before this task)
          </p>
        </div>
        <Button type="button" size="sm" variant={applied ? 'secondary' : 'default'} onClick={onApply} className="shrink-0">
          {applied ? 'Selected' : 'Use this candidate'}
        </Button>
      </div>

      {candidate.reasons.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground list-disc list-inside">
          {candidate.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      {candidate.warnings.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-xs text-amber-700 list-disc list-inside">
          {candidate.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}
