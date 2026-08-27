import { DomainError } from '@/server/services/team.service';
import { findProjectById } from '@/server/repositories/project.repository';
import { findUserById } from '@/server/repositories/user.repository';
import { isUserOnTeam } from '@/server/repositories/team-member.repository';
import {
  createTask as persistTask,
  deleteTask as removeTask,
  findTaskById,
  listTasksByProject,
  updateTask as persistTaskUpdate,
} from '@/server/repositories/taskRepository';
import type {
  CreateTaskInput,
  ProjectId,
  TaskId,
  TaskRecord,
  UpdateTaskInput,
  UserId,
} from '@/lib/types/domain';

async function assertProjectExists(projectId: ProjectId): Promise<void> {
  const project = await findProjectById(projectId);
  if (!project) {
    throw new DomainError('Project not found.');
  }
}

async function assertAssigneeIsProjectTeamMember(
  projectId: ProjectId,
  assigneeId: UserId | null | undefined,
): Promise<void> {
  if (!assigneeId) {
    return;
  }

  const assignee = await findUserById(assigneeId);
  if (!assignee) {
    throw new DomainError('Assignee not found.');
  }

  const project = await findProjectById(projectId);
  if (!project) {
    throw new DomainError('Project not found.');
  }

  const onTeam = await isUserOnTeam(assigneeId, project.teamId);
  if (!onTeam) {
    throw new DomainError('Assignee must be a member of the project team.');
  }
}

export async function getTask(id: TaskId): Promise<TaskRecord> {
  const task = await findTaskById(id);
  if (!task) {
    throw new DomainError('Task not found.');
  }
  return task;
}

export async function getTasksForProject(projectId: ProjectId): Promise<TaskRecord[]> {
  await assertProjectExists(projectId);
  return listTasksByProject(projectId);
}

export async function createProjectTask(input: CreateTaskInput): Promise<TaskRecord> {
  const title = input.title.trim();
  if (title.length === 0) {
    throw new DomainError('Task title is required.');
  }

  await assertProjectExists(input.projectId);
  await assertAssigneeIsProjectTeamMember(input.projectId, input.assigneeId);

  return persistTask({
    ...input,
    title,
  });
}

export async function updateProjectTask(
  id: TaskId,
  input: UpdateTaskInput,
): Promise<TaskRecord> {
  const existing = await getTask(id);
  const nextProjectId = input.projectId ?? existing.projectId;
  const nextAssigneeId =
    input.assigneeId === undefined ? existing.assigneeId : input.assigneeId;

  if (input.title !== undefined && input.title.trim().length === 0) {
    throw new DomainError('Task title is required.');
  }

  await assertProjectExists(nextProjectId);
  await assertAssigneeIsProjectTeamMember(nextProjectId, nextAssigneeId);

  return persistTaskUpdate(id, {
    ...input,
    title: input.title?.trim(),
  });
}

export async function deleteProjectTask(id: TaskId): Promise<TaskRecord> {
  await getTask(id);
  return removeTask(id);
}
