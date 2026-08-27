import { prisma } from "@/lib/db";
import type {
  CreateProjectInput,
  ProjectId,
  ProjectSummary,
  TeamId,
} from "@/lib/types/domain";

export async function findProjectById(
  id: ProjectId,
): Promise<ProjectSummary | null> {
  return prisma.project.findUnique({
    where: { id },
    select: { id: true, title: true, description: true, teamId: true },
  });
}

export async function listProjectsForTeam(
  teamId: TeamId,
): Promise<ProjectSummary[]> {
  return prisma.project.findMany({
    where: { teamId },
    select: { id: true, title: true, description: true, teamId: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ProjectSummary> {
  return prisma.project.create({
    data: {
      title: input.title,
      description: input.description,
      teamId: input.teamId,
    },
    select: { id: true, title: true, description: true, teamId: true },
  });
}
