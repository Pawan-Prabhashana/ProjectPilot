/**
 * Consultation Readiness Service
 *
 * Determines whether a team is ready for their consultation and
 * what they should focus on before the meeting.
 *
 * Outputs a readiness score and a structured preparation checklist.
 * This is surfaced on the Team Workspace and consultation pages to
 * reduce meeting anxiety — teams know what to expect.
 */

import { prisma } from '@/lib/db';

export type ReadinessLevel = 'WELL_PREPARED' | 'MOSTLY_READY' | 'NEEDS_PREP' | 'AT_RISK';

export type PrepItem = {
  area: string;
  status: 'done' | 'needed' | 'optional';
  description: string;
};

export type ConsultationReadiness = {
  level: ReadinessLevel;
  score: number;       // 0–100
  summary: string;
  prepItems: PrepItem[];
  daysUntilMeeting: number | null;
  briefGenerated: boolean;
};

export async function getConsultationReadiness(
  bookingId: string
): Promise<ConsultationReadiness> {
  const booking = await prisma.consultationBooking.findUnique({
    where: { id: bookingId },
    include: {
      brief: { select: { id: true, generatedAt: true } },
      team: {
        include: {
          project: {
            include: {
              tasks: {
                where: { status: { notIn: ['DONE', 'CANCELLED'] } },
                select: { id: true, dueDate: true, blockerNote: true },
              },
              openQuestions: { where: { resolvedAt: null }, select: { id: true, priority: true } },
            },
          },
        },
      },
    },
  });

  if (!booking) {
    return {
      level: 'NEEDS_PREP',
      score: 0,
      summary: 'Consultation not found.',
      prepItems: [],
      daysUntilMeeting: null,
      briefGenerated: false,
    };
  }

  const now = new Date();
  const daysUntilMeeting = Math.ceil((booking.slotStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const project = booking.team.project;
  const overdue = project?.tasks.filter((t) => t.dueDate && t.dueDate < now) ?? [];
  const blocked = project?.tasks.filter((t) => t.blockerNote) ?? [];
  const openQuestions = project?.openQuestions ?? [];
  const urgentQuestions = openQuestions.filter((q) => q.priority === 'HIGH' || q.priority === 'URGENT');

  const prepItems: PrepItem[] = [];
  let score = 100;

  // Agenda / purpose
  if (booking.agenda || booking.purpose) {
    prepItems.push({ area: 'Meeting agenda', status: 'done', description: 'Team has provided a meeting purpose or agenda.' });
  } else {
    prepItems.push({ area: 'Meeting agenda', status: 'needed', description: 'Add a meeting purpose so the supervisor can prepare.' });
    score -= 20;
  }

  // Brief
  if (booking.brief) {
    prepItems.push({ area: 'Pre-meeting brief', status: 'done', description: 'Brief generated — review it before the meeting.' });
  } else {
    prepItems.push({ area: 'Pre-meeting brief', status: 'needed', description: 'Brief has not been generated yet — it will be ready after booking confirmation.' });
    score -= 15;
  }

  // Open questions
  if (urgentQuestions.length > 0) {
    prepItems.push({
      area: 'High-priority questions',
      status: 'needed',
      description: `${urgentQuestions.length} urgent/high question(s) in Project Brain need answers from the supervisor.`,
    });
    score -= urgentQuestions.length * 5;
  } else if (openQuestions.length > 0) {
    prepItems.push({
      area: 'Open questions',
      status: 'optional',
      description: `${openQuestions.length} open question(s) in Project Brain — consider bringing these up.`,
    });
    score -= 5;
  } else {
    prepItems.push({ area: 'Open questions', status: 'done', description: 'No unresolved questions. Great.' });
  }

  // Overdue tasks
  if (overdue.length > 0) {
    prepItems.push({
      area: 'Overdue tasks',
      status: 'needed',
      description: `${overdue.length} overdue task(s) — be ready to explain the delay and propose a recovery plan.`,
    });
    score -= Math.min(25, overdue.length * 8);
  } else {
    prepItems.push({ area: 'Overdue tasks', status: 'done', description: 'No overdue tasks. All on track.' });
  }

  // Blockers
  if (blocked.length > 0) {
    prepItems.push({
      area: 'Blocked tasks',
      status: 'needed',
      description: `${blocked.length} blocked task(s) — bring these to the meeting for supervisor guidance.`,
    });
  } else {
    prepItems.push({ area: 'Blocked tasks', status: 'done', description: 'No blocked tasks.' });
  }

  // Topics for supervisor
  if (booking.topicsForSupervisor) {
    prepItems.push({ area: 'Topics prepared', status: 'done', description: 'Specific topics have been prepared for the supervisor.' });
  } else {
    prepItems.push({ area: 'Topics prepared', status: 'optional', description: 'Consider adding specific topics you want the supervisor to address.' });
    score -= 5;
  }

  score = Math.max(0, Math.min(100, score));

  let level: ReadinessLevel;
  if (score >= 85) level = 'WELL_PREPARED';
  else if (score >= 65) level = 'MOSTLY_READY';
  else if (score >= 40) level = 'NEEDS_PREP';
  else level = 'AT_RISK';

  const summaryMap: Record<ReadinessLevel, string> = {
    WELL_PREPARED: 'Your team is well prepared for this consultation.',
    MOSTLY_READY: 'Almost ready — a little preparation will make the meeting much more productive.',
    NEEDS_PREP: 'Some key preparation is still needed before the meeting.',
    AT_RISK: 'This consultation needs significant preparation. Consider rescheduling if not ready.',
  };

  return {
    level,
    score,
    summary: summaryMap[level],
    prepItems,
    daysUntilMeeting,
    briefGenerated: !!booking.brief,
  };
}
