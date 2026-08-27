import type { Role, TaskPriority, TaskStatus } from "@prisma/client";

export type UserId = string;
export type TeamId = string;
export type ProjectId = string;
export type TaskId = string;

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

export interface TaskRecord {
  id: TaskId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  projectId: ProjectId;
  assigneeId: UserId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  projectId: ProjectId;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date | null;
  assigneeId?: UserId | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date | null;
  projectId?: ProjectId;
  assigneeId?: UserId | null;
}
