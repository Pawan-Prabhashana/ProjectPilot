/**
 * Team Intelligence Service — Shared Team AI Engine
 *
 * Builds the coordination brain for neurodivergent student teams.
 * Detects: ambiguity accumulation, workload imbalance, hidden blockers,
 * dependency risks, clarification burden, and early friction patterns.
 *
 * Design principles:
 * - All logic is deterministic and explainable in Phase 1.
 * - Every signal includes a reason text so nothing feels mysterious.
 * - No individual blame — friction signals target PATTERNS, not people.
 * - Phase 2: replace scoring bodies with LLM calls; typed interfaces stay stable.
 */

import { prisma } from '@/lib/db';
import { gatherHealthFactors, computeHealthFromFactors } from '@/lib/metrics/health';
import { isWorkloadFair, getWorkloadDistribution } from '@/lib/metrics/workload';
import type { FrictionEventType, SignalSeverity, ContributionType } from '@prisma/client';

export { isWorkloadFair, getWorkloadDistribution };

// ─── Types ────────────────────────────────────────────────────────────────────

export type TeamSignalSeverity = 'info' | 'warning' | 'critical';

export type SignalCategory =
  | 'workload'
  | 'ambiguity'
  | 'blocker'
  | 'dependency'
  | 'engagement'
  | 'coordination';

export type HealthSignalItem = {
  id: string;
  category: SignalCategory;
  severity: TeamSignalSeverity;
  title: string;
  explanation: string;
  metric: string;
  recommendation: string | null;
  affectedCount: number;
};

export type AmbiguityItem = {
  taskId: string;
  taskTitle: string;
  reasons: string[];
  severity: 'low' | 'medium' | 'high';
  isBlockingOthers: boolean;
  priority: string;
};

export type WorkloadProfile = {
  userId: string;
  name: string | null;
  openTaskCount: number;
  overdueTaskCount: number;
  heavyTaskCount: number;
  blockerBurdenCount: number;
  estimatedHoursRemaining: number;
  hiddenWorkScore: number;
  isConcentrated: boolean;
  concentrationReason: string | null;
};

export type DependencyRiskItem = {
  taskId: string;
  taskTitle: string;
  assigneeName: string | null;
  daysSinceUpdate: number;
  downstreamCount: number;
  severity: 'warning' | 'critical';
  riskDescription: string;
};

export type ClarificationProfile = {
  userId: string;
  name: string | null;
  hiddenWorkTotal: number;
  breakdown: { type: string; label: string; count: number }[];
  shareOfTeamHiddenWork: number;
  isConcentrated: boolean;
};

export type FrictionSignal = {
  id: string;
  pattern: string;
  description: string;
  affectedArea: string;
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
};

export type TeamRecommendation = {
  id: string;
  category: 'ownership' | 'clarity' | 'load' | 'blocker' | 'coordination' | 'preparation';
  text: string;
  urgency: 'high' | 'medium' | 'low';
  tracedTo: string;
};

export type TeamIntelligenceDashboard = {
  teamId: string;
  generatedAt: Date;
  health: {
    status: string;
    signals: HealthSignalItem[];
    signalSummary: string;
  };
  ambiguity: {
    totalItems: number;
    items: AmbiguityItem[];
    summary: string;
  };
  workload: {
    isFair: boolean;
    profiles: WorkloadProfile[];
    meanOpenTasks: number;
    summary: string;
  };
  dependencies: {
    risks: DependencyRiskItem[];
    totalBlockedTasks: number;
    summary: string;
  };
  clarification: {
    profiles: ClarificationProfile[];
    isConcentrated: boolean;
    teamHiddenWorkTotal: number;
    summary: string;
  };
  friction: {
    signals: FrictionSignal[];
    summary: string;
  };
  recommendations: TeamRecommendation[];
};

// Contribution types that represent hidden/support work
const HIDDEN_WORK_TYPES: { type: ContributionType; label: string }[] = [
  { type: 'CLARIFICATION',      label: 'Clarification' },
  { type: 'MEETING_PREP',       label: 'Meeting prep' },
  { type: 'COORDINATION',       label: 'Coordination' },
  { type: 'UNBLOCKING_SUPPORT', label: 'Unblocking support' },
  { type: 'REVIEW',             label: 'Review' },
];

// ─── Main Dashboard Builder ───────────────────────────────────────────────────

export async function buildTeamIntelligenceDashboard(
  teamId: string
): Promise<TeamIntelligenceDashboard> {
  const now = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // ── 1. Fetch team with members ───────────────────────────────────────────
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      healthStatus: true,
      project: { select: { id: true, title: true } },
      members: {
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!team?.project) return buildEmptyDashboard(teamId);

  const projectId = team.project.id;
  const members = team.members;
  const memberCount = members.length || 1;

  // ── 2. Fetch tasks ────────────────────────────────────────────────────────
  const tasks = await prisma.task.findMany({
    where: { projectId, status: { notIn: ['DONE', 'CANCELLED'] } },
    select: {
      id: true,
      title: true,
      description: true,
      doneCriteria: true,
      blockerNote: true,
      cognitiveLoad: true,
      status: true,
      priority: true,
      dueDate: true,
      assigneeId: true,
      estimatedMinutes: true,
      milestoneId: true,
      updatedAt: true,
      assignee: { select: { id: true, name: true } },
      outgoingDeps: {
        select: {
          id: true,
          targetTaskId: true,
          targetTask: { select: { id: true, title: true, status: true } },
        },
      },
    },
  });

  // ── 3. Fetch AmbiguityFlags (polymorphic — separate query) ─────────────
  const taskIds = tasks.map((t) => t.id);
  const ambiguityFlags = taskIds.length > 0
    ? await prisma.ambiguityFlag.findMany({
        where: { entityType: 'TASK', entityId: { in: taskIds }, resolvedAt: null },
        select: { entityId: true, description: true, severity: true },
      })
    : [];

  // Group flags by taskId for O(1) lookups
  const flagsByTaskId = new Map<string, typeof ambiguityFlags>();
  for (const flag of ambiguityFlags) {
    const existing = flagsByTaskId.get(flag.entityId) ?? [];
    existing.push(flag);
    flagsByTaskId.set(flag.entityId, existing);
  }

  // ── 4. Parallel data fetch ────────────────────────────────────────────────
  const [
    healthFactors,
    workloadFair,
    contributionLogs,
    frictionEvents,
    openQuestions,
    upcomingConsultation,
  ] = await Promise.all([
    gatherHealthFactors(teamId),
    isWorkloadFair(teamId),
    prisma.contributionLog.findMany({
      where: { projectId },
      select: { userId: true, contributionType: true, loggedAt: true },
      orderBy: { loggedAt: 'desc' },
      take: 300,
    }),
    prisma.socialFrictionEvent.findMany({
      where: { teamId, resolved: false },
      select: { eventType: true, flaggedAt: true, severity: true, context: true },
      orderBy: { flaggedAt: 'desc' },
    }),
    prisma.openQuestion.findMany({
      where: { projectId, resolvedAt: null },
      select: { id: true, priority: true },
    }),
    prisma.consultationBooking.findFirst({
      where: { teamId, status: 'CONFIRMED', slotStart: { gte: now } },
      select: { id: true, slotStart: true, agenda: true, purpose: true },
      orderBy: { slotStart: 'asc' },
    }),
  ]);

  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < now
  );

  const totalOpen = tasks.length;
  const meanTasks = totalOpen / memberCount;

  // ─────────────────────────────────────────────────────────────────────────
  // HEALTH SIGNALS
  // ─────────────────────────────────────────────────────────────────────────
  const healthSignals: HealthSignalItem[] = [];

  if (overdueTasks.length >= 3) {
    healthSignals.push({
      id: 'overdue-critical',
      category: 'blocker',
      severity: 'critical',
      title: 'Overdue task accumulation',
      explanation: `${overdueTasks.length} tasks are overdue. A backlog this size suggests the team is falling behind its planned pace and risk is compounding.`,
      metric: `${overdueTasks.length} tasks overdue`,
      recommendation: 'Triage overdue tasks at your next team meeting. Mark out-of-scope tasks as cancelled, and reschedule the rest with realistic new dates.',
      affectedCount: overdueTasks.length,
    });
  } else if (overdueTasks.length > 0) {
    healthSignals.push({
      id: 'overdue-warning',
      category: 'blocker',
      severity: 'warning',
      title: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`,
      explanation: 'Some tasks have passed their due date. Catching these early prevents a growing backlog.',
      metric: `${overdueTasks.length} overdue`,
      recommendation: 'Review each overdue task: reschedule, reassign, or add a blocker note if something is preventing progress.',
      affectedCount: overdueTasks.length,
    });
  }

  if (!healthFactors.hasActivityThisWeek && totalOpen > 0) {
    healthSignals.push({
      id: 'no-activity',
      category: 'engagement',
      severity: 'warning',
      title: 'No contributions logged this week',
      explanation: 'No team member has logged a contribution in the past 7 days. This may signal a stall or that work is happening but not being recorded.',
      metric: 'No activity in 7 days',
      recommendation: 'Encourage the team to log even small contributions. Check if any blockers are preventing progress that should be escalated.',
      affectedCount: memberCount,
    });
  }

  if (!workloadFair && memberCount > 1) {
    const overloadedCount = members.filter(({ user }) => {
      const userTaskCount = tasks.filter((t) => t.assigneeId === user.id).length;
      return meanTasks > 0 && userTaskCount > meanTasks * 1.75;
    }).length;

    healthSignals.push({
      id: 'workload-imbalance',
      category: 'workload',
      severity: 'warning',
      title: 'Task load is unevenly distributed',
      explanation: `At ${Math.round(meanTasks * 10) / 10} tasks per person on average, one or more members are carrying significantly more. This increases burnout risk and creates single points of failure.`,
      metric: `${overloadedCount} member${overloadedCount !== 1 ? 's' : ''} overloaded`,
      recommendation: 'Review task assignments. Consider moving one or two tasks from the most loaded member to someone with lighter capacity.',
      affectedCount: overloadedCount,
    });
  }

  if (!healthFactors.nextMilestoneIsOnTrack) {
    healthSignals.push({
      id: 'milestone-risk',
      category: 'dependency',
      severity: 'critical',
      title: 'Next milestone is at risk',
      explanation: 'The upcoming milestone deadline has passed or is close with insufficient progress signals.',
      metric: 'Milestone at risk',
      recommendation: 'Prioritise tasks linked to this milestone. Raise this at the next consultation and include it in the meeting brief.',
      affectedCount: 1,
    });
  }

  const totalAmbiguityFlags = ambiguityFlags.length;
  if (totalAmbiguityFlags >= 3) {
    healthSignals.push({
      id: 'ambiguity-accumulation',
      category: 'ambiguity',
      severity: 'warning',
      title: 'Ambiguity accumulating in task board',
      explanation: `${totalAmbiguityFlags} ambiguity flags exist across the task board. Unresolved ambiguity creates invisible blockers and increases cognitive load.`,
      metric: `${totalAmbiguityFlags} flag${totalAmbiguityFlags !== 1 ? 's' : ''}`,
      recommendation: 'Review flagged tasks and add owners, due dates, and definitions of done for the most critical ones.',
      affectedCount: totalAmbiguityFlags,
    });
  }

  const unassignedTasks = tasks.filter((t) => !t.assigneeId);
  if (unassignedTasks.length >= 2) {
    healthSignals.push({
      id: 'unassigned-tasks',
      category: 'ambiguity',
      severity: 'warning',
      title: 'Several tasks have no assigned owner',
      explanation: `${unassignedTasks.length} tasks are unassigned. Ownerless tasks are the most common source of invisible work — done by whoever notices, or not done at all.`,
      metric: `${unassignedTasks.length} unassigned`,
      recommendation: 'Assign an explicit owner to each unassigned task before the next team session.',
      affectedCount: unassignedTasks.length,
    });
  }

  const urgentQuestions = openQuestions.filter(
    (q) => q.priority === 'HIGH' || q.priority === 'URGENT'
  );
  if (urgentQuestions.length > 0) {
    healthSignals.push({
      id: 'open-questions',
      category: 'coordination',
      severity: urgentQuestions.length >= 2 ? 'warning' : 'info',
      title: `${urgentQuestions.length} high-priority question${urgentQuestions.length > 1 ? 's' : ''} unresolved`,
      explanation: 'High-priority questions in Project Brain often stall implementation. Unresolved decisions are invisible blockers.',
      metric: `${urgentQuestions.length} high/urgent`,
      recommendation: 'Bring these questions to the next supervisor consultation. Add them to the meeting brief.',
      affectedCount: urgentQuestions.length,
    });
  }

  if (upcomingConsultation && !upcomingConsultation.agenda && !upcomingConsultation.purpose) {
    const daysUntil = Math.ceil(
      (upcomingConsultation.slotStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil <= 7) {
      healthSignals.push({
        id: 'meeting-no-agenda',
        category: 'coordination',
        severity: 'info',
        title: 'Upcoming meeting has no agenda',
        explanation: `Consultation in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} has no agenda or purpose added yet. Unstructured meetings are harder for neurodivergent participants.`,
        metric: `${daysUntil}d until meeting`,
        recommendation: 'Add a meeting purpose and at least one topic. This also helps the supervisor prepare.',
        affectedCount: memberCount,
      });
    }
  }

  const healthStatus = computeHealthFromFactors(healthFactors);
  const signalSummary = buildHealthSummary(healthSignals, healthStatus);

  // ─────────────────────────────────────────────────────────────────────────
  // AMBIGUITY ITEMS
  // ─────────────────────────────────────────────────────────────────────────
  const ambiguityItems: AmbiguityItem[] = [];

  for (const task of tasks) {
    const reasons: string[] = [];
    if (!task.assigneeId) reasons.push('No assignee — unclear who is responsible');
    if (!task.dueDate) reasons.push('No due date — deadline is unknown');
    if (!task.doneCriteria) reasons.push('No definition of done — unclear what completion looks like');
    if (!task.description) reasons.push('No description — task purpose is not documented');

    const taskFlags = flagsByTaskId.get(task.id) ?? [];
    for (const flag of taskFlags) {
      reasons.push(flag.description);
    }

    if (reasons.length === 0) continue;

    // A task blocks others if it has outgoing deps whose targets are incomplete
    const isBlockingOthers = task.outgoingDeps.some(
      (dep) => dep.targetTask.status !== 'DONE' && dep.targetTask.status !== 'CANCELLED'
    );

    const severity: AmbiguityItem['severity'] =
      reasons.length >= 3 ? 'high' : reasons.length >= 2 ? 'medium' : 'low';

    ambiguityItems.push({
      taskId: task.id,
      taskTitle: task.title,
      reasons,
      severity,
      isBlockingOthers,
      priority: task.priority,
    });
  }

  ambiguityItems.sort((a, b) => {
    if (a.isBlockingOthers !== b.isBlockingOthers) return a.isBlockingOthers ? -1 : 1;
    const sev = { high: 0, medium: 1, low: 2 };
    return sev[a.severity] - sev[b.severity];
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WORKLOAD PROFILES
  // ─────────────────────────────────────────────────────────────────────────
  const workloadProfiles: WorkloadProfile[] = members.map(({ user }) => {
    const myTasks = tasks.filter((t) => t.assigneeId === user.id);
    const myOverdue = myTasks.filter((t) => t.dueDate && t.dueDate < now);
    const heavyTaskCount = myTasks.filter((t) => (t.cognitiveLoad ?? 0) >= 4).length;

    // Tasks this person is blocking: tasks they are assigned to that others depend on
    const blockerBurdenCount = tasks.filter(
      (t) =>
        t.assigneeId === user.id &&
        t.outgoingDeps.some(
          (dep) => dep.targetTask.status !== 'DONE' && dep.targetTask.status !== 'CANCELLED'
        )
    ).length;

    const estimatedMinutes = myTasks.reduce(
      (sum, t) => sum + (t.estimatedMinutes ?? 0),
      0
    );

    const myHiddenWork = contributionLogs.filter(
      (c) =>
        c.userId === user.id &&
        c.loggedAt >= sevenDaysAgo &&
        HIDDEN_WORK_TYPES.some((hw) => hw.type === c.contributionType)
    );

    const isConcentrated = meanTasks > 0 && myTasks.length > meanTasks * 1.75;
    const concentrationReason = isConcentrated
      ? `${myTasks.length} tasks vs ${Math.round(meanTasks * 10) / 10} team average`
      : null;

    return {
      userId: user.id,
      name: user.name,
      openTaskCount: myTasks.length,
      overdueTaskCount: myOverdue.length,
      heavyTaskCount,
      blockerBurdenCount,
      estimatedHoursRemaining: Math.round(estimatedMinutes / 60),
      hiddenWorkScore: myHiddenWork.length,
      isConcentrated,
      concentrationReason,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DEPENDENCY RISKS
  // ─────────────────────────────────────────────────────────────────────────
  const dependencyRisks: DependencyRiskItem[] = [];

  for (const task of tasks) {
    // Only care about tasks that have other tasks depending on them
    const incompleteDownstream = task.outgoingDeps.filter(
      (dep) => dep.targetTask.status !== 'DONE' && dep.targetTask.status !== 'CANCELLED'
    );
    if (incompleteDownstream.length === 0) continue;

    const daysSinceUpdate = Math.floor(
      (now.getTime() - task.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isStalled = daysSinceUpdate >= 7;
    const hasBlocker = !!task.blockerNote;
    const downstreamCount = incompleteDownstream.length;

    let severity: DependencyRiskItem['severity'] = 'warning';
    let riskDescription = '';

    if (hasBlocker && isStalled) {
      severity = 'critical';
      riskDescription = `Blocked and stalled for ${daysSinceUpdate}d — ${downstreamCount} downstream task${downstreamCount > 1 ? 's' : ''} cannot proceed.`;
    } else if (hasBlocker) {
      severity = 'critical';
      riskDescription = `Active blocker. ${downstreamCount} downstream task${downstreamCount > 1 ? 's' : ''} are waiting.`;
    } else if (isStalled) {
      severity = 'warning';
      riskDescription = `No updates in ${daysSinceUpdate} days with ${downstreamCount} downstream task${downstreamCount > 1 ? 's' : ''} waiting.`;
    } else {
      riskDescription = `${downstreamCount} downstream task${downstreamCount > 1 ? 's' : ''} depend on this. Monitor for stalls.`;
    }

    dependencyRisks.push({
      taskId: task.id,
      taskTitle: task.title,
      assigneeName: task.assignee?.name ?? null,
      daysSinceUpdate,
      downstreamCount,
      severity,
      riskDescription,
    });
  }

  dependencyRisks.sort((a, b) => {
    const order = { critical: 0, warning: 1 };
    const diff = order[a.severity] - order[b.severity];
    return diff !== 0 ? diff : b.downstreamCount - a.downstreamCount;
  });

  const totalBlockedTasks = tasks.filter((t) => !!t.blockerNote).length;

  // ─────────────────────────────────────────────────────────────────────────
  // CLARIFICATION BURDEN
  // ─────────────────────────────────────────────────────────────────────────
  const allHiddenWork = contributionLogs.filter((c) =>
    HIDDEN_WORK_TYPES.some((hw) => hw.type === c.contributionType)
  );
  const teamHiddenWorkTotal = allHiddenWork.length;

  const clarificationProfiles: ClarificationProfile[] = members.map(({ user }) => {
    const myHiddenWork = allHiddenWork.filter((c) => c.userId === user.id);
    const breakdown = HIDDEN_WORK_TYPES.map((hw) => ({
      type: hw.type,
      label: hw.label,
      count: myHiddenWork.filter((c) => c.contributionType === hw.type).length,
    })).filter((b) => b.count > 0);

    const shareOfTeamHiddenWork =
      teamHiddenWorkTotal > 0 ? myHiddenWork.length / teamHiddenWorkTotal : 0;
    const isConcentrated = memberCount > 1 && shareOfTeamHiddenWork >= 0.5;

    return {
      userId: user.id,
      name: user.name,
      hiddenWorkTotal: myHiddenWork.length,
      breakdown,
      shareOfTeamHiddenWork,
      isConcentrated,
    };
  });

  const clarificationIsConcentrated = clarificationProfiles.some((p) => p.isConcentrated);

  // ─────────────────────────────────────────────────────────────────────────
  // FRICTION SIGNALS (pattern-based, non-stigmatising)
  // ─────────────────────────────────────────────────────────────────────────
  const frictionSignals: FrictionSignal[] = [];

  const criticalDeps = dependencyRisks.filter((d) => d.severity === 'critical');
  if (criticalDeps.length > 0) {
    frictionSignals.push({
      id: 'dependency-chain-stall',
      pattern: 'Dependency chain stall',
      description: `${criticalDeps.length} upstream task${criticalDeps.length > 1 ? 's are' : ' is'} blocked or stalled while downstream work waits. These are compounding risks.`,
      affectedArea: 'Task delivery',
      recommendation: 'Triage blocked upstream tasks first. If blocked externally, escalate to the supervisor for unblocking support.',
      severity: 'high',
    });
  }

  if (clarificationIsConcentrated) {
    frictionSignals.push({
      id: 'clarification-concentration',
      pattern: 'Coordination burden concentration',
      description: 'One or more team members are carrying a disproportionate share of clarification, coordination, and meeting-prep work. This invisible work often goes unrecognised and leads to quiet burnout.',
      affectedArea: 'Team coordination',
      recommendation: 'Make coordination work visible. Explicitly share or rotate clarification and meeting-prep responsibilities.',
      severity: 'medium',
    });
  }

  if (overdueTasks.length >= 2) {
    const milestoneSet = new Set(overdueTasks.map((t) => {
      const full = tasks.find((ft) => ft.id === t.id);
      return full?.milestoneId ?? null;
    }).filter(Boolean));

    if (milestoneSet.size === 1) {
      frictionSignals.push({
        id: 'milestone-overdue-cluster',
        pattern: 'Overdue tasks clustered in one milestone',
        description: 'Multiple overdue tasks all belong to the same milestone. This points to a planning gap, scope underestimate, or a shared blocker affecting a whole work area.',
        affectedArea: 'Milestone delivery',
        recommendation: 'Review whether this milestone scope was realistic. Consider breaking it down or rescoping with supervisor guidance.',
        severity: 'medium',
      });
    }
  }

  if (ambiguityItems.filter((a) => a.isBlockingOthers).length > 0) {
    frictionSignals.push({
      id: 'ambiguous-critical-path',
      pattern: 'Ambiguous tasks on the critical path',
      description: 'One or more tasks with ambiguity signals are blocking downstream work. Ambiguity on the critical path creates compounding uncertainty.',
      affectedArea: 'Task clarity',
      recommendation: 'Prioritise clarifying the tasks with the most downstream dependents first.',
      severity: 'medium',
    });
  }

  if (frictionEvents.length > 0) {
    frictionSignals.push({
      id: 'persistent-friction-events',
      pattern: `${frictionEvents.length} unresolved coordination event${frictionEvents.length > 1 ? 's' : ''}`,
      description: 'Logged friction events indicate recurring coordination challenges. Patterns that are not addressed explicitly tend to compound over time.',
      affectedArea: 'Team coordination',
      recommendation: 'Review and explicitly close each friction event at the next team session. If recurring, address the root cause.',
      severity: frictionEvents.length >= 3 ? 'high' : 'medium',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECOMMENDATIONS
  // ─────────────────────────────────────────────────────────────────────────
  const recommendations = buildRecommendations({
    ambiguityItems,
    workloadProfiles,
    dependencyRisks,
    clarificationProfiles,
    workloadFair,
    memberCount,
    upcomingConsultation,
    healthSignals,
  });

  return {
    teamId,
    generatedAt: now,
    health: {
      status: healthStatus,
      signals: healthSignals,
      signalSummary,
    },
    ambiguity: {
      totalItems: ambiguityItems.length,
      items: ambiguityItems.slice(0, 15),
      summary: buildAmbiguitySummary(ambiguityItems),
    },
    workload: {
      isFair: workloadFair,
      profiles: workloadProfiles,
      meanOpenTasks: Math.round(meanTasks * 10) / 10,
      summary: buildWorkloadSummary(workloadProfiles, workloadFair, meanTasks),
    },
    dependencies: {
      risks: dependencyRisks.slice(0, 10),
      totalBlockedTasks,
      summary: buildDependencySummary(dependencyRisks, totalBlockedTasks),
    },
    clarification: {
      profiles: clarificationProfiles,
      isConcentrated: clarificationIsConcentrated,
      teamHiddenWorkTotal,
      summary: buildClarificationSummary(clarificationProfiles, clarificationIsConcentrated, teamHiddenWorkTotal),
    },
    friction: {
      signals: frictionSignals,
      summary: buildFrictionSummary(frictionSignals),
    },
    recommendations: recommendations.slice(0, 8),
  };
}

// ─── Summary builders ─────────────────────────────────────────────────────────

function buildHealthSummary(signals: HealthSignalItem[], status: string): string {
  const criticals = signals.filter((s) => s.severity === 'critical').length;
  const warnings = signals.filter((s) => s.severity === 'warning').length;
  if (status === 'CRITICAL')
    return `Team health is critical. ${criticals} critical signal${criticals !== 1 ? 's' : ''} require immediate attention.`;
  if (status === 'AT_RISK')
    return `Team is at risk. ${warnings} warning${warnings !== 1 ? 's' : ''} detected — early action prevents escalation.`;
  if (signals.length === 0)
    return 'No significant health signals detected. The team appears to be on track.';
  return `${signals.length} signal${signals.length !== 1 ? 's' : ''} detected. Review and address before the next milestone.`;
}

function buildAmbiguitySummary(items: AmbiguityItem[]): string {
  if (items.length === 0) return 'No task ambiguity detected. All tasks have clear ownership and criteria.';
  const blocking = items.filter((i) => i.isBlockingOthers).length;
  const high = items.filter((i) => i.severity === 'high').length;
  const parts = [`${items.length} task${items.length !== 1 ? 's' : ''} have ambiguity signals.`];
  if (high > 0) parts.push(`${high} high-severity.`);
  if (blocking > 0) parts.push(`${blocking} blocking downstream work.`);
  return parts.join(' ');
}

function buildWorkloadSummary(profiles: WorkloadProfile[], isFair: boolean, mean: number): string {
  if (profiles.length === 0) return 'No member data available.';
  const concentrated = profiles.filter((p) => p.isConcentrated);
  if (!isFair && concentrated.length > 0) {
    return `Load distribution is uneven. ${concentrated.length} member${concentrated.length > 1 ? 's are' : ' is'} carrying more than 1.75× the team average of ${Math.round(mean * 10) / 10} tasks.`;
  }
  return `Load distribution looks balanced at ~${Math.round(mean * 10) / 10} open tasks per member.`;
}

function buildDependencySummary(risks: DependencyRiskItem[], blockedCount: number): string {
  if (risks.length === 0 && blockedCount === 0) return 'No dependency risks detected.';
  const critical = risks.filter((r) => r.severity === 'critical').length;
  const parts: string[] = [];
  if (blockedCount > 0) parts.push(`${blockedCount} task${blockedCount !== 1 ? 's' : ''} currently blocked.`);
  if (critical > 0) parts.push(`${critical} critical risk${critical !== 1 ? 's' : ''} may delay downstream work.`);
  return parts.join(' ') || `${risks.length} dependency pattern${risks.length !== 1 ? 's' : ''} to watch.`;
}

function buildClarificationSummary(
  profiles: ClarificationProfile[],
  isConcentrated: boolean,
  total: number
): string {
  if (total === 0) return 'No coordination/support contributions logged yet.';
  const concentrated = profiles.filter((p) => p.isConcentrated);
  if (isConcentrated && concentrated.length > 0) {
    return `${concentrated[0].name ?? 'One member'} is carrying ${Math.round(concentrated[0].shareOfTeamHiddenWork * 100)}% of team coordination and support work. This invisible burden deserves recognition.`;
  }
  return `${total} coordination/support contribution${total !== 1 ? 's' : ''} logged. Distribution looks reasonable.`;
}

function buildFrictionSummary(signals: FrictionSignal[]): string {
  if (signals.length === 0) return 'No friction patterns detected. Team coordination appears smooth.';
  const high = signals.filter((s) => s.severity === 'high').length;
  if (high > 0)
    return `${high} high-severity coordination pattern${high !== 1 ? 's' : ''} detected. Discuss at the next team meeting.`;
  return `${signals.length} coordination pattern${signals.length !== 1 ? 's' : ''} detected. Review the recommendations below.`;
}

// ─── Recommendation builder ───────────────────────────────────────────────────

function buildRecommendations(ctx: {
  ambiguityItems: AmbiguityItem[];
  workloadProfiles: WorkloadProfile[];
  dependencyRisks: DependencyRiskItem[];
  clarificationProfiles: ClarificationProfile[];
  workloadFair: boolean;
  memberCount: number;
  healthSignals: HealthSignalItem[];
  upcomingConsultation: { id: string; slotStart: Date; agenda: string | null; purpose: string | null } | null;
}): TeamRecommendation[] {
  const recs: TeamRecommendation[] = [];

  const unowned = ctx.ambiguityItems.filter((a) =>
    a.reasons.some((r) => r.includes('No assignee'))
  );
  if (unowned.length > 0) {
    recs.push({
      id: 'assign-owners',
      category: 'ownership',
      text: `Assign explicit owners to ${unowned.length} unassigned task${unowned.length > 1 ? 's' : ''} before the next session. Ownerless tasks become invisible work.`,
      urgency: unowned.length >= 3 ? 'high' : 'medium',
      tracedTo: 'Ambiguity: no assignee',
    });
  }

  const noDOD = ctx.ambiguityItems.filter((a) =>
    a.reasons.some((r) => r.includes('definition of done'))
  );
  if (noDOD.length > 0) {
    const highBlockingNoDOD = noDOD.filter((a) => a.isBlockingOthers).length;
    recs.push({
      id: 'add-done-criteria',
      category: 'clarity',
      text: `Add a "definition of done" to ${noDOD.length} task${noDOD.length > 1 ? 's' : ''}${highBlockingNoDOD > 0 ? ` — ${highBlockingNoDOD} are blocking downstream work` : ''}.`,
      urgency: noDOD.some((a) => a.severity === 'high') ? 'high' : 'medium',
      tracedTo: 'Ambiguity: missing done criteria',
    });
  }

  if (!ctx.workloadFair && ctx.memberCount > 1) {
    const overloaded = ctx.workloadProfiles.filter((p) => p.isConcentrated);
    if (overloaded.length > 0) {
      recs.push({
        id: 'rebalance-load',
        category: 'load',
        text: `Consider redistributing 1–2 tasks from ${overloaded.length > 1 ? 'the most loaded members' : (overloaded[0].name ?? 'the most loaded member')} to members with lighter capacity. This prevents burnout and single points of failure.`,
        urgency: 'medium',
        tracedTo: 'Workload: imbalanced distribution',
      });
    }
  }

  const criticalDeps = ctx.dependencyRisks.filter((d) => d.severity === 'critical');
  if (criticalDeps.length > 0) {
    recs.push({
      id: 'resolve-blockers',
      category: 'blocker',
      text: `Resolve the blocker on "${criticalDeps[0].taskTitle}" urgently — ${criticalDeps[0].downstreamCount} downstream task${criticalDeps[0].downstreamCount > 1 ? 's' : ''} cannot proceed until this is unblocked.`,
      urgency: 'high',
      tracedTo: 'Dependency: critical blocker',
    });
  }

  const concentrated = ctx.clarificationProfiles.filter((p) => p.isConcentrated);
  if (concentrated.length > 0) {
    recs.push({
      id: 'acknowledge-hidden-work',
      category: 'coordination',
      text: `Acknowledge and redistribute coordination work. ${concentrated[0].name ?? 'One member'} is carrying a disproportionate share of clarification and meeting prep. Discuss this as a team.`,
      urgency: 'medium',
      tracedTo: 'Clarification burden: concentrated',
    });
  }

  if (ctx.upcomingConsultation) {
    const daysUntil = Math.ceil(
      (ctx.upcomingConsultation.slotStart.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil <= 5 && !ctx.upcomingConsultation.agenda && !ctx.upcomingConsultation.purpose) {
      recs.push({
        id: 'prepare-meeting',
        category: 'preparation',
        text: `Add a purpose and agenda topics to your consultation in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}. Structured preparation makes meetings more effective and reduces anxiety.`,
        urgency: 'high',
        tracedTo: 'Upcoming consultation: no agenda',
      });
    }
  }

  const openQSignal = ctx.healthSignals.find((s) => s.id === 'open-questions');
  if (openQSignal) {
    recs.push({
      id: 'resolve-open-questions',
      category: 'preparation',
      text: 'Bring unresolved high-priority questions to the next supervisor consultation. Unresolved decisions block implementation and create hidden ambiguity.',
      urgency: openQSignal.severity === 'warning' ? 'medium' : 'low',
      tracedTo: 'Open questions: high priority unresolved',
    });
  }

  const noDueDate = ctx.ambiguityItems.filter((a) =>
    a.reasons.some((r) => r.includes('due date'))
  );
  if (noDueDate.length >= 2) {
    recs.push({
      id: 'add-due-dates',
      category: 'clarity',
      text: `Add due dates to ${noDueDate.length} tasks. Without dates, deadlines become invisible and sprint planning is harder.`,
      urgency: 'low',
      tracedTo: 'Ambiguity: missing due dates',
    });
  }

  const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}

// ─── Empty dashboard ──────────────────────────────────────────────────────────

function buildEmptyDashboard(teamId: string): TeamIntelligenceDashboard {
  return {
    teamId,
    generatedAt: new Date(),
    health: { status: 'ON_TRACK', signals: [], signalSummary: 'No project data found yet.' },
    ambiguity: { totalItems: 0, items: [], summary: 'No project data found.' },
    workload: { isFair: true, profiles: [], meanOpenTasks: 0, summary: 'No team members found.' },
    dependencies: { risks: [], totalBlockedTasks: 0, summary: 'No project data found.' },
    clarification: { profiles: [], isConcentrated: false, teamHiddenWorkTotal: 0, summary: 'No contributions logged yet.' },
    friction: { signals: [], summary: 'No patterns detected.' },
    recommendations: [],
  };
}

// ─── Legacy helpers (preserved for backward compatibility) ───────────────────

export async function snapshotTeamWorkload(teamId: string) {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    select: { userId: true },
  });
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const snapshots = await Promise.all(
    members.map(async ({ userId }) => {
      const [openTaskCount, overdueTaskCount, completedThisWeek, estimateResult] = await Promise.all([
        prisma.task.count({ where: { assigneeId: userId, project: { teamId }, status: { notIn: ['DONE', 'CANCELLED'] } } }),
        prisma.task.count({ where: { assigneeId: userId, project: { teamId }, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { lt: now } } }),
        prisma.task.count({ where: { assigneeId: userId, project: { teamId }, status: 'DONE', updatedAt: { gte: sevenDaysAgo } } }),
        prisma.task.aggregate({ where: { assigneeId: userId, project: { teamId }, status: { notIn: ['DONE', 'CANCELLED'] }, estimatedMinutes: { not: null } }, _sum: { estimatedMinutes: true } }),
      ]);
      return { teamId, userId, openTaskCount, overdueTaskCount, completedThisWeek, estimatedHoursRemaining: estimateResult._sum.estimatedMinutes != null ? estimateResult._sum.estimatedMinutes / 60 : null };
    })
  );
  return prisma.workloadSnapshot.createMany({ data: snapshots });
}

export async function logFrictionEvent(params: {
  teamId: string;
  eventType: FrictionEventType;
  affectedUserId?: string;
  context?: string;
  severity?: SignalSeverity;
}) {
  return prisma.socialFrictionEvent.create({
    data: { teamId: params.teamId, eventType: params.eventType, affectedUserId: params.affectedUserId, context: params.context, severity: params.severity ?? 'MEDIUM' },
  });
}

export async function detectSilentMembers(teamId: string): Promise<string[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const members = await prisma.teamMember.findMany({ where: { teamId }, select: { userId: true } });
  const silentMembers: string[] = [];
  for (const { userId } of members) {
    const hasActivity = await prisma.task.findFirst({ where: { assigneeId: userId, project: { teamId }, updatedAt: { gte: sevenDaysAgo } }, select: { id: true } });
    const hasContribution = await prisma.contributionLog.findFirst({ where: { userId, project: { teamId }, loggedAt: { gte: sevenDaysAgo } }, select: { id: true } });
    if (!hasActivity && !hasContribution) silentMembers.push(userId);
  }
  return silentMembers;
}

export type TeamIntelligenceReport = {
  teamId: string;
  healthStatus: string;
  healthFactors: Awaited<ReturnType<typeof gatherHealthFactors>>;
  workloadIsFair: boolean;
  silentMemberCount: number;
  recentFrictionEvents: number;
  ambiguityFlagCount: number;
};

export async function buildTeamIntelligenceReport(teamId: string): Promise<TeamIntelligenceReport> {
  const [factors, workloadFair, silentMembers, frictionCount, ambiguityCount] = await Promise.all([
    gatherHealthFactors(teamId),
    isWorkloadFair(teamId),
    detectSilentMembers(teamId),
    prisma.socialFrictionEvent.count({ where: { teamId, resolved: false } }),
    prisma.ambiguityFlag.count({ where: { entityType: 'TASK', resolvedAt: null } }),
  ]);
  return {
    teamId,
    healthStatus: computeHealthFromFactors(factors),
    healthFactors: factors,
    workloadIsFair: workloadFair,
    silentMemberCount: silentMembers.length,
    recentFrictionEvents: frictionCount,
    ambiguityFlagCount: ambiguityCount,
  };
}
