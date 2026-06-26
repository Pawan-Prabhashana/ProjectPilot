'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskAllocationPanel } from '@/components/tasks/task-allocation-panel';
import { TASK_SKILL_KEYS } from '@/lib/task-allocation/options';
import type { TaskAssigneeRecommendation } from '@/lib/task-allocation/types';

type Member = { id: string; name: string | null; email: string };
type Milestone = { id: string; title: string };

type Props = {
  projectId: string;
  teamId: string;
  members: Member[];
  milestones: Milestone[];
  /** Only leaders/supervisors/coordinators may create tasks — same group sees allocation recommendations. */
  canSeeAllocationPanel: boolean;
};

const SKILL_LABELS: Record<string, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Database',
  ui_ux: 'UI/UX',
  testing: 'Testing',
  documentation: 'Documentation',
  research: 'Research',
  presentation: 'Presentation',
  project_management: 'Project Management',
  ai_ml: 'AI / ML',
  mobile_development: 'Mobile Development',
  devops: 'DevOps',
};

export function CreateTaskForm({ projectId, teamId, members, milestones, canSeeAllocationPanel }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Controlled fields the allocation panel needs to read live.
  const [assigneeId, setAssigneeId] = useState('');
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('');
  const [cognitiveLoad, setCognitiveLoad] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [appliedRecommendation, setAppliedRecommendation] = useState<TaskAssigneeRecommendation | null>(null);
  const [appliedRoleKey, setAppliedRoleKey] = useState<string | null>(null);

  function toggleSkill(key: string) {
    setRequiredSkills((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    // Required skills changed — a previously applied recommendation is no longer guaranteed valid.
    setAppliedRecommendation(null);
  }

  function handleApplyRecommendation(rec: TaskAssigneeRecommendation, suggestedRoleKey: string | null) {
    setAssigneeId(rec.userId);
    setAppliedRecommendation(rec);
    setAppliedRoleKey(suggestedRoleKey);
  }

  function handleManualAssigneeChange(value: string) {
    setAssigneeId(value);
    // Manual override invalidates the recorded rationale for a different assignee.
    if (!appliedRecommendation || appliedRecommendation.userId !== value) {
      setAppliedRecommendation(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = fd.get('title') as string;

    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    const payload = {
      projectId,
      title,
      description: (fd.get('description') as string) || null,
      doneCriteria: (fd.get('doneCriteria') as string) || null,
      priority,
      status: 'TODO',
      assigneeId: assigneeId || null,
      milestoneId: (fd.get('milestoneId') as string) || null,
      dueDate: dueDate || null,
      estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      cognitiveLoad: cognitiveLoad ? Number(cognitiveLoad) : null,
      requiredSkills: requiredSkills.length > 0 ? requiredSkills : null,
      suggestedRoleKey: appliedRecommendation ? appliedRoleKey : null,
      appliedRecommendation: appliedRecommendation && appliedRecommendation.userId === assigneeId ? appliedRecommendation : null,
    };

    startTransition(async () => {
      setError(null);
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to create task.');
        return;
      }
      const { task } = await res.json();
      router.push(`/dashboard/tasks/${task.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="title">Task title *</Label>
        <Input
          id="title"
          name="title"
          placeholder="What needs to be done?"
          required
          maxLength={300}
          className="text-base"
          autoFocus
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" name="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assigneeId">Assign to</Label>
          <Select id="assigneeId" name="assigneeId" value={assigneeId} onChange={(e) => handleManualAssigneeChange(e.target.value)}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.email}
              </option>
            ))}
          </Select>
          {appliedRecommendation && appliedRecommendation.userId === assigneeId && (
            <p className="text-[11px] text-emerald-700">Set from allocation recommendation (score {appliedRecommendation.score}/100).</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="milestoneId">Milestone</Label>
          <Select id="milestoneId" name="milestoneId">
            <option value="">No milestone</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dueDate">Due date</Label>
          <Input id="dueDate" name="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="estimatedMinutes">Estimated time (minutes)</Label>
          <Input
            id="estimatedMinutes"
            name="estimatedMinutes"
            type="number"
            min={5}
            max={2400}
            placeholder="e.g. 90"
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cognitiveLoad">Cognitive load (1–5)</Label>
          <Select id="cognitiveLoad" name="cognitiveLoad" value={cognitiveLoad} onChange={(e) => setCognitiveLoad(e.target.value)}>
            <option value="">Not set</option>
            <option value="1">1 — Very light</option>
            <option value="2">2 — Light</option>
            <option value="3">3 — Moderate</option>
            <option value="4">4 — Heavy</option>
            <option value="5">5 — Very demanding</option>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Required skills</Label>
        <p className="text-xs text-muted-foreground">
          Select the skills this task needs — used only to recommend a suitable assignee, never to exclude anyone.
        </p>
        <div className="flex flex-wrap gap-2">
          {TASK_SKILL_KEYS.map((key) => {
            const active = requiredSkills.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSkill(key)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted'
                )}
              >
                {SKILL_LABELS[key] ?? key}
              </button>
            );
          })}
        </div>
      </div>

      {canSeeAllocationPanel && (
        <TaskAllocationPanel
          draft={{
            teamId,
            requiredSkills,
            estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
            cognitiveLoad: cognitiveLoad ? Number(cognitiveLoad) : null,
            dueDate: dueDate || null,
            priority,
          }}
          appliedUserId={assigneeId || null}
          onApply={handleApplyRecommendation}
        />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="What exactly needs to happen? Be specific — clarity reduces ambiguity for everyone."
          rows={4}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="doneCriteria">Definition of done</Label>
        <Textarea
          id="doneCriteria"
          name="doneCriteria"
          placeholder="What does 'done' look like? e.g. 'Tests pass, PR merged, reviewed by team lead.'"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          A clear definition of done removes ambiguity and helps everyone know when the task is truly complete.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending} className="flex items-center gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create task
        </Button>
        <Button type="button" variant="ghost" onClick={() => window.history.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
