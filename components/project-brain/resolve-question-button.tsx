'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function ResolveQuestionButton({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleResolve() {
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/project-brain/questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, resolution: resolution.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to resolve question');
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline underline-offset-2"
      >
        Mark resolved
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
      <div>
        <Label htmlFor={`resolve-${questionId}`} className="mb-1 block text-xs font-medium text-emerald-800">
          How was this resolved?
        </Label>
        <Textarea
          id={`resolve-${questionId}`}
          placeholder="Describe the resolution or outcome..."
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          rows={2}
          maxLength={2000}
          className="bg-white text-sm"
        />
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleResolve}
          disabled={isPending || resolution.trim().length < 5}
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-100"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          Confirm resolution
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
