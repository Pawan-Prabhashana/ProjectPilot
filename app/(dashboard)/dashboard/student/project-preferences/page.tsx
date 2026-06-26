'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { InfoCallout } from '@/components/shared/info-callout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  Loader2,
  Star,
  StarOff,
  ChevronDown,
  ChevronUp,
  Info,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TopicSummary, StudentPreference } from '@/lib/services/formation/project-topics';

// ── Types ──────────────────────────────────────────────────────────────────────

type TermInfo = { id: string; name: string } | null;

type RankedPreference = {
  topicId: string;
  rank: number;
  motivation: string;
  topic: TopicSummary;
};

const DIFFICULTY_COLORS: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-red-100 text-red-800',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudentProjectPreferencesPage() {
  const [term,         setTerm]         = useState<TermInfo>(null);
  const [topics,       setTopics]       = useState<TopicSummary[]>([]);
  const [preferences,  setPreferences]  = useState<RankedPreference[]>([]);
  const [submitted,    setSubmitted]    = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ type: 'success'|'error'; msg: string } | null>(null);

  const showToast = (type: 'success'|'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [topicsRes, prefsRes] = await Promise.all([
        fetch('/api/project-topics'),
        fetch('/api/project-preferences'),
      ]);

      // Topics are critical — if this fails, show error state
      if (!topicsRes.ok) {
        const errBody = await topicsRes.json().catch(() => ({}));
        const msg = (errBody as { message?: string }).message ?? 'Could not load topics.';
        showToast('error', msg + ' Please refresh.');
        return;
      }

      const topicsData = await topicsRes.json();
      setTopics(topicsData.topics ?? []);
      setTerm(topicsData.term ?? null);

      // Preferences — load if possible, silently ignore failure (page still works for browsing)
      if (prefsRes.ok) {
        const prefsData = await prefsRes.json();
        const savedPrefs: StudentPreference[] = prefsData.preferences ?? [];
        const ranked: RankedPreference[] = savedPrefs.map(p => ({
          topicId: p.topicId, rank: p.rank, motivation: p.motivation ?? '', topic: p.topic,
        })).sort((a, b) => a.rank - b.rank);
        setPreferences(ranked);
        setSubmitted(savedPrefs.length > 0 && savedPrefs.every(p => p.status === 'SUBMITTED'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load topics.';
      showToast('error', msg + ' Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Selection logic ──────────────────────────────────────────────────────────

  const alreadySelected = (topicId: string) => preferences.some(p => p.topicId === topicId);

  function addTopic(topic: TopicSummary) {
    if (alreadySelected(topic.id)) { showToast('error', 'You already selected this topic.'); return; }
    const maxRank = Math.max(0, ...preferences.map(p => p.rank));
    setPreferences(prev => [...prev, { topicId: topic.id, rank: maxRank + 1, motivation: '', topic }]);
    setSubmitted(false);
  }

  function removeTopic(topicId: string) {
    setPreferences(prev => {
      const next = prev.filter(p => p.topicId !== topicId);
      return next.map((p, i) => ({ ...p, rank: i + 1 }));
    });
    setSubmitted(false);
  }

  function moveUp(topicId: string) {
    setPreferences(prev => {
      const idx = prev.findIndex(p => p.topicId === topicId);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((p, i) => ({ ...p, rank: i + 1 }));
    });
  }

  function moveDown(topicId: string) {
    setPreferences(prev => {
      const idx = prev.findIndex(p => p.topicId === topicId);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((p, i) => ({ ...p, rank: i + 1 }));
    });
  }

  function updateMotivation(topicId: string, text: string) {
    setPreferences(prev => prev.map(p => p.topicId === topicId ? { ...p, motivation: text } : p));
  }

  // ── Save / submit ────────────────────────────────────────────────────────────

  async function saveDraft() {
    if (preferences.length === 0) { showToast('error', 'Add at least one topic first.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/project-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_draft', preferences: preferences.map(p => ({ topicId: p.topicId, rank: p.rank, motivation: p.motivation || undefined })) }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      showToast('success', 'Draft saved.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Could not save draft.');
    } finally {
      setSaving(false);
    }
  }

  async function submitPrefs() {
    if (preferences.length < 3 && topics.length >= 3) {
      showToast('error', 'Please rank at least 3 topics before submitting.'); return;
    }
    if (preferences.length === 0) { showToast('error', 'Add topics before submitting.'); return; }

    setSubmitting(true);
    try {
      // save draft first, then submit
      await fetch('/api/project-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_draft', preferences: preferences.map(p => ({ topicId: p.topicId, rank: p.rank, motivation: p.motivation || undefined })) }),
      });
      const res = await fetch('/api/project-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      setSubmitted(true);
      showToast('success', 'Preferences submitted.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Could not submit preferences.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const unselectedTopics = topics.filter(t => !alreadySelected(t.id));

  return (
    <div className="space-y-6">
      {toast && (
        <div className={cn('fixed bottom-5 right-5 z-50 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg',
          toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
        )}>{toast.msg}</div>
      )}

      <PageHeader
        title="Project Preferences"
        description="Select and rank your preferred capstone project topics."
      />

      {!term ? (
        <InfoCallout variant="warning">No active academic term found. Your coordinator has not opened any topics yet.</InfoCallout>
      ) : (
        <>
          <div className="rounded-lg border border-sky-200 bg-sky-50/50 px-4 py-3 text-sm text-sky-800 flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-sky-500" />
            <span>
              Your preferences help ProjectPilot reduce duplicate project selections and prepare balanced team formation.
              Final allocation is reviewed by the coordinator. Select and rank at least 3 topics when available.
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge className="bg-muted text-muted-foreground text-[10px] border-0">ACTIVE TERM</Badge>
            <span className="font-medium text-foreground">{term.name}</span>
          </div>

          {/* ── Submission confirmation ── */}
          {submitted && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Preferences submitted</p>
                <p className="text-xs text-emerald-700 mt-0.5">Your {preferences.length} preference{preferences.length !== 1 ? 's are' : ' is'} saved. You can update and re-submit at any time before the deadline.</p>
              </div>
            </div>
          )}

          {/* ── Your ranked preferences ── */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" />
              Your Ranked Preferences
              {preferences.length > 0 && (
                <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{preferences.length}</span>
              )}
            </h2>

            {preferences.length === 0 ? (
              <Card className="bg-muted/30">
                <CardContent className="pt-5 pb-5 text-center">
                  <StarOff className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No preferences selected yet. Browse topics below and click &ldquo;Select&rdquo; to add them.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {preferences.map((p, idx) => (
                  <div key={p.topicId} className="rounded-xl border bg-card px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{p.rank}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">{p.topic.title}</span>
                        {p.topic.domain && <span className="ml-2 text-xs text-muted-foreground">{p.topic.domain}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveUp(p.topicId)} disabled={idx === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => moveDown(p.topicId)} disabled={idx === preferences.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => removeTopic(p.topicId)} className="ml-1 p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-700">
                          <StarOff className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 ml-9">
                      <input
                        value={p.motivation}
                        onChange={e => updateMotivation(p.topicId, e.target.value)}
                        placeholder="Optional: why this topic? (helps with matching)"
                        className="w-full text-xs rounded-lg border bg-muted/30 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            {preferences.length > 0 && (
              <div className="mt-3 flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={saveDraft} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Save draft
                </Button>
                <Button size="sm" onClick={submitPrefs} disabled={submitting || (preferences.length < 3 && topics.length >= 3)}>
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Submit preferences
                </Button>
              </div>
            )}
            {topics.length >= 3 && preferences.length < 3 && preferences.length > 0 && (
              <p className="mt-2 text-xs text-amber-600 text-right">Rank at least 3 topics to submit.</p>
            )}
          </section>

          {/* ── Available topics ── */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              Available Topics
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{unselectedTopics.length}</span>
            </h2>

            {unselectedTopics.length === 0 && preferences.length > 0 ? (
              <Card className="bg-muted/20">
                <CardContent className="pt-4 pb-4 text-center text-sm text-muted-foreground">All available topics have been added to your preferences.</CardContent>
              </Card>
            ) : topics.length === 0 ? (
              <Card className="bg-muted/20">
                <CardContent className="pt-4 pb-4 text-center text-sm text-muted-foreground">No open project topics are available yet for this term.</CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {unselectedTopics.map(t => {
                  const expanded = expandedCard === t.id;
                  return (
                    <Card key={t.id} className="transition-shadow hover:shadow-sm">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <button className="w-full text-left" onClick={() => setExpandedCard(expanded ? null : t.id)}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground">{t.title}</span>
                                <Badge className={cn('text-[10px]', DIFFICULTY_COLORS[t.difficulty])}>{t.difficulty}</Badge>
                                {t.domain && <span className="text-[10px] text-muted-foreground">· {t.domain}</span>}
                              </div>
                              <p className={cn('text-xs text-muted-foreground mt-1 leading-relaxed', !expanded && 'line-clamp-2')}>{t.description}</p>
                            </button>

                            {expanded && (
                              <div className="mt-3 space-y-2">
                                {t.supervisorName && (
                                  <p className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">Supervisor:</span> {t.supervisorName}
                                    {t.supervisorDepartment ? ` · ${t.supervisorDepartment}` : ''}
                                  </p>
                                )}
                                {t.requiredSkills.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Required Skills</p>
                                    <div className="flex flex-wrap gap-1">
                                      {t.requiredSkills.map(sk => (
                                        <Badge key={sk} variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">{sk}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {t.preferredSkills.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Preferred Skills</p>
                                    <div className="flex flex-wrap gap-1">
                                      {t.preferredSkills.map(sk => (
                                        <Badge key={sk} variant="outline" className="text-[10px]">{sk}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {t.maxTeams} team slot{t.maxTeams !== 1 ? 's' : ''}
                                  {t.maxStudents ? ` · max ${t.maxStudents} students` : ''}
                                </p>
                              </div>
                            )}

                            <button
                              className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                              onClick={() => setExpandedCard(expanded ? null : t.id)}
                            >
                              {expanded ? <><ChevronUp className="h-3 w-3" />Show less</> : <><ChevronDown className="h-3 w-3" />Show more</>}
                            </button>
                          </div>

                          <Button
                            size="sm"
                            variant={alreadySelected(t.id) ? 'secondary' : 'default'}
                            onClick={() => addTopic(t)}
                            disabled={alreadySelected(t.id)}
                            className="shrink-0 h-8 text-xs"
                          >
                            {alreadySelected(t.id) ? <><CheckCircle className="h-3 w-3 mr-1" />Added</> : <><Star className="h-3 w-3 mr-1" />Select</>}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <div className="rounded-lg border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Your selections are private. Other students cannot see which topics you have chosen.
              The coordinator sees only the total demand for each topic — not individual preferences.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
