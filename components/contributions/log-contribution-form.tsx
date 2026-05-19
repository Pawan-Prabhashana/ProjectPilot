'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { AlertTriangle, Loader2, Plus, X } from 'lucide-react';

const CONTRIBUTION_TYPES = [
  { value: 'CODE',               label: 'Code' },
  { value: 'DESIGN',             label: 'Design' },
  { value: 'RESEARCH',           label: 'Research' },
  { value: 'WRITING',            label: 'Writing' },
  { value: 'PLANNING',           label: 'Planning' },
  { value: 'TESTING',            label: 'Testing' },
  { value: 'COORDINATION',       label: 'Coordination' },
  { value: 'REVIEW',             label: 'Peer Review' },
  { value: 'DOCUMENTATION',      label: 'Documentation' },
  { value: 'CLARIFICATION',      label: 'Clarification' },
  { value: 'MEETING_PREP',       label: 'Meeting Prep' },
  { value: 'UNBLOCKING_SUPPORT', label: 'Support Work' },
  { value: 'OTHER',              label: 'Other' },
];

type Props = { projectId: string };

export function LogContributionForm({ projectId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setError(null);
    setOpen(false);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      projectId,
      description: fd.get('description') as string,
      contributionType: fd.get('contributionType') as string,
      hours: fd.get('hours') ? Number(fd.get('hours')) : null,
    };
    if (!payload.description.trim() || payload.description.trim().length < 10) {
      setError('Please describe your contribution in at least 10 characters.');
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await fetch('/api/contributions/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to log contribution.');
        return;
      }
      reset();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="mt-2 w-full border border-dashed text-muted-foreground hover:text-foreground"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Log a contribution
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Log a contribution</p>
        <button type="button" onClick={reset} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contributionType" className="text-xs">Type</Label>
          <Select id="contributionType" name="contributionType" defaultValue="CODE">
            {CONTRIBUTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hours" className="text-xs">Hours spent (optional)</Label>
          <Input id="hours" name="hours" type="number" min={0.25} max={24} step={0.25} placeholder="e.g. 1.5" className="text-sm" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs">What did you work on?</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Describe what you contributed — be specific enough that a teammate understands what you did."
          rows={3}
          maxLength={1000}
          required
          className="text-sm"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending} className="flex items-center gap-1.5">
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Log contribution
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
