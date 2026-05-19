import { z } from 'zod';

export const decisionLogSchema = z.object({
  projectId: z.string().cuid(),
  title: z.string().min(3).max(200),
  rationale: z.string().min(10).max(3000),
  impact: z.string().max(500).optional(),
  linkedTaskId: z.string().cuid().optional(),
});

export const openQuestionSchema = z.object({
  projectId: z.string().cuid(),
  question: z.string().min(10).max(1000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

export const assumptionSchema = z.object({
  projectId: z.string().cuid(),
  statement: z.string().min(10).max(1000),
  linkedMilestoneId: z.string().cuid().optional(),
});

export type DecisionLogInput = z.infer<typeof decisionLogSchema>;
export type OpenQuestionInput = z.infer<typeof openQuestionSchema>;
export type AssumptionInput = z.infer<typeof assumptionSchema>;
