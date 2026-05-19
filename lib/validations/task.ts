import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(120),
  description: z.string().max(2000).optional(),
  projectId: z.string().cuid(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().cuid().optional(),
  estimatedMinutes: z.number().int().min(1).max(14400).optional(), // max 10 working days
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
