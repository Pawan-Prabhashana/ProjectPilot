'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/shared/page-header';
import { InfoCallout } from '@/components/shared/info-callout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cognitiveProfileSchema, type CognitiveProfileInput } from '@/lib/validations/cognitive-profile';
import { CheckCircle, Loader2 } from 'lucide-react';

const optionSets = {
  communicationStyle: [
    { value: 'STEP_BY_STEP', label: 'Step-by-step', desc: 'One clear instruction at a time' },
    { value: 'DIRECT', label: 'Direct', desc: 'Short and to the point' },
    { value: 'DETAILED', label: 'Detailed', desc: 'Full context and reasoning provided' },
    { value: 'VISUAL_FIRST', label: 'Visual-first', desc: 'Lists, structure, described diagrams' },
    { value: 'NARRATIVE', label: 'Narrative', desc: 'Context-rich, story-framed explanations' },
  ],
  reminderStyle: [
    { value: 'STRUCTURED', label: 'Structured', desc: 'Predictable, calendar-like reminders' },
    { value: 'GENTLE', label: 'Gentle', desc: 'Soft nudges without urgency framing' },
    { value: 'DEADLINE_FOCUSED', label: 'Deadline-focused', desc: 'Clear deadlines with consequence context' },
    { value: 'MINIMAL', label: 'Minimal', desc: 'As few reminders as possible' },
  ],
  preferredMeetingFormat: [
    { value: 'STRUCTURED_AGENDA', label: 'Structured agenda', desc: 'Written agenda provided in advance' },
    { value: 'ASYNC_PREFERRED', label: 'Async preferred', desc: 'Written notes before any live call' },
    { value: 'SHORT_SYNC', label: 'Short sync', desc: 'Brief live conversations (≤15 min)' },
    { value: 'FLEXIBLE', label: 'Flexible', desc: 'Adaptable to each situation' },
  ],
  supportMode: [
    { value: 'MODERATE', label: 'Moderate support', desc: 'Proactive nudges for risk, ambiguity, and overload' },
    { value: 'MINIMAL', label: 'Minimal support', desc: 'I prefer to self-manage; AI assists only when asked' },
    { value: 'COMPREHENSIVE', label: 'Full support', desc: 'Maximum help: decomposition, rewrites, pacing' },
  ],
  overloadSensitivity: [
    { value: 'MEDIUM', label: 'Moderate', desc: 'I notice pile-ups but can usually manage' },
    { value: 'HIGH', label: 'High', desc: 'I reach overwhelm easily — please de-escalate early' },
    { value: 'LOW', label: 'Low', desc: 'Heavy loads don\'t bother me much' },
  ],
};

type RadioGroupProps = {
  name: string;
  label: string;
  hint: string;
  options: { value: string; label: string; desc: string }[];
  value: string;
  onChange: (val: string) => void;
};

function RadioCardGroup({ name, label, hint, options, value, onChange }: RadioGroupProps) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">{label}</legend>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              value === opt.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="mt-0.5 accent-primary"
            />
            <div>
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function CognitiveProfilePage() {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<CognitiveProfileInput>({
    resolver: zodResolver(cognitiveProfileSchema),
    defaultValues: {
      communicationStyle: 'STEP_BY_STEP',
      reminderStyle: 'STRUCTURED',
      preferredMeetingFormat: 'STRUCTURED_AGENDA',
      overloadSensitivity: 'MEDIUM',
      supportMode: 'MODERATE',
    },
  });

  const values = watch();

  async function onSubmit(data: CognitiveProfileInput) {
    setError(null);
    const res = await fetch('/api/cognitive-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? 'Save failed. Please try again.');
      return;
    }
    setSaved(true);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="My Support Profile"
        description="Tell ProjectPilot Neuro how you work best. This information is private to you and your supervisor (only if you choose to share it)."
        badge={{ label: 'Private', variant: 'info' }}
      />

      <InfoCallout variant="info" title="Why does this matter?">
        There is no wrong answer here. These preferences help the AI layer adapt — adjusting how tasks are described to you, when and how you&apos;re reminded, and how much support is offered automatically. You can update this at any time.
      </InfoCallout>

      {saved && (
        <InfoCallout variant="success" title="Profile saved!">
          Your support preferences have been saved. The platform will now adapt to how you work.
        </InfoCallout>
      )}

      {error && <InfoCallout variant="error">{error}</InfoCallout>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Communication &amp; information style</CardTitle>
            <CardDescription>How do you prefer information to be structured when tasks or feedback are shared with you?</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioCardGroup
              name="communicationStyle"
              label="Information style"
              hint="This affects how tasks and feedback are presented to you."
              options={optionSets.communicationStyle}
              value={values.communicationStyle ?? 'STEP_BY_STEP'}
              onChange={(v) => setValue('communicationStyle', v as CognitiveProfileInput['communicationStyle'])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reminders &amp; notifications</CardTitle>
            <CardDescription>How would you like to be reminded about deadlines and tasks?</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioCardGroup
              name="reminderStyle"
              label="Reminder style"
              hint="This affects the tone and timing of deadline reminders."
              options={optionSets.reminderStyle}
              value={values.reminderStyle ?? 'STRUCTURED'}
              onChange={(v) => setValue('reminderStyle', v as CognitiveProfileInput['reminderStyle'])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultation preferences</CardTitle>
            <CardDescription>How do you prefer meetings with your supervisor to be structured?</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioCardGroup
              name="preferredMeetingFormat"
              label="Meeting format"
              hint="Pre-meeting briefs are generated for all consultations, but this tells us what works best for you."
              options={optionSets.preferredMeetingFormat}
              value={values.preferredMeetingFormat ?? 'STRUCTURED_AGENDA'}
              onChange={(v) => setValue('preferredMeetingFormat', v as CognitiveProfileInput['preferredMeetingFormat'])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cognitive load &amp; pacing</CardTitle>
            <CardDescription>How easily do you feel overwhelmed? This helps us calibrate proactive support.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioCardGroup
              name="overloadSensitivity"
              label="Overload sensitivity"
              hint="There's no wrong answer — this only affects how early we intervene with support."
              options={optionSets.overloadSensitivity}
              value={values.overloadSensitivity ?? 'MEDIUM'}
              onChange={(v) => setValue('overloadSensitivity', v as CognitiveProfileInput['overloadSensitivity'])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI support level</CardTitle>
            <CardDescription>How much would you like the AI to proactively help you?</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioCardGroup
              name="supportMode"
              label="Support mode"
              hint="You can change this at any time. Comprehensive mode provides the most assistance."
              options={optionSets.supportMode}
              value={values.supportMode ?? 'MODERATE'}
              onChange={(v) => setValue('supportMode', v as CognitiveProfileInput['supportMode'])}
            />
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : saved ? (
              <><CheckCircle className="h-4 w-4" /> Saved</>
            ) : (
              'Save Support Profile'
            )}
          </Button>
          {saved && (
            <p className="text-sm text-muted-foreground">Your preferences have been saved.</p>
          )}
        </div>
      </form>
    </div>
  );
}
