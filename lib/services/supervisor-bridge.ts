/**
 * Supervisor Bridge Service
 *
 * Translates supervisor communication into neurodivergent-friendly structured outputs.
 *
 * Core insight: academic supervisors communicate naturally in dense prose with
 * implicit expectations, compressed timelines, and assumed background knowledge.
 * For neurodivergent students, this creates significant processing overhead that
 * has nothing to do with their academic capability.
 *
 * The bridge extracts: action items, quality expectations, hidden assumptions,
 * deadline warnings, ambiguity signals, and generates plain-English summaries
 * and ordered first steps.
 *
 * Phase 1: rule-based extraction (this file).
 * Phase 2: same interface, LLM-augmented body — data model already shaped for it.
 */

import { prisma } from '@/lib/db';
import { getOpenQuestions } from './project-brain';
import { gatherHealthFactors } from '@/lib/metrics/health';

// ─── Type Definitions ────────────────────────────────────────────────────────

export type AgendaItem = {
  topic: string;
  priority: 'high' | 'medium' | 'low';
};

export type RiskHighlight = {
  risk: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
};

export type ActionItem = {
  title: string;
  // Human-readable label (e.g. "Team Lead", "Developer", "Whole Team")
  suggestedOwnerLabel: string | null;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  // Extracted hint e.g. "by next session", "before milestone 3"
  dueHint: string | null;
  riskIfIgnored: string | null;
  // What a good outcome for this action item looks like
  whatGoodLooksLike: string | null;
};

export type QualityExpectation = {
  area: string;          // e.g. "Database design", "Report structure"
  standard: string;      // e.g. "Must include full ER diagram with FK labels"
  example: string | null; // e.g. "See milestone 2 template"
};

export type DeadlineWarning = {
  text: string;           // raw extracted phrase
  urgencyLevel: 'urgent' | 'high' | 'medium' | 'low';
  extractedDate: string | null; // human-readable interpretation
};

// ─── Enhanced Bridge Parsing ──────────────────────────────────────────────────

/**
 * ACTION VERB PATTERNS
 * Phrases that typically introduce an action the team needs to take.
 */
const ACTION_PATTERNS = [
  { verbs: ['you need to', 'you must', 'you should', 'the team should', 'please'], priority: 'high' as const },
  { verbs: ['make sure', 'ensure', 'confirm', 'verify', 'check'], priority: 'high' as const },
  { verbs: ['revise', 'rewrite', 'fix', 'correct', 'address', 'update', 'improve'], priority: 'high' as const },
  { verbs: ['add', 'include', 'expand', 'provide', 'demonstrate', 'show', 'document'], priority: 'medium' as const },
  { verbs: ['consider', 'think about', 'look into', 'explore', 'investigate'], priority: 'low' as const },
  { verbs: ['restructure', 'reorganise', 'rework', 'redo', 'redo'], priority: 'high' as const },
  { verbs: ['complete', 'finish', 'finalise', 'submit', 'deliver'], priority: 'high' as const },
];

/**
 * URGENCY MODIFIERS
 * Words that increase the urgency of any statement they appear in.
 */
const URGENCY_WORDS = ['urgent', 'critical', 'immediately', 'asap', 'as soon as possible', 'priority', 'crucial', 'must not miss'];

/**
 * DEADLINE PATTERNS — regex patterns to detect timeline references.
 */
const DEADLINE_PATTERNS: { pattern: RegExp; label: string; urgency: DeadlineWarning['urgencyLevel'] }[] = [
  { pattern: /by\s+next\s+week/i,          label: 'By next week',              urgency: 'high' },
  { pattern: /by\s+next\s+session/i,       label: 'By next session',           urgency: 'high' },
  { pattern: /by\s+next\s+meeting/i,       label: 'By next meeting',           urgency: 'high' },
  { pattern: /before\s+the\s+next\s+\w+/i, label: 'Before the next milestone', urgency: 'high' },
  { pattern: /before\s+submission/i,       label: 'Before submission',         urgency: 'urgent' },
  { pattern: /before\s+milestone/i,        label: 'Before milestone',          urgency: 'high' },
  { pattern: /this\s+week/i,               label: 'This week',                 urgency: 'urgent' },
  { pattern: /end\s+of\s+week/i,           label: 'By end of week',            urgency: 'urgent' },
  { pattern: /in\s+the\s+next\s+\d+\s+days?/i, label: 'In the next few days', urgency: 'high' },
  { pattern: /by\s+friday/i,               label: 'By Friday',                 urgency: 'urgent' },
  { pattern: /next\s+time\s+we\s+meet/i,   label: 'Next meeting',              urgency: 'medium' },
  { pattern: /soon/i,                      label: 'Soon (timeline vague)',      urgency: 'medium' },
  { pattern: /later\b/i,                   label: 'Later (timing unclear)',     urgency: 'low' },
];

/**
 * QUALITY EXPECTATION PATTERNS
 * Phrases that describe what "good" looks like.
 */
const QUALITY_PATTERNS = [
  /i\s+expect\s+to\s+see/i,
  /should\s+(look|demonstrate|show|include|have|contain)/i,
  /the\s+(standard|level|quality|format)\s+should/i,
  /at\s+minimum\b/i,
  /needs?\s+to\s+(include|show|demonstrate|have)/i,
  /i\s+want\s+to\s+see/i,
  /by\s+the\s+end.{0,30}should\s+have/i,
  /typical\s+(standard|format|structure|approach)/i,
];

/**
 * HIDDEN ASSUMPTION PATTERNS
 * Phrases where the supervisor assumes the team already knows something they may not.
 */
const ASSUMPTION_PATTERNS = [
  { pattern: /as\s+you\s+(know|should\s+know|already\s+know)/i,
    template: 'Supervisor assumed: you already know this context.' },
  { pattern: /obviously\b/i,
    template: 'Supervisor used "obviously" — may not be obvious to everyone on the team.' },
  { pattern: /presumably\b/i,
    template: 'Supervisor used "presumably" — this may be an untested assumption.' },
  { pattern: /i\s+assume\s+(you|your\s+team)/i,
    template: 'Supervisor stated an assumption explicitly — verify it is correct.' },
  { pattern: /you\s+should\s+already\s+have/i,
    template: 'Supervisor expects something to already be done — check if that is the case.' },
  { pattern: /by\s+now\b/i,
    template: 'Supervisor expected this to be completed by this point — confirm current state.' },
  { pattern: /standard\s+practice\b/i,
    template: 'Supervisor referenced "standard practice" — this may need clarification on what that means for this project.' },
  { pattern: /you\s+know\s+what\s+to\s+do/i,
    template: 'Supervisor assumed you know what is expected — if unclear, ask for specifics.' },
];

/**
 * VAGUENESS PATTERNS
 * Phrases that signal the feedback may be unclear or open to misinterpretation.
 */
const VAGUENESS_PATTERNS = [
  /more\s+detail/i,
  /needs?\s+work/i,
  /not\s+enough/i,
  /too\s+brief/i,
  /could\s+be\s+(better|improved|stronger)/i,
  /somewhat\s+(weak|lacking|unclear)/i,
  /needs?\s+improvement/i,
  /a\s+bit\s+(vague|unclear|thin|shallow)/i,
  /not\s+quite\s+there/i,
  /improve\s+(this|your|the)/i,
  /not\s+convincing/i,
  /lacks?\s+depth/i,
];

/**
 * parseSupervisorFeedback
 *
 * Significantly enhanced rule-based bridge parser.
 * Extracts action items, quality expectations, hidden assumptions, deadline
 * warnings, ambiguities, and generates student-friendly summary + first steps.
 */
export async function parseSupervisorFeedback(bookingId: string, rawFeedback: string) {
  const lines = rawFeedback
    .split(/[.!?\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 8);

  const actionItems: ActionItem[] = [];
  const expectations: string[] = [];
  const ambiguities: string[] = [];
  const hiddenAssumptions: string[] = [];
  const qualityExpectations: QualityExpectation[] = [];
  const deadlineWarnings: DeadlineWarning[] = [];

  // ── 1. Extract deadline warnings ────────────────────────────────────────
  for (const line of lines) {
    for (const dp of DEADLINE_PATTERNS) {
      if (dp.pattern.test(line)) {
        deadlineWarnings.push({
          text: line,
          urgencyLevel: dp.urgency,
          extractedDate: dp.label,
        });
        break; // one deadline per line
      }
    }
  }

  // ── 2. Extract action items ──────────────────────────────────────────────
  for (const line of lines) {
    const lower = line.toLowerCase();
    let matched = false;
    let detectedPriority: ActionItem['priority'] = 'medium';

    // Check urgency modifiers first
    if (URGENCY_WORDS.some((w) => lower.includes(w))) {
      detectedPriority = 'urgent';
    }

    for (const ap of ACTION_PATTERNS) {
      if (ap.verbs.some((v) => lower.includes(v))) {
        if (detectedPriority !== 'urgent') detectedPriority = ap.priority;
        matched = true;
        break;
      }
    }

    if (matched) {
      // Extract due hint from this line
      let dueHint: string | null = null;
      for (const dp of DEADLINE_PATTERNS) {
        if (dp.pattern.test(line)) {
          dueHint = dp.label;
          break;
        }
      }

      // Determine risk if ignored (heuristic)
      let riskIfIgnored: string | null = null;
      if (detectedPriority === 'urgent') {
        riskIfIgnored = 'May affect project grade or deadline compliance.';
      } else if (detectedPriority === 'high') {
        riskIfIgnored = 'Supervisor will notice this at the next review.';
      }

      // Derive a "what good looks like" if quality patterns follow nearby
      const whatGoodLooksLike = inferWhatGoodLooksLike(line);

      actionItems.push({
        title: capitaliseFirst(line),
        suggestedOwnerLabel: inferOwnerLabel(lower),
        priority: detectedPriority,
        dueHint,
        riskIfIgnored,
        whatGoodLooksLike,
      });
    }
  }

  // ── 3. Extract quality expectations ─────────────────────────────────────
  for (const line of lines) {
    if (QUALITY_PATTERNS.some((p) => p.test(line))) {
      const area = inferAreaFromLine(line);
      qualityExpectations.push({
        area,
        standard: capitaliseFirst(line),
        example: null,
      });
      expectations.push(capitaliseFirst(line));
    }
  }

  // ── 4. Extract hidden assumptions ───────────────────────────────────────
  for (const line of lines) {
    for (const ap of ASSUMPTION_PATTERNS) {
      if (ap.pattern.test(line)) {
        hiddenAssumptions.push(`"${line.slice(0, 120)}" — ${ap.template}`);
        break;
      }
    }
  }

  // ── 5. Extract ambiguities (vague phrases or open questions) ────────────
  for (const line of lines) {
    const lower = line.toLowerCase();
    const isVague = VAGUENESS_PATTERNS.some((p) => p.test(lower));
    const isQuestion = line.includes('?');
    const mentionsClarify = lower.includes('clarif') || lower.includes('unclear') || lower.includes('not clear');

    if (isVague || isQuestion || mentionsClarify) {
      ambiguities.push(capitaliseFirst(line));
    }
  }

  // ── 6. Generate suggested first steps ───────────────────────────────────
  const urgentAndHigh = actionItems.filter((a) => a.priority === 'urgent' || a.priority === 'high');
  const suggestedFirstSteps: string[] = urgentAndHigh
    .slice(0, 3)
    .map((a) => a.title);

  if (suggestedFirstSteps.length === 0 && actionItems.length > 0) {
    suggestedFirstSteps.push(actionItems[0].title);
  }

  if (ambiguities.length > 0 && suggestedFirstSteps.length < 3) {
    suggestedFirstSteps.push(`Clarify with supervisor: ${ambiguities[0].slice(0, 80)}`);
  }

  // ── 7. Generate student-friendly plain English summary ──────────────────
  const studentSummary = generateStudentSummary({
    actionItemCount: actionItems.length,
    urgentCount: actionItems.filter((a) => a.priority === 'urgent').length,
    ambiguityCount: ambiguities.length,
    deadlineCount: deadlineWarnings.length,
    assumptionCount: hiddenAssumptions.length,
    rawFeedback,
  });

  // ── 8. Clarity score ─────────────────────────────────────────────────────
  const totalSignals = actionItems.length + expectations.length + ambiguities.length;
  const clarityScore =
    totalSignals > 0
      ? Math.max(0.1, Math.min(1, 1 - ambiguities.length / totalSignals))
      : 0.5;

  return prisma.supervisorFeedbackParse.upsert({
    where: { bookingId },
    update: {
      rawFeedback,
      actionItems,
      expectations,
      ambiguities,
      hiddenAssumptions,
      qualityExpectations,
      deadlineWarnings,
      suggestedFirstSteps,
      studentSummary,
      clarityScore,
      parsedAt: new Date(),
    },
    create: {
      bookingId,
      rawFeedback,
      actionItems,
      expectations,
      ambiguities,
      hiddenAssumptions,
      qualityExpectations,
      deadlineWarnings,
      suggestedFirstSteps,
      studentSummary,
      clarityScore,
    },
  });
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function capitaliseFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function inferOwnerLabel(lowerLine: string): string | null {
  if (lowerLine.includes('lead') || lowerLine.includes('project manager')) return 'Team Lead';
  if (lowerLine.includes('developer') || lowerLine.includes('programmer') || lowerLine.includes('technical')) return 'Developer';
  if (lowerLine.includes('designer') || lowerLine.includes('ui') || lowerLine.includes('ux')) return 'Designer';
  if (lowerLine.includes('writer') || lowerLine.includes('documentation') || lowerLine.includes('report')) return 'Writer';
  if (lowerLine.includes('everyone') || lowerLine.includes('whole team') || lowerLine.includes('all of you')) return 'Whole Team';
  if (lowerLine.includes('each of you') || lowerLine.includes('each member')) return 'Each Member';
  return null;
}

function inferWhatGoodLooksLike(line: string): string | null {
  const lower = line.toLowerCase();
  if (lower.includes('diagram') || lower.includes('er diagram')) {
    return 'A complete diagram with all entities, relationships, and FK labels shown.';
  }
  if (lower.includes('report') || lower.includes('document')) {
    return 'A structured document with clear section headings, citations, and a summary.';
  }
  if (lower.includes('test')) {
    return 'Tests should cover happy path, edge cases, and error conditions with clear descriptions.';
  }
  if (lower.includes('api') || lower.includes('endpoint')) {
    return 'API returns correct status codes, handles errors gracefully, and is tested with sample requests.';
  }
  if (lower.includes('scope') || lower.includes('requirements')) {
    return 'A concise document listing what IS in scope and what is NOT, reviewed by the whole team.';
  }
  return null;
}

function inferAreaFromLine(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes('database') || lower.includes('schema') || lower.includes('er')) return 'Database Design';
  if (lower.includes('report') || lower.includes('write') || lower.includes('document')) return 'Documentation';
  if (lower.includes('code') || lower.includes('implement')) return 'Implementation';
  if (lower.includes('test')) return 'Testing';
  if (lower.includes('design') || lower.includes('ui') || lower.includes('interface')) return 'UI/Design';
  if (lower.includes('scope') || lower.includes('requirement')) return 'Requirements';
  if (lower.includes('milestone') || lower.includes('deadline')) return 'Project Management';
  return 'General';
}

function generateStudentSummary({
  actionItemCount,
  urgentCount,
  ambiguityCount,
  deadlineCount,
  assumptionCount,
  rawFeedback,
}: {
  actionItemCount: number;
  urgentCount: number;
  ambiguityCount: number;
  deadlineCount: number;
  assumptionCount: number;
  rawFeedback: string;
}): string {
  const parts: string[] = [];

  if (urgentCount > 0) {
    parts.push(
      `Your supervisor identified ${urgentCount} urgent item${urgentCount > 1 ? 's' : ''} that need to be addressed before your next meeting.`
    );
  } else if (actionItemCount > 0) {
    parts.push(
      `Your supervisor gave ${actionItemCount} clear action item${actionItemCount > 1 ? 's' : ''} for the team to work on.`
    );
  } else {
    parts.push('Your supervisor provided feedback on the project progress.');
  }

  if (deadlineCount > 0) {
    parts.push(
      `There ${deadlineCount === 1 ? 'is' : 'are'} ${deadlineCount} timeline mention${deadlineCount > 1 ? 's' : ''} in the feedback — check the deadline warnings below carefully.`
    );
  }

  if (ambiguityCount > 0) {
    parts.push(
      `${ambiguityCount} point${ambiguityCount > 1 ? 's' : ''} in the feedback ${ambiguityCount > 1 ? 'are' : 'is'} unclear — these are listed as things to clarify at your next consultation.`
    );
  } else if (rawFeedback.length > 200) {
    parts.push('The feedback is reasonably clear — focus on the action items and work through them in priority order.');
  }

  if (assumptionCount > 0) {
    parts.push(
      `${assumptionCount} hidden assumption${assumptionCount > 1 ? 's' : ''} ${assumptionCount > 1 ? 'were' : 'was'} detected — make sure the whole team is aligned on these.`
    );
  }

  return parts.join(' ');
}

// ─── Consultation Brief Generation ───────────────────────────────────────────

/**
 * Generates a rich pre-meeting brief from current project state.
 * Shared with both team and supervisor before the consultation.
 */
export async function generateConsultationBrief(bookingId: string) {
  const booking = await prisma.consultationBooking.findUnique({
    where: { id: bookingId },
    include: {
      team: {
        include: {
          project: {
            include: {
              milestones: { orderBy: { dueDate: 'asc' } },
              tasks: {
                where: { status: { notIn: ['DONE', 'CANCELLED'] } },
                include: { assignee: { select: { name: true } } },
                orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
              },
              openQuestions: { where: { resolvedAt: null }, orderBy: { priority: 'desc' } },
              decisionLogs: { orderBy: { madeAt: 'desc' }, take: 3 },
            },
          },
        },
      },
    },
  });

  if (!booking?.team?.project) {
    throw new Error('Booking, team, or project not found.');
  }

  const project = booking.team.project;
  const factors = await gatherHealthFactors(booking.teamId);
  const now = new Date();

  const overdueTasks = project.tasks.filter((t) => t.dueDate && t.dueDate < now);
  const blockedTasks = project.tasks.filter((t) => (t as { blockerNote?: string | null }).blockerNote);
  const upcomingMilestone = project.milestones.find((m) => m.status !== 'COMPLETED');
  const completedMilestones = project.milestones.filter((m) => m.status === 'COMPLETED');
  const totalTasks = await prisma.task.count({ where: { projectId: project.id } });
  const doneTasks = await prisma.task.count({ where: { projectId: project.id, status: 'DONE' } });
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // --- Team Progress Summary ---
  const progressLines: string[] = [
    `Project: ${project.title}.`,
    `Overall completion: ${completionRate}% (${doneTasks}/${totalTasks} tasks done).`,
    factors.hasActivityThisWeek
      ? 'Team has logged activity this week.'
      : 'No activity logged this week — potential stall.',
  ];

  if (completedMilestones.length > 0) {
    progressLines.push(`Completed milestones: ${completedMilestones.map((m) => m.title).join(', ')}.`);
  }

  if (upcomingMilestone) {
    const daysUntil = Math.ceil((upcomingMilestone.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    progressLines.push(
      `Next milestone: "${upcomingMilestone.title}" — due ${upcomingMilestone.dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} (${daysUntil > 0 ? `${daysUntil} days away` : 'overdue'}).`
    );
  }

  if (overdueTasks.length > 0) {
    progressLines.push(`${overdueTasks.length} task(s) are overdue — attention needed.`);
  }

  if (blockedTasks.length > 0) {
    progressLines.push(`${blockedTasks.length} task(s) currently blocked.`);
  }

  const teamProgressSummary = progressLines.join(' ');

  // --- Suggested Agenda Items ---
  const suggestedAgendaItems: AgendaItem[] = [];

  if (booking.purpose) {
    suggestedAgendaItems.push({ topic: booking.purpose, priority: 'high' });
  }

  if (overdueTasks.length > 0) {
    suggestedAgendaItems.push({
      topic: `Review ${overdueTasks.length} overdue task(s): ${overdueTasks.slice(0, 2).map((t) => `"${t.title}"`).join(', ')}`,
      priority: 'high',
    });
  }

  if (blockedTasks.length > 0) {
    suggestedAgendaItems.push({
      topic: `Unblock: ${blockedTasks.slice(0, 2).map((t) => `"${t.title}"`).join(', ')}`,
      priority: 'high',
    });
  }

  if (upcomingMilestone) {
    const daysUntil = Math.ceil((upcomingMilestone.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 21) {
      suggestedAgendaItems.push({
        topic: `Milestone readiness check: "${upcomingMilestone.title}" (${daysUntil}d away)`,
        priority: daysUntil <= 7 ? 'high' : 'medium',
      });
    }
  }

  if (project.openQuestions.length > 0) {
    const topQ = project.openQuestions.filter((q) => q.priority === 'HIGH' || q.priority === 'URGENT');
    if (topQ.length > 0) {
      suggestedAgendaItems.push({
        topic: `Resolve high-priority question: "${topQ[0].question.slice(0, 80)}"`,
        priority: 'high',
      });
    } else {
      suggestedAgendaItems.push({
        topic: `Resolve ${project.openQuestions.length} open question(s) in Project Brain`,
        priority: 'medium',
      });
    }
  }

  if (booking.blockerContext) {
    suggestedAgendaItems.push({
      topic: `Team-reported blocker: ${booking.blockerContext.slice(0, 100)}`,
      priority: 'high',
    });
  }

  if (booking.topicsForSupervisor) {
    suggestedAgendaItems.push({
      topic: `Team question: ${booking.topicsForSupervisor.slice(0, 100)}`,
      priority: 'medium',
    });
  }

  if (!factors.hasActivityThisWeek) {
    suggestedAgendaItems.push({
      topic: 'Discuss team momentum and any blockers to progress',
      priority: 'high',
    });
  }

  suggestedAgendaItems.push({ topic: 'Open floor: any concerns from the team', priority: 'low' });

  // --- Risks ---
  const risksToHighlight: RiskHighlight[] = [];

  if (overdueTasks.length >= 3) {
    risksToHighlight.push({ risk: `${overdueTasks.length} overdue tasks indicate a delivery risk`, severity: 'high' });
  }
  if (!factors.nextMilestoneIsOnTrack) {
    risksToHighlight.push({ risk: 'Next milestone may be missed at current pace', severity: 'critical' });
  }
  if (factors.recentFrictionEventCount > 0) {
    risksToHighlight.push({ risk: `${factors.recentFrictionEventCount} unresolved team friction event(s)`, severity: 'medium' });
  }
  if (blockedTasks.length > 0) {
    risksToHighlight.push({ risk: `${blockedTasks.length} blocked task(s) may create a dependency cascade`, severity: 'medium' });
  }
  if (!factors.hasActivityThisWeek && project.tasks.length > 0) {
    risksToHighlight.push({ risk: 'No team activity logged this week — check for disengagement', severity: 'medium' });
  }

  return prisma.consultationBrief.upsert({
    where: { bookingId },
    update: {
      teamProgressSummary,
      suggestedAgendaItems,
      risksToHighlight,
      unresolvedQuestions: project.openQuestions.map((q) => q.question),
      generatedAt: new Date(),
    },
    create: {
      bookingId,
      teamProgressSummary,
      suggestedAgendaItems,
      risksToHighlight,
      unresolvedQuestions: project.openQuestions.map((q) => q.question),
    },
  });
}
