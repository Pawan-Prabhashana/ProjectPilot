import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { resolveActiveWorkspace } from '@/lib/services/workspace-access';
import { getStudentMyWorkDashboard } from '@/lib/services/dashboard/student-dashboard';
import { getStudentCapstoneJourney } from '@/lib/services/dashboard/capstone-journey';
import type { JourneyStep, StudentCapstoneJourney } from '@/lib/services/dashboard/capstone-journey';
import { explainStudentNextSteps } from '@/lib/services/explainability/explainability-service';
import type { ExplainabilityResult } from '@/lib/services/explainability/types';
import { InfoCallout } from '@/components/shared/info-callout';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RecentActivityFeed } from '@/components/activity/recent-activity-feed';
import { ExplainableScoreCard } from '@/components/metrics/explainable-score-card';
import { MetricStatusBadge } from '@/components/metrics/metric-status-badge';
import { calculateCognitiveLoadScore } from '@/lib/metrics/cognitive-load';
import { scoreTaskAmbiguity } from '@/lib/metrics/task-ambiguity';
import type { TaskInput } from '@/lib/metrics/task-ambiguity';
import {
  Crown,
  ClipboardList,
  AlertTriangle,
  Clock,
  CheckSquare,
  Calendar,
  BarChart3,
  Focus,
  Lightbulb,
  ArrowRight,
  BookOpen,
  Users,
  Zap,
  MessageSquare,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'My Work' };

const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-blue-100 text-blue-800 border-blue-200',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200',
};

const statusColors: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
  TODO: 'bg-slate-100 text-slate-600 border-slate-200',
  IN_REVIEW: 'bg-purple-100 text-purple-800 border-purple-200',
};

export default async function MyWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const user = await requireAuth();
  const { teamId } = await searchParams;

  if (user.role !== 'STUDENT') {
    return (
      <div className="space-y-6">
        <PageHeader title="My Work" description="Personal task and support dashboard." />
        <InfoCallout variant="warning">
          This page is for students only.
        </InfoCallout>
      </div>
    );
  }

  const workspace = await resolveActiveWorkspace(user, teamId);
  const data = await getStudentMyWorkDashboard(user.id, workspace?.teamId);
  const journey = await getStudentCapstoneJourney(user.id);
  const nextStepsExplain = await explainStudentNextSteps(user.id).catch(() => null);

  const teamParam = workspace ? `?teamId=${workspace.teamId}` : '';

  // Metrics — computed only when we have a valid workspace
  const cognitiveLoadScore = workspace?.teamId
    ? await calculateCognitiveLoadScore(user.id, workspace.teamId)
    : null;

  if (!workspace || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Work"
          description="Your personal task and support dashboard."
        />
        {/* Capstone Journey shown even without a team */}
        {journey && <CapstoneJourneyCard journey={journey} explainResult={nextStepsExplain} />}
        {!journey && (
          <InfoCallout variant="info" title="Not assigned to a team yet">
            You are not assigned to a team yet. Complete your Formation Profile and submit project preferences, then wait for the coordinator to publish teams.
          </InfoCallout>
        )}
      </div>
    );
  }

  const {
    teamName,
    projectTitle,
    memberRole,
    safeStart,
    overdueTasks,
    dueSoonTasks,
    inProgressTasks,
    notStartedTasks,
    latestSupervisorNote,
    contributions,
    hasCognitiveProfile,
  } = data;

  const isLeader = memberRole === 'LEADER' || memberRole === 'CO_LEADER';
  const roleLabel = memberRole === 'CO_LEADER' ? 'Co-Leader' : memberRole === 'LEADER' ? 'Team Leader' : 'Member';
  const allActiveTasks = [...overdueTasks, ...dueSoonTasks, ...inProgressTasks, ...notStartedTasks];

  // Task ambiguity: score each assigned task that has enough info for analysis
  const ambiguousTaskDetails = allActiveTasks
    .map((t) => {
      const input: TaskInput = {
        id: t.id,
        title: t.title,
        description: null,        // description not included in MyWorkTask
        doneCriteria: t.doneCriteria ?? null,
        assigneeId: user.id,      // task is already assigned to this user
        dueDate: t.dueDate ?? null,
        priority: t.priority,
        blockerNote: t.blockerNote ?? null,
        status: t.status,
      };
      return scoreTaskAmbiguity(input);
    })
    .filter((d) => d.score.status !== 'LOW' && d.score.score !== null)
    .sort((a, b) => (b.score.score ?? 0) - (a.score.score ?? 0))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Work"
        description="What should you personally focus on today?"
      />

      {/* Capstone Journey — always shown at top */}
      {journey && <CapstoneJourneyCard journey={journey} explainResult={nextStepsExplain} />}

      {/* Workspace identity */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border bg-muted/40 px-4 py-2.5 text-sm">
        <span className="font-medium text-foreground">{teamName}</span>
        {projectTitle && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{projectTitle}</span>
          </>
        )}
        <span className="text-muted-foreground">·</span>
        <Badge
          variant="secondary"
          className={cn('text-xs', isLeader ? 'bg-amber-100 text-amber-800 border-amber-200' : '')}
        >
          {isLeader && <Crown className="h-3 w-3 mr-1" />}
          {roleLabel}
        </Badge>
      </div>

      {/* ── Workload Metrics ──────────────────────────────────────── */}
      {cognitiveLoadScore && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Your Workload Snapshot
          </h2>
          <ExplainableScoreCard metric={cognitiveLoadScore} />
        </section>
      )}

      {/* ── Clarity warnings for assigned tasks ───────────────────── */}
      {ambiguousTaskDetails.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Tasks Needing Clarification
            <Badge variant="secondary" className="ml-1 text-xs">
              {ambiguousTaskDetails.length}
            </Badge>
          </h2>
          <div className="space-y-2">
            {ambiguousTaskDetails.map((detail) => (
              <div
                key={detail.taskId}
                className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/dashboard/tasks/${detail.taskId}${teamParam}`}
                        className="text-sm font-semibold hover:underline underline-offset-2 truncate"
                      >
                        {detail.taskTitle}
                      </Link>
                      <MetricStatusBadge
                        status={detail.score.status}
                        label={detail.score.status === 'CRITICAL' ? 'Very Unclear' : detail.score.status === 'HIGH' ? 'Unclear' : 'Some Gaps'}
                        size="sm"
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{detail.score.summary}</p>
                    {detail.suggestedFixes[0] && (
                      <p className="mt-1.5 text-xs text-amber-800">
                        <span className="font-medium">Suggested fix: </span>
                        {detail.suggestedFixes[0]}
                      </p>
                    )}
                  </div>
                  <Link href={`/dashboard/tasks/${detail.taskId}${teamParam}`}>
                    <Button size="sm" variant="ghost" className="shrink-0 text-xs">
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Leader banner */}
      {isLeader && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-medium text-amber-900">
              You are also a{memberRole === 'CO_LEADER' ? ' co-' : ' '}team leader for this workspace. Leader tools are available.
            </p>
          </div>
          <Link href={`/dashboard/leader${teamParam}`}>
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0">
              Open Leader Dashboard <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Section A: Today's Safe Start */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Zap className="h-4 w-4 text-amber-500" />
          Today&apos;s Safe Start
        </h2>
        {safeStart ? (
          <Card className="border-l-4 border-l-amber-400 bg-amber-50/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <p className="font-semibold text-foreground leading-snug">{safeStart.taskTitle}</p>
                  <p className="text-sm text-muted-foreground">{safeStart.reason}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge
                      variant="outline"
                      className={cn('text-xs', priorityColors[safeStart.priority] ?? '')}
                    >
                      {safeStart.priority}
                    </Badge>
                    {safeStart.dueDate && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(safeStart.dueDate)}
                      </Badge>
                    )}
                    {safeStart.estimatedMinutes && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        ~{safeStart.estimatedMinutes} min
                      </Badge>
                    )}
                    {safeStart.isDecomposed && (
                      <Badge variant="outline" className="text-xs text-green-700 border-green-200 bg-green-50">
                        Steps available
                      </Badge>
                    )}
                  </div>
                  {safeStart.doneCriteria && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium">Done when:</span> {safeStart.doneCriteria.slice(0, 120)}
                      {safeStart.doneCriteria.length > 120 ? '…' : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/dashboard/tasks/${safeStart.taskId}${teamParam}`}>
                    <Button size="sm" variant="default">
                      Open Task <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </Link>
                  <Link href={`/dashboard/support-tools${teamParam}`}>
                    <Button size="sm" variant="outline">
                      <Focus className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">
                You have no active assigned tasks in this workspace. Check the team board or ask your
                team leader what to take next.
              </p>
              <Link href={`/dashboard/tasks${teamParam}`} className="mt-3 inline-block">
                <Button size="sm" variant="outline">
                  View Team Board <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Section B: My Active Tasks */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            My Active Tasks
            {allActiveTasks.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {allActiveTasks.length}
              </Badge>
            )}
          </h2>
          <Link href={`/dashboard/tasks${teamParam}`}>
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-7">
              View all
            </Button>
          </Link>
        </div>

        {allActiveTasks.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">
                No tasks have been created for this team yet. Team leaders can create the first task
                from the Tasks page.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {overdueTasks.length > 0 && (
              <TaskGroup
                label="Overdue"
                icon={<AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                tasks={overdueTasks}
                teamParam={teamParam}
                borderColor="border-red-200"
                headerClass="text-red-700"
              />
            )}
            {dueSoonTasks.length > 0 && (
              <TaskGroup
                label="Due Soon"
                icon={<Clock className="h-3.5 w-3.5 text-orange-500" />}
                tasks={dueSoonTasks}
                teamParam={teamParam}
                borderColor="border-orange-200"
                headerClass="text-orange-700"
              />
            )}
            {inProgressTasks.length > 0 && (
              <TaskGroup
                label="In Progress"
                icon={<CheckSquare className="h-3.5 w-3.5 text-blue-500" />}
                tasks={inProgressTasks}
                teamParam={teamParam}
                borderColor="border-blue-200"
                headerClass="text-blue-700"
              />
            )}
            {notStartedTasks.length > 0 && (
              <TaskGroup
                label="Not Started"
                icon={<ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />}
                tasks={notStartedTasks}
                teamParam={teamParam}
                borderColor="border-border"
                headerClass="text-muted-foreground"
              />
            )}
          </div>
        )}
      </section>

      {/* Section C: Latest Supervisor Update */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Latest Supervisor Update
        </h2>
        {latestSupervisorNote ? (
          <Card>
            <CardContent className="pt-4 pb-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                From consultation on {formatDate(latestSupervisorNote.slotDate)}
              </p>
              <p className="text-sm text-foreground leading-relaxed">{latestSupervisorNote.summary}</p>
              {latestSupervisorNote.hasActionItems && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  Has action items
                </Badge>
              )}
              <div className="pt-1">
                <Link href={`/dashboard/consultations${teamParam}`}>
                  <Button size="sm" variant="outline">
                    View Consultation Notes <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">
                No supervisor feedback has been released for this workspace yet. Prepare questions
                in Project Brain before requesting a consultation.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/dashboard/consultations${teamParam}`}>
                  <Button size="sm" variant="outline">
                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                    Book Consultation
                  </Button>
                </Link>
                <Link href={`/dashboard/project-brain${teamParam}`}>
                  <Button size="sm" variant="outline">
                    <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                    Project Brain
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Section D: My Contribution Snapshot */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          My Contribution Snapshot
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold text-foreground">{contributions.thisWeekCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">contributions this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold text-foreground">{contributions.thisWeekHours}h</p>
              <p className="text-xs text-muted-foreground mt-0.5">hours logged this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold text-foreground">{contributions.totalCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">total contributions</p>
            </CardContent>
          </Card>
        </div>
        {contributions.thisWeekCount === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground rounded-lg border bg-muted/30 px-4 py-3">
            No contributions logged this week. Remember that clarification, testing, reviewing, and
            helping a teammate also count.
          </p>
        ) : null}
        <div className="mt-3">
          <Link href={`/dashboard/contributions${teamParam}`}>
            <Button size="sm" variant="outline">
              View Contributions <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Section E: Cognitive Support Shortcuts */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          Support Shortcuts
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SupportCard
            href={`/dashboard/support-tools${teamParam}`}
            icon={<Focus className="h-4 w-4 text-indigo-500" />}
            title="Focus Mode"
            description="Break the next task into smaller steps and work with fewer distractions."
          />
          <SupportCard
            href={`/dashboard/cognitive-profile`}
            icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
            title="Support Profile"
            description={
              hasCognitiveProfile
                ? 'Your support preferences are set. Update them any time.'
                : 'Set up your support profile to personalise your experience.'
            }
          />
          <SupportCard
            href={`/dashboard/team${teamParam}`}
            icon={<Users className="h-4 w-4 text-emerald-500" />}
            title="Team Workspace"
            description="See what your teammates are working on and find ways to help."
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground rounded-lg border bg-muted/20 px-4 py-2.5">
          Need a lower-pressure start? Use support tools to break the next task into smaller steps.
        </p>
      </section>

      {/* Recent team activity */}
      {workspace && (
        <RecentActivityFeed
          teamId={workspace.teamId}
          limit={6}
          compact
          title="Recent Team Activity"
        />
      )}
    </div>
  );
}

// ── Reusable sub-components ───────────────────────────────────────────────────

type TaskGroupProps = {
  label: string;
  icon: React.ReactNode;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: Date | null;
    milestoneName: string | null;
    isOverdue: boolean;
  }>;
  teamParam: string;
  borderColor: string;
  headerClass: string;
};

function TaskGroup({ label, icon, tasks, teamParam, borderColor, headerClass }: TaskGroupProps) {
  return (
    <div>
      <p className={cn('mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide', headerClass)}>
        {icon}
        {label} ({tasks.length})
      </p>
      <div className={cn('space-y-1.5 rounded-lg border p-2', borderColor)}>
        {tasks.slice(0, 5).map((task) => (
          <Link
            key={task.id}
            href={`/dashboard/tasks/${task.id}${teamParam}`}
            className="flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-muted/50 transition-colors group"
          >
            <span className="flex-1 truncate font-medium text-foreground group-hover:text-primary">{task.title}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {task.milestoneName && (
                <Badge variant="outline" className="text-[10px] max-w-[80px] truncate hidden sm:block">
                  {task.milestoneName}
                </Badge>
              )}
              <Badge variant="outline" className={cn('text-[10px]', priorityColors[task.priority] ?? '')}>
                {task.priority}
              </Badge>
              {task.dueDate && (
                <span className={cn('text-[10px]', task.isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                  {formatDate(task.dueDate)}
                </span>
              )}
              <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </div>
          </Link>
        ))}
        {tasks.length > 5 && (
          <p className="px-2.5 py-1 text-xs text-muted-foreground">
            +{tasks.length - 5} more tasks
          </p>
        )}
      </div>
    </div>
  );
}

type SupportCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

function SupportCard({ href, icon, title, description }: SupportCardProps) {
  return (
    <Link href={href}>
      <Card className="h-full transition-shadow hover:shadow-sm cursor-pointer group">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
              {title}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Capstone Journey Card ─────────────────────────────────────────────────────

const JOURNEY_STATUS_ICON: Record<string, React.ReactNode> = {
  done: <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />,
  in_progress: <Clock className="h-4 w-4 text-sky-600 shrink-0 animate-pulse" />,
  action_required: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />,
  pending: <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />,
};

const JOURNEY_STATUS_STYLES: Record<string, string> = {
  done: 'text-emerald-700 bg-emerald-50/50',
  in_progress: 'text-sky-700 bg-sky-50/50',
  action_required: 'text-amber-700 bg-amber-50/60',
  pending: 'text-muted-foreground',
};

function CapstoneJourneyCard({ journey, explainResult }: { journey: StudentCapstoneJourney; explainResult?: ExplainabilityResult | null }) {
  const { steps, nextActionLabel, nextActionHref, teamName, termName } = journey;
  return (
    <Card className="border-violet-200 bg-violet-50/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-violet-800">
          <Zap className="h-4 w-4" />
          My Capstone Journey
          {termName && <span className="font-normal text-xs text-violet-600 ml-1">· {termName}</span>}
          {teamName && <Badge className="bg-violet-100 text-violet-700 text-xs ml-1">{teamName}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-1 mb-3">
          {steps.map((step) => (
            <JourneyStepRow key={step.key} step={step} />
          ))}
        </div>
        {nextActionHref && (
          <Link href={nextActionHref}>
            <div className="flex items-center justify-between rounded-lg bg-violet-600 px-4 py-2.5 text-white hover:bg-violet-700 transition-colors">
              <span className="text-sm font-medium">{nextActionLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        )}
        {explainResult && (
          <details className="mt-3 group">
            <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors list-none">
              <Lightbulb className="h-3.5 w-3.5 text-violet-500" />
              What should I do next? (explanation)
            </summary>
            <div className="mt-2 rounded-lg border border-violet-200 bg-white/70 px-3 py-3 text-xs space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400">
                Deterministic explanation · Based on your profile and formation status
              </p>
              <p className="text-violet-900">{explainResult.summary}</p>
              {explainResult.recommendedActions.length > 0 && (
                <ul className="space-y-1">
                  {explainResult.recommendedActions.map((a) => (
                    <li key={a} className="flex items-start gap-1.5 text-violet-800">
                      <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
                      {a}
                    </li>
                  ))}
                </ul>
              )}
              {explainResult.privacyNote && (
                <p className="text-[10px] text-violet-400 border-t border-violet-100 pt-2">
                  🔒 {explainResult.privacyNote}
                </p>
              )}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function JourneyStepRow({ step }: { step: JourneyStep }) {
  const row = (
    <div className={cn('flex items-center gap-2.5 rounded px-3 py-2 text-sm', JOURNEY_STATUS_STYLES[step.status])}>
      {JOURNEY_STATUS_ICON[step.status] ?? JOURNEY_STATUS_ICON.pending}
      <div className="flex-1 min-w-0">
        <span className="font-medium">{step.label}</span>
        <span className="ml-2 text-xs opacity-70 truncate">{step.detail}</span>
      </div>
      {step.href && step.actionLabel && (
        <span className="text-xs underline opacity-60 shrink-0">{step.actionLabel}</span>
      )}
    </div>
  );
  if (step.href) return <Link href={step.href}>{row}</Link>;
  return row;
}
