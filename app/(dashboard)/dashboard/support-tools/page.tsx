import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth, requireRole } from '@/lib/rbac';
import { getNextBestAction, getConfidenceSupport } from '@/lib/services/support-intelligence';
import { PageHeader } from '@/components/shared/page-header';
import { InfoCallout } from '@/components/shared/info-callout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Focus, Zap, MessageSquare, Brain, ArrowRight,
  CheckCircle, AlertTriangle, Clock, Lightbulb,
} from 'lucide-react';

export const metadata: Metadata = { title: 'Support Tools — ProjectPilot' };

const tools = [
  {
    href: '/dashboard/support-tools/focus',
    icon: Focus,
    title: 'Focus Mode',
    description: 'Enter a low-clutter, one-task-at-a-time working view. Clear distractions and see exactly what to do next.',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 border-indigo-100',
    badge: null,
  },
  {
    href: '/dashboard/support-tools/low-energy',
    icon: Zap,
    title: 'Low-Energy Mode',
    description: 'Overwhelmed or stuck? Get a simplified view with just one small, doable next step. No pressure.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-100',
    badge: 'New',
  },
  {
    href: '/dashboard/support-tools/communicate',
    icon: MessageSquare,
    title: 'Communication Tools',
    description: 'Rewrite messages in a different style, or decode ambiguous communication and hidden signals.',
    color: 'text-violet-600',
    bg: 'bg-violet-50 border-violet-100',
    badge: null,
  },
];

export default async function SupportToolsPage() {
  const user = await requireAuth();
  requireRole(user, ['STUDENT']);

  const [nextAction, confidence] = await Promise.all([
    getNextBestAction(user.id),
    getConfidenceSupport(user.id),
  ]);

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Support Tools"
        description="Assistive tools that help you work at your own pace, communicate clearly, and stay grounded."
      />

      {/* Confidence banner */}
      <div className="rounded-2xl border bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <Brain className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-foreground">{confidence.progressStatement}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{confidence.reassurance}</p>
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                {confidence.completedTaskCount} tasks done
              </div>
              {confidence.completedMilestones > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-indigo-500" />
                  {confidence.completedMilestones} milestone{confidence.completedMilestones !== 1 ? 's' : ''} complete
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Next best action */}
      {nextAction && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Best next action
          </h2>
          <Link
            href={`/dashboard/support-tools/focus?taskId=${nextAction.taskId}`}
            className="block group"
          >
            <div className={`rounded-xl border p-4 transition-all hover:shadow-sm hover:border-primary/30 ${
              nextAction.urgencyLevel === 'overdue' ? 'border-red-200 bg-red-50/50' :
              nextAction.urgencyLevel === 'due-soon' ? 'border-amber-200 bg-amber-50/50' :
              'border-border bg-card'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                  nextAction.urgencyLevel === 'overdue' ? 'bg-red-500' :
                  nextAction.urgencyLevel === 'due-soon' ? 'bg-amber-500' :
                  'bg-indigo-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug">{nextAction.taskTitle}</p>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{nextAction.reason}</p>
                  {nextAction.urgencyLevel !== 'overdue' && (
                    <p className="text-xs text-primary mt-1.5 font-medium">
                      Start with: {nextAction.suggestedFirstStep}
                    </p>
                  )}
                  {nextAction.urgencyLevel === 'overdue' && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-700">
                      <AlertTriangle className="h-3 w-3" />
                      Overdue — any update counts as progress
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-indigo-600">
                    <Focus className="h-3 w-3" />
                    Open in Focus Mode →
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Tool cards */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Tools
        </h2>
        <div className="grid gap-3 sm:grid-cols-1">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} className="group block">
              <div className={`rounded-xl border p-4 transition-all hover:shadow-sm ${tool.bg}`}>
                <div className="flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-xl bg-white/70 flex items-center justify-center shrink-0 shadow-sm`}>
                    <tool.icon className={`h-5 w-5 ${tool.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm font-semibold ${tool.color}`}>{tool.title}</p>
                      {tool.badge && (
                        <span className="text-xs bg-white/80 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
                  </div>
                  <ArrowRight className={`h-4 w-4 shrink-0 mt-1 ${tool.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Meeting recovery link */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          After a consultation
        </h2>
        <Link href="/dashboard/consultations" className="group block">
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 transition-all hover:shadow-sm">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
                <Clock className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-violet-700 mb-1">Meeting Recovery Mode</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  After a supervisor meeting, view a simplified recovery summary with your top 3 actions, 
                  what can wait, and a gentle re-entry point. Available from your consultation history.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-violet-600 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </Link>
      </section>

      <InfoCallout variant="info" title="Your support data is private">
        All support tools — translation outputs, social analysis, and support summaries — are private
        to you. They are never shared with your supervisor or coordinator.
      </InfoCallout>
    </div>
  );
}
