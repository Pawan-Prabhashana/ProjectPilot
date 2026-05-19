'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function AddDecisionForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [rationale, setRationale] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await fetch('/api/project-brain/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title: title.trim(), rationale: rationale.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to save decision');
        return;
      }
      setTitle('');
      setRationale('');
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Log decision
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <p className="text-sm font-medium">Log a decision</p>

      <div>
        <Label htmlFor="decision-title" className="mb-1 block text-xs">
          Decision title
        </Label>
        <Input
          id="decision-title"
          placeholder="e.g. Use PostgreSQL for the database layer"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          required
        />
      </div>

      <div>
        <Label htmlFor="decision-rationale" className="mb-1 block text-xs">
          Why was this decision made?
        </Label>
        <Textarea
          id="decision-rationale"
          placeholder="e.g. PostgreSQL provides better JSON support and the team already has experience with it..."
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={3}
          maxLength={2000}
          required
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          Save decision
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
