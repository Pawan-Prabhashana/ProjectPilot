import Link from 'next/link';
import {
  Brain,
  Users,
  Calendar,
  Zap,
  ArrowRight,
  BarChart3,
  Lightbulb,
  Shield,
  Target,
  BookOpen,
  CheckCircle,
  Layers,
  GitMerge,
  ClipboardList,
  Eye,
  AlertTriangle,
  Star,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">

      {/* ── Navigation ── */}
      <nav className="border-b border-white/8 px-6 py-0">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-white">ProjectPilot</span>
            <span className="rounded-md bg-sky-500/20 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-sky-400">
              CAPSTONE
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/8 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:bg-sky-400 hover:shadow-sky-400/30"
            >
              Open demo
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative px-6 pb-24 pt-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-sky-500/10 via-indigo-500/5 to-transparent"
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-sm font-medium text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            Intelligent capstone team formation · neurodivergent-first support built in
          </div>
          <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            Form balanced student project teams —
            <br />
            <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
              then keep them on track.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60 leading-relaxed">
            ProjectPilot helps coordinators match students by skill, schedule, project preference, role
            suitability, and capacity — then monitors workload, conflicts, and team health through the
            semester, with neurodivergent-friendly support built in.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-base font-semibold text-white shadow-xl shadow-sky-500/30 transition-all hover:bg-sky-400 hover:shadow-sky-400/40"
            >
              Open demo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#workflow"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/10"
            >
              View workflow
            </Link>
          </div>
          <p className="mt-5 text-sm text-white/35">
            Demo accounts available — no setup needed. Password: <code className="text-white/55">demo1234</code>
          </p>
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="border-y border-white/8 bg-white/[0.02] px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-white/40">
            Why manual capstone team formation breaks down
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Users, text: 'Manually forming hundreds of students creates skill imbalances and uneven teams' },
              { icon: Target, text: 'Duplicate project selections go undetected until it is too late to change them' },
              { icon: Shield, text: 'Students regularly get left without a team and coordinators do not notice' },
              { icon: BarChart3, text: 'Workload lands unevenly once teams are formed — overloaded and idle members' },
              { icon: Calendar, text: 'Overlapping schedules make collaboration impossible without schedule-aware matching' },
              { icon: Brain, text: 'No systematic way to match people by skill, schedule, role fit, or capacity' },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-4"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-red-400/70" />
                <p className="text-sm text-white/60">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow steps ── */}
      <section id="workflow" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
              Complete formation workflow
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">From readiness to delivery.</h2>
            <p className="mt-3 text-white/50">
              One connected workflow — from student profile to published team to allocated tasks.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { step: '01', icon: Layers, color: 'text-violet-400', bg: 'bg-violet-500/10', title: 'Collect Student Profiles', desc: 'Students complete skills, availability, weekly capacity, and role preferences.' },
              { step: '02', icon: BookOpen, color: 'text-sky-400', bg: 'bg-sky-500/10', title: 'Rank Project Topics', desc: 'Students rank preferred capstone topics. Duplicate demand and conflicts are auto-detected.' },
              { step: '03', icon: GitMerge, color: 'text-indigo-400', bg: 'bg-indigo-500/10', title: 'Form Balanced Teams', desc: 'Deterministic engine matches students by skill, schedule, preference, and role suitability.' },
              { step: '04', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', title: 'Review & Publish', desc: 'Coordinator reviews draft teams, inspects warnings, adjusts manually, then publishes.' },
              { step: '05', icon: ClipboardList, color: 'text-amber-400', bg: 'bg-amber-500/10', title: 'Allocate Tasks Fairly', desc: 'Capacity-aware task allocation recommends the right assignee based on skills, load, and role.' },
              { step: '06', icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10', title: 'Monitor Risks', desc: 'Conflict dashboard aggregates skill gaps, overload, friction events, and missing supervisors.' },
            ].map(({ step, icon: Icon, color, bg, title, desc }) => (
              <div key={step} className="group rounded-2xl border border-white/8 bg-white/[0.03] p-6 transition-colors hover:border-white/15 hover:bg-white/[0.05]">
                <div className="mb-3 flex items-center gap-3">
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <span className="text-xs font-bold tracking-widest text-white/25">STEP {step}</span>
                </div>
                <h3 className="mb-2 font-semibold text-white/90">{title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="border-y border-white/8 bg-white/[0.02] px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
              Platform capabilities
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">Everything in one place.</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Users, color: 'text-sky-400', bg: 'bg-sky-500/10', title: 'Intelligent Team Formation', description: 'Match students into balanced teams by skill, schedule, preference, and role suitability. Explain every suggestion.' },
              { icon: Target, color: 'text-violet-400', bg: 'bg-violet-500/10', title: 'Role & Task Allocation', description: 'Assign roles and distribute tasks according to member capacity. Transparent scoring, no hidden decisions.' },
              { icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10', title: 'Conflict & Gap Detection', description: 'Flag critical skill gaps, duplicate project choices, overloaded students, and schedule clashes.' },
              { icon: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-500/10', title: 'Team Health Monitor', description: 'Surface workload imbalance, silent members, and overload signals with recommended actions.' },
              { icon: BookOpen, color: 'text-indigo-400', bg: 'bg-indigo-500/10', title: 'Coordinator & Supervisor Oversight', description: 'Coordinators manage the full formation pipeline. Supervisors get structured team briefs and consultation tools.' },
              { icon: Lightbulb, color: 'text-pink-400', bg: 'bg-pink-500/10', title: 'Neurodivergent-First Support', description: 'A private support layer gives students clearer tasks, lower cognitive load, and structured guidance — never exposed to coordinators or supervisors.' },
            ].map(({ icon: Icon, color, bg, title, description }) => (
              <div key={title} className="group rounded-2xl border border-white/8 bg-white/[0.03] p-6 transition-colors hover:border-white/15 hover:bg-white/[0.05]">
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3 className="mb-2 font-semibold text-white/90">{title}</h3>
                <p className="text-sm leading-relaxed text-white/55">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Role sections ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
              Built for every role
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">One platform, three perspectives.</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Coordinator */}
            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
                  <Shield className="h-4 w-4 text-purple-400" />
                </div>
                <span className="font-semibold text-purple-300">Coordinator</span>
              </div>
              <ul className="space-y-2.5 text-sm text-white/60">
                {[
                  'Manage academic terms and student intake',
                  'Open project topics and review demand conflicts',
                  'Run deterministic team formation engine',
                  'Review, adjust, and publish draft teams',
                  'Monitor skill gaps, overload, and formation risks',
                  '8-step workflow checklist with live status',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-400/60" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Student */}
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20">
                  <Brain className="h-4 w-4 text-sky-400" />
                </div>
                <span className="font-semibold text-sky-300">Student</span>
              </div>
              <ul className="space-y-2.5 text-sm text-white/60">
                {[
                  'Build a formation profile with skills and availability',
                  'Rank capstone project topic preferences',
                  'See a guided "My Capstone Journey" checklist',
                  'Review assigned team, project, and supervisor',
                  'View tasks with cognitive load indicators',
                  'Private safe support preferences — never shared',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400/60" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Supervisor */}
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20">
                  <Eye className="h-4 w-4 text-indigo-400" />
                </div>
                <span className="font-semibold text-indigo-300">Supervisor</span>
              </div>
              <ul className="space-y-2.5 text-sm text-white/60">
                {[
                  'View assigned teams with health indicators',
                  'Review workload balance and task progress',
                  'Manage consultation requests and schedules',
                  'Answer open project questions via Project Brain',
                  'Track team milestones and identify friction events',
                  'Structured meeting notes with action items',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400/60" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Explainability ── */}
      <section className="border-y border-white/8 bg-white/[0.02] px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
              Transparent by design
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">Every decision is explainable.</h2>
            <p className="mt-3 text-white/50">
              ProjectPilot uses deterministic scoring engines. Every team suggestion, role assignment,
              and task recommendation includes a human-readable explanation.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: GitMerge, color: 'text-sky-400', label: '"Why this team?"', desc: 'See the skill coverage score, schedule overlap, and preference match that formed each team.' },
              { icon: Star, color: 'text-amber-400', label: '"Why this role?"', desc: 'Understand how role confidence scores and skill alignment led to each suggested role.' },
              { icon: ClipboardList, color: 'text-emerald-400', label: '"Why this assignee?"', desc: 'Task recommendations show skill match, available capacity, and workload balance reasons.' },
              { icon: AlertTriangle, color: 'text-orange-400', label: '"What should I fix first?"', desc: 'The conflict dashboard ranks risks by severity and provides prioritised recommended actions.' },
            ].map(({ icon: Icon, color, label, desc }) => (
              <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
                <Icon className={`mb-3 h-5 w-5 ${color}`} />
                <p className="mb-1.5 text-sm font-semibold text-white/80">{label}</p>
                <p className="text-xs leading-relaxed text-white/45">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-white/8 bg-white/[0.025] px-5 py-4 text-sm text-white/45">
            <span className="font-medium text-white/60">Deterministic engines · </span>
            Scoring is transparent, consistent, and repeatable — no AI makes hidden allocation decisions.
            Optional AI-enhanced summaries can supplement explanations but never replace the deterministic logic.
          </div>
        </div>
      </section>

      {/* ── Neurodivergent support ── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
            Neurodivergent-first support
          </p>
          <h2 className="mb-3 text-3xl font-bold sm:text-4xl">Support that stays private.</h2>
          <p className="mb-10 text-white/50">
            Cognitive support preferences help route appropriate tasks to students — without exposing any
            personal data to coordinators or supervisors.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Written instructions', 'Tasks include explicit written guidance'],
              ['Clear definition of done', 'Every task has concrete acceptance criteria'],
              ['Predictable routine', 'Team meeting times stay consistent'],
              ['Smaller task chunks', 'Complex tasks are broken into manageable steps'],
              ['Regular check-ins', 'Structured progress reviews reduce uncertainty'],
              ['Reduced cognitive load', 'Uncluttered UI with obvious next actions'],
            ].map(([label, desc]) => (
              <div key={label} className="rounded-xl border border-white/8 bg-white/[0.03] p-4 text-left">
                <p className="mb-1 text-sm font-semibold text-white/80">{label}</p>
                <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Principles ── */}
      <section className="border-y border-white/8 bg-white/[0.02] px-6 py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-8 text-xs font-semibold uppercase tracking-widest text-white/40">
            Design principles
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: 'Low Cognitive Load', desc: 'Clean, uncluttered layouts that reduce visual noise and decision fatigue' },
              { title: 'Predictable Structure', desc: 'Consistent navigation and interaction patterns throughout the platform' },
              { title: 'Explicit Communication', desc: 'Clear next actions, no vague feedback, plain-language explanations throughout' },
            ].map(({ title, desc }) => (
              <div key={title} className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
                <div className="mb-1 text-sm font-semibold text-white/90">{title}</div>
                <div className="text-xs text-white/45 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-20 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="text-3xl font-bold">Ready to explore the demo?</h2>
          <p className="mt-3 text-white/55">
            Sign in with a demo account to walk through the full formation pipeline — no setup required.
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
              Demo accounts — password: <code className="text-white/70">demo1234</code>
            </p>
            <div className="space-y-2 text-sm">
              {[
                { role: 'Coordinator', email: 'coord@demo.com', color: 'bg-purple-500/20 text-purple-300', note: 'Full formation workflow' },
                { role: 'Student', email: 'ruvan@demo.com', color: 'bg-sky-500/20 text-sky-300', note: 'Capstone journey view' },
                { role: 'Supervisor', email: 'dr.perera@demo.com', color: 'bg-indigo-500/20 text-indigo-300', note: 'Team oversight' },
              ].map(({ role, email, color, note }) => (
                <div key={email} className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${color}`}>{role}</span>
                  <code className="text-white/60">{email}</code>
                  <span className="ml-auto text-xs text-white/30">{note}</span>
                </div>
              ))}
            </div>
          </div>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-sky-500/30 transition-all hover:bg-sky-400"
          >
            Open demo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-white/30">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/80">
              <Zap className="h-3 w-3 text-white" />
            </div>
            ProjectPilot
          </div>
          <span>Intelligent capstone team formation · neurodivergent-first support built in</span>
          <span>Deterministic · Explainable · Privacy-first</span>
        </div>
      </footer>
    </div>
  );
}
