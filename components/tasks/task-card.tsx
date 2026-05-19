import Link from 'next/link';
import { AlertTriangle, Clock, User, Lock, Zap, HelpCircle, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import type { PriorityLevel, TaskStatus } from '@prisma/client';

export type TaskCardData = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: PriorityLevel;
  dueDate: Date | null;
  estimatedMinutes: number | null;
  cognitiveLoad: number | null;
  blockerNote: string | null;
  doneCriteria: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
  milestone: { id: string; title: string } | null;
  hasAmbiguityFlag: boolean;
  hasDependencies: boolean;
  hasDecomposition: boolean;
};

const priorityConfig: Record<PriorityLevel, { dot: string; border: string }> = {
  LOW:    { dot: 'bg-slate-400',  border: 'border-l-slate-300' },
  MEDIUM: { dot: 'bg-sky-500',    border: 'border-l-sky-300' },
  HIGH:   { dot: 'bg-amber-500',  border: 'border-l-amber-400' },
  URGENT: { dot: 'bg-red-500',    border: 'border-l-red-500' },
};

const statusBg: Record<TaskStatus, string> = {
  TODO:        'bg-card',
  IN_PROGRESS: 'bg-sky-50/40',
  REVIEW:      'bg-violet-50/40',
  DONE:        'bg-muted/40',
  CANCELLED:   'bg-muted/20',
};

export function TaskCard({ task }: { task: TaskCardData }) {
  const p = priorityConfig[task.priority];
  const now = new Date();
  const isOverdue =
    task.dueDate !== null &&
    task.dueDate < now &&
    task.status !== 'DONE' &&
    task.status !== 'CANCELLED';
  const isDone = task.status === 'DONE' || task.status === 'CANCELLED';

  return (
    <Link href={`/dashboard/tasks/${task.id}`} className="block group">
      <div
        className={cn(
          'rounded-xl border border-l-4 p-4 transition-all hover:shadow-sm hover:-translate-y-0.5',
          statusBg[task.status],
          isOverdue ? 'border-amber-200 border-l-amber-500' : `border-border ${p.border}`,
          isDone && 'opacity-60'
        )}
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-semibold leading-snug', isDone && 'line-through text-muted-foreground')}>
            {task.title}
          </p>
          <div className={cn('mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full', p.dot)} title={task.priority} />
        </div>

        {/* Milestone */}
        {task.milestone && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {task.milestone.title}
          </p>
        )}

        {/* Signals row */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {task.assignee && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assignee.name ?? task.assignee.email.split('@')[0]}
            </span>
          )}
          {task.dueDate && (
            <span className={cn('flex items-center gap-1', isOverdue && 'text-amber-700 font-medium')}>
              <Clock className="h-3 w-3" />
              {isOverdue ? `${Math.floor((now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24))}d overdue` : formatDate(task.dueDate)}
            </span>
          )}
          {task.estimatedMinutes && (
            <span className="flex items-center gap-1">
              ~{task.estimatedMinutes >= 60 ? `${Math.round(task.estimatedMinutes / 60)}h` : `${task.estimatedMinutes}m`}
            </span>
          )}
        </div>

        {/* Flag icons */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {task.blockerNote && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              <Lock className="h-3 w-3" />
              Blocked
            </span>
          )}
          {task.hasAmbiguityFlag && !task.blockerNote && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              <HelpCircle className="h-3 w-3" />
              Ambiguous
            </span>
          )}
          {task.cognitiveLoad !== null && task.cognitiveLoad >= 4 && !isDone && (
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              <Zap className="h-3 w-3" />
              {task.cognitiveLoad === 5 ? 'Complex' : 'Heavy'}
            </span>
          )}
          {task.hasDependencies && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3" />
              Has deps
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
