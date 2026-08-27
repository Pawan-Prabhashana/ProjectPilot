import type { Role } from "@prisma/client";

export type UserId = string;
export type TeamId = string;
export type ProjectId = string;

export interface UserSummary {
  id: UserId;
  email: string;
  name: string;
  role: Role;
}

export interface TeamSummary {
  id: TeamId;
  name: string;
  supervisorId: UserId;
}

export interface ProjectSummary {
  id: ProjectId;
  title: string;
  description: string;
  teamId: TeamId;
}

export interface TeamMembership {
  id: string;
  userId: UserId;
  teamId: TeamId;
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
}

export interface CreateTeamInput {
  name: string;
  supervisorId: UserId;
}

export interface CreateProjectInput {
  title: string;
  description: string;
  teamId: TeamId;
}

export interface AddTeamMemberInput {
  userId: UserId;
  teamId: TeamId;
}
