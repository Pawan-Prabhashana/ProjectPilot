import { z } from 'zod';

export const bookConsultationSchema = z.object({
  availabilityId: z.string().cuid(),
  teamId: z.string().cuid(),
  slotStart: z.string().datetime(),
  slotEnd: z.string().datetime(),
  agenda: z.string().max(1500).optional(),
});

export const meetingNoteSchema = z.object({
  bookingId: z.string().cuid(),
  content: z.string().min(10, 'Notes must be at least 10 characters').max(5000),
  privateNote: z.string().max(2000).optional(),
});

export const availabilitySchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  slotMinutes: z.number().int().min(15).max(120).default(30),
  isRecurring: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

export type BookConsultationInput = z.infer<typeof bookConsultationSchema>;
export type MeetingNoteInput = z.infer<typeof meetingNoteSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
