import { prisma } from '@/lib/db';
import type {
  CreateTaskInput,
  ProjectId,
  TaskId,
  TaskRecord,
  UpdateTaskInput,
} from '@/lib/types/domain';

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  projectId: true,
  assigneeId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function findTaskById(id: TaskId): Promise<TaskRecord | null> {
  return prisma.task.findUnique({
    where: { id },
    select: taskSelect,
  });
}

export async function listTasksByProject(projectId: ProjectId): Promise<TaskRecord[]> {
  return prisma.task.findMany({
    where: { projectId },
    select: taskSelect,
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  return prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      projectId: input.projectId,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate ?? null,
      assigneeId: input.assigneeId ?? null,
    },
    select: taskSelect,
  });
}

export async function updateTask(id: TaskId, input: UpdateTaskInput): Promise<TaskRecord> {
  return prisma.task.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate,
      projectId: input.projectId,
      assigneeId: input.assigneeId,
    },
    select: taskSelect,
  });
}

export async function deleteTask(id: TaskId): Promise<TaskRecord> {
  return prisma.task.delete({
    where: { id },
    select: taskSelect,
  });
}
