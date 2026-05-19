'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  notes: string | null;
};

function formatSlot(startTime: string, slotMinutes: number) {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + slotMinutes * 60 * 1000);
  return {
    date: start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    time: `${start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
  };
}

export function BookConsultationForm() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [agenda, setAgenda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch('/api/consultations/available-slots')
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Please select a time slot.');
      return;
    }
    if (agenda.trim().length < 10) {
      setError('Agenda must be at least 10 characters.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/consultations/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availabilityId: selectedSlot, agenda: agenda.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Booking failed. Please try again.');
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.refresh();
      }, 1500);
    });
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle className="h-8 w-8 text-green-500" />
        <p className="font-semibold text-green-800">Consultation request sent!</p>
        <p className="text-sm text-green-700">
          Your supervisor has been notified and will confirm shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Slot selection */}
      <div>
        <Label className="mb-2 block">Choose a time slot</Label>
        {loadingSlots ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading available slots…
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No available slots at the moment. Your supervisor has not published availability yet.
          </div>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => {
              const { date, time } = formatSlot(slot.startTime, slot.slotMinutes);
              const isSelected = selectedSlot === slot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSelectedSlot(slot.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{date}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {time} · {slot.slotMinutes} min
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Agenda */}
      <div>
        <Label htmlFor="agenda" className="mb-1 block">
          Agenda{' '}
          <span className="text-xs font-normal text-muted-foreground">
            — What do you want to discuss?
          </span>
        </Label>
        <Textarea
          id="agenda"
          placeholder="e.g. Review our system design proposal and get feedback on the API layer. Also need to clarify requirements for the reporting module."
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          rows={4}
          maxLength={2000}
          className="resize-y"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {agenda.length}/2000 · A clear agenda helps your supervisor prepare and reduces meeting anxiety for everyone.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending || slots.length === 0 || !selectedSlot}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending request…
          </>
        ) : (
          'Request consultation'
        )}
      </Button>
    </form>
  );
}
