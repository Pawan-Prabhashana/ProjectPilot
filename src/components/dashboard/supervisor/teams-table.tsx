import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { SupervisorTeamRow, TeamHealth } from '@/lib/types/domain';

interface TeamsTableProps {
  teams: SupervisorTeamRow[];
}

function healthVariant(health: TeamHealth): 'success' | 'warning' | 'destructive' {
  if (health === 'ON_TRACK') {
    return 'success';
  }
  if (health === 'AT_RISK') {
    return 'warning';
  }
  return 'destructive';
}

function healthLabel(health: TeamHealth): string {
  if (health === 'ON_TRACK') {
    return 'On track';
  }
  if (health === 'AT_RISK') {
    return 'At risk';
  }
  return 'Critical';
}

export function TeamsTable({ teams }: TeamsTableProps): JSX.Element {
  if (teams.length === 0) {
    return <p className="text-sm text-muted-foreground">No teams yet. Run the database seed.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Team</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Health</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map((team) => (
          <TableRow key={team.id}>
            <TableCell className="font-medium">{team.name}</TableCell>
            <TableCell>{team.projectTitle}</TableCell>
            <TableCell>
              <Badge variant={healthVariant(team.health)}>{healthLabel(team.health)}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
