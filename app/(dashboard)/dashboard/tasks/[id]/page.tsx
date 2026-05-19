import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { TaskStatusButton } from '@/components/tasks/task-status-button';
import { ExplainableScoreCard } from '@/components/metrics/explainable-score-card';
import { scoreTaskAmbiguity } from '@/lib/metrics/task-ambiguity';
import {
  ArrowLeft, User, Clock, Target, AlertTriangle, Lock, HelpCircle,
  Zap, GitBranch, CheckCircle, Circle, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import type { TaskStatus, PriorityLevel } from '@prisma/client';

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const task = await prisma.task.findUnique({ where: { id: params.id }, select: { title: true } });
  return { title: task ? task.title : 'Task' };
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  TODO:        { label: 'To Do',       className: 'bg-slate-100 text-slate-700 border-slate-200' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  REVIEW:      { label: 'In Review',   className: 'bg-violet-50 text-violet-700 border-violet-200' },
  DONE:        { label: 'Done',        className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED:   { label: 'Cancelled',   className: 'bg-muted text-muted-foreground' },
};

const priorityConfig: Record<PriorityLevel, { label: string; className: string }> = {
  LOW:    { label: 'Low',    className: 'bg-slate-100 text-slate-700' },
  MEDIUM: { label: 'Medium', className: 'bg-sky-50 text-sky-700' },
  HIGH:   { label: 'High',   className: 'bg-amber-50 text-amber-700' },
  URGENT: { label: 'Urgent', className: 'bg-red-100 text-red-700 font-semibold' },
};

export default async function TaskDetailPage({ params }: Props) {
  const user = await requireAuth();
  const task = await getTaskDetail(params.id);
  if (!task) notFound();

  const now = new Date();
  const isOverdue = task.dueDate && task.dueDate < now && !['DONE', 'CANCELLED'].includes(task.status);
  const sc = statusConfig[task.status];
  const pc = priorityConfig[task.priority];

  // Compute task ambiguity score
  const ambiguityDetail = scoreTaskAmbiguity({
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    doneCriteria: (task as { doneCriteria?: string | null }).doneCriteria ?? null,
    assigneeId: task.assignee?.id ?? null,
    dueDate: task.dueDate ?? null,
    priority: task.priority,
    blockerNote: (task as { blockerNote?: string | null }).blockerNote ?? null,
    status: task.status,
  });

  // Steps done
  const steps = task.decomposition?.steps as { title: string; estimatedMinutes: number; orderIndex: number; done: boolean }[] ?? [];
  const stepsDone = steps.filter((s) => s.done).length;
  const stepsProgress = steps.length > 0 ? Math.round((stepsDone / steps.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Back navigation ─────────────────────────────────────── */}
      <div>
        <Link
          href="/dashboard/tasks"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Tasks
        </Link>
      </div>

      {/* ── Title & status ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <h1 className={cn(
            'text-2xl font-bold tracking-tight flex-1',
            task.status === 'DONE' && 'line-through text-muted-foreground'
          )}>
            {task.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full border px-3 py-1 text-xs font-medium', sc.className)}>
            {sc.label}
          </span>
          <span className={cn('rounded-full px-3 py-1 text-xs font-medium', pc.className)}>
            {pc.label} priority
          </span>
          {isOverdue && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Overdue
            </span>
          )}
          {task.cognitiveLoad !== null && task.cognitiveLoad >= 4 && (
            <span className="flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
              <Zap className="h-3.5 w-3.5" />
              Cognitive load: {task.cognitiveLoad}/5
            </span>
          )}
          {/* Status advance button */}
          {!['DONE', 'CANCELLED'].includes(task.status) && (
            <TaskStatusButton taskId={task.id} currentStatus={task.status} />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main content ────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Description */}
          {task.description && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Description</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {task.description}
              </p>
            </section>
          )}

          {/* Definition of Done */}
          {task.doneCriteria && (
            <section>
              <h2 className="mb-2 text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Definition of Done
              </h2>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm text-emerald-900 leading-relaxed whitespace-pre-line">
                {task.doneCriteria}
              </div>
            </section>
          )}

          {/* Blocker */}
          {task.blockerNote && (
            <section>
              <h2 className="mb-2 text-sm font-semibold flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-red-500" />
                Blocker
              </h2>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 leading-relaxed">
                {task.blockerNote}
              </div>
            </section>
          )}

          {/* Task Clarity Analysis */}
          {ambiguityDetail.score.status !== 'LOW' && !['DONE', 'CANCELLED'].includes(task.status) && (
            <section>
              <h2 className="mb-2 text-sm font-semibold flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-amber-500" />
                Task Clarity
              </h2>
              <ExplainableScoreCard metric={ambiguityDetail.score} />
              {ambiguityDetail.suggestedFixes.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Suggested fixes:</p>
                  <ul className="space-y-1">
                    {ambiguityDetail.suggestedFixes.map((fix, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                        {fix}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Legacy ambiguity flag (from DB — shown alongside formula score) */}
          {task.ambiguityFlag && ambiguityDetail.score.status === 'LOW' && (
            <section>
              <h2 className="mb-2 text-sm font-semibold flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-amber-500" />
                Ambiguity Flag
              </h2>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {task.ambiguityFlag.description}
                <p className="mt-2 text-xs text-amber-600">
                  Flagged {formatDate(task.ambiguityFlag.flaggedAt)} · Severity: {task.ambiguityFlag.severity}
                </p>
              </div>
            </section>
          )}

          {/* Step-by-step decomposition */}
          {steps.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-indigo-500" />
                  Step-by-step breakdown
                </h2>
                <span className="text-xs text-muted-foreground">{stepsDone}/{steps.length} steps done</span>
              </div>
              <Progress value={stepsProgress} variant={stepsProgress >= 70 ? 'success' : stepsProgress >= 30 ? 'default' : 'danger'} className="mb-3" />
              <ol className="space-y-2">
                {steps.map((step, i) => (
                  <li
                    key={i}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 text-sm',
                      step.done ? 'bg-muted/40 opacity-60' : 'bg-card'
                    )}
                  >
                    <div className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                    )}>
                      {step.done ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <p className={cn('font-medium', step.done && 'line-through text-muted-foreground')}>
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        ~{step.estimatedMinutes}m
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Dependencies */}
          {(task.outgoingDeps.length > 0 || task.incomingDeps.length > 0) && (
            <section>
              <h2 className="mb-3 text-sm font-semibold flex items-center gap-1.5">
                <GitBranch className="h-4 w-4 text-sky-500" />
                Dependencies
              </h2>
              {task.outgoingDeps.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">This task depends on:</p>
                  <div className="space-y-1.5">
                    {task.outgoingDeps.map((dep) => (
                      <Link key={dep.id} href={`/dashboard/tasks/${dep.targetTask.id}`}>
                        <div className={cn(
                          'flex items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/50 transition-colors',
                          !['DONE', 'CANCELLED'].includes(dep.targetTask.status) && dep.dependencyType === 'BLOCKS'
                            ? 'border-amber-200 bg-amber-50/50'
                            : 'border-border'
                        )}>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{dep.targetTask.title}</span>
                          <span className="ml-auto text-xs text-muted-foreground capitalize">
                            {dep.dependencyType.replace('_', ' ').toLowerCase()}
                          </span>
                          <span className={cn(
                            'rounded px-1.5 py-0.5 text-xs',
                            dep.targetTask.status === 'DONE'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            {dep.targetTask.status.replace('_', ' ').toLowerCase()}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {task.incomingDeps.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Blocked by this task:</p>
                  <div className="space-y-1.5">
                    {task.incomingDeps.map((dep) => (
                      <Link key={dep.id} href={`/dashboard/tasks/${dep.sourceTask.id}`}>
                        <div className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm hover:bg-muted/50 transition-colors">
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{dep.sourceTask.title}</span>
                          <span className={cn(
                            'ml-auto rounded px-1.5 py-0.5 text-xs',
                            dep.sourceTask.status === 'DONE'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            {dep.sourceTask.status.replace('_', ' ').toLowerCase()}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Sidebar metadata ────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <MetaRow icon={<User className="h-3.5 w-3.5" />} label="Assigned to">
                {task.assignee ? (
                  <span className="font-medium">{task.assignee.name ?? task.assignee.email}</span>
                ) : (
                  <span className="text-muted-foreground italic">Unassigned</span>
                )}
              </MetaRow>

              <Separator />

              <MetaRow icon={<Clock className="h-3.5 w-3.5" />} label="Due date">
                {task.dueDate ? (
                  <span className={cn('font-medium', isOverdue && 'text-amber-700')}>
                    {formatDate(task.dueDate)}
                    {isOverdue && ' (overdue)'}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">No due date</span>
                )}
              </MetaRow>

              {task.estimatedMinutes && (
                <>
                  <Separator />
                  <MetaRow icon={<Clock className="h-3.5 w-3.5" />} label="Estimated time">
                    <span className="font-medium">
                      {task.estimatedMinutes >= 60
                        ? `${Math.round(task.estimatedMinutes / 60)}h`
                        : `${task.estimatedMinutes}m`}
                    </span>
                  </MetaRow>
                </>
              )}

              {task.milestone && (
                <>
                  <Separator />
                  <MetaRow icon={<Target className="h-3.5 w-3.5" />} label="Milestone">
                    <span className="font-medium text-indigo-700">{task.milestone.title}</span>
                  </MetaRow>
                </>
              )}

              {task.cognitiveLoad !== null && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1.5 text-xs text-muted-foreground flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5" />
                      Cognitive load
                    </p>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div
                          key={n}
                          className={cn(
                            'h-2 flex-1 rounded-full',
                            n <= (task.cognitiveLoad ?? 0)
                              ? task.cognitiveLoad! >= 4 ? 'bg-red-500' : task.cognitiveLoad! >= 3 ? 'bg-amber-400' : 'bg-emerald-500'
                              : 'bg-muted'
                          )}
                        />
                      ))}
                      <span className="ml-1 text-xs text-muted-foreground">{task.cognitiveLoad}/5</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-0.5 text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

// ── Data helper ────────────────────────────────────────────────────────────────

async function getTaskDetail(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      milestone: { select: { id: true, title: true } },
      decomposition: true,
      outgoingDeps: {
        include: {
          targetTask: { select: { id: true, title: true, status: true } },
        },
      },
      incomingDeps: {
        include: {
          sourceTask: { select: { id: true, title: true, status: true } },
        },
      },
    },
  });

  if (!task) return null;

  const ambiguityFlag = await prisma.ambiguityFlag.findFirst({
    where: { entityType: 'TASK', entityId: taskId, resolvedAt: null },
    orderBy: { flaggedAt: 'desc' },
  });

  return { ...task, ambiguityFlag };
}
