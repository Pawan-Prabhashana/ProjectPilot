'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Zap } from 'lucide-react';

export function GenerateBriefButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/consultations/${bookingId}/brief`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to generate brief');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button size="sm" variant="outline" onClick={handleGenerate} disabled={isPending}>
        {isPending ? (
          <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating…</>
        ) : (
          <><Zap className="h-3.5 w-3.5 mr-1.5" />Generate brief</>
        )}
      </Button>
    </div>
  );
}
