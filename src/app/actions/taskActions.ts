'use server';

import { failure, success, type Result } from '@/lib/types';
import type { CreateTaskInput, ProjectId, TaskId, TaskRecord, UpdateTaskInput } from '@/lib/types/domain';
import { DomainError } from '@/server/services/team.service';
import {
  createProjectTask,
  deleteProjectTask,
  getTask,
  getTasksForProject,
  updateProjectTask,
} from '@/server/services/taskService';

function toResult<T>(error: unknown): Result<T> {
  if (error instanceof DomainError) {
    return failure(error.message);
  }
  return failure('An unexpected error occurred.');
}

export async function getTaskAction(id: TaskId): Promise<Result<TaskRecord>> {
  try {
    const data = await getTask(id);
    return success(data);
  } catch (error: unknown) {
    return toResult(error);
  }
}

export async function listProjectTasksAction(
  projectId: ProjectId,
): Promise<Result<TaskRecord[]>> {
  try {
    const data = await getTasksForProject(projectId);
    return success(data);
  } catch (error: unknown) {
    return toResult(error);
  }
}

export async function createTaskAction(
  input: CreateTaskInput,
): Promise<Result<TaskRecord>> {
  try {
    const data = await createProjectTask(input);
    return success(data);
  } catch (error: unknown) {
    return toResult(error);
  }
}

export async function updateTaskAction(
  id: TaskId,
  input: UpdateTaskInput,
): Promise<Result<TaskRecord>> {
  try {
    const data = await updateProjectTask(id, input);
    return success(data);
  } catch (error: unknown) {
    return toResult(error);
  }
}

export async function deleteTaskAction(id: TaskId): Promise<Result<TaskRecord>> {
  try {
    const data = await deleteProjectTask(id);
    return success(data);
  } catch (error: unknown) {
    return toResult(error);
  }
}
