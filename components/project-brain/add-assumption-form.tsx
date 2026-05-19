'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Loader2, Plus, X } from 'lucide-react';

type Props = { projectId: string };

export function AddAssumptionForm({ projectId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statement, setStatement] = useState('');

  function reset() {
    setStatement('');
    setError(null);
    setOpen(false);
  }

  function submit() {
    if (!statement.trim() || statement.trim().length < 10) {
      setError('Please write at least 10 characters.');
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await fetch('/api/project-brain/assumptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, statement }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to log assumption.');
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
        className="mt-3 w-full border border-dashed text-muted-foreground hover:text-foreground"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Log an assumption
      </Button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">New assumption</p>
        <button type="button" onClick={reset} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {error}
        </div>
      )}
      <Textarea
        placeholder="What is the team currently assuming without verification? e.g. 'We assume all users will have a reliable internet connection.'"
        rows={3}
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        maxLength={1000}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={submit}
          className="flex items-center gap-2"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Log assumption
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
