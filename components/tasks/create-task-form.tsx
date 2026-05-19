'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';

type Member = { id: string; name: string | null; email: string };
type Milestone = { id: string; title: string };

type Props = {
  projectId: string;
  members: Member[];
  milestones: Milestone[];
};

export function CreateTaskForm({ projectId, members, milestones }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const payload = {
      projectId,
      title: fd.get('title') as string,
      description: fd.get('description') as string || null,
      doneCriteria: fd.get('doneCriteria') as string || null,
      priority: fd.get('priority') as string,
      status: 'TODO',
      assigneeId: fd.get('assigneeId') as string || null,
      milestoneId: fd.get('milestoneId') as string || null,
      dueDate: fd.get('dueDate') as string || null,
      estimatedMinutes: fd.get('estimatedMinutes') ? Number(fd.get('estimatedMinutes')) : null,
      cognitiveLoad: fd.get('cognitiveLoad') ? Number(fd.get('cognitiveLoad')) : null,
    };

    if (!payload.title.trim()) {
      setError('Task title is required.');
      return;
    }

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
          <Select id="priority" name="priority" defaultValue="MEDIUM">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assigneeId">Assign to</Label>
          <Select id="assigneeId" name="assigneeId">
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.email}
              </option>
            ))}
          </Select>
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
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="estimatedMinutes">Estimated time (minutes)</Label>
          <Input id="estimatedMinutes" name="estimatedMinutes" type="number" min={5} max={2400} placeholder="e.g. 90" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cognitiveLoad">Cognitive load (1–5)</Label>
          <Select id="cognitiveLoad" name="cognitiveLoad">
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
