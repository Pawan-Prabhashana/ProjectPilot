/**
 * Explainable Project Intelligence Metrics — barrel export
 *
 * Import from this file to access all metric calculators and types.
 */

export type {
  ScoreStatus,
  ScoreFactor,
  ExplainableScore,
  TaskAmbiguityDetail,
  TeamAmbiguitySummary,
  FairnessMemberSnapshot,
} from './types';

export { calculateCognitiveLoadScore } from './cognitive-load';
export { calculateTeamHealthScore }    from './team-health';
export { calculateTeamAmbiguity, scoreTaskAmbiguity, VAGUE_TERMS } from './task-ambiguity';
export type { TaskInput }              from './task-ambiguity';
export { calculateTeamFairnessScore }  from './team-fairness';
export type { TeamFairnessResult }     from './team-fairness';
