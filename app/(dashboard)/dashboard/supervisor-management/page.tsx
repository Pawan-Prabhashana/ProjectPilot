import type { Metadata } from 'next';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { InfoCallout } from '@/components/shared/info-callout';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Supervisor Management' };

export default async function SupervisorManagementPage() {
  const user = await requireAuth();

  if (user.role !== 'COORDINATOR') {
    return (
      <div className="space-y-6">
        <PageHeader title="Supervisor Management" description="Coordinator-only management tool." />
        <InfoCallout variant="warning">
          This page is only accessible to coordinators.
        </InfoCallout>
      </div>
    );
  }

  // Operational data only — no private student cognitive profile data is queried here.
  const supervisors = await prisma.supervisorProfile.findMany({
    include: {
      user: { select: { name: true, email: true } },
      supervisedTeams: { select: { id: true, name: true, healthStatus: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const totalSupervisors = supervisors.length;
  const withTeams = supervisors.filter((s) => s.supervisedTeams.length > 0);
  const withoutTeams = supervisors.filter((s) => s.supervisedTeams.length === 0);
  const totalSupervisedTeams = supervisors.reduce((sum, s) => sum + s.supervisedTeams.length, 0);
  const averageLoad =
    totalSupervisors > 0 ? (totalSupervisedTeams / totalSupervisors).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervisor Management"
        description="Coordinator overview of supervisor capacity and team coverage — the foundation for capacity-aware supervisor allocation during team formation."
      />

      <InfoCallout variant="info" title="Capacity preparation">
        This overview shows current supervisor load so you can balance assignments before forming teams.
        Capacity-aware supervisor allocation (automatically matching supervisors to teams by available
        capacity and domain) is a planned next module that builds on the data shown here.
      </InfoCallout>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock
          value={totalSupervisors}
          label="Total Supervisors"
          icon={<BookOpen className="h-4 w-4 text-indigo-500" />}
        />
        <StatBlock
          value={withTeams.length}
          label="With Assigned Teams"
          icon={<CheckCircle className="h-4 w-4 text-emerald-500" />}
        />
        <StatBlock
          value={withoutTeams.length}
          label="No Teams Yet"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          highlight={withoutTeams.length > 0}
        />
        <StatBlock
          value={averageLoad}
          label="Avg Teams / Supervisor"
          icon={<Users className="h-4 w-4 text-blue-500" />}
        />
      </div>

      {/* Supervisor list with team counts */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          Supervisors & Team Load
        </h2>

        {supervisors.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">
                No supervisor accounts exist yet. Supervisors will appear here once their accounts are created.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-6 gap-2 bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="col-span-3">Supervisor</span>
              <span>Department</span>
              <span className="text-center">Teams</span>
              <span className="text-right">Status</span>
            </div>
            {supervisors.map((s, i) => {
              const teamCount = s.supervisedTeams.length;
              return (
                <div
                  key={s.id}
                  className={cn(
                    'grid grid-cols-6 gap-2 items-center px-4 py-2.5 text-sm',
                    i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                  )}
                >
                  <div className="col-span-3 min-w-0">
                    <p className="font-medium truncate text-foreground">
                      {s.title ? `${s.title} ` : ''}
                      {s.user.name ?? 'Unnamed supervisor'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{s.user.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.department ?? <span className="text-muted-foreground/60">—</span>}
                  </p>
                  <p className="text-center text-sm font-medium tabular-nums">{teamCount}</p>
                  <div className="text-right">
                    {teamCount === 0 ? (
                      <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                        Available
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300">
                        Assigned
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Privacy reminder */}
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Privacy note:</span>{' '}
          This view shows operational supervisor capacity only. Private student cognitive profile and
          accessibility data is never exposed to coordinators or supervisors.
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

type StatBlockProps = {
  value: number | string;
  label: string;
  icon: React.ReactNode;
  highlight?: boolean;
};

function StatBlock({ value, label, icon, highlight }: StatBlockProps) {
  const isHighlighted = highlight && Number(value) > 0;
  return (
    <Card className={cn(isHighlighted ? 'border-amber-300 bg-amber-50/30' : '')}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-1">{icon}</div>
        <p className={cn('text-2xl font-bold', isHighlighted ? 'text-amber-700' : 'text-foreground')}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}
