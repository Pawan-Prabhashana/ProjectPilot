import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { resolveActiveWorkspace } from '@/lib/services/workspace-access';
import { getStudentMyWorkDashboard } from '@/lib/services/dashboard/student-dashboard';
import { InfoCallout } from '@/components/shared/info-callout';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RecentActivityFeed } from '@/components/activity/recent-activity-feed';
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

  const teamParam = workspace ? `?teamId=${workspace.teamId}` : '';

  if (!workspace || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Work"
          description="Your personal task and support dashboard."
        />
        <InfoCallout variant="info" title="Not assigned to a team yet">
          You are not assigned to a team yet. Please contact your coordinator to be added to a team.
        </InfoCallout>
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Work"
        description="What should you personally focus on today?"
      />

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
