'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Database, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetricStatusBadge } from './metric-status-badge';
import { ScoreFactorList } from './score-factor-list';
import type { ExplainableScore, ScoreStatus } from '@/lib/metrics/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Status-aware label overrides so health scores say "Healthy"/"At Risk"
 * and fairness scores say "Balanced"/"Visible Imbalance" etc.
 */
const HEALTH_LABELS: Partial<Record<ScoreStatus, string>> = {
  LOW: 'Healthy', BALANCED: 'Stable', WATCH: 'Watch',
  HIGH: 'At Risk', CRITICAL: 'Critical', UNKNOWN: 'Unknown',
};

const FAIRNESS_LABELS: Partial<Record<ScoreStatus, string>> = {
  LOW: 'Balanced', BALANCED: 'Low Concern', WATCH: 'Watch',
  HIGH: 'Imbalance', CRITICAL: 'Severe Imbalance', UNKNOWN: 'Unknown',
};

const LOAD_LABELS: Partial<Record<ScoreStatus, string>> = {
  LOW: 'Light', BALANCED: 'Balanced', WATCH: 'Building',
  HIGH: 'High', CRITICAL: 'Critical', UNKNOWN: 'Unknown',
};

const AMBIGUITY_LABELS: Partial<Record<ScoreStatus, string>> = {
  LOW: 'Clear', BALANCED: 'Minor Gaps', WATCH: 'Notable Gaps',
  HIGH: 'Unclear', CRITICAL: 'Very Unclear', UNKNOWN: 'Unknown',
};

function getStatusLabel(key: string, status: ScoreStatus): string {
  const map: Record<string, Partial<Record<ScoreStatus, string>>> = {
    team_health:   HEALTH_LABELS,
    team_fairness: FAIRNESS_LABELS,
    cognitive_load: LOAD_LABELS,
    task_ambiguity: AMBIGUITY_LABELS,
    team_ambiguity: AMBIGUITY_LABELS,
  };
  return map[key]?.[status] ?? status;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  HIGH:   'High confidence',
  MEDIUM: 'Medium confidence',
  LOW:    'Low confidence — limited data',
};

// ─── Score gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score, maxScore, status }: { score: number; maxScore: number; status: ScoreStatus }) {
  const pct = Math.round((score / maxScore) * 100);
  const statusColor: Record<ScoreStatus, string> = {
    LOW:      'text-emerald-600',
    BALANCED: 'text-sky-600',
    WATCH:    'text-amber-600',
    HIGH:     'text-orange-600',
    CRITICAL: 'text-red-600',
    UNKNOWN:  'text-muted-foreground',
  };
  return (
    <div className="flex items-baseline gap-1">
      <span className={cn('text-2xl font-bold tabular-nums', statusColor[status])}>
        {score}
      </span>
      <span className="text-sm text-muted-foreground font-medium">/ {maxScore}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  metric: ExplainableScore;
  /** Show a compact version (no expand/collapse). Default: false */
  compact?: boolean;
  className?: string;
};

export function ExplainableScoreCard({ metric, compact = false, className }: Props) {
  const [expanded, setExpanded] = useState(false);

  const statusLabel = getStatusLabel(metric.key, metric.status);

  if (metric.score === null || metric.status === 'UNKNOWN') {
    return (
      <div className={cn('rounded-xl border bg-muted/20 px-4 py-4', className)}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-foreground">{metric.label}</span>
          <MetricStatusBadge status="UNKNOWN" label="No data" size="sm" />
        </div>
        <p className="text-xs text-muted-foreground">{metric.summary}</p>
        {metric.recommendedAction && (
          <p className="mt-2 text-xs text-muted-foreground italic">{metric.recommendedAction}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border bg-card', className)}>
      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{metric.label}</span>
              <MetricStatusBadge
                status={metric.status}
                label={statusLabel}
                size="sm"
              />
            </div>
            <ScoreGauge score={metric.score} maxScore={metric.maxScore} status={metric.status} />
          </div>
        </div>

        {/* Summary */}
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          {metric.summary}
        </p>

        {/* Recommended action */}
        {metric.recommendedAction && (
          <div className="mt-2.5 rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs text-foreground leading-relaxed">
              <span className="font-medium">Action: </span>
              {metric.recommendedAction}
            </p>
          </div>
        )}
      </div>

      {/* Expandable details */}
      {!compact && metric.factors.length > 0 && (
        <>
          <div className="border-t px-4 py-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={expanded}
            >
              <span>View explanation</span>
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {expanded && (
            <div className="border-t px-4 pb-4 pt-3 space-y-4">
              {/* Factors */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Factors
                </p>
                <ScoreFactorList factors={metric.factors} maxItems={6} />
              </div>

              {/* Data sources */}
              {metric.dataSources.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    Data sources
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {metric.dataSources.map((src) => (
                      <span
                        key={src}
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence + timestamp */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {CONFIDENCE_LABEL[metric.confidence]}
                </span>
                <span>
                  {new Date(metric.calculatedAt).toLocaleTimeString('en-GB', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
