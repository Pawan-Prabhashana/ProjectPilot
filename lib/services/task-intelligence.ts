/**
 * Task Intelligence Service
 *
 * Provides task-level analysis: decomposition, ambiguity detection,
 * and dependency tracking. These are the micro-level interventions that
 * help neurodivergent students get started and avoid stalls.
 *
 * Key behaviours:
 * - A task with no description is almost always ambiguous → auto-flag it.
 * - Long tasks (>4h estimated) benefit from decomposition → generate steps.
 * - Dependencies that aren't documented create invisible blockers.
 */

import { prisma } from '@/lib/db';
import type { DependencyType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Task Decomposition
// ---------------------------------------------------------------------------

export type DecompositionStep = {
  title: string;
  estimatedMinutes: number;
  orderIndex: number;
  done: boolean;
};

/**
 * Generates a rule-based step-by-step breakdown for a task.
 * In Phase 2, this will call an LLM with the task title + description
 * and the team's project context to generate richer steps.
 */
export async function generateTaskDecomposition(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: { select: { title: true } } },
  });

  if (!task) throw new Error(`Task ${taskId} not found`);

  // Simple heuristic decomposition based on task title patterns.
  // Replace this block with an LLM call in Phase 2.
  const steps = generateRuleBasedSteps(task.title, task.description, task.estimatedMinutes);

  const totalMinutes = steps.reduce((acc, s) => acc + s.estimatedMinutes, 0);

  return prisma.taskDecomposition.upsert({
    where: { taskId },
    update: { steps, estimatedTotalMinutes: totalMinutes, updatedAt: new Date() },
    create: { taskId, steps, estimatedTotalMinutes: totalMinutes },
  });
}

function generateRuleBasedSteps(
  title: string,
  description: string | null,
  estimatedMinutes: number | null
): DecompositionStep[] {
  const lower = title.toLowerCase();
  const base = estimatedMinutes ?? 60;
  const perStep = Math.round(base / 3);

  // Keyword-based pattern matching for common academic task types
  if (lower.includes('report') || lower.includes('write') || lower.includes('draft')) {
    return [
      { title: 'Review existing materials and understand scope', estimatedMinutes: perStep, orderIndex: 0, done: false },
      { title: 'Create an outline with section headings', estimatedMinutes: Math.round(perStep * 0.5), orderIndex: 1, done: false },
      { title: 'Write first draft (content, not formatting)', estimatedMinutes: perStep, orderIndex: 2, done: false },
      { title: 'Review, refine, and check against rubric', estimatedMinutes: Math.round(perStep * 0.5), orderIndex: 3, done: false },
    ];
  }

  if (lower.includes('implement') || lower.includes('code') || lower.includes('build') || lower.includes('develop')) {
    return [
      { title: 'Understand the requirements and acceptance criteria', estimatedMinutes: Math.round(perStep * 0.5), orderIndex: 0, done: false },
      { title: 'Design the approach (pseudocode or diagram)', estimatedMinutes: perStep, orderIndex: 1, done: false },
      { title: 'Implement the core functionality', estimatedMinutes: perStep, orderIndex: 2, done: false },
      { title: 'Test, fix edge cases, and document', estimatedMinutes: perStep, orderIndex: 3, done: false },
    ];
  }

  if (lower.includes('research') || lower.includes('review') || lower.includes('investigate')) {
    return [
      { title: 'Define the specific question to answer', estimatedMinutes: Math.round(perStep * 0.5), orderIndex: 0, done: false },
      { title: 'Gather and skim relevant sources', estimatedMinutes: perStep, orderIndex: 1, done: false },
      { title: 'Extract key points and take notes', estimatedMinutes: perStep, orderIndex: 2, done: false },
      { title: 'Summarise findings for the team', estimatedMinutes: Math.round(perStep * 0.5), orderIndex: 3, done: false },
    ];
  }

  // Fallback: generic 3-step approach
  return [
    { title: 'Clarify what "done" looks like for this task', estimatedMinutes: Math.round(perStep * 0.5), orderIndex: 0, done: false },
    { title: 'Complete the main work', estimatedMinutes: perStep, orderIndex: 1, done: false },
    { title: 'Review and mark complete', estimatedMinutes: Math.round(perStep * 0.5), orderIndex: 2, done: false },
  ];
}

// ---------------------------------------------------------------------------
// Ambiguity Detection
// ---------------------------------------------------------------------------

/**
 * Checks a task for common ambiguity patterns and creates a flag if found.
 * Idempotent — won't duplicate flags for the same entity.
 */
export async function checkTaskAmbiguity(taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return false;

  const ambiguityReasons: string[] = [];

  if (!task.description || task.description.trim().length < 20) {
    ambiguityReasons.push('Task has no meaningful description — unclear what to do.');
  }
  if (!task.dueDate) {
    ambiguityReasons.push('No due date set — unclear when this is expected.');
  }
  if (!task.assigneeId) {
    ambiguityReasons.push('No assignee — unclear who is responsible.');
  }
  if (!task.estimatedMinutes) {
    ambiguityReasons.push('No effort estimate — unclear how much work is involved.');
  }

  if (ambiguityReasons.length === 0) return false;

  // Only create a flag if one doesn't already exist for this task
  const existingFlag = await prisma.ambiguityFlag.findFirst({
    where: { entityType: 'TASK', entityId: taskId, resolvedAt: null },
    select: { id: true },
  });

  if (existingFlag) return true;

  await prisma.ambiguityFlag.create({
    data: {
      entityType: 'TASK',
      entityId: taskId,
      description: ambiguityReasons.join(' '),
      flaggedBy: 'system',
      severity: ambiguityReasons.length >= 3 ? 'HIGH' : 'MEDIUM',
    },
  });

  return true;
}

// ---------------------------------------------------------------------------
// Dependency Links
// ---------------------------------------------------------------------------

export async function linkTaskDependency(
  sourceTaskId: string,
  targetTaskId: string,
  type: DependencyType = 'BLOCKS',
  discoveredBy: string = 'user',
  note?: string
) {
  return prisma.dependencyLink.upsert({
    where: { sourceTaskId_targetTaskId: { sourceTaskId, targetTaskId } },
    update: { dependencyType: type, note },
    create: { sourceTaskId, targetTaskId, dependencyType: type, discoveredBy, note },
  });
}

export async function getTaskDependencies(taskId: string) {
  const [outgoing, incoming] = await Promise.all([
    prisma.dependencyLink.findMany({
      where: { sourceTaskId: taskId },
      include: { targetTask: { select: { id: true, title: true, status: true } } },
    }),
    prisma.dependencyLink.findMany({
      where: { targetTaskId: taskId },
      include: { sourceTask: { select: { id: true, title: true, status: true } } },
    }),
  ]);
  return { outgoing, incoming };
}
