'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { InfoCallout } from '@/components/shared/info-callout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  Loader2,
  BookOpen,
  Clock,
  Calendar,
  Star,
  Shield,
  Lock,
  Send,
  Save,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────────────────

const SKILL_CATALOGUE = [
  { key: 'frontend',          label: 'Frontend Development',  category: 'Technical'      },
  { key: 'backend',           label: 'Backend Development',   category: 'Technical'      },
  { key: 'database',          label: 'Database Design',       category: 'Technical'      },
  { key: 'devops',            label: 'DevOps / Deployment',   category: 'Technical'      },
  { key: 'mobile_development',label: 'Mobile Development',    category: 'Technical'      },
  { key: 'ai_ml',             label: 'AI / Machine Learning', category: 'Technical'      },
  { key: 'ui_ux',             label: 'UI/UX Design',          category: 'Design'         },
  { key: 'testing',           label: 'Testing & QA',          category: 'Quality'        },
  { key: 'documentation',     label: 'Documentation',         category: 'Communication'  },
  { key: 'research',          label: 'Research',              category: 'Research'       },
  { key: 'presentation',      label: 'Presentation',          category: 'Communication'  },
  { key: 'project_management',label: 'Project Management',    category: 'Management'     },
];

const ROLE_CATALOGUE = [
  { key: 'team_leader',              label: 'Team Leader'               },
  { key: 'frontend_developer',       label: 'Frontend Developer'        },
  { key: 'backend_developer',        label: 'Backend Developer'         },
  { key: 'database_designer',        label: 'Database Designer'         },
  { key: 'ui_ux_designer',           label: 'UI/UX Designer'            },
  { key: 'qa_tester',                label: 'QA Tester'                 },
  { key: 'documentation_lead',       label: 'Documentation Lead'        },
  { key: 'research_lead',            label: 'Research Lead'             },
  { key: 'presentation_lead',        label: 'Presentation Lead'         },
  { key: 'client_communication_lead',label: 'Client Communication Lead' },
];

const DOMAIN_OPTIONS = [
  'AI / ML',
  'Web application',
  'Mobile application',
  'Data analytics',
  'Education technology',
  'Healthcare technology',
  'Sustainability',
  'Business process automation',
  'Accessibility / assistive technology',
  'Cybersecurity',
];

const SUPPORT_PREFS = [
  { key: 'prefers_async_communication',         label: 'Prefer async communication',           desc: 'Discuss over chat or written notes rather than live calls where possible' },
  { key: 'prefers_written_instructions',        label: 'Prefer written instructions',          desc: 'Written task briefs are clearer for me than verbal instructions' },
  { key: 'prefers_clear_definition_of_done',    label: 'Prefer clear definition of done',      desc: 'I work better when tasks have explicit completion criteria' },
  { key: 'prefers_smaller_task_chunks',         label: 'Prefer smaller task chunks',           desc: 'Smaller, well-scoped tasks help me stay focused and make progress' },
  { key: 'prefers_predictable_meeting_times',   label: 'Prefer predictable meeting times',     desc: 'Consistent, pre-scheduled meeting times work better than last-minute calls' },
  { key: 'prefers_reduced_meeting_load',        label: 'Prefer fewer meetings',                desc: 'I stay more productive with fewer or shorter live meetings' },
  { key: 'prefers_visual_task_board',           label: 'Prefer visual task boards',            desc: 'Visual kanban-style boards help me see the full picture' },
  { key: 'prefers_advance_notice_before_changes', label: 'Prefer advance notice for changes', desc: 'I prefer knowing about scope or schedule changes as early as possible' },
  { key: 'prefers_low_pressure_presentations',  label: 'Prefer low-pressure presentations',   desc: 'Less formal presentation formats (e.g. written summaries) work better for me' },
  { key: 'prefers_regular_progress_checkpoints',label: 'Prefer regular check-ins',            desc: 'Regular brief check-ins help me stay on track without feeling lost' },
];

const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'] as const;
const BLOCKS = ['MORNING','AFTERNOON','EVENING','NIGHT'] as const;
const AVAIL_LEVELS = ['PREFERRED','AVAILABLE','LIMITED','UNAVAILABLE'] as const;

const AVAIL_COLOR: Record<string, string> = {
  PREFERRED:   'bg-emerald-500',
  AVAILABLE:   'bg-sky-400',
  LIMITED:     'bg-amber-400',
  UNAVAILABLE: 'bg-muted',
};

const AVAIL_LABEL: Record<string, string> = {
  PREFERRED:   'Preferred',
  AVAILABLE:   'Available',
  LIMITED:     'Limited',
  UNAVAILABLE: 'Unavailable',
};

type SkillState   = { level: number; interest: number };
type RoleState    = { preferenceLevel: number; confidenceLevel: number; avoid: boolean };
type AvailState   = Record<string, Record<string, string>>; // day → block → level

// ── Component ─────────────────────────────────────────────────────────────────

export default function FormationProfilePage() {
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status,     setStatus]     = useState<string>('DRAFT');
  const [score,      setScore]      = useState(0);
  const [toast,      setToast]      = useState<{ type: 'success'|'error'; msg: string } | null>(null);

  // Base profile fields
  const [weeklyHours, setWeeklyHours] = useState(8);
  const [maxTasks,    setMaxTasks]    = useState(2);
  const [prefTeamSize, setPrefTeamSize] = useState<number|''>('');
  const [domains,     setDomains]     = useState<string[]>([]);
  const [supportPrefs, setSupportPrefs] = useState<Record<string, boolean>>({});
  const [privateNotes, setPrivateNotes] = useState('');

  // Skills: key → { level, interest }
  const [skills, setSkills] = useState<Record<string, SkillState>>(() =>
    Object.fromEntries(SKILL_CATALOGUE.map(s => [s.key, { level: 1, interest: 3 }]))
  );

  // Role preferences
  const [roles, setRoles] = useState<Record<string, RoleState>>(() =>
    Object.fromEntries(ROLE_CATALOGUE.map(r => [r.key, { preferenceLevel: 3, confidenceLevel: 3, avoid: false }]))
  );

  // Availability grid
  const [avail, setAvail] = useState<AvailState>(() => {
    const grid: AvailState = {};
    for (const d of DAYS) {
      grid[d] = {};
      for (const b of BLOCKS) grid[d][b] = 'AVAILABLE';
    }
    return grid;
  });

  const showToast = (type: 'success'|'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/formation-profile');
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      const p = data.profile;
      if (!p) { setLoading(false); return; }

      setStatus(p.status);
      setScore(p.completionScore ?? 0);
      setWeeklyHours(p.weeklyCapacityHours ?? 8);
      setMaxTasks(p.maxConcurrentTasks ?? 2);
      setPrefTeamSize(p.preferredTeamSize ?? '');
      setDomains(Array.isArray(p.domainPreferences) ? p.domainPreferences : []);
      setSupportPrefs(p.safeSupportPreferences ?? {});
      setPrivateNotes(p.privateSupportNotes ?? '');

      if (p.skills?.length) {
        const sk: Record<string, SkillState> = { ...Object.fromEntries(SKILL_CATALOGUE.map(s => [s.key, { level: 1, interest: 3 }])) };
        for (const s of p.skills) sk[s.skillKey] = { level: s.level, interest: s.interest };
        setSkills(sk);
      }
      if (p.rolePreferences?.length) {
        const ro: Record<string, RoleState> = { ...Object.fromEntries(ROLE_CATALOGUE.map(r => [r.key, { preferenceLevel: 3, confidenceLevel: 3, avoid: false }])) };
        for (const r of p.rolePreferences) ro[r.roleKey] = { preferenceLevel: r.preferenceLevel, confidenceLevel: r.confidenceLevel, avoid: r.avoid };
        setRoles(ro);
      }
      if (p.availability?.length) {
        const av: AvailState = {};
        for (const d of DAYS) { av[d] = {}; for (const b of BLOCKS) av[d][b] = 'AVAILABLE'; }
        for (const sl of p.availability) av[sl.dayOfWeek][sl.block] = sl.level;
        setAvail(av);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function saveDraft() {
    setSaving(true);
    try {
      const res = await fetch('/api/formation-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_draft',
          weeklyCapacityHours: weeklyHours,
          maxConcurrentTasks: maxTasks,
          preferredTeamSize: prefTeamSize === '' ? null : Number(prefTeamSize),
          domainPreferences: domains,
          safeSupportPreferences: supportPrefs,
          privateSupportNotes: privateNotes,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setScore(data.profile?.completionScore ?? score);

      // Also save skills, roles, availability
      const profileId = data.profile?.id;
      if (profileId) {
        await fetch('/api/formation-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_skills',
            skills: SKILL_CATALOGUE.map(s => ({
              skillKey: s.key, skillLabel: s.label, category: s.category,
              level: skills[s.key]?.level ?? 1,
              interest: skills[s.key]?.interest ?? 3,
            })),
          }),
        });
        await fetch('/api/formation-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_roles',
            roles: ROLE_CATALOGUE.map(r => ({
              roleKey: r.key, roleLabel: r.label,
              preferenceLevel: roles[r.key]?.preferenceLevel ?? 3,
              confidenceLevel: roles[r.key]?.confidenceLevel ?? 3,
              avoid: roles[r.key]?.avoid ?? false,
            })),
          }),
        });
        const slots: { dayOfWeek: string; block: string; level: string }[] = [];
        for (const d of DAYS) for (const b of BLOCKS) slots.push({ dayOfWeek: d, block: b, level: avail[d]?.[b] ?? 'AVAILABLE' });
        await fetch('/api/formation-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_availability', slots }),
        });
      }
      // Reload to get updated score
      await loadProfile();
      showToast('success', 'Draft saved.');
    } catch {
      showToast('error', 'Could not save draft. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await saveDraft();
      const res = await fetch('/api/formation-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' }),
      });
      if (!res.ok) throw new Error('Submit failed');
      setStatus('SUBMITTED');
      showToast('success', 'Profile submitted! You are marked as ready for formation.');
    } catch {
      showToast('error', 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isSubmitted = status === 'SUBMITTED';

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-5 right-5 z-50 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg transition-all',
          toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
        )}>
          {toast.msg}
        </div>
      )}

      <PageHeader
        title="Formation Profile"
        description="Tell us your skills, availability, and preferences so we can form a well-matched team for you."
      />

      {/* Status banner */}
      {isSubmitted ? (
        <InfoCallout variant="success" title="Profile submitted">
          Your formation profile is marked as ready. The coordinator will use it during team formation.
          You can still update and re-submit at any time.
        </InfoCallout>
      ) : (
        <InfoCallout variant="info" title="Complete your profile to be formation-ready">
          Fill in as many sections as you can. Your profile helps the system form balanced teams with
          compatible skills, schedules, and working styles.
        </InfoCallout>
      )}

      {/* Completion score */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Completion</span>
                <Badge
                  className={cn(
                    'text-[10px]',
                    isSubmitted ? 'bg-emerald-100 text-emerald-800' : score >= 60 ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                  )}
                >
                  {isSubmitted ? 'Submitted' : status === 'DRAFT' ? 'Draft' : 'Needs Review'}
                </Badge>
              </div>
              <Progress value={score} className="h-2 w-full max-w-xs" />
              <p className="text-xs text-muted-foreground">{score}/100 — save a draft to update</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                onClick={saveDraft}
                disabled={saving || submitting}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save draft
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || submitting || score < 20}
                size="sm"
                className="gap-1.5"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {isSubmitted ? 'Re-submit' : 'Submit as ready'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 1: Capacity ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Weekly Capacity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <label className="text-sm font-medium text-foreground">
                Hours available per week
              </label>
              <p className="text-xs text-muted-foreground mb-2">Realistic available time for the project each week</p>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1} max={40} step={1}
                  value={weeklyHours}
                  onChange={e => setWeeklyHours(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <span className="text-sm font-semibold w-14 text-right">{weeklyHours}h/wk</span>
              </div>
            </fieldset>
            <fieldset>
              <label className="text-sm font-medium text-foreground">
                Max concurrent tasks
              </label>
              <p className="text-xs text-muted-foreground mb-2">Maximum tasks you can focus on at the same time</p>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1} max={10} step={1}
                  value={maxTasks}
                  onChange={e => setMaxTasks(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <span className="text-sm font-semibold w-14 text-right">{maxTasks} tasks</span>
              </div>
            </fieldset>
          </div>
          <fieldset>
            <label className="text-sm font-medium text-foreground">Preferred team size (optional)</label>
            <p className="text-xs text-muted-foreground mb-2">Leave blank if you have no preference</p>
            <div className="flex gap-2 flex-wrap">
              {[3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => setPrefTeamSize(prefTeamSize === n ? '' : n)}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    prefTeamSize === n ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                  )}
                >
                  {n} people
                </button>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      {/* ── Section 2: Skills ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-muted-foreground" />
            Skills
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Rate your level (1 = beginner, 5 = expert) and interest (1 = low, 5 = love it) for each skill.
          </p>
          {['Technical','Design','Quality','Research','Communication','Management'].map(cat => {
            const catSkills = SKILL_CATALOGUE.filter(s => s.category === cat);
            if (!catSkills.length) return null;
            return (
              <div key={cat} className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</p>
                <div className="space-y-3">
                  {catSkills.map(s => (
                    <div key={s.key} className="grid grid-cols-1 gap-y-1 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-x-6">
                      <span className="text-sm font-medium">{s.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-10">Level</span>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(v => (
                            <button
                              key={v}
                              onClick={() => setSkills(prev => ({ ...prev, [s.key]: { ...prev[s.key], level: v } }))}
                              className={cn(
                                'h-7 w-7 rounded text-xs font-semibold transition-colors',
                                (skills[s.key]?.level ?? 1) >= v
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              )}
                            >{v}</button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-12">Interest</span>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(v => (
                            <button
                              key={v}
                              onClick={() => setSkills(prev => ({ ...prev, [s.key]: { ...prev[s.key], interest: v } }))}
                              className={cn(
                                'h-7 w-7 rounded transition-colors',
                                (skills[s.key]?.interest ?? 3) >= v
                                  ? 'text-amber-500'
                                  : 'text-muted-foreground/30'
                              )}
                            ><Star className="h-3.5 w-3.5 fill-current" /></button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Section 3: Role preferences ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Role Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Set your preference (1 = not my preference, 5 = would love it) and confidence for each role.
            Toggle <span className="font-medium">Avoid</span> if you do not want this role at all.
          </p>
          <div className="space-y-3">
            {ROLE_CATALOGUE.map(r => {
              const current = roles[r.key] ?? { preferenceLevel: 3, confidenceLevel: 3, avoid: false };
              return (
                <div key={r.key} className={cn(
                  'rounded-lg border p-3 transition-colors',
                  current.avoid ? 'border-red-200 bg-red-50/30' : 'border-border'
                )}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <span className="text-sm font-medium">{r.label}</span>
                    <button
                      onClick={() => setRoles(prev => ({ ...prev, [r.key]: { ...current, avoid: !current.avoid } }))}
                      className={cn(
                        'rounded px-2 py-0.5 text-[10px] font-semibold transition-colors',
                        current.avoid ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {current.avoid ? '✕ Avoid' : 'Avoid'}
                    </button>
                  </div>
                  {!current.avoid && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-20">Preference</span>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(v => (
                            <button key={v}
                              onClick={() => setRoles(prev => ({ ...prev, [r.key]: { ...current, preferenceLevel: v } }))}
                              className={cn('h-6 w-6 rounded text-[10px] font-semibold transition-colors',
                                current.preferenceLevel >= v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              )}
                            >{v}</button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-20">Confidence</span>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(v => (
                            <button key={v}
                              onClick={() => setRoles(prev => ({ ...prev, [r.key]: { ...current, confidenceLevel: v } }))}
                              className={cn('h-6 w-6 rounded text-[10px] font-semibold transition-colors',
                                current.confidenceLevel >= v ? 'bg-sky-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              )}
                            >{v}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Schedule availability ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Tap each cell to cycle through: Preferred → Available → Limited → Unavailable.
          </p>
          <div className="flex gap-2 flex-wrap mb-3">
            {AVAIL_LEVELS.map(l => (
              <span key={l} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className={cn('h-3 w-3 rounded-sm', AVAIL_COLOR[l])} />
                {AVAIL_LABEL[l]}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="py-1.5 pr-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-20"></th>
                  {BLOCKS.map(b => (
                    <th key={b} className="py-1.5 px-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {b.charAt(0) + b.slice(1).toLowerCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(d => (
                  <tr key={d}>
                    <td className="py-1 pr-2 text-[10px] font-medium text-muted-foreground">
                      {d.charAt(0) + d.slice(1, 3).toLowerCase()}
                    </td>
                    {BLOCKS.map(b => {
                      const level = avail[d]?.[b] ?? 'AVAILABLE';
                      const idx = AVAIL_LEVELS.indexOf(level as typeof AVAIL_LEVELS[number]);
                      const next = AVAIL_LEVELS[(idx + 1) % AVAIL_LEVELS.length];
                      return (
                        <td key={b} className="py-0.5 px-1">
                          <button
                            onClick={() => setAvail(prev => ({ ...prev, [d]: { ...prev[d], [b]: next } }))}
                            title={AVAIL_LABEL[level]}
                            className={cn('h-8 w-full rounded transition-colors', AVAIL_COLOR[level])}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Domain preferences ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-muted-foreground" />
            Domain Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Select areas that interest you for your capstone project topic.
          </p>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_OPTIONS.map(d => {
              const active = domains.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => setDomains(prev => active ? prev.filter(x => x !== d) : [...prev, d])}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                >{d}</button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 6: Support preferences ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Support Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoCallout variant="info" className="mb-4">
            These preferences help ProjectPilot recommend clearer tasks, healthier team routines,
            and compatible working patterns. They are not diagnosis labels and are not shared
            directly with coordinators or supervisors in identifiable form.
          </InfoCallout>
          <div className="space-y-2">
            {SUPPORT_PREFS.map(p => {
              const active = supportPrefs[p.key] === true;
              return (
                <label
                  key={p.key}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    active ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/30'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => setSupportPrefs(prev => ({ ...prev, [p.key]: !active }))}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 7: Private notes ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Private Support Notes
            <Badge variant="secondary" className="text-[10px] font-normal ml-1">Visible only to you</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Add any personal notes about how you work best. This is completely private — coordinators
            and supervisors cannot see this.
          </p>
          <textarea
            value={privateNotes}
            onChange={e => setPrivateNotes(e.target.value)}
            rows={4}
            placeholder="e.g. I work best in the mornings. I find large ambiguous tasks stressful. I prefer having a written summary after team meetings…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          />
        </CardContent>
      </Card>

      {/* ── Bottom actions ────────────────────────────────────────────────── */}
      <div className="flex gap-3 justify-end pb-8">
        <Button
          onClick={saveDraft}
          disabled={saving || submitting}
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save draft
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving || submitting || score < 20}
          size="sm"
          className="gap-1.5"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          {isSubmitted ? 'Update & re-submit' : 'Submit as ready for formation'}
        </Button>
      </div>
    </div>
  );
}
