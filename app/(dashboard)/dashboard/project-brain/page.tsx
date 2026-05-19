import type { Metadata } from 'next';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { resolveActiveWorkspace } from '@/lib/services/workspace-access';
import { getProjectBrainSummary } from '@/lib/services/project-brain';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AddDecisionForm } from '@/components/project-brain/add-decision-form';
import { RaiseQuestionForm } from '@/components/project-brain/raise-question-form';
import { ResolveQuestionButton } from '@/components/project-brain/resolve-question-button';
import { AddAssumptionForm } from '@/components/project-brain/add-assumption-form';
import {
  Brain, HelpCircle, Lightbulb, GitCommit, MessageSquare,
  CheckCircle, Clock,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Project Brain' };

const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 border-red-200',
  HIGH:   'bg-amber-100 text-amber-700 border-amber-200',
  MEDIUM: 'bg-sky-50 text-sky-700 border-sky-200',
  LOW:    'bg-muted text-muted-foreground border-border',
};

export default async function ProjectBrainPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const user = await requireAuth();
  const { teamId } = await searchParams;

  const workspace = await resolveActiveWorkspace(user, teamId);

  if (!workspace || !workspace.projectId) {
    const description =
      user.role === 'STUDENT'
        ? "You are not assigned to a team yet. Please contact your coordinator."
        : user.role === 'SUPERVISOR'
        ? "No teams are assigned to you yet."
        : "No teams exist yet.";
    return (
      <div className="space-y-6">
        <PageHeader
          title="Project Brain"
          description="The shared memory of your project — decisions, questions, assumptions, and supervisor feedback."
        />
        <EmptyState
          icon={<Brain className="h-8 w-8" />}
          title="No project linked"
          description={description}
        />
      </div>
    );
  }

  const project = await prisma.project.findUnique({ where: { id: workspace.projectId } });

  if (!project) {
    return (
      <div className="space-y-6">
        <PageHeader title="Project Brain" description="The shared memory of your project." />
        <EmptyState icon={<Brain className="h-8 w-8" />} title="Project not found" description="The linked project could not be found." />
      </div>
    );
  }

  const [summary, decisions, openQuestions, resolvedQuestions, assumptions, feedbackMemory] =
    await Promise.all([
      getProjectBrainSummary(project.id),
      prisma.decisionLog.findMany({
        where: { projectId: project.id },
        include: { author: { select: { name: true, role: true } } },
        orderBy: { madeAt: 'desc' },
        take: 8,
      }),
      prisma.openQuestion.findMany({
        where: { projectId: project.id, resolvedAt: null },
        include: { raisedByUser: { select: { name: true } } },
        orderBy: [{ priority: 'desc' }, { raisedAt: 'asc' }],
      }),
      prisma.openQuestion.findMany({
        where: { projectId: project.id, resolvedAt: { not: null } },
        orderBy: { resolvedAt: 'desc' },
        take: 3,
      }),
      prisma.assumptionRecord.findMany({
        where: { projectId: project.id, isInvalidated: false },
        include: { loggedByUser: { select: { name: true } } },
        orderBy: { loggedAt: 'desc' },
      }),
      prisma.feedbackMemory.findMany({
        where: { projectId: project.id },
        include: { author: { select: { name: true, role: true } } },
        orderBy: { recordedAt: 'desc' },
        take: 5,
      }),
    ]);

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <Brain className="h-6 w-6 text-violet-500" />
          Project Brain
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-xl">
          The shared memory of <span className="font-medium text-foreground">{project.title}</span>.
          Decisions made, questions open, assumptions live, and what the supervisor last said.
        </p>
      </div>

      {/* ── Summary tiles ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Open Questions',
            value: summary.openQuestionsCount,
            icon: <HelpCircle className="h-4 w-4 text-amber-500" />,
            highlight: summary.openQuestionsCount > 0,
          },
          {
            label: 'Live Assumptions',
            value: summary.unresolvedAssumptions,
            icon: <Lightbulb className="h-4 w-4 text-yellow-500" />,
            highlight: false,
          },
          {
            label: 'Recent Decisions',
            value: summary.recentDecisions,
            icon: <GitCommit className="h-4 w-4 text-indigo-500" />,
            highlight: false,
          },
          {
            label: 'Feedback Entries',
            value: feedbackMemory.length,
            icon: <MessageSquare className="h-4 w-4 text-sky-500" />,
            highlight: false,
          },
        ].map((s) => (
          <div
            key={s.label}
            className={cn(
              'rounded-xl border p-4',
              s.highlight ? 'border-amber-200 bg-amber-50/60' : 'border-border bg-card'
            )}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              {s.icon}
            </div>
            <p className={cn('text-2xl font-bold', s.highlight && 'text-amber-700')}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Open Questions ─────────────────────────────────────── */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Open Questions</h2>
            {openQuestions.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {openQuestions.length}
              </span>
            )}
          </div>

          {openQuestions.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-800">
                All questions resolved — great clarity!
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {openQuestions.map((q) => (
                <li key={q.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium flex-1">{q.question}</p>
                    <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium', priorityColors[q.priority])}>
                      {q.priority}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Raised by {q.raisedByUser.name ?? 'Unknown'} · {formatDate(q.raisedAt)}</span>
                  </div>
                  <div className="mt-2">
                    <ResolveQuestionButton questionId={q.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {resolvedQuestions.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                {resolvedQuestions.length} resolved question{resolvedQuestions.length !== 1 ? 's' : ''}
              </summary>
              <ul className="mt-2 space-y-1.5">
                {resolvedQuestions.map((q) => (
                  <li key={q.id} className="rounded-lg bg-muted/40 p-3 text-sm opacity-70">
                    <p className="line-through text-muted-foreground">{q.question}</p>
                    {q.resolution && <p className="mt-0.5 text-xs text-foreground/70 no-underline">{q.resolution}</p>}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <RaiseQuestionForm projectId={project.id} />
        </section>

        {/* ── Decisions ──────────────────────────────────────────── */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <GitCommit className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold">Decisions</h2>
          </div>

          {decisions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              No decisions logged yet.
              <br />
              <span className="text-xs">Record key decisions here so nothing important gets lost between consultations.</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {decisions.map((d) => (
                <li key={d.id} className="rounded-xl border p-4">
                  <p className="text-sm font-semibold">{d.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">{d.rationale}</p>
                  {d.impact && (
                    <p className="mt-1.5 text-xs border-l-2 border-indigo-200 pl-2 text-indigo-800 leading-relaxed">{d.impact}</p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {d.author.name ?? 'Team'} · {formatDate(d.madeAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <AddDecisionForm projectId={project.id} />
        </section>

        {/* ── Assumptions ────────────────────────────────────────── */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            <h2 className="text-sm font-semibold">Live Assumptions</h2>
          </div>

          {assumptions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              No assumptions recorded.
              <br />
              <span className="text-xs">Logging what your team assumes prevents surprises later.</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {assumptions.map((a) => (
                <li key={a.id} className="rounded-xl border border-yellow-200 bg-yellow-50/40 p-4">
                  <p className="text-sm leading-relaxed">{a.statement}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Logged by {a.loggedByUser.name ?? 'Unknown'} · {formatDate(a.loggedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <AddAssumptionForm projectId={project.id} />
        </section>

        {/* ── Supervisor Feedback Memory ─────────────────────────── */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-sky-500" />
            <h2 className="text-sm font-semibold">Supervisor Feedback</h2>
          </div>

          {feedbackMemory.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              No feedback stored yet.
              <br />
              <span className="text-xs">After consultations, supervisor feedback is automatically added here.</span>
            </div>
          ) : (
            <ul className="space-y-3">
              {feedbackMemory.map((f) => (
                <li key={f.id} className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
                  <p className="text-sm leading-relaxed line-clamp-4">{f.content}</p>
                  {f.keyThemes && (f.keyThemes as string[]).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(f.keyThemes as string[]).map((theme, i) => (
                        <span key={i} className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{f.author.name ?? 'Supervisor'}</span>
                    <span>·</span>
                    <span className="capitalize">{f.source}</span>
                    {f.sentiment && (
                      <>
                        <span>·</span>
                        <span className={cn(
                          'capitalize rounded px-1.5 py-0.5',
                          f.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' :
                          f.sentiment === 'constructive' ? 'bg-amber-100 text-amber-700' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {f.sentiment}
                        </span>
                      </>
                    )}
                    <span>·</span>
                    <span>{formatDate(f.recordedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

