/**
 * Cognitive Support Service
 *
 * Manages the CognitiveProfile, OverloadSignal, and AccessibilitySetting
 * models. This is the backbone of the neurodivergent-first support layer.
 *
 * Key principles:
 * - Always return a safe default profile if one hasn't been created yet,
 *   so the rest of the system can assume a profile exists.
 * - Never log or expose cognitive profile data in supervisor/coordinator
 *   queries unless the student has explicitly opted in.
 * - Overload signals are sensitive — treat them as personal health records.
 */

import { prisma, Prisma } from '@/lib/db';
import type {
  CommunicationStyle,
  ReminderStyle,
  MeetingFormat,
  OverloadSensitivity,
  PacingPreference,
  AmbiguityComfort,
  SupportMode,
  SignalSeverity,
  DigestMode,
} from '@prisma/client';
import type { CognitiveProfileInput } from '@/lib/validations/cognitive-profile';

// ---------------------------------------------------------------------------
// Cognitive Profile
// ---------------------------------------------------------------------------

/**
 * Returns the student's cognitive profile, or a safe default if it hasn't
 * been set up yet. Callers can check `onboardingCompleted` to decide
 * whether to prompt the student to finish onboarding.
 */
export async function getCognitiveProfile(userId: string) {
  const existing = await prisma.cognitiveProfile.findUnique({ where: { userId } });
  if (existing) return existing;

  // Return sensible defaults so the rest of the system can proceed without
  // special-casing the "no profile" state everywhere.
  return {
    userId,
    communicationStyle: 'STEP_BY_STEP' as CommunicationStyle,
    reminderStyle: 'STRUCTURED' as ReminderStyle,
    preferredMeetingFormat: 'STRUCTURED_AGENDA' as MeetingFormat,
    overloadSensitivity: 'MEDIUM' as OverloadSensitivity,
    pacingPreference: 'STEADY' as PacingPreference,
    ambiguityComfort: 'MEDIUM' as AmbiguityComfort,
    focusDurationMinutes: null,
    supportMode: 'MODERATE' as SupportMode,
    preferredWorkingHours: null,
    onboardingCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function upsertCognitiveProfile(userId: string, data: CognitiveProfileInput) {
  // Ensure the student has a profile row in the DB before upserting the
  // cognitive profile (CognitiveProfile references StudentProfile.userId).
  await prisma.studentProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  // Prisma requires Prisma.DbNull or Prisma.JsonNull for nullable JSON fields.
  // We cannot pass a plain JS null — we must use the sentinel value.
  const preferredWorkingHours =
    data.preferredWorkingHours == null
      ? Prisma.DbNull
      : data.preferredWorkingHours;

  const profileData = { ...data, preferredWorkingHours, onboardingCompleted: true };

  return prisma.cognitiveProfile.upsert({
    where: { userId },
    update: { ...profileData, updatedAt: new Date() },
    create: { userId, ...profileData },
  });
}

export async function markOnboardingComplete(userId: string) {
  return prisma.cognitiveProfile.update({
    where: { userId },
    data: { onboardingCompleted: true },
  });
}

// ---------------------------------------------------------------------------
// Overload Signals
// ---------------------------------------------------------------------------

export async function recordOverloadSignal(
  userId: string,
  context: string,
  severity: SignalSeverity = 'MEDIUM'
) {
  const signal = await prisma.overloadSignal.create({
    data: { userId, context, severity },
  });

  // If the student's profile is set to COMPREHENSIVE support, automatically
  // create a notification for their supervisor to check in.
  const profile = await prisma.cognitiveProfile.findUnique({
    where: { userId },
    select: { supportMode: true },
  });

  if (profile?.supportMode === 'COMPREHENSIVE') {
    const member = await prisma.teamMember.findFirst({
      where: { userId },
      include: { team: { select: { supervisorId: true } } },
    });

    if (member?.team?.supervisorId) {
      const supervisor = await prisma.supervisorProfile.findUnique({
        where: { id: member.team.supervisorId },
        select: { userId: true },
      });
      if (supervisor) {
        await prisma.notification.create({
          data: {
            userId: supervisor.userId,
            type: 'OVERLOAD_DETECTED',
            title: 'Team member may need support',
            body: 'A student in one of your teams has signalled they are overwhelmed. Consider a brief check-in.',
            link: '/dashboard/overview',
          },
        });
      }
    }
  }

  return signal;
}

export async function getRecentOverloadSignals(userId: string, limitDays = 14) {
  const since = new Date(Date.now() - limitDays * 24 * 60 * 60 * 1000);
  return prisma.overloadSignal.findMany({
    where: { userId, triggeredAt: { gte: since } },
    orderBy: { triggeredAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Accessibility Settings
// ---------------------------------------------------------------------------

export async function getAccessibilitySettings(userId: string) {
  return prisma.accessibilitySetting.findUnique({ where: { userId } });
}

export async function upsertAccessibilitySettings(
  userId: string,
  data: {
    reducedMotion?: boolean;
    highContrast?: boolean;
    fontScale?: string;
    focusMode?: boolean;
    lowEnergyMode?: boolean;
    digestMode?: DigestMode;
  }
) {
  return prisma.accessibilitySetting.upsert({
    where: { userId },
    update: { ...data, updatedAt: new Date() },
    create: { userId, ...data },
  });
}
