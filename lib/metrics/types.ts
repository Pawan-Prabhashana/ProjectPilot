/**
 * Shared types for the explainable project intelligence metrics system.
 *
 * Every metric produced by this module follows the ExplainableScore contract
 * so dashboards can render scores, explanations, and recommendations
 * consistently regardless of which metric they are displaying.
 *
 * Design principle: a number alone is meaningless. Every score MUST come with
 * enough context for the reader to understand why, what data was used, and
 * what to do next.
 */

// ─── Core status levels ──────────────────────────────────────────────────────

/**
 * Status labels that describe where a metric sits in its range.
 * Use context-appropriate labels in UI (e.g. "Healthy" instead of "LOW" for
 * health scores; "Balanced" instead of "LOW" for fairness scores).
 */
export type ScoreStatus =
  | 'LOW'       // Good: low risk, low load, low ambiguity
  | 'BALANCED'  // Acceptable: within healthy range
  | 'WATCH'     // Needs monitoring: starting to accumulate
  | 'HIGH'      // Concerning: action recommended
  | 'CRITICAL'  // Urgent: immediate action required
  | 'UNKNOWN';  // Not enough data to calculate

// ─── Factor types ────────────────────────────────────────────────────────────

/**
 * A single data point that contributed to a score calculation.
 * The `impact` field indicates whether it made the score better, worse,
 * or was informational.
 */
export type ScoreFactor = {
  /** Short human-readable label shown in the factor list */
  label: string;
  /** The measured value (count, boolean label, etc.) */
  value: number | string;
  /** Whether this factor increased risk (+), decreased risk (-), or is neutral */
  impact: 'positive' | 'negative' | 'neutral';
  /** How much this factor contributed to the score (optional, 0–100) */
  weight?: number;
  /** Plain-English explanation of what this factor means */
  explanation: string;
};

// ─── Main explainable score type ─────────────────────────────────────────────

/**
 * The canonical output type for all four metrics:
 *   - Cognitive Load Score
 *   - Team Health Score
 *   - Task Ambiguity Score
 *   - Team Fairness Score
 *
 * Consumers should render all fields — not just the number.
 */
export type ExplainableScore = {
  /** Machine key, e.g. "cognitive_load", "team_health" */
  key: string;
  /** Human-readable title shown in card headers */
  label: string;
  /** Numerical score. null = not enough data. */
  score: number | null;
  /** Maximum possible score (typically 100) */
  maxScore: number;
  /** Status classification based on score thresholds */
  status: ScoreStatus;
  /** 1–2 sentence summary explaining the score */
  summary: string;
  /** Ordered list of factors that shaped the score */
  factors: ScoreFactor[];
  /** Labels of the data sources used in this calculation */
  dataSources: string[];
  /** What the user should do next, given the current score */
  recommendedAction: string;
  /** Confidence in the score based on data availability */
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  /** ISO string of when the score was computed */
  calculatedAt: string;
};

// ─── Per-task ambiguity detail ────────────────────────────────────────────────

/**
 * Full ambiguity analysis for a single task.
 * Used on task cards and the task detail page.
 */
export type TaskAmbiguityDetail = {
  taskId: string;
  taskTitle: string;
  score: ExplainableScore;
  suggestedFixes: string[];
};

// ─── Team ambiguity summary ───────────────────────────────────────────────────

/**
 * Aggregated ambiguity picture for a whole team/project.
 * Used on leader and supervisor dashboards.
 */
export type TeamAmbiguitySummary = {
  teamId: string;
  totalActiveTasks: number;
  ambiguousTaskCount: number;
  criticalCount: number;
  highCount: number;
  overallScore: ExplainableScore;
  topItems: TaskAmbiguityDetail[];
};

// ─── Fairness member snapshot ─────────────────────────────────────────────────

export type FairnessMemberSnapshot = {
  userId: string;
  name: string | null;
  activeTasks: number;
  overdueTasks: number;
  completedThisWeek: number;
  contributionLogs: number;
  estimatedHoursRemaining: number;
  shareOfTeamWork: number;        // 0–1 proportion of visible work
  isConcentrated: boolean;        // carrying >1.75× mean
};
