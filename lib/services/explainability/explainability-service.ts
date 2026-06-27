/**
 * Explainability Service (Part 12)
 *
 * Orchestrates deterministic explanations and optionally enhances with AI.
 * The system ALWAYS works without an AI key — deterministic mode is the default.
 *
 * Environment variables (all optional):
 *   EXPLAINABILITY_MODE="deterministic"   (default, set to "ai_enhanced" to enable AI)
 *   AI_PROVIDER=""                        (currently unused; reserved for future integration)
 *   AI_API_KEY=""                         (not required; graceful fallback if absent)
 *
 * Privacy: Never reads CognitiveProfile or privateSupportNotes.
 */

import type {
  ExplainabilityResult,
  TaskRecommendationExplainInput,
} from './types';
import {
  deterministicExplainTeamFormationRun,
  deterministicExplainDraftTeam,
  deterministicExplainRoleAssignment,
  deterministicExplainTaskRecommendation,
  deterministicExplainConflicts,
  deterministicExplainStudentNextSteps,
} from './deterministic-explanations';

function isAIEnabled(): boolean {
  return (
    process.env.EXPLAINABILITY_MODE === 'ai_enhanced' &&
    typeof process.env.AI_API_KEY === 'string' &&
    process.env.AI_API_KEY.trim().length > 0
  );
}

/**
 * Explain a completed team formation run.
 */
export async function explainTeamFormationRun(
  runId: string
): Promise<ExplainabilityResult> {
  return deterministicExplainTeamFormationRun(runId);
}

/**
 * Explain why a specific draft team was formed as-is.
 */
export async function explainDraftTeam(
  draftTeamId: string
): Promise<ExplainabilityResult> {
  return deterministicExplainDraftTeam(draftTeamId);
}

/**
 * Explain why a specific role was assigned to a draft team member.
 */
export async function explainRoleAssignment(
  draftTeamMemberId: string
): Promise<ExplainabilityResult> {
  return deterministicExplainRoleAssignment(draftTeamMemberId);
}

/**
 * Explain why a candidate is recommended for a task.
 * Input is lightweight — can be called from task allocation panels directly.
 */
export function explainTaskRecommendation(
  input: TaskRecommendationExplainInput
): ExplainabilityResult {
  return deterministicExplainTaskRecommendation(input);
}

/**
 * Explain the current state of the conflict dashboard for an academic term.
 */
export async function explainConflictDashboard(
  termId?: string
): Promise<ExplainabilityResult> {
  return deterministicExplainConflicts(termId);
}

/**
 * Explain a student's current position in the capstone journey and next steps.
 */
export async function explainStudentNextSteps(
  userId: string
): Promise<ExplainabilityResult> {
  return deterministicExplainStudentNextSteps(userId);
}

/**
 * Utility: returns a mode label for display.
 */
export function getExplainabilityModeLabel(): 'Deterministic explanation' | 'AI-enhanced explanation' {
  return isAIEnabled() ? 'AI-enhanced explanation' : 'Deterministic explanation';
}

export type { ExplainabilityResult, TaskRecommendationExplainInput };
