import { prisma } from "@/lib/db";
import type {
  AddTeamMemberInput,
  TeamId,
  TeamMembership,
  UserId,
} from "@/lib/types/domain";

export async function listMembersForTeam(
  teamId: TeamId,
): Promise<TeamMembership[]> {
  return prisma.teamMember.findMany({
    where: { teamId },
    select: { id: true, userId: true, teamId: true },
  });
}

export async function listTeamsForStudent(
  userId: UserId,
): Promise<TeamMembership[]> {
  return prisma.teamMember.findMany({
    where: { userId },
    select: { id: true, userId: true, teamId: true },
  });
}

export async function addTeamMember(
  input: AddTeamMemberInput,
): Promise<TeamMembership> {
  return prisma.teamMember.create({
    data: {
      userId: input.userId,
      teamId: input.teamId,
    },
    select: { id: true, userId: true, teamId: true },
  });
}

export async function isUserOnTeam(
  userId: UserId,
  teamId: TeamId,
): Promise<boolean> {
  const membership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: { userId, teamId },
    },
    select: { id: true },
  });
  return membership !== null;
}
