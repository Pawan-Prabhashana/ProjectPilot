'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Calendar, MapPin, Video, LayoutGrid, FileText, HelpCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type AvailableSlot = {
  id: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  meetingMode: string | null;
  locationOrLink: string | null;
  notes: string | null;
  supervisorName: string;
};

type Props = {
  slots: AvailableSlot[];
};

const modeIcon: Record<string, React.ElementType> = {
  online: Video,
  'in-person': MapPin,
  hybrid: LayoutGrid,
};

function formatSlotTime(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${s.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export function StructuredBookingForm({ slots }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!selectedSlotId) {
      setError('Please select a consultation slot.');
      return;
    }

    const form = new FormData(e.currentTarget);
    const agenda = form.get('agenda') as string;
    const purpose = form.get('purpose') as string;
    const blockerContext = form.get('blockerContext') as string;
    const topicsForSupervisor = form.get('topicsForSupervisor') as string;

    if (!agenda || agenda.trim().length < 10) {
      setError('Please provide a brief agenda of at least 10 characters.');
      return;
    }

    startTransition(async () => {
      const res = await fetch('/api/consultations/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availabilityId: selectedSlotId,
          agenda: agenda.trim(),
          purpose: purpose?.trim() || null,
          blockerContext: blockerContext?.trim() || null,
          topicsForSupervisor: topicsForSupervisor?.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to book. Please try again.');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.refresh();
      }, 1500);
    });
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-600">No slots available right now</p>
        <p className="text-xs text-slate-400 mt-1">Check back soon — your supervisor will publish new availability.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <FileText className="h-6 w-6 text-green-600" />
        </div>
        <p className="font-semibold text-green-800">Consultation requested</p>
        <p className="mt-1 text-sm text-green-700">
          Your request has been sent. Your supervisor will confirm the slot shortly.
          You can view the status in your consultation list.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Step 1: Select slot */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
          Choose a time slot
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {slots.map((slot) => {
            const ModeIcon = modeIcon[slot.meetingMode ?? 'in-person'] ?? MapPin;
            const isSelected = slot.id === selectedSlotId;
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSelectedSlotId(slot.id)}
                className={cn(
                  'text-left rounded-xl border p-3 transition-all hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-background hover:border-primary/50'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-foreground leading-tight">
                      {formatSlotTime(slot.startTime, slot.endTime)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {slot.slotMinutes} min · {slot.supervisorName}
                    </p>
                  </div>
                  <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <ModeIcon className="h-3.5 w-3.5" />
                    <span className="capitalize">{slot.meetingMode ?? 'in-person'}</span>
                  </span>
                </div>
                {slot.locationOrLink && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{slot.locationOrLink}</p>
                )}
                {slot.notes && (
                  <p className="mt-1 text-xs text-muted-foreground/70 italic line-clamp-1">{slot.notes}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Show supervisor notes for selected slot */}
      {selectedSlot?.notes && (
        <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2.5 text-sm text-sky-700">
          <span className="font-medium">Supervisor note:</span> {selectedSlot.notes}
        </div>
      )}

      {/* Step 2: What do you want from this meeting? */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
          What do you want from this meeting?
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="purpose" className="text-xs text-muted-foreground">
              Meeting purpose <span className="text-muted-foreground/60">(what you want to achieve)</span>
            </Label>
            <Textarea
              id="purpose"
              name="purpose"
              placeholder="e.g. Get supervisor sign-off on our system design before we start implementation. Need clarity on which authentication approach is best for our use case."
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="blockerContext" className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              Current blockers <span className="text-muted-foreground/60">(what is stopping you)</span>
            </Label>
            <Textarea
              id="blockerContext"
              name="blockerContext"
              placeholder="e.g. We can't start the API implementation until we know whether to use JWT or session-based auth. Also unclear on the ER diagram approval process."
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="topicsForSupervisor" className="text-xs text-muted-foreground flex items-center gap-1">
              <HelpCircle className="h-3 w-3 text-violet-500" />
              Questions for supervisor <span className="text-muted-foreground/60">(specific things to ask)</span>
            </Label>
            <Textarea
              id="topicsForSupervisor"
              name="topicsForSupervisor"
              placeholder="e.g. Can you review our updated ER diagram? Is the scope document specific enough for milestone 2 sign-off?"
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </div>
      </div>

      {/* Step 3: Brief agenda */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
          Summary agenda
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="agenda" className="text-xs text-muted-foreground">
            A 1–2 sentence summary of what this meeting covers
          </Label>
          <Textarea
            id="agenda"
            name="agenda"
            required
            placeholder="e.g. Review system design document and ER diagram, discuss authentication approach, and get sign-off on milestone 2 scope."
            rows={2}
            className="resize-none text-sm"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending || !selectedSlotId} className="w-full">
        {isPending ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending request…</>
        ) : (
          <><Calendar className="h-4 w-4 mr-2" />Request consultation</>
        )}
      </Button>
    </form>
  );
}
