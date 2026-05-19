import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { resolveActiveWorkspace } from '@/lib/services/workspace-access';
import { hasAnyLeaderCapability } from '@/lib/rbac/team-permissions';
import { getLeaderDashboard } from '@/lib/services/dashboard/leader-dashboard';
import { InfoCallout } from '@/components/shared/info-callout';
import { PageHeader } from '@/components/shared/page-header';
import { RecentActivityFeed } from '@/components/activity/recent-activity-feed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Crown,
  Users,
  ClipboardList,
  BarChart3,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Brain,
  ArrowRight,
  Zap,
  Target,
  Clock,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Leader Dashboard' };

const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-blue-100 text-blue-800 border-blue-200',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default async function LeaderDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const user = await requireAuth();
  const { teamId } = await searchParams;

  if (user.role !== 'STUDENT' && user.role !== 'COORDINATOR') {
    return (
      <div className="space-y-6">
        <PageHeader title="Leader Dashboard" description="Team leadership tools." />
        <InfoCallout variant="warning">
          This page is for team leaders only.
        </InfoCallout>
      </div>
    );
  }

  if (user.role === 'STUDENT') {
    const isLeader = await hasAnyLeaderCapability(user.id);
    if (!isLeader) {
      return (
        <div className="space-y-6">
          <PageHeader title="Leader Dashboard" description="Team leadership tools." />
          <InfoCallout variant="info" title="Leader access not assigned">
            You are not currently assigned as a team leader. If this is incorrect, contact your coordinator.
          </InfoCallout>
        </div>
      );
    }
  }

  const workspace = await resolveActiveWorkspace(user, teamId);
  const data = await getLeaderDashboard(user.id, workspace?.teamId);

  const teamParam = workspace ? `?teamId=${workspace.teamId}` : '';

  if (!workspace || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Leader Dashboard" description="Team leadership tools." />
        <InfoCallout variant="warning" title="No leader workspace found">
          {workspace
            ? 'You do not have leader access in the selected workspace. Use the topbar to switch to a team where you are a leader.'
            : 'No team workspace is available. Make sure you are assigned as a leader in at least one team.'}
        </InfoCallout>
      </div>
    );
  }

  const {
    teamName,
    projectTitle,
    leaderRole,
    teamStats,
    members,
    riskTasks,
    nextConsultation,
    upcomingMilestone,
    openQuestionsCount,
    unresolvedAssumptionsCount,
  } = data;

  const roleLabel = leaderRole === 'CO_LEADER' ? 'Co-Leader' : 'Team Leader';
  const attentionCount = [
    teamStats.overdueTasks > 0,
    teamStats.blockedTasks > 0,
    teamStats.unassignedTasks > 0,
    openQuestionsCount > 0,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Leader Dashboard"
        description="How is the team doing and what needs attention?"
      />

      {/* Section A: Leader Command Header */}
      <section>
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3 space-y-3">
          {/* Identity */}
          <div className="flex flex-wrap items-center gap-2">
            <Crown className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="font-semibold text-amber-900">{teamName}</span>
            {projectTitle && (
              <>
                <span className="text-amber-600">·</span>
                <span className="text-amber-800">{projectTitle}</span>
              </>
            )}
            <Badge className="ml-1 bg-amber-200 text-amber-900 border-amber-300 text-xs">
              {roleLabel}
            </Badge>
          </div>

          {/* Progress summary */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-amber-800">
              <span className="font-semibold">{teamStats.doneTasks}</span> tasks done
            </span>
            <span className="text-amber-800">
              <span className="font-semibold">{teamStats.activeTasks}</span> active
            </span>
            <span className="text-amber-800">
              <span className="font-semibold text-lg">{teamStats.completionRate}%</span> complete
            </span>
            {teamStats.memberCount > 0 && (
              <span className="text-amber-700">{teamStats.memberCount} members</span>
            )}
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/tasks${teamParam}`}>
              <Button size="sm" variant="default" className="h-7 text-xs bg-amber-600 hover:bg-amber-700">
                <ClipboardList className="h-3 w-3 mr-1" /> Create Task
              </Button>
            </Link>
            <Link href={`/dashboard/team${teamParam}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100">
                <Users className="h-3 w-3 mr-1" /> Team Board
              </Button>
            </Link>
            <Link href={`/dashboard/project-brain${teamParam}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100">
                <Brain className="h-3 w-3 mr-1" /> Project Brain
              </Button>
            </Link>
            <Link href={`/dashboard/consultations${teamParam}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100">
                <Calendar className="h-3 w-3 mr-1" /> Consultations
              </Button>
            </Link>
            <Link href={`/dashboard/contributions${teamParam}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100">
                <BarChart3 className="h-3 w-3 mr-1" /> Contributions
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Section B: Team Attention Cards */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Team Attention
          {attentionCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
              {attentionCount} area{attentionCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AttentionCard
            value={teamStats.overdueTasks}
            label="Overdue Tasks"
            actionText="Review and reassign before the next consultation"
            href={`/dashboard/tasks${teamParam}`}
            urgency={teamStats.overdueTasks > 0 ? 'high' : 'ok'}
          />
          <AttentionCard
            value={teamStats.blockedTasks}
            label="Blocked Tasks"
            actionText="Unblock or split these tasks to keep progress moving"
            href={`/dashboard/tasks${teamParam}`}
            urgency={teamStats.blockedTasks > 0 ? 'medium' : 'ok'}
          />
          <AttentionCard
            value={teamStats.unassignedTasks}
            label="Unassigned Tasks"
            actionText="Assign to a team member with available capacity"
            href={`/dashboard/tasks${teamParam}`}
            urgency={teamStats.unassignedTasks > 0 ? 'medium' : 'ok'}
          />
          <AttentionCard
            value={openQuestionsCount}
            label="Open Questions"
            actionText="Prepare these questions before the next consultation"
            href={`/dashboard/project-brain${teamParam}`}
            urgency={openQuestionsCount > 0 ? 'low' : 'ok'}
          />
        </div>
      </section>

      {/* Section C: Team Workload Overview */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Users className="h-4 w-4 text-muted-foreground" />
          Team Workload
        </h2>
        {members.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">No team members found for this workspace.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-5 gap-2 bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="col-span-2">Member</span>
              <span className="text-center">Active</span>
              <span className="text-center">Overdue</span>
              <span className="text-center">Done this week</span>
            </div>
            {members.map((member, i) => (
              <div
                key={member.userId}
                className={cn(
                  'grid grid-cols-5 gap-2 items-center px-4 py-2.5 text-sm',
                  i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                )}
              >
                <div className="col-span-2 min-w-0">
                  <p className="font-medium truncate text-foreground">{member.name ?? member.email}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {(member.role as string).toLowerCase().replace('_', ' ')}
                    </Badge>
                    {member.noRecentActivity && (
                      <span className="text-[10px] text-muted-foreground">· No recent activity</span>
                    )}
                  </div>
                </div>
                <p className="text-center font-semibold">{member.activeTaskCount}</p>
                <p className={cn('text-center font-semibold', member.overdueTaskCount > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                  {member.overdueTaskCount}
                </p>
                <p className={cn('text-center font-semibold', member.completedThisWeekCount > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                  {member.completedThisWeekCount}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          &quot;No recent activity&quot; means no tasks completed or contributions logged this week — not a judgment.
        </p>
      </section>

      {/* Section D: Blockers & Risks */}
      {riskTasks.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Blockers &amp; Risks
            <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200 text-xs">
              {riskTasks.length}
            </Badge>
          </h2>
          <div className="space-y-2">
            {riskTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-start sm:justify-between hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/tasks/${task.id}${teamParam}`}
                      className="font-medium text-sm text-foreground hover:text-primary"
                    >
                      {task.title}
                    </Link>
                    <Badge variant="outline" className={cn('text-[10px]', priorityColors[task.priority] ?? '')}>
                      {task.priority}
                    </Badge>
                    {task.isOverdue && (
                      <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-200">
                        {task.daysOverdue}d overdue
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{task.riskReason}</p>
                  {task.assigneeName && (
                    <p className="text-xs text-muted-foreground">Owner: {task.assigneeName}</p>
                  )}
                </div>
                <div className="shrink-0">
                  <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200 font-normal">
                    {task.suggestedAction}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section E: Meeting Preparation */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Meeting Preparation
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className={cn(nextConsultation ? 'border-blue-200 bg-blue-50/30' : '')}>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                Next Consultation
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              {nextConsultation ? (
                <>
                  <p className="text-sm font-medium text-foreground">
                    {formatDate(nextConsultation.slotStart)}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {nextConsultation.status}
                  </Badge>
                  {!nextConsultation.hasBrief && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      No brief submitted yet. Prepare your team&apos;s updates and questions.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No upcoming consultation found. Prepare questions in Project Brain before booking.
                </p>
              )}
              <Link href={`/dashboard/consultations${teamParam}`}>
                <Button size="sm" variant="outline" className="w-full mt-1">
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                  {nextConsultation ? 'View Consultation' : 'Book Consultation'}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className={cn(openQuestionsCount > 0 ? 'border-purple-200 bg-purple-50/30' : '')}>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-purple-500" />
                Project Brain
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              <div className="flex gap-3">
                <div>
                  <p className="text-xl font-bold text-foreground">{openQuestionsCount}</p>
                  <p className="text-xs text-muted-foreground">open questions</p>
                </div>
                {unresolvedAssumptionsCount > 0 && (
                  <div>
                    <p className="text-xl font-bold text-foreground">{unresolvedAssumptionsCount}</p>
                    <p className="text-xs text-muted-foreground">unresolved assumptions</p>
                  </div>
                )}
              </div>
              {openQuestionsCount === 0 && (
                <p className="text-xs text-muted-foreground">
                  No open questions. Add any unresolved decisions before the next consultation.
                </p>
              )}
              <Link href={`/dashboard/project-brain${teamParam}`}>
                <Button size="sm" variant="outline" className="w-full mt-1">
                  <Brain className="h-3.5 w-3.5 mr-1.5" /> Review Project Brain
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {upcomingMilestone && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                <Target className="h-3.5 w-3.5 inline mr-1.5 text-emerald-600" />
                Upcoming Milestone: {upcomingMilestone.title}
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Due {formatDate(upcomingMilestone.dueDate)} · {upcomingMilestone.completionRate}% tasks done
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Section F: Leader-only Actions */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Zap className="h-4 w-4 text-amber-500" />
          Leader Actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            href={`/dashboard/tasks${teamParam}`}
            icon={<ClipboardList className="h-4 w-4 text-blue-500" />}
            title="Create a Task"
            description="Add new tasks, assign to team members, and set priorities"
          />
          <ActionCard
            href={`/dashboard/tasks${teamParam}`}
            icon={<CheckCircle className="h-4 w-4 text-emerald-500" />}
            title="Assign & Review Tasks"
            description="Review unassigned tasks and balance workload across the team"
          />
          <ActionCard
            href={`/dashboard/consultations${teamParam}`}
            icon={<Calendar className="h-4 w-4 text-purple-500" />}
            title="Prepare Supervisor Update"
            description="Prepare a brief and open questions before your next consultation"
          />
          <ActionCard
            href={`/dashboard/contributions${teamParam}`}
            icon={<BarChart3 className="h-4 w-4 text-indigo-500" />}
            title="Review Contributions"
            description="Check that visible work is balanced fairly across team members"
          />
          <ActionCard
            href={`/dashboard/team${teamParam}`}
            icon={<Users className="h-4 w-4 text-amber-500" />}
            title="Open Team Workspace"
            description="Full team view, member workload, and collaboration tools"
          />
          <ActionCard
            href={`/dashboard/my-work${teamParam}`}
            icon={<Zap className="h-4 w-4 text-slate-500" />}
            title="My Personal Work"
            description="Switch to your personal tasks and support tools"
          />
        </div>
      </section>

      <div className="rounded-xl border border-amber-200/60 bg-amber-50/30 p-4">
        <p className="text-sm text-amber-800">
          <span className="font-semibold">You are viewing the Leader workspace.</span>{' '}
          Your team members see their personal My Work view without leader management tools.
          Use the sidebar to switch between your personal dashboard and these leader tools.
        </p>
      </div>

      {/* Live team activity */}
      {data && (
        <RecentActivityFeed
          teamId={data.teamId}
          limit={8}
          title="Live Team Activity"
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

type AttentionCardProps = {
  value: number;
  label: string;
  actionText: string;
  href: string;
  urgency: 'high' | 'medium' | 'low' | 'ok';
};

function AttentionCard({ value, label, actionText, href, urgency }: AttentionCardProps) {
  const styles = {
    high: { card: 'border-red-200 bg-red-50/30', number: 'text-red-700', dot: 'bg-red-500' },
    medium: { card: 'border-orange-200 bg-orange-50/30', number: 'text-orange-700', dot: 'bg-orange-500' },
    low: { card: 'border-amber-200 bg-amber-50/20', number: 'text-amber-700', dot: 'bg-amber-500' },
    ok: { card: 'border-border bg-muted/20', number: 'text-muted-foreground', dot: 'bg-emerald-500' },
  }[urgency];

  return (
    <Link href={href}>
      <Card className={cn('h-full transition-shadow hover:shadow-sm cursor-pointer', styles.card)}>
        <CardContent className="pt-4 pb-4 space-y-1">
          <p className={cn('text-2xl font-bold', styles.number)}>{value}</p>
          <p className="text-xs font-medium text-foreground">{label}</p>
          {value > 0 && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">{actionText}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

type ActionCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

function ActionCard({ href, icon, title, description }: ActionCardProps) {
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
