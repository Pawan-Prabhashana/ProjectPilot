'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { InfoCallout } from '@/components/shared/info-callout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';

type Toggle = {
  id: string;
  label: string;
  description: string;
  defaultValue: boolean;
};

const accessibilityToggles: Toggle[] = [
  { id: 'reducedMotion', label: 'Reduced motion', description: 'Disable animations and transitions throughout the interface.', defaultValue: false },
  { id: 'highContrast', label: 'High contrast', description: 'Increase contrast between text and backgrounds for readability.', defaultValue: false },
  { id: 'focusMode', label: 'Focus mode', description: 'Hide non-essential UI elements to reduce visual clutter during work sessions.', defaultValue: false },
  { id: 'lowEnergyMode', label: 'Low-energy mode', description: 'Simplify the interface and reduce notification frequency for low-energy days.', defaultValue: false },
];

const fontSizes = ['sm', 'md', 'lg', 'xl'];
const digestModes = [
  { value: 'REALTIME', label: 'Real-time' },
  { value: 'DAILY', label: 'Daily digest' },
  { value: 'WEEKLY', label: 'Weekly digest' },
  { value: 'NONE', label: 'No digest' },
];

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, boolean>>({
    reducedMotion: false,
    highContrast: false,
    focusMode: false,
    lowEnergyMode: false,
  });
  const [fontScale, setFontScale] = useState('md');
  const [digestMode, setDigestMode] = useState('DAILY');

  function toggle(id: string) {
    setSettings((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function onSave() {
    setSaving(true);
    await fetch('/api/settings/accessibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, fontScale, digestMode }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Settings"
        description="Personalise your experience. These settings affect only your view."
      />

      {/* Accessibility */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accessibility</CardTitle>
          <CardDescription>
            Adjust visual and interaction preferences. These apply across the entire platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accessibilityToggles.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </div>
              <button
                role="switch"
                aria-checked={settings[t.id]}
                onClick={() => toggle(t.id)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  settings[t.id] ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    settings[t.id] ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Font size */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Text size</CardTitle>
          <CardDescription>Choose a comfortable text size for reading and navigation.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {fontSizes.map((size) => (
              <button
                key={size}
                onClick={() => setFontScale(size)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  fontScale === size
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {size.toUpperCase()}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification digest */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification frequency</CardTitle>
          <CardDescription>
            How often would you like to receive notification digests? This reduces interruptions during focused work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {digestModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setDigestMode(mode.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  digestMode === mode.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={saving} className="gap-2">
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle className="h-4 w-4" /> Saved</>
          ) : (
            'Save Settings'
          )}
        </Button>
        {saved && <p className="text-sm text-muted-foreground">Settings saved successfully.</p>}
      </div>

      <InfoCallout variant="info">
        Notification preferences per-type and cognitive-profile-linked adaptive settings will be linked in the next phase, once AI support layers are active.
      </InfoCallout>
    </div>
  );
}
