/**
 * Student Capstone Journey Service (Part 10)
 *
 * Returns the student's complete formation journey status:
 *   Formation Profile → Project Preferences → Team Assignment → Project/Tasks
 *
 * PRIVACY: Never reads CognitiveProfile or privateSupportNotes.
 */

import { prisma } from '@/lib/db';

export type JourneyStepStatus = 'done' | 'in_progress' | 'pending' | 'action_required';

export type JourneyStep = {
  key: string;
  label: string;
  status: JourneyStepStatus;
  detail: string;
  href: string | null;
  actionLabel?: string;
};

export type StudentCapstoneJourney = {
  // Formation profile
  hasFormationProfile: boolean;
  profileStatus: string | null;
  profileCompletionScore: number | null;
  profileSubmitted: boolean;

  // Project preferences
  hasSubmittedPreferences: boolean;
  preferencesCount: number;
  topPreferenceTitle: string | null;

  // Team assignment
  isAssignedToTeam: boolean;
  teamName: string | null;
  teamId: string | null;
  projectTitle: string | null;
  supervisorName: string | null;

  // Intake status
  intakeStatus: string | null;
  termName: string | null;

  // Ordered step guide
  steps: JourneyStep[];

  // Current next action
  nextActionLabel: string;
  nextActionHref: string;
};

export async function getStudentCapstoneJourney(
  userId: string
): Promise<StudentCapstoneJourney | null> {
  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      formationProfile: {
        select: {
          status: true,
          completionScore: true,
          submittedAt: true,
        },
      },
      intakeRecords: {
        select: {
          status: true,
          term: { select: { name: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      teamMemberships: {
        select: {
          role: true,
          team: {
            select: {
              id: true,
              name: true,
              supervisorId: true,
              supervisor: {
                select: { user: { select: { name: true } } },
              },
              project: { select: { title: true } },
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!studentProfile) return null;

  // Active term for preference query
  const activeTerm = await prisma.academicTerm.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  });

  const submittedPrefs = activeTerm
    ? await prisma.projectPreference.findMany({
        where: {
          studentProfileId: studentProfile.id,
          termId: activeTerm.id,
          status: 'SUBMITTED',
        },
        select: { rank: true, topic: { select: { title: true } } },
        orderBy: { rank: 'asc' },
      })
    : [];

  const fp = studentProfile.formationProfile;
  const intake = studentProfile.intakeRecords[0] ?? null;
  const membership = studentProfile.teamMemberships[0] ?? null;

  const hasFormationProfile = !!fp;
  const profileSubmitted = fp?.status === 'SUBMITTED';
  const hasSubmittedPreferences = submittedPrefs.length > 0;
  const isAssignedToTeam = !!membership?.team;
  const topPreferenceTitle = submittedPrefs.find((p) => p.rank === 1)?.topic?.title ?? null;

  // ── Build journey steps ─────────────────────────────────────────────────────

  const steps: JourneyStep[] = [];

  // Step 1: Formation profile
  let profileStepStatus: JourneyStepStatus = 'pending';
  let profileStepDetail = 'Not started';
  if (profileSubmitted) {
    profileStepStatus = 'done';
    profileStepDetail = `Submitted · ${fp?.completionScore ?? 0}% complete`;
  } else if (fp) {
    profileStepStatus = 'action_required';
    profileStepDetail = `In draft · ${fp?.completionScore ?? 0}% complete — please submit`;
  } else {
    profileStepStatus = 'action_required';
    profileStepDetail = 'Formation profile not started';
  }
  steps.push({
    key: 'formation-profile',
    label: 'Complete Formation Profile',
    status: profileStepStatus,
    detail: profileStepDetail,
    href: '/dashboard/student/formation-profile',
    actionLabel: fp ? (profileSubmitted ? 'View Profile' : 'Finish & Submit') : 'Start Profile',
  });

  // Step 2: Project preferences
  let prefStepStatus: JourneyStepStatus = 'pending';
  let prefStepDetail = 'Not started';
  if (hasSubmittedPreferences) {
    prefStepStatus = 'done';
    prefStepDetail = `${submittedPrefs.length} preference${submittedPrefs.length !== 1 ? 's' : ''} submitted${topPreferenceTitle ? ` · Top: "${topPreferenceTitle}"` : ''}`;
  } else if (profileSubmitted) {
    prefStepStatus = 'action_required';
    prefStepDetail = 'Profile submitted — now rank project topics';
  } else {
    prefStepStatus = 'pending';
    prefStepDetail = 'Complete profile first';
  }
  steps.push({
    key: 'project-preferences',
    label: 'Submit Project Preferences',
    status: prefStepStatus,
    detail: prefStepDetail,
    href: profileSubmitted ? '/dashboard/student/project-preferences' : null,
    actionLabel: hasSubmittedPreferences ? 'View Preferences' : 'Rank Topics',
  });

  // Step 3: Team formation (coordinator action)
  let formationStepStatus: JourneyStepStatus = 'pending';
  let formationStepDetail = 'Waiting for coordinator to run team formation';
  if (isAssignedToTeam) {
    formationStepStatus = 'done';
    formationStepDetail = 'Teams have been published';
  } else if (hasSubmittedPreferences) {
    formationStepStatus = 'in_progress';
    formationStepDetail = 'Your preferences are ready — waiting for formation';
  }
  steps.push({
    key: 'team-formation',
    label: 'Wait for Team Formation',
    status: formationStepStatus,
    detail: formationStepDetail,
    href: null,
  });

  // Step 4: Review team and project
  let teamStepStatus: JourneyStepStatus = 'pending';
  let teamStepDetail = 'Not yet assigned to a team';
  if (isAssignedToTeam) {
    const team = membership!.team!;
    const projectTitle = team.project?.title;
    const supervisorName = team.supervisor?.user?.name;
    teamStepStatus = 'done';
    teamStepDetail = [
      `Team: ${team.name}`,
      projectTitle ? `Project: "${projectTitle}"` : 'No project linked yet',
      supervisorName ? `Supervisor: ${supervisorName}` : 'No supervisor assigned yet',
    ].join(' · ');
  }
  steps.push({
    key: 'team-review',
    label: 'Review Your Team & Project',
    status: teamStepStatus,
    detail: teamStepDetail,
    href: isAssignedToTeam ? `/dashboard/team` : null,
    actionLabel: 'View Team',
  });

  // Step 5: Tasks
  let taskStepStatus: JourneyStepStatus = 'pending';
  let taskStepDetail = 'Tasks will appear once you are assigned to a team';
  if (isAssignedToTeam) {
    taskStepStatus = 'in_progress';
    taskStepDetail = 'Check your assigned tasks and workload';
  }
  steps.push({
    key: 'tasks',
    label: 'Check Tasks & Workload',
    status: taskStepStatus,
    detail: taskStepDetail,
    href: isAssignedToTeam ? '/dashboard/tasks' : null,
    actionLabel: 'View Tasks',
  });

  // ── Next action ─────────────────────────────────────────────────────────────

  let nextActionLabel = 'Start your Formation Profile';
  let nextActionHref = '/dashboard/student/formation-profile';

  if (isAssignedToTeam) {
    nextActionLabel = 'View your tasks';
    nextActionHref = '/dashboard/tasks';
  } else if (hasSubmittedPreferences) {
    nextActionLabel = 'Check your submitted preferences';
    nextActionHref = '/dashboard/student/project-preferences';
  } else if (profileSubmitted) {
    nextActionLabel = 'Submit your project preferences';
    nextActionHref = '/dashboard/student/project-preferences';
  } else if (fp) {
    nextActionLabel = 'Finish and submit your Formation Profile';
    nextActionHref = '/dashboard/student/formation-profile';
  }

  return {
    hasFormationProfile,
    profileStatus: fp?.status ?? null,
    profileCompletionScore: fp?.completionScore ?? null,
    profileSubmitted,
    hasSubmittedPreferences,
    preferencesCount: submittedPrefs.length,
    topPreferenceTitle,
    isAssignedToTeam,
    teamName: membership?.team?.name ?? null,
    teamId: membership?.team?.id ?? null,
    projectTitle: membership?.team?.project?.title ?? null,
    supervisorName: membership?.team?.supervisor?.user?.name ?? null,
    intakeStatus: intake?.status ?? null,
    termName: intake?.term?.name ?? activeTerm?.name ?? null,
    steps,
    nextActionLabel,
    nextActionHref,
  };
}
