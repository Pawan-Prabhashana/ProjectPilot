'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTasks } from '@/hooks/useTasks';
import type { ProjectId, TaskRecord } from '@/lib/types/domain';
import { TaskStatus } from '@prisma/client';

const ACTIVE_STATUSES: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW];

interface TaskColumnProps {
  title: string;
  tasks: TaskRecord[];
}

function TaskColumn({ title, tasks }: TaskColumnProps): JSX.Element {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks in this list.</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="rounded-md border p-3">
              <p className="text-sm font-medium">{task.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
              <div className="mt-2">
                <Badge variant="outline">{task.status.replaceAll('_', ' ')}</Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

interface StudentTaskBoardProps {
  projectId: ProjectId;
}

export function StudentTaskBoard({ projectId }: StudentTaskBoardProps): JSX.Element {
  const { data, isLoading, error } = useTasks(projectId);

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const tasks = data ?? [];
  const active = tasks.filter((task) => ACTIVE_STATUSES.includes(task.status));
  const backlog = tasks.filter((task) => task.status === TaskStatus.BACKLOG);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TaskColumn title="My active tasks" tasks={active} />
      <TaskColumn title="Project backlog" tasks={backlog} />
    </div>
  );
}
