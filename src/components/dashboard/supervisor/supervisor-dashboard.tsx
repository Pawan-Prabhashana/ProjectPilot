'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSupervisorOverview } from '@/hooks/useDashboard';
import type { TeamHealth } from '@/lib/types/domain';

function healthVariant(health: TeamHealth): 'success' | 'warning' | 'destructive' {
  if (health === 'ON_TRACK') {
    return 'success';
  }
  if (health === 'AT_RISK') {
    return 'warning';
  }
  return 'destructive';
}

export function SupervisorDashboard(): JSX.Element {
  const { data, isLoading, error } = useSupervisorOverview();

  if (isLoading) {
    return <Skeleton className="h-80 w-full" />;
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">{error?.message ?? 'Overview unavailable.'}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Supervisor deck</h1>
        <p className="text-sm text-muted-foreground">Team oversight and programme health.</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total teams</CardTitle>
                <CardDescription>Teams currently supervised</CardDescription>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">{data.stats.totalTeams}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Projects</CardTitle>
                <CardDescription>Active year-long projects</CardDescription>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">{data.stats.totalProjects}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>At-risk projects</CardTitle>
                <CardDescription>Mocked health signal</CardDescription>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">{data.stats.atRiskProjects}</CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="teams">
          <Card>
            <CardHeader>
              <CardTitle>Supervised teams</CardTitle>
              <CardDescription>Project assignment and mocked health</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Health</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.teams.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No teams yet. Run the database seed.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.teams.map((team) => (
                      <TableRow key={team.id}>
                        <TableCell className="font-medium">{team.name}</TableCell>
                        <TableCell>{team.projectTitle}</TableCell>
                        <TableCell>
                          <Badge variant={healthVariant(team.health)}>
                            {team.health.replaceAll('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
