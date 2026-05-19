/**
 * Communication Support Service
 *
 * Provides three capabilities for neurodivergent students:
 *
 * 1. Adaptive Communication Translator
 *    Rewrites text into a chosen register (direct, gentle, formal, etc.)
 *    using deterministic pattern transformations. Phase 2 will pass these
 *    through an LLM — the typed interfaces remain stable.
 *
 * 2. Social Translation Layer
 *    Analyses text for hidden expectations, soft deadlines, ownership
 *    ambiguity, and implied urgency. Makes invisible social signals explicit
 *    without making accusations about intent or tone.
 *
 * 3. Meeting Recovery Summary
 *    Derives a calm, simplified post-meeting summary from consultation
 *    data for re-entry after an intense meeting.
 *
 * Privacy: all outputs are scoped to the requesting student. None of this
 * data is persisted or shared with supervisors.
 */

import { prisma } from '@/lib/db';

// ─── Translator ────────────────────────────────────────────────────────────────

export type TranslationStyle =
  | 'DIRECT'
  | 'GENTLE'
  | 'ACADEMIC_FORMAL'
  | 'SUPERVISOR_READY'
  | 'CONCISE_ACTION'
  | 'PEER_COLLABORATIVE';

export const TRANSLATION_STYLE_META: Record<
  TranslationStyle,
  { label: string; description: string; icon: string }
> = {
  DIRECT: {
    label: 'Clear & Direct',
    description: 'Removes hedging, simplifies to the core message. Best for internal notes.',
    icon: '→',
  },
  GENTLE: {
    label: 'Gentle & Friendly',
    description: 'Adds warmth and collaborative framing. Best for team messages.',
    icon: '☀',
  },
  ACADEMIC_FORMAL: {
    label: 'Academic Formal',
    description: 'Structured, professional language for written submissions.',
    icon: '📄',
  },
  SUPERVISOR_READY: {
    label: 'Supervisor-Ready',
    description: 'Clear context, numbered questions, respectful tone. Best for emails.',
    icon: '✉',
  },
  CONCISE_ACTION: {
    label: 'Action List',
    description: 'Converts prose into a clear list of next steps.',
    icon: '✓',
  },
  PEER_COLLABORATIVE: {
    label: 'Peer Collaborative',
    description: 'Casual, inclusive, inviting discussion. Best for team channels.',
    icon: '💬',
  },
};

export type TranslationResult = {
  original: string;
  translated: string;
  style: TranslationStyle;
  changesApplied: string[];
  tip: string | null;
};

/**
 * Transforms text into the requested communication style.
 * Uses deterministic text-processing heuristics.
 */
export function translateMessage(text: string, style: TranslationStyle): TranslationResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { original: text, translated: '', style, changesApplied: [], tip: null };
  }

  let result = trimmed;
  const changes: string[] = [];

  switch (style) {
    case 'DIRECT':
      result = applyDirectStyle(trimmed, changes);
      break;
    case 'GENTLE':
      result = applyGentleStyle(trimmed, changes);
      break;
    case 'ACADEMIC_FORMAL':
      result = applyAcademicStyle(trimmed, changes);
      break;
    case 'SUPERVISOR_READY':
      result = applySupervisorStyle(trimmed, changes);
      break;
    case 'CONCISE_ACTION':
      result = applyActionListStyle(trimmed, changes);
      break;
    case 'PEER_COLLABORATIVE':
      result = applyPeerStyle(trimmed, changes);
      break;
  }

  const tip = getTip(style, trimmed);
  return { original: trimmed, translated: result.trim(), style, changesApplied: changes, tip };
}

// ── Style implementations ─────────────────────────────────────────────────────

function applyDirectStyle(text: string, changes: string[]): string {
  let t = text;

  // Remove hedging phrases
  const hedges = [
    /\b(maybe|perhaps|possibly|I think|I guess|I suppose|sort of|kind of|I feel like|probably|it might be that|it could be that)\b,?\s*/gi,
    /\bI was wondering if\b/gi,
    /\bif that makes sense\b[.,]?/gi,
    /\bhopefully\b,?\s*/gi,
    /\bjust\b\s+(?=want|thought|checking|wondering)/gi,
  ];
  hedges.forEach((pattern) => {
    if (pattern.test(t)) changes.push('Removed hedging language');
    t = t.replace(pattern, '');
  });

  // Remove excessive apologies
  const apologies = [
    /^(Sorry[,.]?\s*|I'm sorry[,.]?\s*|Apologies[,.]?\s*)/i,
    /\(sorry[^)]*\)/gi,
    /I hope (this is okay|that's okay|that's fine|you don't mind)[.,]?\s*/gi,
  ];
  apologies.forEach((pattern) => {
    if (pattern.test(t)) changes.push('Removed unnecessary apology');
    t = t.replace(pattern, '');
  });

  // Capitalize start
  t = t.charAt(0).toUpperCase() + t.slice(1);

  // Clean double spaces
  t = t.replace(/\s{2,}/g, ' ').trim();

  if (changes.length === 0) changes.push('Text is already clear and direct');
  return t;
}

function applyGentleStyle(text: string, changes: string[]): string {
  let t = text.trim();

  // Add warm opening if it doesn't already have one
  const hasWarmOpening = /^(Hi|Hello|Hey|Good|Thank|I hope|I wanted|Just wanted)/i.test(t);
  if (!hasWarmOpening) {
    t = `I wanted to share something — ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
    changes.push('Added collaborative opening');
  }

  // Soften demands
  const imperatives: [RegExp, string][] = [
    [/^Please\s+(do|check|update|send|complete|fix|review|add|remove)/m, ''],
    [/\bYou need to\b/gi, 'It would be great if you could'],
    [/\bYou must\b/gi, 'It would really help if you could'],
    [/\bDo this\b/gi, 'When you have a moment, could you do this'],
  ];
  imperatives.forEach(([pattern, replacement]) => {
    if (pattern.test(t)) {
      changes.push('Softened directive language');
      t = t.replace(pattern, replacement);
    }
  });

  // Add closing if short message
  if (t.split(' ').length < 40 && !/thank/i.test(t)) {
    t = `${t} Thank you for taking a look at this.`;
    changes.push('Added appreciative closing');
  }

  return t.trim();
}

function applyAcademicStyle(text: string, changes: string[]): string {
  let t = text.trim();

  // Expand contractions
  const contractions: [RegExp, string][] = [
    [/\bI'm\b/g, 'I am'],
    [/\bIt's\b/g, 'It is'],
    [/\bDon't\b/g, 'Do not'],
    [/\bCan't\b/g, 'Cannot'],
    [/\bWon't\b/g, 'Will not'],
    [/\bWe're\b/g, 'We are'],
    [/\bThey're\b/g, 'They are'],
    [/\bdidn't\b/g, 'did not'],
    [/\bhasn't\b/g, 'has not'],
    [/\bwasn't\b/g, 'was not'],
    [/\bcouldn't\b/g, 'could not'],
    [/\bshouldn't\b/g, 'should not'],
  ];
  let contractionFound = false;
  contractions.forEach(([pattern, replacement]) => {
    if (pattern.test(t)) contractionFound = true;
    t = t.replace(pattern, replacement);
  });
  if (contractionFound) changes.push('Expanded contractions for formal register');

  // Add formal structure markers for longer text
  const sentences = t.match(/[^.!?]+[.!?]+/g) ?? [];
  if (sentences.length >= 3) {
    t = `It is noted that ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
    changes.push('Added academic framing');
  }

  // Replace informal vocabulary
  const vocab: [RegExp, string][] = [
    [/\ba lot of\b/gi, 'a significant number of'],
    [/\bgets\b/gi, 'becomes'],
    [/\buse\b/gi, 'utilise'],
    [/\bshow\b/gi, 'demonstrate'],
    [/\bstart\b/gi, 'commence'],
    [/\bhelp\b/gi, 'facilitate'],
    [/\bbig\b/gi, 'substantial'],
    [/\bget\b/gi, 'obtain'],
  ];
  vocab.forEach(([pattern, replacement]) => {
    if (pattern.test(t)) {
      t = t.replace(pattern, replacement);
    }
  });
  changes.push('Applied formal vocabulary');

  return t;
}

function applySupervisorStyle(text: string, changes: string[]): string {
  // Split on question marks or sentences and reformat as structured questions
  const lines = text
    .split(/(?<=[.!?])\s+|(\?)\s+/)
    .map((l) => l?.trim())
    .filter((l) => l && l.length > 2);

  const questions = lines.filter((l) => l.endsWith('?'));
  const statements = lines.filter((l) => !l.endsWith('?'));

  let result = '';

  if (statements.length > 0) {
    result += `Context:\n${statements.join(' ')}\n\n`;
    changes.push('Separated context from questions');
  }

  if (questions.length > 0) {
    result += `Questions for clarification:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
    changes.push('Numbered questions for clarity');
  } else if (statements.length > 0) {
    // No questions found — create a clarification request
    result = `I am writing regarding the following:\n\n${text}\n\nCould you please confirm the above and let me know the preferred next step?`;
    changes.push('Added clarification request');
  }

  if (!result.includes('Kind regards') && !result.includes('Thank')) {
    result += '\n\nThank you for your time and guidance.';
    changes.push('Added professional closing');
  }

  return result;
}

function applyActionListStyle(text: string, changes: string[]): string {
  // Split into sentences and convert each to an action item
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) ?? [text];

  const actions = sentences
    .map((s) => {
      let action = s.trim().replace(/[.!?]$/, '');
      if (!action) return null;

      // If it doesn't start with a verb, try to extract the action
      const verbPattern = /^(to\s+)?(check|update|review|send|complete|add|remove|write|create|fix|clarify|confirm|ask|discuss|decide|schedule|prepare|test|implement|plan|document)/i;
      if (!verbPattern.test(action)) {
        // Convert to imperative
        action = action.replace(/^I (need to|should|will|want to|am going to)\s+/i, '');
        action = action.replace(/^We (need to|should|will|want to|are going to)\s+/i, '');
        action = action.charAt(0).toUpperCase() + action.slice(1);
      }
      return `• ${action}`;
    })
    .filter(Boolean);

  changes.push('Converted to action list');
  return actions.join('\n') || `• ${text}`;
}

function applyPeerStyle(text: string, changes: string[]): string {
  let t = text.trim();

  // Add casual opening if needed
  const hasCasualOpening = /^(Hey|Hi|Heya|Just|Quick)/i.test(t);
  if (!hasCasualOpening) {
    t = `Hey team — ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
    changes.push('Added casual team opening');
  }

  // Make it more inclusive
  t = t.replace(/\bI need\b/gi, 'We probably need');
  t = t.replace(/\bYou should\b/gi, 'Would someone be up for');
  t = t.replace(/\bThis must\b/gi, 'This probably needs to');

  if (t !== text) changes.push('Made language more inclusive');

  // Add collaborative closing
  if (!t.includes('thoughts?') && !t.includes('let me know') && !t.includes('sound?')) {
    t = `${t} Any thoughts?`;
    changes.push('Added invitation to respond');
  }

  return t;
}

function getTip(style: TranslationStyle, original: string): string | null {
  const wordCount = original.split(/\s+/).length;
  if (style === 'SUPERVISOR_READY' && wordCount > 80) {
    return 'Long messages can be hard to parse. Consider splitting into separate emails if there are more than 3 distinct topics.';
  }
  if (style === 'DIRECT' && /\?/.test(original)) {
    return 'Direct style works best for statements. For questions, try Supervisor-Ready style instead.';
  }
  if (style === 'GENTLE' && wordCount < 10) {
    return 'Very short messages may benefit from a little more context before adding gentle framing.';
  }
  return null;
}

// ─── Social Translation Layer ──────────────────────────────────────────────────

export type SocialSignalType =
  | 'SOFT_DEADLINE'
  | 'HIDDEN_URGENCY'
  | 'OWNERSHIP_AMBIGUITY'
  | 'HIDDEN_ASSUMPTION'
  | 'IMPLIED_CRITICISM'
  | 'UNCLEAR_ACTION'
  | 'PASSIVE_ASSIGNMENT'
  | 'VAGUE_EXPECTATION';

export type SocialSignal = {
  type: SocialSignalType;
  label: string;
  matchedPhrase: string;
  interpretation: string;
  suggestedClarification: string | null;
  severity: 'low' | 'medium' | 'high';
};

export type SocialTranslationResult = {
  original: string;
  signals: SocialSignal[];
  clearedInterpretation: string;
  suggestedResponse: string | null;
  ambiguityScore: number;    // 0–1, how ambiguous the message is
  hasClearAction: boolean;
  summary: string;
};

const SOCIAL_PATTERNS: {
  type: SocialSignalType;
  label: string;
  patterns: RegExp[];
  interpret: (match: string) => string;
  clarify: string | null;
  severity: 'low' | 'medium' | 'high';
}[] = [
  {
    type: 'SOFT_DEADLINE',
    label: 'Soft deadline',
    patterns: [
      /\bsoon\b/gi,
      /\bwhen (you get a chance|you have time|possible)\b/gi,
      /\bas soon as (possible|you can)\b/gi,
      /\bASAP\b/g,
      /\bwhenever you('re| are) ready\b/gi,
      /\bbefore (next week|the weekend|end of week|EOW|EOM)\b/gi,
      /\bin (a|the) (timely|reasonable) manner\b/gi,
      /\bshortly\b/gi,
      /\bin (the|a) few days\b/gi,
    ],
    interpret: (m) => `"${m}" implies a deadline that is not explicitly stated. This is a soft deadline — the actual urgency is unclear.`,
    clarify: 'Ask for a specific date: "Could you clarify when exactly you need this by?"',
    severity: 'medium',
  },
  {
    type: 'HIDDEN_URGENCY',
    label: 'Hidden urgency',
    patterns: [
      /\bas (you know|discussed|mentioned|agreed)\b/gi,
      /\byou(\'ll| will) (remember|recall)\b/gi,
      /\bI trust you('ll|\'ve| have)\b/gi,
      /\bI (know|trust) you('re| are) (on top of|aware|managing)\b/gi,
      /\bthis (really|really does|does) need(s)?\b/gi,
      /\bI shouldn't have to (say|remind|explain)\b/gi,
      /\bI (expected|assumed) (this would|you would|you'd)\b/gi,
    ],
    interpret: (m) => `"${m}" signals that the sender considers this important or overdue — there may be an implicit expectation that has not been met.`,
    clarify: 'Clarify the specific expectation: "Could you help me understand what was expected at this point?"',
    severity: 'high',
  },
  {
    type: 'OWNERSHIP_AMBIGUITY',
    label: 'Unclear ownership',
    patterns: [
      /\bsomeone (should|needs to|ought to)\b/gi,
      /\bwe need to\b/gi,
      /\bthe team (should|needs to|ought to|must)\b/gi,
      /\bit would be (good|great|helpful|ideal) if\b/gi,
      /\bit needs to be done\b/gi,
      /\bthis (should|needs to|must) happen\b/gi,
      /\bcan (someone|anyone)\b/gi,
    ],
    interpret: (m) => `"${m}" does not assign responsibility to a specific person. Tasks without a clear owner are at high risk of not being completed.`,
    clarify: 'Ask directly: "Who specifically should take this on?"',
    severity: 'high',
  },
  {
    type: 'HIDDEN_ASSUMPTION',
    label: 'Hidden assumption',
    patterns: [
      /\bas (you|we) (know|are aware|can see|discussed)\b/gi,
      /\bobviously\b/gi,
      /\bclearly\b/gi,
      /\bof course\b/gi,
      /\bit goes without saying\b/gi,
      /\bneedless to say\b/gi,
      /\bI assume (you|we)\b/gi,
      /\bassuming (you|we|that)\b/gi,
    ],
    interpret: (m) => `"${m}" assumes shared knowledge or context that may not actually be shared. This creates invisible expectations.`,
    clarify: 'Ask for explicit context: "Could you walk me through the background on this?"',
    severity: 'medium',
  },
  {
    type: 'IMPLIED_CRITICISM',
    label: 'Implied concern',
    patterns: [
      /\bI (notice[d]?|noticed|observed|see)\b/gi,
      /\bIt seems (like|as though|that)\b/gi,
      /\bI would have (expected|thought|assumed)\b/gi,
      /\bgoing forward[,]?\b/gi,
      /\bin (the )?future[,]?\b/gi,
      /\bI (hope|expect) (this won't|you will|you won't)\b/gi,
      /\bNext time\b/gi,
    ],
    interpret: (m) => `"${m}" may signal concern or indirect feedback. It is often used to point out something without stating it directly.`,
    clarify: 'Ask for direct feedback: "Are you flagging a specific concern I should address?"',
    severity: 'medium',
  },
  {
    type: 'UNCLEAR_ACTION',
    label: 'Unclear next step',
    patterns: [
      /\bthink about\b/gi,
      /\bconsider (whether|if|how|what)\b/gi,
      /\bkeep (this|that|it) in mind\b/gi,
      /\bbe (aware|mindful|conscious) (of|that)\b/gi,
      /\bhave a look\b/gi,
      /\btake a look\b/gi,
    ],
    interpret: (m) => `"${m}" is a vague directive. It implies something should happen but does not specify the action, deadline, or deliverable.`,
    clarify: 'Ask for specifics: "What specifically should I do, and by when?"',
    severity: 'medium',
  },
  {
    type: 'PASSIVE_ASSIGNMENT',
    label: 'Passive-voice assignment',
    patterns: [
      /\b(this|that|it) (should|needs to|ought to) be (done|completed|sent|finished|reviewed|updated)\b/gi,
      /\b(this|that|the document|the task) (will need to|must be)\b/gi,
      /\bhas (yet to|not been|to be)\b/gi,
      /\bhas not been (completed|done|sent|submitted|updated)\b/gi,
    ],
    interpret: (m) => `"${m}" is passive phrasing that avoids naming who is responsible. Without a named owner, this will likely not get done.`,
    clarify: 'Ask: "Who should complete this, and what does done look like?"',
    severity: 'high',
  },
  {
    type: 'VAGUE_EXPECTATION',
    label: 'Vague expectation',
    patterns: [
      /\bmore (professional|polished|structured|formal|detailed|thorough)\b/gi,
      /\bbetter quality\b/gi,
      /\bup to (the|a) standard\b/gi,
      /\blooks (good|right|correct|proper)\b/gi,
      /\b(improve|strengthen|enhance) (the|your|this)\b/gi,
      /\bnot quite (there|right|what I expected)\b/gi,
    ],
    interpret: (m) => `"${m}" sets a quality expectation without defining what it means. Without explicit criteria, it is very hard to know when the work is "good enough".`,
    clarify: 'Ask: "Could you describe what the improved version should look like specifically?"',
    severity: 'high',
  },
];

/**
 * Analyses text for social subtext, hidden expectations, and ambiguity.
 */
export function analyzeSocialSubtext(text: string): SocialTranslationResult {
  const signals: SocialSignal[] = [];
  const foundTypes = new Set<SocialSignalType>();

  for (const pattern of SOCIAL_PATTERNS) {
    for (const regex of pattern.patterns) {
      const matches = text.match(new RegExp(regex.source, regex.flags));
      if (matches) {
        const match = matches[0];
        if (!foundTypes.has(pattern.type)) {
          foundTypes.add(pattern.type);
          signals.push({
            type: pattern.type,
            label: pattern.label,
            matchedPhrase: match,
            interpretation: pattern.interpret(match),
            suggestedClarification: pattern.clarify,
            severity: pattern.severity,
          });
        }
      }
    }
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  signals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Ambiguity score (0–1)
  const highCount = signals.filter((s) => s.severity === 'high').length;
  const medCount = signals.filter((s) => s.severity === 'medium').length;
  const ambiguityScore = Math.min(1, (highCount * 0.35 + medCount * 0.15));

  // Has clear action?
  const hasActionVerb = /\b(please|could you|can you|make sure|ensure|complete|send|update|confirm|reply|review|check)\b/i.test(text);
  const hasClearAction = hasActionVerb && !foundTypes.has('UNCLEAR_ACTION');

  // Build cleared interpretation
  const clearedInterpretation = buildClearedInterpretation(text, signals);

  // Suggested response
  const suggestedResponse =
    signals.length > 0
      ? buildSuggestedResponse(signals)
      : null;

  // Summary
  const summary = buildSocialSummary(signals, hasClearAction, ambiguityScore);

  return {
    original: text,
    signals,
    clearedInterpretation,
    suggestedResponse,
    ambiguityScore,
    hasClearAction,
    summary,
  };
}

function buildClearedInterpretation(text: string, signals: SocialSignal[]): string {
  if (signals.length === 0) return 'This message appears clear and direct. No hidden signals detected.';

  const highSignals = signals.filter((s) => s.severity === 'high');
  const parts: string[] = [];

  if (highSignals.some((s) => s.type === 'OWNERSHIP_AMBIGUITY')) {
    parts.push('This message contains a task or action without a named owner.');
  }
  if (highSignals.some((s) => s.type === 'HIDDEN_URGENCY')) {
    parts.push('The sender appears to expect something to already be in progress or completed.');
  }
  if (highSignals.some((s) => s.type === 'PASSIVE_ASSIGNMENT')) {
    parts.push('There is work implied but no one has been explicitly assigned to it.');
  }
  if (highSignals.some((s) => s.type === 'VAGUE_EXPECTATION')) {
    parts.push('A quality expectation is set without concrete success criteria.');
  }

  const softDeadlines = signals.filter((s) => s.type === 'SOFT_DEADLINE');
  if (softDeadlines.length > 0) {
    parts.push(`There is a time reference ("${softDeadlines[0].matchedPhrase}") without a specific date.`);
  }

  const assumptions = signals.filter((s) => s.type === 'HIDDEN_ASSUMPTION');
  if (assumptions.length > 0) {
    parts.push('The message assumes shared context that may not be shared.');
  }

  return parts.length > 0
    ? parts.join(' ')
    : 'The message contains some ambiguous phrasing. Review the highlighted signals below.';
}

function buildSuggestedResponse(signals: SocialSignal[]): string {
  const clarifications = signals
    .filter((s) => s.suggestedClarification)
    .map((s) => s.suggestedClarification!)
    .slice(0, 2);

  if (clarifications.length === 0) return 'No specific clarification appears needed.';

  return `Thank you for your message. To make sure I understand correctly — ${clarifications.join(', and ')}`;
}

function buildSocialSummary(signals: SocialSignal[], hasClearAction: boolean, score: number): string {
  if (signals.length === 0) return 'Message is clear with no ambiguous signals detected.';

  const high = signals.filter((s) => s.severity === 'high').length;
  if (high >= 2) return `High ambiguity detected (score: ${Math.round(score * 100)}%). Multiple signals need clarification before taking action.`;
  if (high === 1) return `One high-severity signal detected. Clarify this before proceeding.`;
  return `${signals.length} subtle signal${signals.length > 1 ? 's' : ''} detected. Overall message is ${hasClearAction ? 'mostly clear' : 'somewhat unclear'}.`;
}

// ─── Meeting Recovery Summary ─────────────────────────────────────────────────

export type RecoveryAction = {
  title: string;
  isUrgent: boolean;
  canDefer: boolean;
  owner: string | null;
  clarificationNeeded: boolean;
};

export type MeetingRecoverySummary = {
  consultationId: string;
  meetingDate: Date;
  supervisorName: string | null;
  studentSummary: string | null;
  topActions: RecoveryAction[];
  whatChanged: string[];
  whatCanWait: string[];
  clarificationItems: string[];
  lowEnergyStart: string;
  isAvailable: boolean;
};

export async function getMeetingRecoverySummary(
  consultationId: string,
  userId: string
): Promise<MeetingRecoverySummary> {
  const booking = await prisma.consultationBooking.findUnique({
    where: { id: consultationId },
    include: {
      team: {
        include: {
          supervisor: { include: { user: { select: { name: true } } } },
        },
      },
      meetingNote: true,
      feedbackParse: true,
    },
  });

  const empty: MeetingRecoverySummary = {
    consultationId,
    meetingDate: new Date(),
    supervisorName: null,
    studentSummary: null,
    topActions: [],
    whatChanged: [],
    whatCanWait: [],
    clarificationItems: [],
    lowEnergyStart: 'Review the meeting notes and highlight one thing you want to follow up on.',
    isAvailable: false,
  };

  if (!booking) return empty;

  const supervisorName = booking.team?.supervisor?.user.name ?? null;
  const feedbackParse = booking.feedbackParse ?? null;

  if (!feedbackParse) return { ...empty, meetingDate: booking.slotStart, supervisorName, isAvailable: false };

  // Parse action items from JSON
  let rawActions: Array<{
    title: string;
    priority?: string;
    dueHint?: string;
    suggestedOwnerLabel?: string;
  }> = [];
  try {
    rawActions = Array.isArray(feedbackParse.actionItems)
      ? (feedbackParse.actionItems as typeof rawActions)
      : [];
  } catch {
    rawActions = [];
  }

  const topActions: RecoveryAction[] = rawActions.slice(0, 5).map((a) => ({
    title: a.title,
    isUrgent: a.priority === 'HIGH' || a.priority === 'URGENT',
    canDefer: a.priority === 'LOW',
    owner: a.suggestedOwnerLabel ?? null,
    clarificationNeeded: false,
  }));

  // Ambiguities from parse
  let ambiguities: string[] = [];
  try {
    ambiguities = Array.isArray(feedbackParse.ambiguities)
      ? (feedbackParse.ambiguities as string[])
      : [];
  } catch {
    ambiguities = [];
  }

  // Suggested first steps
  let suggestedFirstSteps: string[] = [];
  try {
    suggestedFirstSteps = Array.isArray(feedbackParse.suggestedFirstSteps)
      ? (feedbackParse.suggestedFirstSteps as string[])
      : [];
  } catch {
    suggestedFirstSteps = [];
  }

  // What changed
  const whatChanged = [
    booking.meetingNote ? 'Meeting notes recorded by supervisor' : null,
    feedbackParse.actionItems && (feedbackParse.actionItems as unknown[]).length > 0
      ? `${(feedbackParse.actionItems as unknown[]).length} action item${(feedbackParse.actionItems as unknown[]).length !== 1 ? 's' : ''} identified`
      : null,
    ambiguities.length > 0 ? `${ambiguities.length} item${ambiguities.length !== 1 ? 's' : ''} flagged for clarification` : null,
  ].filter(Boolean) as string[];

  // What can wait
  const whatCanWait = rawActions
    .filter((a) => a.priority === 'LOW')
    .map((a) => a.title)
    .slice(0, 3);

  // Low energy start
  const lowEnergyStart =
    suggestedFirstSteps[0] ??
    topActions[0]?.title ??
    'Read through the meeting summary once and write down one question you want answered.';

  return {
    consultationId,
    meetingDate: booking.slotStart,
    supervisorName,
    studentSummary: (feedbackParse.studentSummary as string | null) ?? null,
    topActions,
    whatChanged,
    whatCanWait,
    clarificationItems: ambiguities.slice(0, 3),
    lowEnergyStart,
    isAvailable: true,
  };
}
