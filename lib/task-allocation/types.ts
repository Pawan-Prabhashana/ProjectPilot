/**
 * Capacity-Aware Task Allocation — Shared Types (Part 8)
 *
 * Internal normalised shapes the allocation engine works with, plus the
 * coordinator/supervisor/leader-facing result types returned by the service.
 *
 * Privacy: these types deliberately contain NO CognitiveProfile fields and NO
 * privateSupportNotes. The only support signal carried is the boolean map of
 * safe, non-diagnostic work-pattern preferences, used only for task-guidance text.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// ── Normalised member context ───────────────────────────────────────────────────

export type MemberSkill = {
  skillKey: string;
  level: number; // 1–5
};

export type MemberAllocationContext = {
  userId: string;
  studentProfileId: string;
  name: string;
  email: string;
  teamMemberRole: 'MEMBER' | 'LEADER' | 'CO_LEADER';
  /** Resolved role key: published Part 7 suggested role, else top non-avoided StudentRolePreference. */
  resolvedRoleKey: string | null;
  resolvedRoleLabel: string | null;
  skills: MemberSkill[];
  weeklyCapacityHours: number;
  maxConcurrentTasks: number;
  hasFormationProfile: boolean;
  /** Safe, non-diagnostic work-pattern flags only. */
  safeSupportPreferences: Record<string, boolean>;
  /** Active (incomplete) task count assigned to this user within the team's project. */
  activeTaskCount: number;
  /** Sum of estimatedMinutes (or default) across active tasks, in hours. */
  currentAssignedHours: number;
};

export type TaskAllocationContext = {
  teamId: string;
  projectId: string | null;
  members: MemberAllocationContext[];
  teamMeanLoadRatio: number; // average (currentAssignedHours / weeklyCapacityHours) across members
};

// ── Input ────────────────────────────────────────────────────────────────────────

export type TaskAllocationInput = {
  teamId: string;
  projectId?: string | null;
  taskId?: string | null; // when recommending for an existing task
  title?: string;
  description?: string | null;
  estimatedMinutes?: number | null;
  cognitiveLoad?: number | null; // 1–5
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string | Date | null;
  requiredSkills?: string[];
  preferredSkills?: string[];
  suggestedRoleKey?: string | null;
};

// ── Output ───────────────────────────────────────────────────────────────────────

export type AllocationScoreBreakdown = {
  skillScore: number;
  roleScore: number;
  capacityScore: number;
  currentLoadScore: number;
  dueDateScore: number;
  supportFitScore: number;
};

export type TaskAssigneeRecommendation = {
  userId: string;
  studentProfileId: string;
  name: string;
  email: string;
  score: number;
  skillScore: number;
  roleScore: number;
  capacityScore: number;
  currentLoadScore: number;
  dueDateScore: number;
  supportFitScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
  warnings: string[];
  availableCapacityHours: number;
  currentAssignedHours: number;
  projectedAssignedHours: number;
  recommended: boolean;
};

export type TaskAllocationRecommendationResult = {
  suggestedRoleKey: string | null;
  candidates: TaskAssigneeRecommendation[];
  /** Run-level notes, e.g. missing-skill or no-eligible-member warnings. */
  notes: string[];
};

// ── Team workload overview ──────────────────────────────────────────────────────

export type MemberWorkloadOverview = {
  userId: string;
  studentProfileId: string;
  name: string;
  email: string;
  weeklyCapacityHours: number;
  currentAssignedHours: number;
  remainingCapacityHours: number;
  activeTaskCount: number;
  maxConcurrentTasks: number;
  overloadRisk: RiskLevel;
  roleKey: string | null;
  roleLabel: string | null;
  skillCoverageSummary: string;
  recommendationNote: string;
};

export type TeamWorkloadOverview = {
  teamId: string;
  projectId: string | null;
  members: MemberWorkloadOverview[];
};
