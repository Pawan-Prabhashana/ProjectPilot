/**
 * Capacity-Aware Task Allocation — Constants & Options (Part 8)
 *
 * Deterministic, no AI. All tunables live here so the scoring module and
 * service share one source of truth. Mirrors the structure of
 * lib/formation/team-formation-options.ts (Part 5) and the role catalogue in
 * lib/formation/role-suitability.ts (Part 7).
 */

/** Deterministic weighted scoring weights (sum to 100). */
export const ALLOCATION_WEIGHTS = {
  skillMatchWeight: 30,
  roleMatchWeight: 20,
  capacityAvailableWeight: 20,
  currentLoadFairnessWeight: 15,
  dueDateFeasibilityWeight: 10,
  supportFitWeight: 5,
} as const;

export type AllocationWeights = typeof ALLOCATION_WEIGHTS;

/** Canonical skill keys a task's requiredSkills can reference (mirrors Part 3/5/7). */
export const TASK_SKILL_KEYS = [
  'frontend',
  'backend',
  'database',
  'ui_ux',
  'testing',
  'documentation',
  'research',
  'presentation',
  'project_management',
  'ai_ml',
  'mobile_development',
  'devops',
] as const;

/** A skill is "strong" at this level, "acceptable" at SKILL_ACCEPTABLE_LEVEL. */
export const SKILL_STRONG_LEVEL = 4;
export const SKILL_ACCEPTABLE_LEVEL = 3;

/** Default effort assumed when a task has no estimatedMinutes set. */
export const DEFAULT_TASK_MINUTES = 60;

/** Default weekly capacity assumed if a student has no formation profile. */
export const DEFAULT_WEEKLY_CAPACITY_HOURS = 8;
export const DEFAULT_MAX_CONCURRENT_TASKS = 2;

/** Task statuses counted as "active" (still consuming a member's capacity). */
export const ACTIVE_TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW'] as const;

/**
 * Generic, non-diagnostic task-guidance hints keyed by the safe support
 * preference flag. Used only to suggest task formatting — never to exclude a
 * candidate or to reference diagnosis/neurodivergent labels.
 */
export const TASK_GUIDANCE_HINTS: Record<string, string> = {
  prefers_clear_definition_of_done: 'Add a clear definition of done to this task',
  prefers_smaller_task_chunks: 'Consider breaking this task into smaller chunks',
  prefers_written_instructions: 'Provide written, step-by-step instructions',
  prefers_regular_progress_checkpoints: 'Schedule a regular progress checkpoint for this task',
};

/** A task is "high cognitive load" at or above this level (1-5 scale). */
export const HIGH_COGNITIVE_LOAD_THRESHOLD = 4;

/** Risk thresholds for projected capacity utilization (assignedHours / weeklyCapacityHours). */
export const UTILIZATION_LOW_MAX = 0.8;
export const UTILIZATION_HIGH_MIN = 1.3;

/** A member at or above this active task count (vs. their own max) is considered saturated. */
export const SATURATION_BUFFER = 1;
