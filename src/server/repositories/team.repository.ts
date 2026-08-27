import { prisma } from "@/lib/db";
import type {
  CreateTeamInput,
  TeamId,
  TeamSummary,
  UserId,
} from "@/lib/types/domain";

export async function findTeamById(id: TeamId): Promise<TeamSummary | null> {
  return prisma.team.findUnique({
    where: { id },
    select: { id: true, name: true, supervisorId: true },
  });
}

export async function listTeamsForSupervisor(
  supervisorId: UserId,
): Promise<TeamSummary[]> {
  return prisma.team.findMany({
    where: { supervisorId },
    select: { id: true, name: true, supervisorId: true },
    orderBy: { name: "asc" },
  });
}

export async function createTeam(input: CreateTeamInput): Promise<TeamSummary> {
  return prisma.team.create({
    data: {
      name: input.name,
      supervisorId: input.supervisorId,
    },
    select: { id: true, name: true, supervisorId: true },
  });
}
