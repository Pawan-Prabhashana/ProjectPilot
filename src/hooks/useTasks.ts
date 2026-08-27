'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { createTaskAction, listProjectTasksAction, updateTaskAction } from '@/app/actions/taskActions';
import { isSuccess, type Result } from '@/lib/types';
import type { CreateTaskInput, ProjectId, TaskId, TaskRecord, UpdateTaskInput } from '@/lib/types/domain';

export const taskQueryKey = (projectId: ProjectId) => ['tasks', projectId] as const;

function unwrapResult<T>(result: Result<T>): T {
  if (!isSuccess(result)) {
    throw new Error(result.error ?? 'Request failed.');
  }
  return result.data;
}

export function useTasks(projectId: ProjectId | undefined): UseQueryResult<TaskRecord[], Error> {
  return useQuery({
    queryKey: projectId ? taskQueryKey(projectId) : ['tasks', 'none'],
    enabled: Boolean(projectId),
    queryFn: async (): Promise<TaskRecord[]> => {
      if (!projectId) {
        return [];
      }
      return unwrapResult(await listProjectTasksAction(projectId));
    },
  });
}

type CreateTaskContext = {
  previous?: TaskRecord[];
};

export function useCreateTask(
  projectId: ProjectId | undefined,
): UseMutationResult<TaskRecord, Error, CreateTaskInput, CreateTaskContext> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput): Promise<TaskRecord> => {
      return unwrapResult(await createTaskAction(input));
    },
    onMutate: async (input): Promise<CreateTaskContext> => {
      if (!projectId) {
        return {};
      }
      await queryClient.cancelQueries({ queryKey: taskQueryKey(projectId) });
      const previous = queryClient.getQueryData<TaskRecord[]>(taskQueryKey(projectId));
      const optimistic: TaskRecord = {
        id: `optimistic-${Date.now()}`,
        title: input.title,
        description: input.description,
        status: input.status ?? 'BACKLOG',
        priority: input.priority ?? 'MEDIUM',
        dueDate: input.dueDate ?? null,
        projectId: input.projectId,
        assigneeId: input.assigneeId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      queryClient.setQueryData<TaskRecord[]>(taskQueryKey(projectId), (current) => [
        optimistic,
        ...(current ?? []),
      ]);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (projectId && context?.previous) {
        queryClient.setQueryData(taskQueryKey(projectId), context.previous);
      }
    },
    onSettled: async () => {
      if (projectId) {
        await queryClient.invalidateQueries({ queryKey: taskQueryKey(projectId) });
      }
    },
  });
}

export function useUpdateTask(
  projectId: ProjectId | undefined,
): UseMutationResult<TaskRecord, Error, { id: TaskId; input: UpdateTaskInput }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: TaskId;
      input: UpdateTaskInput;
    }): Promise<TaskRecord> => {
      return unwrapResult(await updateTaskAction(id, input));
    },
    onSuccess: async () => {
      if (projectId) {
        await queryClient.invalidateQueries({ queryKey: taskQueryKey(projectId) });
      }
    },
  });
}
