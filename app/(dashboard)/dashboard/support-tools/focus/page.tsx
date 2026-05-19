import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth, requireRole } from '@/lib/rbac';
import { getFocusModeData } from '@/lib/services/support-intelligence';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { InfoCallout } from '@/components/shared/info-callout';
import { FocusTaskPicker } from '@/components/support/focus-task-picker';
import {
  CheckCircle, Clock, ArrowLeft, AlertTriangle,
  Target, Layers, BookOpen, Focus,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Focus Mode — ProjectPilot' };

const PRIORITY_COLORS: Record<string, { label: string; bg: string; text: string }> = {
  URGENT: { label: 'Urgent', bg: 'bg-red-100', text: 'text-red-700' },
  HIGH:   { label: 'High',   bg: 'bg-amber-100', text: 'text-amber-700' },
  MEDIUM: { label: 'Medium', bg: 'bg-sky-100',   text: 'text-sky-700' },
  LOW:    { label: 'Low',    bg: 'bg-slate-100',  text: 'text-slate-600' },
};

export default async function FocusModePage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const user = await requireAuth();
  requireRole(user, ['STUDENT']);
  const { taskId } = await searchParams;

  const focusData = await getFocusModeData(user.id, taskId);

  // Load available open tasks for task picker
  const availableTasks = await prisma.task.findMany({
    where: {
      assigneeId: user.id,
      status: { notIn: ['DONE', 'CANCELLED'] },
    },
    select: { id: true, title: true, priority: true, dueDate: true },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    take: 20,
  });

  if (!focusData) {
    return (
      <div className="max-w-2xl space-y-6">
        <Link
          href="/dashboard/support-tools"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Support Tools
        </Link>
        <PageHeader
          title="Focus Mode"
          description="One task. One step. Full attention."
        />
        <InfoCallout variant="info">
          No tasks are currently assigned to you. Focus Mode will be available once you have an open task.
        </InfoCallout>
        <Link href="/dashboard/tasks" className="text-sm text-primary hover:underline underline-offset-2">
          View task board →
        </Link>
      </div>
    );
  }

  const { task, decompositionSteps, nextStep, whyItMatters, suggestedSessionMinutes, supportPrompt, isBlocked } = focusData;
  const priorityStyle = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.MEDIUM;
  const remainingSteps = decompositionSteps.filter((s) => !s.done);
  const doneSteps = decompositionSteps.filter((s) => s.done);
  const stepProgress = decompositionSteps.length > 0
    ? Math.round((doneSteps.length / decompositionSteps.length) * 100)
    : 0;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/support-tools"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Support Tools
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
          <Focus className="h-3.5 w-3.5" />
          Focus Mode
        </div>
      </div>

      {/* Task picker */}
      {availableTasks.length > 1 && (
        <FocusTaskPicker tasks={availableTasks} currentTaskId={task.id} />
      )}

      {/* Blocked warning */}
      {isBlocked && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">This task has an active blocker</p>
            <p className="text-xs text-red-700 mt-1">{task.blockerNote}</p>
            <p className="text-xs text-red-600 mt-1.5">
              You can still use Focus Mode to document your thoughts or plan around the blocker, but you may need to resolve this first.
            </p>
          </div>
        </div>
      )}

      {/* Main focus card */}
      <div className="rounded-2xl border bg-gradient-to-br from-indigo-50/50 to-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/50 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <Target className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-lg font-bold text-foreground leading-tight">{task.title}</h1>
                <span className={cn('text-xs font-medium rounded-full px-2.5 py-0.5', priorityStyle.bg, priorityStyle.text)}>
                  {priorityStyle.label}
                </span>
              </div>
              {task.milestoneName && (
                <p className="text-xs text-indigo-600 font-medium">
                  Part of: {task.milestoneName}
                </p>
              )}
              {task.dueDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3" />
                  Due {formatDate(task.dueDate)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Why it matters */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Why this matters
            </p>
            <p className="text-sm text-foreground leading-relaxed">{whyItMatters}</p>
          </div>

          {/* Description */}
          {task.description && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                What it involves
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Next immediate step */}
          <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-5 py-4 space-y-1.5">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
              Your next step right now
            </p>
            <p className="text-sm font-medium text-indigo-900 leading-relaxed">{nextStep}</p>
            {suggestedSessionMinutes && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-600 pt-1">
                <Clock className="h-3 w-3" />
                Suggested session: {suggestedSessionMinutes} minutes
              </div>
            )}
          </div>

          {/* Definition of done */}
          {task.doneCriteria && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                Done when
              </p>
              <p className="text-sm text-foreground leading-relaxed">{task.doneCriteria}</p>
            </div>
          )}

          {/* Decomposition steps */}
          {decompositionSteps.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Task steps
                </p>
                {stepProgress > 0 && (
                  <span className="text-xs text-green-700">{stepProgress}% done</span>
                )}
              </div>
              {stepProgress > 0 && (
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-400 rounded-full"
                    style={{ width: `${stepProgress}%` }}
                  />
                </div>
              )}
              <div className="space-y-2">
                {decompositionSteps.map((step, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm',
                      step.done ? 'bg-green-50 text-green-800' : i === doneSteps.length ? 'bg-indigo-50 text-indigo-900 font-medium ring-1 ring-indigo-200' : 'bg-muted/40 text-muted-foreground'
                    )}
                  >
                    <span className={cn(
                      'mt-0.5 h-2 w-2 rounded-full shrink-0',
                      step.done ? 'bg-green-500' : i === doneSteps.length ? 'bg-indigo-500' : 'bg-muted-foreground/30'
                    )} />
                    <span className={cn(step.done && 'line-through opacity-60')}>{step.title}</span>
                    {step.estimatedMinutes > 0 && (
                      <span className="ml-auto text-xs opacity-50 shrink-0">~{step.estimatedMinutes}m</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Support prompt */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-600 italic leading-relaxed">{supportPrompt}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href={`/dashboard/tasks/${task.id}`}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Open full task view
        </Link>
        <Link
          href="/dashboard/support-tools/low-energy"
          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          <Focus className="h-3.5 w-3.5" />
          Switch to Low-Energy Mode
        </Link>
      </div>
    </div>
  );
}
