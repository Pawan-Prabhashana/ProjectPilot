import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { resolveActiveWorkspace } from '@/lib/services/workspace-access';
import { canCreateTask } from '@/lib/rbac/team-permissions';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { InfoCallout } from '@/components/shared/info-callout';
import { CreateTaskForm } from '@/components/tasks/create-task-form';
import { ArrowLeft, ClipboardList } from 'lucide-react';

export const metadata: Metadata = { title: 'New Task' };

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const user = await requireAuth();
  const { teamId } = await searchParams;

  const workspace = await resolveActiveWorkspace(user, teamId);

  if (!workspace || !workspace.projectId) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Task" description="Create a task for your project." />
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No project linked"
          description="You must be part of a team with an active project to create tasks."
        />
      </div>
    );
  }

  // Permission check: only leaders, supervisors, and coordinators can create tasks
  const allowed = await canCreateTask(user, workspace.teamId);
  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Task" description="Create a task for your project." />
        <InfoCallout variant="warning" title="Permission required">
          Only team leaders, supervisors, and coordinators can create tasks. If you need a task created, ask your team leader.
        </InfoCallout>
      </div>
    );
  }

  const project = await prisma.project.findUnique({ where: { id: workspace.projectId } });
  if (!project) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Task" description="Create a task for your project." />
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="Project not found"
          description="The linked project could not be found."
        />
      </div>
    );
  }

  const teamIdParam = `?teamId=${workspace.teamId}`;

  const [members, milestones] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId: workspace.teamId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.milestone.findMany({
      where: { projectId: project.id, status: { not: 'COMPLETED' } },
      orderBy: { orderIndex: 'asc' },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/dashboard/tasks${teamIdParam}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Tasks
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Task</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Adding to <span className="font-medium">{project.title}</span>
          {' '}for <span className="font-medium">{workspace.teamName}</span>
        </p>
      </div>

      <CreateTaskForm
        projectId={project.id}
        teamId={workspace.teamId}
        members={members.map((m) => m.user)}
        milestones={milestones}
        canSeeAllocationPanel={allowed}
      />
    </div>
  );
}
