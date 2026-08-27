import { findUserByEmail } from '@/server/repositories/user.repository';
import { listTeams } from '@/server/repositories/team.repository';
import { listProjects } from '@/server/repositories/project.repository';
import { DomainError } from '@/server/services/team.service';
import type {
  StudentWorkspace,
  SupervisorOverviewStats,
  SupervisorTeamRow,
  TeamHealth,
} from '@/lib/types/domain';

function mockHealth(index: number): TeamHealth {
  if (index === 0) {
    return 'AT_RISK';
  }
  return 'ON_TRACK';
}

export async function getSupervisorOverview(): Promise<{
  stats: SupervisorOverviewStats;
  teams: SupervisorTeamRow[];
}> {
  const teams = await listTeams();
  const projects = await listProjects();

  const rows: SupervisorTeamRow[] = teams.map((team, index) => {
    const project = projects.find((item) => item.teamId === team.id);
    return {
      id: team.id,
      name: team.name,
      projectTitle: project?.title ?? 'No project assigned',
      health: mockHealth(index),
    };
  });

  const stats: SupervisorOverviewStats = {
    totalTeams: teams.length,
    totalProjects: projects.length,
    atRiskProjects: rows.filter((row) => row.health !== 'ON_TRACK').length,
  };

  return { stats, teams: rows };
}

export async function getStudentWorkspace(): Promise<StudentWorkspace> {
  const student = await findUserByEmail('student@demo.com');
  if (!student) {
    throw new DomainError('Demo student not found. Run the database seed.');
  }

  const projects = await listProjects();
  const project = projects[0];
  if (!project) {
    throw new DomainError('No project found. Run the database seed.');
  }

  return {
    studentId: student.id,
    studentName: student.name,
    projectId: project.id,
    projectTitle: project.title,
  };
}
