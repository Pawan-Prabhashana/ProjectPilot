/**
 * Team Formation Engine — Constants & Options (Part 5)
 *
 * Deterministic, no AI. All tunables and canonical key lists live here so the
 * engine and scoring modules share one source of truth.
 *
 * Privacy: nothing in this module references CognitiveProfile or
 * privateSupportNotes. The support-preference keys below are the safe,
 * non-diagnostic work-pattern signals stored in
 * StudentFormationProfile.safeSupportPreferences.
 */

export const ALGORITHM_VERSION = 'deterministic-v1';

/** Default scoring weights, used when a batch has no FormationRuleSet. */
export const DEFAULT_WEIGHTS = {
  skillWeight: 30,
  scheduleWeight: 20,
  roleWeight: 15,
  preferenceWeight: 15,
  capacityWeight: 10,
  supportCompatibilityWeight: 5,
  supervisorCapacityWeight: 5,
} as const;

export type FormationWeights = {
  skillWeight: number;
  scheduleWeight: number;
  roleWeight: number;
  preferenceWeight: number;
  capacityWeight: number;
  supportCompatibilityWeight: number;
  supervisorCapacityWeight: number;
};

/** Deterministic draft team names. Falls back to "Draft Team N" past this list. */
export const DRAFT_TEAM_NAMES = [
  'Draft Team Alpha',
  'Draft Team Beta',
  'Draft Team Gamma',
  'Draft Team Delta',
  'Draft Team Epsilon',
  'Draft Team Zeta',
  'Draft Team Eta',
  'Draft Team Theta',
  'Draft Team Iota',
  'Draft Team Kappa',
] as const;

export function draftTeamName(index: number): string {
  return DRAFT_TEAM_NAMES[index] ?? `Draft Team ${index + 1}`;
}

/**
 * Canonical core skill keys used to judge a team's general balance when no
 * topic is assigned. Mirrors the skill keys used in the student profile UI/seed.
 */
export const CORE_SKILL_KEYS = [
  'frontend',
  'backend',
  'database',
  'ui_ux',
  'testing',
  'documentation',
  'research',
  'project_management',
  'presentation',
] as const;

/**
 * Canonical team roles the engine tries to cover. roleKey values match
 * StudentRolePreference.roleKey in the student formation profile.
 */
export const TEAM_ROLES: { key: string; label: string }[] = [
  { key: 'team_leader', label: 'Team Leader' },
  { key: 'frontend_developer', label: 'Frontend Developer' },
  { key: 'backend_developer', label: 'Backend Developer' },
  { key: 'database_designer', label: 'Database Designer' },
  { key: 'ui_ux_designer', label: 'UI/UX Designer' },
  { key: 'qa_tester', label: 'QA Tester' },
  { key: 'documentation_lead', label: 'Documentation Lead' },
  { key: 'presentation_lead', label: 'Presentation Lead' },
];

/** A required skill is "covered" at level >= this. */
export const SKILL_COVERED_LEVEL = 3;
/** A required skill is "strongly covered" at level >= this. */
export const SKILL_STRONG_LEVEL = 4;

/** Availability level → numeric weight for schedule overlap scoring. */
export const AVAILABILITY_WEIGHT: Record<string, number> = {
  PREFERRED: 3,
  AVAILABLE: 2,
  LIMITED: 1,
  UNAVAILABLE: 0,
};

/** A schedule slot counts as a usable shared slot at level >= this (AVAILABLE). */
export const SCHEDULE_USABLE_LEVEL = 2;
/** Number of shared usable slots considered "strong" schedule compatibility. */
export const SCHEDULE_STRONG_SHARED_SLOTS = 2;

/**
 * Generic, non-diagnostic support routine suggestions keyed by the safe support
 * preference flag. Used only to produce team-level routine hints — never to
 * exclude a student and never naming any diagnosis or neurodivergent label.
 */
export const SUPPORT_ROUTINE_HINTS: Record<string, string> = {
  prefers_written_instructions: 'Members prefer written instructions',
  prefers_async_communication: 'Team may benefit from async communication',
  prefers_predictable_meeting_times: 'Team may benefit from predictable meeting times',
  prefers_smaller_task_chunks: 'Break work into smaller chunks',
  prefers_clear_definition_of_done: 'Use clear definitions of done',
  prefers_visual_task_board: 'Keep a shared visual task board',
  prefers_regular_progress_checkpoints: 'Schedule regular progress checkpoints',
  prefers_advance_notice_before_changes: 'Give advance notice before changes',
  prefers_reduced_meeting_load: 'Keep the meeting load light',
  prefers_low_pressure_presentations: 'Keep presentations low-pressure',
};

/**
 * Supervisor capacity: a single supervisor receiving more than this many draft
 * teams in one run triggers SUPERVISOR_CAPACITY_RISK.
 */
export const SUPERVISOR_DRAFT_TEAM_SOFT_CAP = 2;

/** Capacity-imbalance threshold: spread (max-min) of weekly hours within a team. */
export const CAPACITY_SPREAD_WARN_HOURS = 10;
