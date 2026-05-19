'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';

export function CreateSlotForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [slotMinutes, setSlotMinutes] = useState('30');
  const [meetingMode, setMeetingMode] = useState('in-person');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = new FormData(e.currentTarget);
    const dateValue = form.get('date') as string;
    const timeValue = form.get('time') as string;

    if (!dateValue || !timeValue) {
      setError('Please provide both a date and a time.');
      return;
    }

    const startTime = new Date(`${dateValue}T${timeValue}:00`);

    const payload = {
      startTime: startTime.toISOString(),
      slotMinutes: parseInt(slotMinutes, 10),
      meetingMode,
      locationOrLink: (form.get('locationOrLink') as string) || null,
      notes: (form.get('notes') as string) || null,
    };

    startTransition(async () => {
      const res = await fetch('/api/consultations/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to create slot. Please try again.');
        return;
      }

      setSuccess(true);
      (e.target as HTMLFormElement).reset();
      setMeetingMode('in-person');
      setSlotMinutes('30');
      router.refresh();
      onSuccess?.();
    });
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" min={today} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="time">Time</Label>
          <Input id="time" name="time" type="time" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="slotMinutes">Duration</Label>
          <Select
            id="slotMinutes"
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(e.target.value)}
          >
            <option value="15">15 minutes</option>
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meetingMode">Meeting mode</Label>
          <Select
            id="meetingMode"
            value={meetingMode}
            onChange={(e) => setMeetingMode(e.target.value)}
          >
            <option value="in-person">In-person</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="locationOrLink">
          {meetingMode === 'online' ? 'Meeting link (Zoom / Teams / Google Meet)' : 'Room / location'}
        </Label>
        <Input
          id="locationOrLink"
          name="locationOrLink"
          placeholder={
            meetingMode === 'online'
              ? 'https://zoom.us/j/your-meeting-id'
              : 'e.g. CS Building, Room 301'
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Notes for students <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="e.g. Please prepare an agenda. Bring your latest designs or code."
          rows={3}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          Slot published successfully.
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Publishing…</>
        ) : (
          <><Plus className="h-4 w-4 mr-2" />Publish slot</>
        )}
      </Button>
    </form>
  );
}
