import type { Metadata } from 'next';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { InfoCallout } from '@/components/shared/info-callout';
import { PageHeader } from '@/components/shared/page-header';
import { HealthBadge } from '@/components/shared/health-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Team Management' };

export default async function TeamManagementPage() {
  const user = await requireAuth();

  if (user.role !== 'COORDINATOR') {
    return (
      <div className="space-y-6">
        <PageHeader title="Team Management" description="Coordinator tools for managing teams." />
        <InfoCallout variant="warning">
          This page is only accessible to coordinators.
        </InfoCallout>
      </div>
    );
  }

  const teams = await prisma.team.findMany({
    include: {
      project: { select: { title: true, status: true } },
      members: { select: { id: true, role: true } },
      supervisor: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="View and manage all teams on the platform. Full create/edit/assign functionality coming in Part 2."
      />

      <InfoCallout variant="info" title="Part 1 — Read-only overview">
        This page currently shows a read-only list of all teams. Full team creation, supervisor assignment,
        and student management tools will be added in Part 2.
      </InfoCallout>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => {
          const leaders = team.members.filter(
            (m) => m.role === 'LEADER' || m.role === 'CO_LEADER'
          );
          return (
            <Card key={team.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    {team.name}
                  </span>
                  <HealthBadge status={team.healthStatus} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs text-muted-foreground">
                {team.project && (
                  <p className="font-medium text-foreground text-sm truncate">
                    {team.project.title}
                  </p>
                )}
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  <span>{team.members.length} member{team.members.length !== 1 ? 's' : ''}</span>
                  {leaders.length > 0 && (
                    <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      {leaders.length} leader{leaders.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {team.supervisor && (
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3 w-3" />
                    <span>{team.supervisor.user.name ?? 'Supervisor'}</span>
                  </div>
                )}
                {!team.supervisor && (
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <Shield className="h-3 w-3" />
                    <span>No supervisor assigned</span>
                  </div>
                )}
                {team.project && (
                  <div
                    className={cn(
                      'inline-block rounded px-1.5 py-0.5 text-[10px] font-medium',
                      team.project.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-700'
                        : team.project.status === 'ON_HOLD'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {team.project.status}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {teams.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">No teams yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Team creation tools will be available in Part 2.
          </p>
        </div>
      )}
    </div>
  );
}
