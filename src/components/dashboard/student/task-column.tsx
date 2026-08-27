'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { TaskRecord } from '@/lib/types/domain';
import type { TaskStatus } from '@prisma/client';

interface TaskColumnProps {
  title: string;
  tasks: TaskRecord[];
  isLoading: boolean;
}

function statusLabel(status: TaskStatus): string {
  return status.replaceAll('_', ' ');
}

export function TaskColumn({ title, tasks, isLoading }: TaskColumnProps): JSX.Element {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks in this list.</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{task.title}</p>
                <Badge variant="outline">{statusLabel(task.status)}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
