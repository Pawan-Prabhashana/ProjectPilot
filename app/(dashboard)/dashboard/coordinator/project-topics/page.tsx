'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { InfoCallout } from '@/components/shared/info-callout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  Users,
  Zap,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  CoordinatorTopicView,
  ConflictSummary,
  ProjectPreferenceReadiness,
} from '@/lib/services/formation/project-topics';

// ── Types ──────────────────────────────────────────────────────────────────────

type PageData = {
  topics: CoordinatorTopicView[];
  conflicts: ConflictSummary[];
  readiness: ProjectPreferenceReadiness;
  term: { id: string; name: string; code: string } | null;
};

type NewTopicForm = {
  title: string; slug: string; description: string;
  domain: string; difficulty: string; status: string;
  maxTeams: string; maxStudents: string;
  requiredSkills: string; preferredSkills: string;
};

const SKILL_OPTIONS = ['frontend','backend','database','ui_ux','testing','documentation','research','presentation','project_management','ai_ml','mobile_development','devops'];
const DIFFICULTY_COLORS: Record<string, string> = { LOW: 'bg-emerald-100 text-emerald-800', MEDIUM: 'bg-amber-100 text-amber-800', HIGH: 'bg-red-100 text-red-800' };
const STATUS_COLORS: Record<string, string> = { DRAFT: 'bg-muted text-muted-foreground', OPEN: 'bg-sky-100 text-sky-800', CLOSED: 'bg-orange-100 text-orange-800', ARCHIVED: 'bg-muted text-muted-foreground/60' };
const SEVERITY_COLORS: Record<string, string> = { CRITICAL: 'border-red-300 bg-red-50/60', HIGH: 'border-orange-300 bg-orange-50/60', MEDIUM: 'border-amber-200 bg-amber-50/40', LOW: 'border-sky-200 bg-sky-50/30', INFO: 'border-border bg-muted/20' };
const SEVERITY_BADGE: Record<string, string> = { CRITICAL: 'bg-red-100 text-red-800', HIGH: 'bg-orange-100 text-orange-800', MEDIUM: 'bg-amber-100 text-amber-800', LOW: 'bg-sky-100 text-sky-800', INFO: 'bg-muted text-muted-foreground' };
const CAPACITY_COLORS: Record<string, string> = { OK: 'text-emerald-600', AT_CAPACITY: 'text-amber-600', OVER_CAPACITY: 'text-red-600', NO_INTEREST: 'text-muted-foreground' };

const emptyForm: NewTopicForm = { title: '', slug: '', description: '', domain: '', difficulty: 'MEDIUM', status: 'OPEN', maxTeams: '1', maxStudents: '', requiredSkills: '', preferredSkills: '' };

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoordinatorProjectTopicsPage() {
  const [data,          setData]          = useState<PageData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [showForm,      setShowForm]      = useState(false);
  const [creating,      setCreating]      = useState(false);
  const [form,          setForm]          = useState<NewTopicForm>(emptyForm);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [toast,         setToast]         = useState<{ type: 'success'|'error'; msg: string } | null>(null);

  const showToast = (type: 'success'|'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/project-topics?role=coordinator');
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData(d);
    } catch {
      showToast('error', 'Failed to load project topics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function recalculate() {
    setRecalculating(true);
    try {
      const res = await fetch('/api/project-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recalculate_conflicts' }),
      });
      if (!res.ok) throw new Error();
      showToast('success', 'Conflicts recalculated.');
      await loadData();
    } catch {
      showToast('error', 'Could not recalculate conflicts.');
    } finally {
      setRecalculating(false);
    }
  }

  async function createTopic() {
    if (!form.title.trim() || !form.slug.trim() || !form.description.trim()) {
      showToast('error', 'Title, slug, and description are required.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/project-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_topic',
          title: form.title.trim(),
          slug: form.slug.trim().toLowerCase().replace(/\s+/g, '-'),
          description: form.description.trim(),
          domain: form.domain.trim() || undefined,
          difficulty: form.difficulty,
          status: form.status,
          maxTeams: Number(form.maxTeams) || 1,
          maxStudents: form.maxStudents ? Number(form.maxStudents) : undefined,
          requiredSkills: form.requiredSkills ? form.requiredSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
          preferredSkills: form.preferredSkills ? form.preferredSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      showToast('success', 'Topic created.');
      setForm(emptyForm);
      setShowForm(false);
      await loadData();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to create topic.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const { topics = [], conflicts = [], readiness, term } = data ?? {};

  return (
    <div className="space-y-6">
      {toast && (
        <div className={cn('fixed bottom-5 right-5 z-50 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg',
          toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
        )}>{toast.msg}</div>
      )}

      <PageHeader
        title="Project Topics"
        description="Manage the project topic catalogue, monitor student demand, and detect selection conflicts."
      />

      {!term ? (
        <InfoCallout variant="warning">No active academic term found. Run db:setup to seed demo data.</InfoCallout>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">ACTIVE TERM</Badge>
              <span className="text-sm font-medium text-foreground">{term.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{term.code}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={recalculate} disabled={recalculating} className="gap-1.5">
                {recalculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Recalculate conflicts
              </Button>
              <Button size="sm" onClick={() => setShowForm(v => !v)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add topic
              </Button>
            </div>
          </div>

          {/* ── Readiness summary ── */}
          {readiness && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Open topics', value: readiness.openTopics, icon: <BookOpen className="h-4 w-4 text-sky-500" /> },
                { label: 'Students with preferences', value: readiness.submittedStudents, icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> },
                { label: 'Missing preferences', value: readiness.missingPreferences, icon: <Users className="h-4 w-4 text-amber-500" />, highlight: readiness.missingPreferences > 0 },
                { label: 'Unresolved conflicts', value: readiness.unresolvedConflicts, icon: <AlertTriangle className="h-4 w-4 text-red-500" />, highlight: readiness.unresolvedConflicts > 0 },
              ].map(s => (
                <Card key={s.label} className={cn(s.highlight && s.value > 0 ? 'border-amber-300 bg-amber-50/30' : '')}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1">{s.icon}</div>
                    <p className={cn('text-2xl font-bold', s.highlight && s.value > 0 ? 'text-amber-700' : 'text-foreground')}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ── Create topic form ── */}
          {showForm && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> New Project Topic</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="text-xs font-medium mb-1 block">Title *</label>
                    <input value={form.title} onChange={e => { setForm(p => ({ ...p, title: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })); }}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="e.g. Smart Library Booking System" />
                  </div>
                  <div><label className="text-xs font-medium mb-1 block">Slug *</label>
                    <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="smart-library-booking" />
                  </div>
                  <div className="sm:col-span-2"><label className="text-xs font-medium mb-1 block">Description *</label>
                    <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                      className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="Brief description of the project topic…" />
                  </div>
                  <div><label className="text-xs font-medium mb-1 block">Domain</label>
                    <input value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="e.g. Web application" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-xs font-medium mb-1 block">Difficulty</label>
                      <select value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))} className="w-full rounded-lg border px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50">
                        {['LOW','MEDIUM','HIGH'].map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div><label className="text-xs font-medium mb-1 block">Status</label>
                      <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full rounded-lg border px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50">
                        {['DRAFT','OPEN','CLOSED'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label className="text-xs font-medium mb-1 block">Max Teams</label>
                    <input type="number" min={1} value={form.maxTeams} onChange={e => setForm(p => ({ ...p, maxTeams: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
                  </div>
                  <div><label className="text-xs font-medium mb-1 block">Max Students (optional)</label>
                    <input type="number" min={1} value={form.maxStudents} onChange={e => setForm(p => ({ ...p, maxStudents: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="Leave blank for no limit" />
                  </div>
                  <div><label className="text-xs font-medium mb-1 block">Required Skills (comma-separated)</label>
                    <input value={form.requiredSkills} onChange={e => setForm(p => ({ ...p, requiredSkills: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
                      placeholder={`e.g. ${SKILL_OPTIONS.slice(0,3).join(', ')}`} />
                  </div>
                  <div><label className="text-xs font-medium mb-1 block">Preferred Skills (comma-separated)</label>
                    <input value={form.preferredSkills} onChange={e => setForm(p => ({ ...p, preferredSkills: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="Optional" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</Button>
                  <Button size="sm" onClick={createTopic} disabled={creating} className="gap-1.5">
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Create topic
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Conflict cards ── */}
          {conflicts.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Selection Conflicts
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">{conflicts.length}</Badge>
              </h2>
              <div className="space-y-2">
                {conflicts.map(c => (
                  <div key={c.id} className={cn('rounded-lg border px-4 py-3', SEVERITY_COLORS[c.severity] ?? 'border-border')}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={cn('text-[10px]', SEVERITY_BADGE[c.severity])}>{c.severity}</Badge>
                          <Badge variant="outline" className="text-[10px]">{c.type.replace(/_/g, ' ')}</Badge>
                          {c.topicTitle && <span className="text-xs text-muted-foreground">· {c.topicTitle}</span>}
                        </div>
                        <p className="text-sm font-medium text-foreground">{c.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{c.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Topic catalogue ── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Topic Catalogue
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{topics.length}</span>
            </h2>
            {topics.length === 0 ? (
              <Card className="bg-muted/30">
                <CardContent className="pt-6 pb-6 text-center">
                  <p className="text-sm text-muted-foreground">No project topics yet. Click &ldquo;Add topic&rdquo; to create the first one, or run db:setup to seed demo data.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {topics.map(t => {
                  const expanded = expandedTopic === t.id;
                  return (
                    <Card key={t.id} className={cn(t.demand.capacityStatus === 'OVER_CAPACITY' ? 'border-red-300' : t.demand.capacityStatus === 'NO_INTEREST' ? 'border-amber-200' : '')}>
                      <CardContent className="pt-3 pb-3">
                        <button className="w-full text-left" onClick={() => setExpandedTopic(expanded ? null : t.id)}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm text-foreground">{t.title}</span>
                                <Badge className={cn('text-[10px]', STATUS_COLORS[t.status])}>{t.status}</Badge>
                                <Badge className={cn('text-[10px]', DIFFICULTY_COLORS[t.difficulty])}>{t.difficulty}</Badge>
                                {t.domain && <span className="text-[10px] text-muted-foreground">· {t.domain}</span>}
                              </div>
                              <div className="mt-1.5 flex items-center gap-4 text-xs">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Zap className="h-3 w-3" />{t.demand.firstChoiceCount} first choice
                                </span>
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Users className="h-3 w-3" />{t.demand.totalSubmittedCount} total
                                </span>
                                <span className={cn('font-medium', CAPACITY_COLORS[t.demand.capacityStatus])}>
                                  {t.demand.capacityStatus.replace('_', ' ')}
                                </span>
                                <span className="text-muted-foreground">
                                  {t.minTeams}–{t.maxTeams} team{t.maxTeams !== 1 ? 's' : ''}
                                  {t.maxStudents ? ` · max ${t.maxStudents} students` : ''}
                                </span>
                              </div>
                            </div>
                            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                          </div>
                        </button>

                        {expanded && (
                          <div className="mt-3 pt-3 border-t space-y-3">
                            <p className="text-sm text-muted-foreground leading-relaxed">{t.description}</p>
                            {t.supervisorName && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Supervisor:</span> {t.supervisorName}
                                {t.supervisorDepartment ? ` · ${t.supervisorDepartment}` : ''}
                              </p>
                            )}
                            {t.requiredSkills.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Required Skills</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {t.requiredSkills.map(sk => (
                                    <Badge key={sk} variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">{sk}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {t.preferredSkills.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Preferred Skills</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {t.preferredSkills.map(sk => (
                                    <Badge key={sk} variant="outline" className="text-[10px]">{sk}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />
                                Demand: {t.demand.firstChoiceCount} first-choice / {t.demand.totalSubmittedCount} interested
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Privacy note:</span>{' '}
              Demand counts are shown as totals only. Individual student selections, cognitive profiles,
              and private support notes are never displayed here.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
