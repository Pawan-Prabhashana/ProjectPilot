/**
 * Deterministic Explanations (Part 12)
 *
 * Generates human-readable explanations from existing scoring data.
 * No AI required — always works offline and without API keys.
 *
 * Privacy: Never reads CognitiveProfile or privateSupportNotes.
 */

import { prisma } from '@/lib/db';
import type {
  ExplainabilityResult,
  TaskRecommendationExplainInput,
} from './types';

// ── Team formation run explanation ────────────────────────────────────────────

export async function deterministicExplainTeamFormationRun(
  runId: string
): Promise<ExplainabilityResult> {
  const run = await prisma.teamFormationRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      summary: true,
      draftTeams: {
        select: {
          id: true,
          name: true,
          overallScore: true,
          warnings: {
            where: { resolved: false },
            select: { severity: true, type: true },
          },
        },
      },
    },
  });

  if (!run) {
    return {
      mode: 'deterministic',
      title: 'Formation Run Not Found',
      summary: 'No formation run found with this ID.',
      keyReasons: [],
      risks: [],
      recommendedActions: ['Run the team formation engine from the Team Formation Workspace.'],
    };
  }

  const summary = run.summary as Record<string, unknown> | null;
  const totalTeams = run.draftTeams.length;
  const avgScore = summary?.averageOverallScore as number | undefined;
  const unassigned = summary?.unassignedStudents as number | undefined;
  const criticalWarnings = run.draftTeams
    .flatMap((t) => t.warnings)
    .filter((w) => w.severity === 'CRITICAL' || w.severity === 'HIGH').length;

  const keyReasons: string[] = [];
  if (totalTeams > 0) keyReasons.push(`${totalTeams} draft team${totalTeams !== 1 ? 's' : ''} formed from student intake data`);
  if (avgScore !== undefined) keyReasons.push(`Average team quality score: ${Math.round(avgScore)}/100`);
  if (unassigned !== undefined && unassigned > 0) keyReasons.push(`${unassigned} student${unassigned !== 1 ? 's' : ''} could not be placed (check intake/batch size)`);
  if (criticalWarnings === 0) keyReasons.push('No critical or high-severity warnings detected');

  const risks: string[] = [];
  if (criticalWarnings > 0) risks.push(`${criticalWarnings} unresolved HIGH/CRITICAL warning${criticalWarnings !== 1 ? 's' : ''} across draft teams`);
  if (unassigned && unassigned > 0) risks.push(`${unassigned} student${unassigned !== 1 ? 's were' : ' was'} not assigned to a team`);

  const recommendedActions: string[] = [];
  if (criticalWarnings > 0) recommendedActions.push('Review teams with critical warnings before publishing');
  if (unassigned && unassigned > 0) recommendedActions.push('Check formation batch student list and re-run or manually add unassigned students');
  if (run.status === 'COMPLETED' && criticalWarnings === 0) {
    recommendedActions.push('All teams look ready — review roles and publish when satisfied');
  }

  return {
    mode: 'deterministic',
    title: `Formation Run — ${run.status}`,
    summary: `Based on ProjectPilot\'s scoring data: ${totalTeams} draft team${totalTeams !== 1 ? 's were' : ' was'} formed${avgScore !== undefined ? ` with an average quality score of ${Math.round(avgScore)}/100` : ''}.${criticalWarnings > 0 ? ` ${criticalWarnings} warning${criticalWarnings !== 1 ? 's require' : ' requires'} review.` : ' No critical issues detected.'}`,
    keyReasons,
    risks,
    recommendedActions,
  };
}

// ── Draft team explanation ─────────────────────────────────────────────────────

export async function deterministicExplainDraftTeam(
  draftTeamId: string
): Promise<ExplainabilityResult> {
  const team = await prisma.draftTeam.findUnique({
    where: { id: draftTeamId },
    select: {
      name: true,
      overallScore: true,
      skillScore: true,
      scheduleScore: true,
      preferenceScore: true,
      roleScore: true,
      capacityScore: true,
      topic: { select: { title: true } },
      members: {
        select: {
          suggestedRoleKey: true,
          suggestedRoleLabel: true,
          fitScore: true,
          studentProfile: {
            select: {
              user: { select: { name: true } },
              formationProfile: {
                select: {
                  skills: { select: { skillKey: true, level: true } },
                },
              },
            },
          },
        },
      },
      warnings: {
        where: { resolved: false },
        select: { severity: true, title: true, type: true },
      },
    },
  });

  if (!team) {
    return {
      mode: 'deterministic',
      title: 'Team Not Found',
      summary: 'No draft team found.',
      keyReasons: [],
      risks: [],
      recommendedActions: [],
    };
  }

  const keyReasons: string[] = [];
  if (team.topic) keyReasons.push(`Matched to project topic: "${team.topic.title}"`);
  if (team.overallScore) keyReasons.push(`Overall team quality score: ${Math.round(team.overallScore)}/100`);
  if (team.skillScore) keyReasons.push(`Skill coverage score: ${Math.round(team.skillScore)}/100 — team collectively covers required skills`);
  if (team.scheduleScore) keyReasons.push(`Schedule overlap score: ${Math.round(team.scheduleScore)}/100 — members share enough common availability`);
  if (team.preferenceScore) keyReasons.push(`Preference match score: ${Math.round(team.preferenceScore)}/100 — at least one member selected this topic`);
  if (team.roleScore) keyReasons.push(`Role balance score: ${Math.round(team.roleScore)}/100 — key roles (leader, developer, documenter) are covered`);

  const memberNames = team.members.map((m) => m.studentProfile.user?.name ?? 'Unknown').filter(Boolean);
  if (memberNames.length > 0) keyReasons.push(`Members: ${memberNames.join(', ')}`);

  const risks = team.warnings
    .filter((w) => w.severity === 'HIGH' || w.severity === 'CRITICAL')
    .map((w) => `${w.severity}: ${w.title}`);

  const recommendedActions: string[] = [];
  if (risks.length > 0) recommendedActions.push('Review and resolve high/critical warnings before marking this team as ready');
  if ((team.skillScore ?? 0) < 60) recommendedActions.push('Consider adding a member with stronger technical skills to improve coverage');
  if ((team.scheduleScore ?? 0) < 50) recommendedActions.push('Encourage members to add more availability slots to improve scheduling');
  if (risks.length === 0) recommendedActions.push('Mark team as READY once you have reviewed the composition');

  return {
    mode: 'deterministic',
    title: `Why "${team.name}"?`,
    summary: `Based on ProjectPilot\'s scoring data: this team scored ${Math.round(team.overallScore ?? 0)}/100 overall, balancing skill coverage, schedule overlap, project preferences, and role distribution.`,
    keyReasons,
    risks,
    recommendedActions,
    privacyNote: 'Member support preferences are private and not used in team explanations.',
  };
}

// ── Role assignment explanation ───────────────────────────────────────────────

export async function deterministicExplainRoleAssignment(
  draftTeamMemberId: string
): Promise<ExplainabilityResult> {
  const member = await prisma.draftTeamMember.findUnique({
    where: { id: draftTeamMemberId },
    select: {
      suggestedRoleKey: true,
      suggestedRoleLabel: true,
      fitScore: true,
      roleConfidence: true,
      studentProfile: {
        select: {
          user: { select: { name: true } },
          formationProfile: {
            select: {
              skills: {
                select: { skillKey: true, level: true },
                orderBy: { level: 'desc' },
                take: 5,
              },
              rolePreferences: {
                where: { avoid: false },
                select: { roleKey: true, roleLabel: true, preferenceLevel: true, confidenceLevel: true },
                orderBy: { preferenceLevel: 'desc' },
                take: 3,
              },
            },
          },
        },
      },
    },
  });

  if (!member) {
    return { mode: 'deterministic', title: 'Member Not Found', summary: '', keyReasons: [], risks: [], recommendedActions: [] };
  }

  const name = member.studentProfile.user?.name ?? 'This member';
  const role = member.suggestedRoleLabel ?? member.suggestedRoleKey ?? 'an unspecified role';
  const fp = member.studentProfile.formationProfile;
  const topSkills = (fp?.skills ?? []).map((s) => `${s.skillKey} (level ${s.level})`);
  const topPrefs = (fp?.rolePreferences ?? []).map((r) => r.roleLabel);

  const keyReasons: string[] = [];
  if (topSkills.length > 0) keyReasons.push(`Top skills: ${topSkills.slice(0, 3).join(', ')}`);
  if (topPrefs.length > 0) keyReasons.push(`Role preferences: ${topPrefs.slice(0, 2).join(', ')}`);
  if (member.fitScore) keyReasons.push(`Member fit score for this team: ${Math.round(member.fitScore)}/100`);
  if (member.roleConfidence) keyReasons.push(`Role confidence score: ${Math.round(member.roleConfidence)}/100`);

  return {
    mode: 'deterministic',
    title: `Why "${role}" for ${name}?`,
    summary: `Based on ProjectPilot\'s scoring data: ${name} was suggested for ${role} based on skill alignment, stated role preferences, and fit with the team\'s needs.`,
    keyReasons,
    risks: [],
    recommendedActions: member.roleConfidence && member.roleConfidence < 50
      ? ['Consider reviewing this role assignment — confidence is below 50%']
      : ['Role assignment looks appropriate — change manually if needed'],
    privacyNote: 'Safe support preferences are used internally for workload guidance only.',
  };
}

// ── Task recommendation explanation ──────────────────────────────────────────

export function deterministicExplainTaskRecommendation(
  input: TaskRecommendationExplainInput
): ExplainabilityResult {
  const {
    candidateName = 'This member',
    skillScore,
    roleScore,
    capacityScore,
    currentLoadScore,
    reasons = [],
    warnings = [],
    riskLevel = 'LOW',
  } = input;

  const keyReasons: string[] = [...reasons];
  if (!reasons.length) {
    if (skillScore !== undefined) keyReasons.push(`Skill match score: ${Math.round(skillScore)}/100`);
    if (roleScore !== undefined) keyReasons.push(`Role alignment score: ${Math.round(roleScore)}/100`);
    if (capacityScore !== undefined) keyReasons.push(`Available capacity score: ${Math.round(capacityScore)}/100`);
    if (currentLoadScore !== undefined) keyReasons.push(`Current load balance score: ${Math.round(currentLoadScore)}/100`);
  }

  const risks = [...warnings];
  if (riskLevel === 'HIGH') risks.unshift(`Risk level is HIGH — this assignment may overload ${candidateName}`);

  return {
    mode: 'deterministic',
    title: `Why ${candidateName}?`,
    summary: `Based on ProjectPilot\'s scoring data: ${candidateName} is recommended for this task based on skill match, role alignment, available capacity, and current workload fairness.`,
    keyReasons,
    risks,
    recommendedActions: riskLevel === 'HIGH'
      ? ['Review this member\'s current workload before assigning', 'Consider the next-ranked candidate if workload is already high']
      : ['Apply this recommendation or select another candidate from the scored list'],
  };
}

// ── Conflict dashboard explanation ────────────────────────────────────────────

export async function deterministicExplainConflicts(
  termId?: string
): Promise<ExplainabilityResult> {
  const activeTerm = termId
    ? await prisma.academicTerm.findUnique({ where: { id: termId }, select: { id: true, name: true } })
    : await prisma.academicTerm.findFirst({ where: { status: 'ACTIVE' }, select: { id: true, name: true } });

  if (!activeTerm) {
    return {
      mode: 'deterministic',
      title: 'No Active Term',
      summary: 'No active academic term found. Set up an academic term to enable conflict detection.',
      keyReasons: [],
      risks: [],
      recommendedActions: ['Create an academic term in Formation Setup'],
    };
  }

  const [openConflicts, missingProfiles, missingPrefs] = await Promise.all([
    prisma.projectSelectionConflict.count({ where: { termId: activeTerm.id, resolved: false } }),
    prisma.studentIntake.count({
      where: {
        termId: activeTerm.id,
        studentProfile: { formationProfile: null },
      },
    }),
    prisma.studentIntake.count({
      where: {
        termId: activeTerm.id,
        studentProfile: {
          projectPreferences: {
            none: { termId: activeTerm.id, status: 'SUBMITTED' },
          },
        },
      },
    }),
  ]);

  const totalIssues = openConflicts + (missingProfiles > 0 ? 1 : 0) + (missingPrefs > 0 ? 1 : 0);

  const keyReasons: string[] = [];
  if (openConflicts > 0) keyReasons.push(`${openConflicts} unresolved project selection conflict${openConflicts !== 1 ? 's' : ''}`);
  if (missingProfiles > 0) keyReasons.push(`${missingProfiles} student${missingProfiles !== 1 ? 's' : ''} missing a submitted formation profile`);
  if (missingPrefs > 0) keyReasons.push(`${missingPrefs} student${missingPrefs !== 1 ? 's' : ''} missing submitted project preferences`);
  if (totalIssues === 0) keyReasons.push('No critical readiness gaps detected for the active term');

  const recommendedActions: string[] = [];
  if (missingProfiles > 0) recommendedActions.push('Ask students to complete and submit their Formation Profiles');
  if (missingPrefs > 0) recommendedActions.push('Ask students to submit at least 3 project preferences');
  if (openConflicts > 0) recommendedActions.push('Recalculate project selection conflicts and review over-selected topics');
  if (totalIssues === 0) recommendedActions.push('Formation readiness looks good — run the team formation engine');

  return {
    mode: 'deterministic',
    title: `Risk Summary — ${activeTerm.name}`,
    summary: `Based on ProjectPilot\'s data: ${totalIssues === 0 ? 'no critical gaps detected' : `${totalIssues} risk area${totalIssues !== 1 ? 's' : ''} need attention`} for the ${activeTerm.name} intake.`,
    keyReasons,
    risks: [],
    recommendedActions,
  };
}

// ── Student next steps explanation ────────────────────────────────────────────

export async function deterministicExplainStudentNextSteps(
  userId: string
): Promise<ExplainabilityResult> {
  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      formationProfile: { select: { status: true, completionScore: true } },
      teamMemberships: {
        select: {
          team: {
            select: {
              name: true,
              project: { select: { id: true } },
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!studentProfile) {
    return {
      mode: 'deterministic',
      title: 'Profile Not Found',
      summary: 'No student profile found for this user.',
      keyReasons: [],
      risks: [],
      recommendedActions: [],
    };
  }

  const activeTerm = await prisma.academicTerm.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  const hasTeam = studentProfile.teamMemberships.length > 0;
  const fp = studentProfile.formationProfile;
  const profileSubmitted = fp?.status === 'SUBMITTED';
  const completionScore = fp?.completionScore ?? 0;

  const submittedPrefs = activeTerm
    ? await prisma.projectPreference.count({
        where: { studentProfileId: studentProfile.id, termId: activeTerm.id, status: 'SUBMITTED' },
      })
    : 0;

  const keyReasons: string[] = [];
  const recommendedActions: string[] = [];

  if (hasTeam) {
    const team = studentProfile.teamMemberships[0].team;
    keyReasons.push(`Assigned to team: "${team.name}"`);
    if (!team.project) {
      keyReasons.push('Your team does not have a project linked yet');
      recommendedActions.push('Wait for the coordinator to link a project to your team');
    } else {
      keyReasons.push('Your team has a project — you can view tasks and log contributions');
      recommendedActions.push('Check your assigned tasks and update their status');
      recommendedActions.push('Review your workload and let your supervisor know if you are overloaded');
    }
  } else if (profileSubmitted && submittedPrefs >= 3) {
    keyReasons.push('Formation profile submitted and project preferences submitted');
    keyReasons.push('Waiting for the coordinator to run and publish team formation');
    recommendedActions.push('No action needed right now — the coordinator will publish teams');
    recommendedActions.push('Check your Formation Profile to ensure all sections are complete');
  } else if (profileSubmitted && submittedPrefs < 3) {
    keyReasons.push('Formation profile is submitted');
    keyReasons.push(`Only ${submittedPrefs} project preference${submittedPrefs !== 1 ? 's' : ''} submitted — aim for at least 3`);
    recommendedActions.push('Submit at least 3 project topic preferences so the formation engine can match you');
  } else if (fp && !profileSubmitted) {
    keyReasons.push(`Formation profile exists but is not submitted (${completionScore}% complete)`);
    recommendedActions.push('Complete all sections of your Formation Profile and submit it');
    if (completionScore < 70) recommendedActions.push('Add skills, availability slots, and role preferences to increase your completion score');
  } else {
    keyReasons.push('Formation profile not started');
    recommendedActions.push('Start your Formation Profile — add skills, availability, and role preferences');
    recommendedActions.push('Aim for at least 70% completion score before submitting');
  }

  const summary = hasTeam
    ? `You are assigned to a team. Focus on your tasks and keep your workload balanced.`
    : profileSubmitted && submittedPrefs >= 3
      ? `Your profile and preferences are submitted. Wait for the coordinator to publish teams.`
      : `You have not completed all readiness steps yet. See the recommended actions below.`;

  return {
    mode: 'deterministic',
    title: 'Your Next Steps',
    summary,
    keyReasons,
    risks: !hasTeam && !fp ? ['Formation profile not started — coordinator needs this to form your team'] : [],
    recommendedActions,
    privacyNote: 'Your support preferences are private and never shared with coordinators or supervisors.',
  };
}
