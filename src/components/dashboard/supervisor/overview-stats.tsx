import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SupervisorOverviewStats } from '@/lib/types/domain';

interface OverviewStatsProps {
  stats: SupervisorOverviewStats;
}

export function OverviewStats({ stats }: OverviewStatsProps): JSX.Element {
  const items = [
    { label: 'Total teams', value: stats.totalTeams },
    { label: 'Projects', value: stats.totalProjects },
    { label: 'At-risk projects', value: stats.atRiskProjects },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
