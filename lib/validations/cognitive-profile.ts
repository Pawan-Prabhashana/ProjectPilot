import { z } from 'zod';

export const cognitiveProfileSchema = z.object({
  communicationStyle: z
    .enum(['DIRECT', 'DETAILED', 'VISUAL_FIRST', 'STEP_BY_STEP', 'NARRATIVE'])
    .default('STEP_BY_STEP'),
  reminderStyle: z
    .enum(['GENTLE', 'STRUCTURED', 'DEADLINE_FOCUSED', 'MINIMAL'])
    .default('STRUCTURED'),
  preferredMeetingFormat: z
    .enum(['ASYNC_PREFERRED', 'SHORT_SYNC', 'STRUCTURED_AGENDA', 'FLEXIBLE'])
    .default('STRUCTURED_AGENDA'),
  overloadSensitivity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  pacingPreference: z.enum(['STEADY', 'SPRINT_REST', 'FLEXIBLE']).default('STEADY'),
  ambiguityComfort: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  focusDurationMinutes: z.number().int().min(5).max(240).nullable().optional(),
  supportMode: z.enum(['MINIMAL', 'MODERATE', 'COMPREHENSIVE']).default('MODERATE'),
  preferredWorkingHours: z
    .object({
      preferredSlots: z.array(z.enum(['morning', 'afternoon', 'evening', 'night'])).optional(),
      avoidSlots: z.array(z.enum(['morning', 'afternoon', 'evening', 'night'])).optional(),
    })
    .nullable()
    .optional(),
});

export type CognitiveProfileInput = z.infer<typeof cognitiveProfileSchema>;
