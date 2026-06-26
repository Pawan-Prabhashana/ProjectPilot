/**
 * Team Formation Engine — Shared Types (Part 5)
 *
 * Internal, normalised shapes the deterministic engine works with, plus the
 * coordinator-facing result types returned by the service.
 *
 * Privacy: these types deliberately contain NO CognitiveProfile fields and NO
 * privateSupportNotes. The only support signal carried is the boolean map of
 * safe, non-diagnostic work-pattern preferences.
 */

import type {
  AvailabilityBlock,
  Weekday,
  TeamFormationRunStatus,
  DraftTeamStatus,
  FormationWarningType,
  FormationWarningSeverity,
} from '@prisma/client';
import type { FormationWeights } from './team-formation-options';

// ── Normalised inputs ─────────────────────────────────────────────────────────

export type NormalizedSkill = {
  skillKey: string;
  level: number; // 1–5
  interest: number; // 1–5
};

export type NormalizedAvailability = {
  dayOfWeek: Weekday;
  block: AvailabilityBlock;
  weight: number; // 0–3 (UNAVAILABLE..PREFERRED)
};

export type NormalizedRolePref = {
  roleKey: string;
  roleLabel: string;
  preferenceLevel: number; // 1–5
  confidenceLevel: number; // 1–5
  avoid: boolean;
};

export type NormalizedStudent = {
  studentProfileId: string;
  studentIntakeId: string;
  // Display name/email used only for deterministic sorting and team explanations.
  name: string;
  email: string;
  hasProfile: boolean;
  profileSubmitted: boolean;
  completionScore: number;
  weeklyCapacityHours: number;
  maxConcurrentTasks: number;
  skills: NormalizedSkill[];
  availability: NormalizedAvailability[];
  rolePreferences: NormalizedRolePref[];
  // Safe, non-diagnostic work-pattern flags only.
  safeSupportPreferences: Record<string, boolean>;
  // topicId -> rank (1 = first choice). Only submitted preferences.
  topicRanks: Record<string, number>;
  // Count of skills at level >= SKILL_STRONG_LEVEL (used for deterministic sort).
  strongSkillCount: number;
};

export type NormalizedTopic = {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  maxTeams: number;
  requiredSkills: string[];
  preferredSkills: string[];
  supervisorProfileId: string | null;
  supervisorName: string | null;
  // First-choice and total submitted demand (from eligible students).
  firstChoiceDemand: number;
  totalDemand: number;
};

// ── Scoring ────────────────────────────────────────────────────────────────────

export type TeamScoreBreakdown = {
  skillScore: number;
  scheduleScore: number;
  roleScore: number;
  preferenceScore: number;
  capacityScore: number;
  supportCompatibilityScore: number;
  supervisorCapacityScore: number;
  overallScore: number;
};

// ── Engine working model ────────────────────────────────────────────────────────

export type DraftWarningDraft = {
  draftTeamIndex: number | null; // resolved to draftTeamId after persistence
  studentProfileId: string | null;
  topicId: string | null;
  type: FormationWarningType;
  severity: FormationWarningSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type DraftMemberPlan = {
  student: NormalizedStudent;
  suggestedRoleKey: string | null;
  suggestedRoleLabel: string | null;
  roleConfidence: number; // 0–100
  fitScore: number; // 0–100
  explanation: string;
};

export type DraftTeamPlan = {
  index: number;
  name: string;
  topic: NormalizedTopic | null;
  supervisorProfileId: string | null;
  members: DraftMemberPlan[];
  scores: TeamScoreBreakdown;
  explanation: string;
  supportRoutineHints: string[];
};

// ── Result / summary shapes ─────────────────────────────────────────────────────

export type RunSummary = {
  totalStudents: number;
  totalDraftTeams: number;
  averageOverallScore: number;
  unassignedStudents: number;
  warningCountsBySeverity: Record<string, number>;
  warningCountsByType: Record<string, number>;
  topicUsage: { topicId: string; title: string; teamCount: number }[];
  algorithmVersion: string;
};

export type FormationRunOverview = {
  id: string;
  termId: string;
  batchId: string;
  status: TeamFormationRunStatus;
  algorithmVersion: string;
  createdByName: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  summary: RunSummary | null;
  weights: FormationWeights;
  createdAt: Date;
};

export type DraftMemberView = {
  id: string;
  studentProfileId: string;
  name: string;
  suggestedRoleKey: string | null;
  suggestedRoleLabel: string | null;
  roleConfidence: number;
  fitScore: number;
  explanation: string | null;
};

export type DraftWarningView = {
  id: string;
  type: FormationWarningType;
  severity: FormationWarningSeverity;
  title: string;
  message: string;
  draftTeamId: string | null;
  studentName: string | null;
  topicTitle: string | null;
  resolved: boolean;
};

export type DraftTeamView = {
  id: string;
  name: string;
  status: DraftTeamStatus;
  topicTitle: string | null;
  supervisorName: string | null;
  overallScore: number;
  scores: TeamScoreBreakdown;
  explanation: string | null;
  supportRoutineHints: string[];
  members: DraftMemberView[];
  warnings: DraftWarningView[];
};

export type FormationRunDetails = {
  run: FormationRunOverview;
  draftTeams: DraftTeamView[];
  runWarnings: DraftWarningView[];
};
