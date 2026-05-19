'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { TaskStatus } from '@prisma/client';

type Props = {
  taskId: string;
  currentStatus: TaskStatus;
};

const nextStatus: Partial<Record<TaskStatus, { label: string; next: TaskStatus }>> = {
  TODO: { label: 'Start', next: 'IN_PROGRESS' },
  IN_PROGRESS: { label: 'Mark for review', next: 'REVIEW' },
  REVIEW: { label: 'Mark done', next: 'DONE' },
};

const buttonStyles: Partial<Record<TaskStatus, string>> = {
  TODO: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
  IN_PROGRESS: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
  REVIEW: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
};

export function TaskStatusButton({ taskId, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const action = nextStatus[currentStatus];
  if (!action) return null;

  function advance() {
    startTransition(async () => {
      await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action!.next }),
      });
      router.refresh();
    });
  }

  return (
    <button
      onClick={advance}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${buttonStyles[currentStatus] ?? 'border-border hover:bg-muted'}`}
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : null}
      {action.label}
    </button>
  );
}
