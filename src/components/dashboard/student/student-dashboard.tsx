'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateTaskDialog } from '@/components/dashboard/student/create-task-dialog';
import { StudentTaskBoard } from '@/components/dashboard/student/student-task-board';
import { useStudentWorkspace } from '@/hooks/useDashboard';

export function StudentDashboard(): JSX.Element {
  const { data, isLoading, error } = useStudentWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-80 w-full" />;
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">{error?.message ?? 'Workspace unavailable.'}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Student sprint</h1>
          <p className="text-sm text-muted-foreground">{data.projectTitle}</p>
        </div>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          Create task
        </Button>
      </div>
      <StudentTaskBoard projectId={data.projectId} />
      <CreateTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={data.projectId}
        assigneeId={data.studentId}
      />
    </div>
  );
}
