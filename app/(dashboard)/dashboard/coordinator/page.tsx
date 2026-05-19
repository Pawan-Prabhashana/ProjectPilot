import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { getCoordinatorDashboard } from '@/lib/services/dashboard/coordinator-dashboard';
import { InfoCallout } from '@/components/shared/info-callout';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HealthBadge } from '@/components/shared/health-badge';
import {
  Shield,
  Users,
  BarChart3,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Settings,
  BookOpen,
  CheckCircle,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Coordinator Dashboard' };

export default async function CoordinatorDashboardPage() {
  const user = await requireAuth();

  if (user.role !== 'COORDINATOR') {
    return (
      <div className="space-y-6">
        <PageHeader title="Coordinator Dashboard" description="Platform management." />
        <InfoCallout variant="warning">
          This page is only accessible to coordinators.
        </InfoCallout>
      </div>
    );
  }

  const data = await getCoordinatorDashboard();
  const { stats, setupGaps, recentTeams } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coordinator Dashboard"
        description="Platform-wide overview. Manage teams, supervisors, and operational health."
      />

      {/* Section A: System Overview */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          System Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBlock value={stats.totalStudents} label="Students" icon={<Users className="h-4 w-4 text-blue-500" />} />
          <StatBlock value={stats.totalSupervisors} label="Supervisors" icon={<BookOpen className="h-4 w-4 text-indigo-500" />} />
          <StatBlock value={stats.totalTeams} label="Total Teams" icon={<Zap className="h-4 w-4 text-purple-500" />} />
          <StatBlock
            value={stats.totalActiveProjects}
            label="Active Projects"
            icon={<CheckCircle className="h-4 w-4 text-emerald-500" />}
          />
          <StatBlock
            value={stats.teamsWithoutSupervisor}
            label="No Supervisor"
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            highlight={stats.teamsWithoutSupervisor > 0}
          />
          <StatBlock
            value={stats.teamsWithoutProject}
            label="No Project"
            icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
            highlight={stats.teamsWithoutProject > 0}
          />
          <StatBlock
            value={stats.studentsWithoutTeam}
            label="Students Unassigned"
            icon={<Users className="h-4 w-4 text-amber-500" />}
            highlight={stats.studentsWithoutTeam > 0}
          />
          <StatBlock
            value={stats.upcomingConsultations}
            label="Upcoming Consultations"
            icon={<Calendar className="h-4 w-4 text-blue-500" />}
          />
        </div>
      </section>

      {/* Section B: Setup Attention */}
      {setupGaps.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Setup Attention
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
              {setupGaps.length} team{setupGaps.length !== 1 ? 's' : ''}
            </Badge>
          </h2>
          <div className="space-y-2">
            {setupGaps.map((gap) => (
              <div
                key={gap.teamId}
                className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium text-sm text-foreground">{gap.teamName}</p>
                  <div className="flex flex-wrap gap-1">
                    {gap.issues.map((issue, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                        {issue}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Link href={`/dashboard/team-management`}>
                  <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0">
                    Fix Setup <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friction events alert */}
      {stats.unresolveedFrictionEvents > 0 && (
        <InfoCallout variant="warning" title="Unresolved friction events">
          {stats.unresolveedFrictionEvents} social friction event{stats.unresolveedFrictionEvents !== 1 ? 's' : ''} are
          unresolved across teams.
        </InfoCallout>
      )}

      {/* Section C: Team Management Preview */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Users className="h-4 w-4 text-muted-foreground" />
            Recent Teams
          </h2>
          <Link href="/dashboard/team-management">
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-7">
              View all
            </Button>
          </Link>
        </div>
        {recentTeams.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">
                No teams have been created yet. Set up teams from the Team Management page.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-5 gap-2 bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="col-span-2">Team</span>
              <span>Supervisor</span>
              <span>Leader</span>
              <span className="text-center">Members</span>
            </div>
            {recentTeams.map((team, i) => (
              <div
                key={team.teamId}
                className={cn(
                  'grid grid-cols-5 gap-2 items-center px-4 py-2.5 text-sm',
                  i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                )}
              >
                <div className="col-span-2 min-w-0">
                  <p className="font-medium truncate text-foreground">{team.teamName}</p>
                  {team.projectTitle && (
                    <p className="text-xs text-muted-foreground truncate">{team.projectTitle}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {team.supervisorName ?? (
                    <span className="text-amber-600">Not assigned</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {team.leaderName ?? (
                    <span className="text-amber-600">None</span>
                  )}
                </p>
                <p className="text-center text-sm font-medium">{team.memberCount}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section D: Academic Operations */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Shield className="h-4 w-4 text-muted-foreground" />
          Academic Operations
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <OperationCard
            href="/dashboard/team-management"
            icon={<Users className="h-4 w-4 text-blue-500" />}
            title="Manage Teams"
            description="Create teams, assign supervisors, and manage team membership."
          />
          <OperationCard
            href="/dashboard/supervisor-workspace"
            icon={<BookOpen className="h-4 w-4 text-indigo-500" />}
            title="Manage Supervisors"
            description="View all supervisor activity, consultation slots, and team assignments."
            comingSoon={false}
          />
          <OperationCard
            href="/dashboard/supervisor-management"
            icon={<Settings className="h-4 w-4 text-slate-500" />}
            title="Supervisor Management"
            description="Assign supervisors to teams and review supervisor capacity."
            comingSoon
          />
          <OperationCard
            href="/dashboard/consultations"
            icon={<Calendar className="h-4 w-4 text-purple-500" />}
            title="Review Consultations"
            description="View all consultation bookings across teams and supervisors."
          />
          <OperationCard
            href="/dashboard/coordinator"
            icon={<BarChart3 className="h-4 w-4 text-emerald-500" />}
            title="System Overview"
            description="Platform-wide counts, setup health, and team operational status."
          />
        </div>
      </section>

      {/* Section E: Privacy reminder */}
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Privacy note:</span>{' '}
          Coordinator dashboards show operational setup and progress, not private student cognitive profile details.
          Student support preferences and accessibility data remain private to each student.
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

type StatBlockProps = {
  value: number;
  label: string;
  icon: React.ReactNode;
  highlight?: boolean;
};

function StatBlock({ value, label, icon, highlight }: StatBlockProps) {
  return (
    <Card className={cn(highlight && value > 0 ? 'border-amber-300 bg-amber-50/30' : '')}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-1">{icon}</div>
        <p className={cn('text-2xl font-bold', highlight && value > 0 ? 'text-amber-700' : 'text-foreground')}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

type OperationCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  comingSoon?: boolean;
};

function OperationCard({ href, icon, title, description, comingSoon }: OperationCardProps) {
  if (comingSoon) {
    return (
      <Card className="h-full opacity-70">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="font-medium text-sm text-foreground">{title}</span>
            <Badge variant="secondary" className="ml-auto text-[10px]">Soon</Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Link href={href}>
      <Card className="h-full transition-shadow hover:shadow-sm cursor-pointer group">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
              {title}
            </span>
            <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
