import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { resolveActiveWorkspace } from '@/lib/services/workspace-access';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Progress } from '@/components/ui/progress';
import { TaskCard } from '@/components/tasks/task-card';
import type { TaskCardData } from '@/components/tasks/task-card';
import { ClipboardList, Plus, Lock, AlertTriangle, Users, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskStatus } from '@prisma/client';

export const metadata: Metadata = { title: 'Tasks' };

const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'TODO',        label: 'To Do',       color: 'bg-slate-500' },
  { key: 'IN_PROGRESS', label: 'In Progress',  color: 'bg-sky-500' },
  { key: 'REVIEW',      label: 'Review',       color: 'bg-violet-500' },
  { key: 'DONE',        label: 'Done',         color: 'bg-emerald-500' },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const user = await requireAuth();
  const { teamId } = await searchParams;

  const workspace = await resolveActiveWorkspace(user, teamId);

  if (!workspace || !workspace.projectId) {
    const emptyDesc =
      user.role === 'STUDENT'
        ? 'You are not assigned to a team yet. Please contact your coordinator.'
        : user.role === 'SUPERVISOR'
        ? 'No teams are assigned to you yet.'
        : 'No teams exist yet. Create or import teams from Team Management.';
    return (
      <div className="space-y-6">
        <PageHeader
          title="Tasks"
          description="Smart task board — see what the team is working on, who owns what, and what is blocked."
        />
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No project linked"
          description={emptyDesc}
        />
      </div>
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: workspace.projectId },
  });

  if (!project) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tasks" description="Smart task board." />
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="Project not found"
          description="The linked project could not be found."
        />
      </div>
    );
  }

  const tasks = await getProjectTasks(project.id);
  const now = new Date();

  // Compute stats
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const overdue = tasks.filter(
    (t) => t.dueDate && t.dueDate < now && !['DONE', 'CANCELLED'].includes(t.status)
  ).length;
  const blocked = tasks.filter((t) => t.blockerNote).length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  // Group by status
  const byStatus = STATUS_COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.key),
  }));

  const teamIdParam = workspace.teamId ? `?teamId=${workspace.teamId}` : '';
  const canCreate =
    workspace.isLeader ||
    workspace.isSupervisor ||
    workspace.isCoordinator;

  return (
    <div className="space-y-6">
      {/* Workspace context banner */}
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-foreground">{workspace.teamName}</span>
        <span>·</span>
        <span>{project.title}</span>
        {workspace.isLeader && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            <Crown className="h-2.5 w-2.5" />
            {workspace.userCapability === 'CO_LEADER' ? 'Co-Leader' : 'Team Leader'}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.title} · {total} task{total !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Link
            href={`/dashboard/tasks/new${teamIdParam}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 self-start"
          >
            <Plus className="h-4 w-4" />
            Add task
          </Link>
        )}
      </div>

      {/* ── Progress + alerts ─────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Overall progress</span>
          <span className="font-medium">{done}/{total} done</span>
        </div>
        <Progress value={completionRate} variant={completionRate >= 70 ? 'success' : completionRate >= 30 ? 'default' : 'danger'} />
      </div>

      {/* Overdue / blocked alerts */}
      {(overdue > 0 || blocked > 0) && (
        <div className="flex flex-wrap gap-2">
          {overdue > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {overdue} overdue task{overdue !== 1 ? 's' : ''}
            </div>
          )}
          {blocked > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
              <Lock className="h-3.5 w-3.5" />
              {blocked} blocked task{blocked !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* ── Kanban board ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {byStatus.map((col) => (
          <div key={col.key} className="flex flex-col gap-2">
            {/* Column header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', col.color)} />
                <span className="text-sm font-semibold">{col.label}</span>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {col.tasks.length}
              </span>
            </div>
            {/* Column body */}
            <div className="flex flex-col gap-2 min-h-24">
              {col.tasks.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
                  {col.key === 'TODO' ? 'Nothing queued' : `No tasks ${col.label.toLowerCase()}`}
                </div>
              ) : (
                col.tasks.map((task) => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Priority risk summary ─────────────────────────────────── */}
      {tasks.filter((t) => t.priority === 'URGENT' && t.status !== 'DONE').length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800 mb-2">
            Urgent tasks requiring immediate attention
          </p>
          <ul className="space-y-1">
            {tasks
              .filter((t) => t.priority === 'URGENT' && t.status !== 'DONE')
              .map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/dashboard/tasks/${t.id}`}
                    className="text-xs text-red-700 hover:underline underline-offset-2 font-medium"
                  >
                    {t.title}
                    {t.assignee && ` — ${t.assignee.name ?? t.assignee.email}`}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Data helpers ───────────────────────────────────────────────────────────────

async function getProjectTasks(projectId: string): Promise<TaskCardData[]> {
  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: { projectId, status: { notIn: ['CANCELLED'] } },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      milestone: { select: { id: true, title: true } },
      outgoingDeps: { select: { id: true } },
      decomposition: { select: { taskId: true } },
    },
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' },
    ],
  });

  // Check ambiguity flags in one batch query
  const taskIds = tasks.map((t) => t.id);
  const ambiguousTaskIds = new Set(
    (
      await prisma.ambiguityFlag.findMany({
        where: { entityType: 'TASK', entityId: { in: taskIds }, resolvedAt: null },
        select: { entityId: true },
      })
    ).map((f) => f.entityId)
  );

  // Also flag tasks with missing key fields
  tasks.forEach((t) => {
    if (!t.description || !t.assigneeId || !t.dueDate) {
      ambiguousTaskIds.add(t.id);
    }
  });

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    estimatedMinutes: t.estimatedMinutes,
    cognitiveLoad: (t as { cognitiveLoad?: number | null }).cognitiveLoad ?? null,
    blockerNote: (t as { blockerNote?: string | null }).blockerNote ?? null,
    doneCriteria: (t as { doneCriteria?: string | null }).doneCriteria ?? null,
    assignee: t.assignee,
    milestone: t.milestone,
    hasAmbiguityFlag: ambiguousTaskIds.has(t.id),
    hasDependencies: t.outgoingDeps.length > 0,
    hasDecomposition: !!t.decomposition,
  }));
}
