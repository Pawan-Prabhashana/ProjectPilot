import Link from 'next/link';
import {
  Brain,
  Users,
  Calendar,
  Zap,
  CheckCircle,
  ArrowRight,
  BarChart3,
  Lightbulb,
  MessageSquare,
  Shield,
  Clock,
  BookOpen,
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
              NEURO
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
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative px-6 pb-24 pt-20">
        {/* Background glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-sky-500/10 via-indigo-500/5 to-transparent"
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-sm font-medium text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            Built for neurodivergent university teams
          </div>

          <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            The project platform
            <br />
            <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
              that actually understands you.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-white/60 leading-relaxed">
            ProjectPilot Neuro connects student teams with supervisors in one shared space — designed around how neurodivergent minds actually work.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-base font-semibold text-white shadow-xl shadow-sky-500/30 transition-all hover:bg-sky-400 hover:shadow-sky-400/40"
            >
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/10"
            >
              Sign in to your account
            </Link>
          </div>

          <p className="mt-5 text-sm text-white/35">
            Demo accounts available — no setup needed.
          </p>
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="border-y border-white/8 bg-white/[0.02] px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-white/40">
            The real problem
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: MessageSquare, text: 'Vague supervisor feedback creates invisible anxiety' },
              { icon: Clock, text: 'Task overload hits without warning' },
              { icon: Shield, text: 'Hidden dependencies block progress silently' },
              { icon: Users, text: 'One team member carries everyone else' },
              { icon: Calendar, text: 'Consultations are wasted without structure' },
              { icon: Brain, text: 'Important decisions get lost between meetings' },
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

      {/* ── Solution ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
              What ProjectPilot Neuro does
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">Everything your team needs.</h2>
            <p className="mt-3 text-white/50">Three AI layers. One shared space.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Lightbulb,
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
                title: 'Personal Support Agent',
                description:
                  'Each student has a private cognitive profile. The AI adapts communication style, reminders, and pacing to how you actually work.',
              },
              {
                icon: Brain,
                color: 'text-violet-400',
                bg: 'bg-violet-500/10',
                title: 'Project Brain',
                description:
                  'Shared team memory for decisions, open questions, and assumptions — so nothing important gets forgotten between consultations.',
              },
              {
                icon: BookOpen,
                color: 'text-sky-400',
                bg: 'bg-sky-500/10',
                title: 'Supervisor Bridge',
                description:
                  'Translates academic feedback into clear action items. Auto-generates pre-meeting briefs so every consultation is structured.',
              },
              {
                icon: BarChart3,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10',
                title: 'Team Health Monitor',
                description:
                  'Surfaces workload imbalances, silent members, and overload signals before they become crises.',
              },
              {
                icon: Calendar,
                color: 'text-pink-400',
                bg: 'bg-pink-500/10',
                title: 'Structured Consultations',
                description:
                  'Book meetings with structured agendas. Both sides arrive prepared — no more "so what did you want to discuss?" moments.',
              },
              {
                icon: CheckCircle,
                color: 'text-green-400',
                bg: 'bg-green-500/10',
                title: 'Task Intelligence',
                description:
                  'Detects ambiguous requirements, surfaces dependencies, and breaks large tasks into manageable steps automatically.',
              },
            ].map(({ icon: Icon, color, bg, title, description }) => (
              <div
                key={title}
                className="group rounded-2xl border border-white/8 bg-white/[0.03] p-6 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
              >
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-white/55">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof / principles ── */}
      <section className="border-y border-white/8 bg-white/[0.02] px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-8 text-xs font-semibold uppercase tracking-widest text-white/40">
            Designed on these principles
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: 'Low Cognitive Load', desc: 'Clean, uncluttered layouts that reduce visual noise' },
              { title: 'Predictable Structure', desc: 'Consistent navigation and interaction patterns throughout' },
              { title: 'Explicit Communication', desc: 'No hidden meanings, clear next actions, no vague feedback' },
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
          <h2 className="text-3xl font-bold">Ready to get started?</h2>
          <p className="mt-3 text-white/55">
            Sign in with a demo account to explore the full platform — no setup required.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
              Demo accounts — password: <code className="text-white/70">demo1234</code>
            </p>
            <div className="space-y-2 text-sm">
              {[
                { role: 'Student', email: 'ruvan@demo.com', color: 'bg-sky-500/20 text-sky-300' },
                { role: 'Supervisor', email: 'dr.perera@demo.com', color: 'bg-indigo-500/20 text-indigo-300' },
                { role: 'Coordinator', email: 'coord@demo.com', color: 'bg-purple-500/20 text-purple-300' },
              ].map(({ role, email, color }) => (
                <div key={email} className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${color}`}>{role}</span>
                  <code className="text-white/60">{email}</code>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-sky-500/30 transition-all hover:bg-sky-400"
          >
            Sign in to explore
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-white/30">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/80">
              <Zap className="h-3 w-3 text-white" />
            </div>
            ProjectPilot Neuro
          </div>
          <span>Built for neurodivergent university teams</span>
        </div>
      </footer>
    </div>
  );
}
