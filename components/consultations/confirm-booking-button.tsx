'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ConfirmBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await fetch(`/api/consultations/${bookingId}/confirm`, { method: 'POST' });
      if (res.ok) router.refresh();
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={confirm}
      disabled={isPending}
      className="border-green-300 text-green-700 hover:bg-green-50"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CheckCircle className="h-3.5 w-3.5" />
      )}
      Confirm
    </Button>
  );
}
