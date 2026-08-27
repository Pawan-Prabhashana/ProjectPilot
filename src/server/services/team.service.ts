import { Role } from "@prisma/client";
import { findUserById } from "@/server/repositories/user.repository";
import { createTeam } from "@/server/repositories/team.repository";
import { addTeamMember } from "@/server/repositories/team-member.repository";
import type {
  CreateTeamInput,
  TeamId,
  TeamSummary,
  UserId,
} from "@/lib/types/domain";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export async function createTeamForSupervisor(
  input: CreateTeamInput,
): Promise<TeamSummary> {
  const supervisor = await findUserById(input.supervisorId);
  if (!supervisor) {
    throw new DomainError("Supervisor not found.");
  }
  if (supervisor.role !== Role.SUPERVISOR) {
    throw new DomainError("Only supervisors can own a team.");
  }
  return createTeam(input);
}

export async function enrolStudentOnTeam(
  userId: UserId,
  teamId: TeamId,
): Promise<void> {
  const student = await findUserById(userId);
  if (!student) {
    throw new DomainError("Student not found.");
  }
  if (student.role !== Role.STUDENT) {
    throw new DomainError("Only students can be enrolled as team members.");
  }
  await addTeamMember({ userId, teamId });
}
