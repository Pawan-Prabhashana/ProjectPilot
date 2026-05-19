'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Zap } from 'lucide-react';

type Props = {
  bookingId: string;
  existingContent?: string;
  existingPrivateNote?: string;
};

export function MeetingNotesForm({ bookingId, existingContent, existingPrivateNote }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isUpdate = !!existingContent;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = new FormData(e.currentTarget);
    const content = (form.get('content') as string)?.trim();
    const privateNote = (form.get('privateNote') as string)?.trim() || null;

    if (!content || content.length < 50) {
      setError('Please write at least 50 characters. Good notes help students take clear action.');
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/consultations/${bookingId}/meeting-notes`, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, privateNote }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to save notes. Please try again.');
        return;
      }

      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="content">
          Meeting notes
        </Label>
        <p className="text-xs text-muted-foreground">
          Write naturally — the system will automatically extract action items, quality expectations,
          and ambiguities for the student team.
        </p>
        <Textarea
          id="content"
          name="content"
          defaultValue={existingContent}
          required
          rows={12}
          className="resize-none text-sm font-mono leading-relaxed"
          placeholder={`Write your notes here. The bridge system will parse them for action items and expectations.

Tips for clear student-facing notes:
• Use "you should...", "please ensure...", "make sure..." to signal action items
• Use "I expect to see...", "by the end of next week..." for expectations  
• Include deadline hints: "by next session", "before milestone X"
• Specific is better than vague — e.g. "Add cardinality labels to all ER diagram relationships" beats "improve the diagram"`}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="privateNote">
          Private note <span className="text-muted-foreground text-xs">(not shared with team)</span>
        </Label>
        <Textarea
          id="privateNote"
          name="privateNote"
          defaultValue={existingPrivateNote ?? ''}
          rows={3}
          className="resize-none text-sm"
          placeholder="Internal observations, team dynamics notes, or reminders for your own records."
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
          <p className="text-sm font-medium text-green-700">Notes saved and translated for the team.</p>
          <p className="text-xs text-green-600 mt-0.5">
            The bridge system has extracted action items, expectations, and ambiguities from your notes.
          </p>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving and translating…</>
        ) : (
          <><Zap className="h-4 w-4 mr-2" />{isUpdate ? 'Update notes and re-translate' : 'Save notes and translate for team'}</>
        )}
      </Button>

      {!isUpdate && (
        <p className="text-center text-xs text-muted-foreground">
          <Save className="inline h-3 w-3 mr-1" />
          This will also mark the consultation as completed.
        </p>
      )}
    </form>
  );
}
