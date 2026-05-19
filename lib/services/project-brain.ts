/**
 * Project Brain Service
 *
 * The Project Brain is the team's persistent shared memory. It stores
 * decisions, open questions, assumptions, and supervisor feedback so
 * nothing important gets lost between consultations.
 *
 * For neurodivergent students, externalising this context is especially
 * important — it reduces cognitive load and prevents the anxiety of
 * "did we forget something important?"
 */

import { prisma } from '@/lib/db';
import type {
  DecisionLogInput,
  OpenQuestionInput,
  AssumptionInput,
} from '@/lib/validations/project-brain';

// ---------------------------------------------------------------------------
// Decision Log
// ---------------------------------------------------------------------------

export async function logDecision(userId: string, data: DecisionLogInput) {
  return prisma.decisionLog.create({
    data: { ...data, madeBy: userId },
  });
}

export async function getDecisionLog(projectId: string) {
  return prisma.decisionLog.findMany({
    where: { projectId },
    include: { author: { select: { name: true, role: true } } },
    orderBy: { madeAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Open Questions
// ---------------------------------------------------------------------------

export async function raiseQuestion(userId: string, data: OpenQuestionInput) {
  return prisma.openQuestion.create({
    data: { ...data, raisedBy: userId },
  });
}

export async function resolveQuestion(questionId: string, resolution: string) {
  return prisma.openQuestion.update({
    where: { id: questionId },
    data: { resolvedAt: new Date(), resolution },
  });
}

export async function getOpenQuestions(projectId: string) {
  return prisma.openQuestion.findMany({
    where: { projectId, resolvedAt: null },
    include: { raisedByUser: { select: { name: true } } },
    orderBy: [{ priority: 'desc' }, { raisedAt: 'asc' }],
  });
}

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

export async function logAssumption(userId: string, data: AssumptionInput) {
  return prisma.assumptionRecord.create({
    data: { ...data, loggedBy: userId },
  });
}

export async function invalidateAssumption(assumptionId: string, note: string) {
  return prisma.assumptionRecord.update({
    where: { id: assumptionId },
    data: { isInvalidated: true, invalidationNote: note },
  });
}

export async function getAssumptions(projectId: string) {
  return prisma.assumptionRecord.findMany({
    where: { projectId },
    include: { loggedByUser: { select: { name: true } } },
    orderBy: { loggedAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Feedback Memory
// ---------------------------------------------------------------------------

export async function storeFeedbackMemory(
  projectId: string,
  authorId: string,
  content: string,
  source: string = 'meeting',
  linkedBookingId?: string
) {
  return prisma.feedbackMemory.create({
    data: {
      projectId,
      authorId,
      content,
      source,
      linkedBookingId,
    },
  });
}

export async function getFeedbackMemory(projectId: string) {
  return prisma.feedbackMemory.findMany({
    where: { projectId },
    include: { author: { select: { name: true, role: true } } },
    orderBy: { recordedAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Project Brain Summary
// ---------------------------------------------------------------------------

export type ProjectBrainSummary = {
  openQuestionsCount: number;
  unresolvedAssumptions: number;
  recentDecisions: number;
  latestFeedbackDate: Date | null;
};

export async function getProjectBrainSummary(projectId: string): Promise<ProjectBrainSummary> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [openQuestionsCount, unresolvedAssumptions, recentDecisions, latestFeedback] =
    await Promise.all([
      prisma.openQuestion.count({ where: { projectId, resolvedAt: null } }),
      prisma.assumptionRecord.count({ where: { projectId, isInvalidated: false } }),
      prisma.decisionLog.count({
        where: { projectId, madeAt: { gte: thirtyDaysAgo } },
      }),
      prisma.feedbackMemory.findFirst({
        where: { projectId },
        orderBy: { recordedAt: 'desc' },
        select: { recordedAt: true },
      }),
    ]);

  return {
    openQuestionsCount,
    unresolvedAssumptions,
    recentDecisions,
    latestFeedbackDate: latestFeedback?.recordedAt ?? null,
  };
}
