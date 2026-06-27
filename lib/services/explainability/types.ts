/**
 * Explainability Layer — Shared Types (Part 12)
 *
 * Used across deterministic and optional AI-enhanced explanation generation.
 * Privacy: Never includes CognitiveProfile, privateSupportNotes, or diagnosis language.
 */

export type ExplainabilityMode = 'deterministic' | 'ai_enhanced';

export type ExplainabilityResult = {
  mode: ExplainabilityMode;
  title: string;
  summary: string;
  keyReasons: string[];
  risks: string[];
  recommendedActions: string[];
  privacyNote?: string;
};

export type TeamFormationExplainInput = {
  runId: string;
};

export type DraftTeamExplainInput = {
  draftTeamId: string;
};

export type RoleAssignmentExplainInput = {
  draftTeamMemberId: string;
};

export type TaskRecommendationExplainInput = {
  teamId: string;
  taskTitle?: string;
  requiredSkills?: string[];
  estimatedMinutes?: number;
  candidateName?: string;
  skillScore?: number;
  roleScore?: number;
  capacityScore?: number;
  currentLoadScore?: number;
  reasons?: string[];
  warnings?: string[];
  riskLevel?: string;
};

export type ConflictExplainInput = {
  termId?: string;
};

export type StudentNextStepsExplainInput = {
  userId: string;
};
