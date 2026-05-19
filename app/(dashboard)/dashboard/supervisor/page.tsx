import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { getSupervisorDashboard } from '@/lib/services/dashboard/supervisor-dashboard';
import { InfoCallout } from '@/components/shared/info-callout';
import { PageHeader } from '@/components/shared/page-header';
import { RecentActivityFeed } from '@/components/activity/recent-activity-feed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HealthBadge } from '@/components/shared/health-badge';
import {
  BookOpen,
  Users,
  AlertTriangle,
  Calendar,
  ArrowRight,
  CheckCircle,
  Clock,
  ClipboardList,
  Brain,
  MessageSquare,
  Eye,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Supervisor Dashboard' };

export default async function SupervisorDashboardPage() {
  const user = await requireAuth();

  if (user.role !== 'SUPERVISOR' && user.role !== 'COORDINATOR') {
    return (
      <div className="space-y-6">
        <PageHeader title="Supervisor Dashboard" description="Team oversight and feedback." />
        <InfoCallout variant="warning">
          This page is only accessible to supervisors and coordinators.
        </InfoCallout>
      </div>
    );
  }

  const data = await getSupervisorDashboard(user.id);

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Supervisor Dashboard" description="Team oversight and feedback." />
        <InfoCallout variant="info" title="Supervisor profile not found">
          Your supervisor profile is not set up yet. Please contact the system coordinator.
        </InfoCallout>
      </div>
    );
  }

  const {
    supervisorName,
    profileTitle,
    department,
    teams,
    pendingConsultations,
    upcomingConsultations,
    recentConsultations,
    stats,
  } = data;

  const teamsNeedingAttention = teams.filter((t) => t.needsAttention);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Supervisor Dashboard"
        description="Which teams need your attention and what should you review?"
      />

      {/* Identity */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border bg-muted/40 px-4 py-2.5 text-sm">
        <BookOpen className="h-4 w-4 text-indigo-500 shrink-0" />
        <span className="font-medium text-foreground">{supervisorName ?? user.name ?? 'Supervisor'}</span>
        {profileTitle && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{profileTitle}</span>
          </>
        )}
        {department && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{department}</span>
          </>
        )}
      </div>

      {/* Section A: Overview Stats */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBlock
            value={stats.totalTeams}
            label="Assigned Teams"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
          <StatBlock
            value={stats.pendingRequests}
            label="Pending Requests"
            icon={<Clock className="h-4 w-4 text-orange-500" />}
            highlight={stats.pendingRequests > 0}
          />
          <StatBlock
            value={stats.upcomingMeetings}
            label="Upcoming Meetings"
            icon={<Calendar className="h-4 w-4 text-blue-500" />}
          />
          <StatBlock
            value={teamsNeedingAttention.length}
            label="Need Attention"
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            highlight={teamsNeedingAttention.length > 0}
          />
        </div>
      </section>

      {/* Section D: Teams Needing Attention (promoted above team board for visibility) */}
      {teamsNeedingAttention.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Teams Needing Attention
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
              {teamsNeedingAttention.length}
            </Badge>
          </h2>
          <div className="space-y-2">
            {teamsNeedingAttention.map((team) => (
              <div
                key={team.teamId}
                className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{team.teamName}</p>
                  {team.projectTitle && (
                    <p className="text-xs text-muted-foreground truncate">{team.projectTitle}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {team.attentionReasons.map((reason, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/dashboard/team?teamId=${team.teamId}`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                  </Link>
                  <Link href={`/dashboard/consultations?teamId=${team.teamId}`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <Calendar className="h-3 w-3 mr-1" /> Consult
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section B: Assigned Teams Board */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Users className="h-4 w-4 text-muted-foreground" />
          Assigned Teams
        </h2>
        {teams.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">
                You are not assigned to supervise any teams yet. Contact your coordinator.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Card
                key={team.teamId}
                className={cn(
                  'transition-shadow hover:shadow-sm',
                  team.needsAttention ? 'border-amber-200' : ''
                )}
              >
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-semibold truncate">{team.teamName}</CardTitle>
                      {team.projectTitle && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{team.projectTitle}</p>
                      )}
                    </div>
                    <HealthBadge status={team.healthStatus} className="shrink-0" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-base font-bold text-foreground">{team.memberCount}</p>
                      <p className="text-[10px] text-muted-foreground">members</p>
                    </div>
                    <div>
                      <p className={cn('text-base font-bold', team.activeTaskCount > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                        {team.activeTaskCount}
                      </p>
                      <p className="text-[10px] text-muted-foreground">active tasks</p>
                    </div>
                    <div>
                      <p className={cn('text-base font-bold', team.overdueTaskCount > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                        {team.overdueTaskCount}
                      </p>
                      <p className="text-[10px] text-muted-foreground">overdue</p>
                    </div>
                  </div>
                  {team.openQuestionsCount > 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      {team.openQuestionsCount} open question{team.openQuestionsCount > 1 ? 's' : ''} in Project Brain
                    </p>
                  )}
                  {team.leaderName && (
                    <p className="text-xs text-muted-foreground">
                      Leader: <span className="font-medium text-foreground">{team.leaderName}</span>
                    </p>
                  )}
                  {team.nextConsultation && (
                    <p className="text-xs text-muted-foreground">
                      Next meeting: <span className="font-medium">{formatDate(team.nextConsultation.slotStart)}</span>
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Link href={`/dashboard/team?teamId=${team.teamId}`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full h-7 text-xs">
                        <Eye className="h-3 w-3 mr-1" /> View Team
                      </Button>
                    </Link>
                    <Link href={`/dashboard/consultations?teamId=${team.teamId}`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full h-7 text-xs">
                        <Calendar className="h-3 w-3 mr-1" /> Consult
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Section C: Consultation Queue */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Consultation Queue
        </h2>
        {pendingConsultations.length === 0 && upcomingConsultations.length === 0 && recentConsultations.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">
                No consultation has been booked yet. Prepare questions in Project Brain before requesting one.
              </p>
              <Link href="/dashboard/consultations" className="mt-3 inline-block">
                <Button size="sm" variant="outline">
                  <Calendar className="h-3.5 w-3.5 mr-1.5" /> View Consultations
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingConsultations.length > 0 && (
              <ConsultationGroup
                label="Pending Requests"
                items={pendingConsultations}
                badgeClass="bg-orange-100 text-orange-800 border-orange-200"
              />
            )}
            {upcomingConsultations.length > 0 && (
              <ConsultationGroup
                label="Upcoming Confirmed"
                items={upcomingConsultations}
                badgeClass="bg-blue-100 text-blue-800 border-blue-200"
              />
            )}
            {recentConsultations.length > 0 && (
              <ConsultationGroup
                label="Recently Completed"
                items={recentConsultations}
                badgeClass="bg-green-100 text-green-800 border-green-200"
              />
            )}
          </div>
        )}
      </section>

      {/* Recent activity across supervised teams */}
      <RecentActivityFeed
        limit={8}
        title="Recent Supervised Activity"
      />

      {/* Section E: Action Center */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
          Supervisor Action Center
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            href="/dashboard/consultations"
            icon={<Calendar className="h-4 w-4 text-blue-500" />}
            title="Consultation Requests"
            description={
              pendingConsultations.length > 0
                ? `${pendingConsultations.length} request${pendingConsultations.length > 1 ? 's' : ''} awaiting your confirmation`
                : 'Review and manage your consultation schedule'
            }
            highlight={pendingConsultations.length > 0}
          />
          <ActionCard
            href="/dashboard/project-brain"
            icon={<Brain className="h-4 w-4 text-purple-500" />}
            title="Review Project Brain"
            description="Respond to open questions and review team decisions"
          />
          <ActionCard
            href="/dashboard/supervisor-workspace"
            icon={<Eye className="h-4 w-4 text-indigo-500" />}
            title="Supervisor Workspace"
            description="Detailed workspace view, meeting notes, and feedback tools"
          />
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

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

type ConsultationItem = {
  bookingId: string;
  teamName: string;
  slotStart: Date;
  status: string;
  hasBrief: boolean;
  hasNote: boolean;
};

function ConsultationGroup({
  label,
  items,
  badgeClass,
}: {
  label: string;
  items: ConsultationItem[];
  badgeClass: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="space-y-1.5 rounded-lg border p-2">
        {items.map((item) => (
          <Link
            key={item.bookingId}
            href={`/dashboard/consultations`}
            className="flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-muted/50 transition-colors group"
          >
            <span className="flex-1 truncate font-medium text-foreground group-hover:text-primary">
              {item.teamName}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{formatDate(item.slotStart)}</span>
              <Badge variant="outline" className={cn('text-[10px]', badgeClass)}>
                {item.status}
              </Badge>
              {!item.hasBrief && item.status !== 'COMPLETED' && (
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                  no brief
                </Badge>
              )}
              <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

type ActionCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
};

function ActionCard({ href, icon, title, description, highlight }: ActionCardProps) {
  return (
    <Link href={href}>
      <Card
        className={cn(
          'h-full transition-shadow hover:shadow-sm cursor-pointer group',
          highlight ? 'border-amber-300' : ''
        )}
      >
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
              {title}
            </span>
            {highlight && (
              <span className="ml-auto h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
