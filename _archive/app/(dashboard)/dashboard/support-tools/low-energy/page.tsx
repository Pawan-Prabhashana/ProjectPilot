import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth, requireRole } from '@/lib/rbac';
import { getLowEnergyView } from '@/lib/services/support-intelligence';
import { PageHeader } from '@/components/shared/page-header';
import { InfoCallout } from '@/components/shared/info-callout';
import {
  ArrowLeft, CheckCircle, Clock, Zap, ArrowRight, Focus, Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Low-Energy Mode — ProjectPilot' };

export default async function LowEnergyModePage() {
  const user = await requireAuth();
  requireRole(user, ['STUDENT']);
  const view = await getLowEnergyView(user.id);

  return (
    <div className="max-w-lg space-y-7">
      {/* Back */}
      <Link
        href="/dashboard/support-tools"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Support Tools
      </Link>

      <PageHeader
        title="Low-Energy Mode"
        description="One small step. That's all."
      />

      {/* Gentle framing */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 px-5 py-5 space-y-2">
        <div className="flex items-center gap-2 text-emerald-700">
          <Heart className="h-4 w-4" />
          <p className="text-sm font-semibold">You do not need to do everything today.</p>
        </div>
        <p className="text-sm text-emerald-800 leading-relaxed">
          Low-energy days are real. This mode shows you the smallest useful action you can take right
          now — one that actually moves something forward without requiring you to be at full capacity.
        </p>
      </div>

      {/* Skip reason if no tasks */}
      {view.skipReason ? (
        <InfoCallout variant="info">{view.skipReason}</InfoCallout>
      ) : (
        <>
          {/* The one step */}
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b border-border/50 bg-gradient-to-r from-emerald-50 to-white px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                  Today&apos;s minimum
                </p>
              </div>
              <p className="text-base font-semibold text-foreground leading-snug">
                {view.todayMinimum}
              </p>
            </div>

            <div className="px-5 py-5 space-y-5">
              {/* Smallest step */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  What to do
                </p>
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-900 leading-relaxed">
                    {view.smallestStep.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2.5 text-xs text-emerald-700">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      About {view.smallestStep.estimatedMinutes} min
                    </span>
                    {view.smallestStep.taskTitle && (
                      <span className="text-emerald-600 opacity-70">
                        Task: {view.smallestStep.taskTitle}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Why */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Why this one
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {view.smallestStep.rationale}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                {view.smallestStep.taskId && (
                  <Link
                    href={`/dashboard/support-tools/focus?taskId=${view.smallestStep.taskId}`}
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    <Focus className="h-3.5 w-3.5" />
                    Open in Focus Mode
                  </Link>
                )}
                <Link
                  href="/dashboard/tasks"
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  View all tasks
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Progress reassurance */}
          <div className="rounded-xl border bg-card px-4 py-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              What you have already done
            </p>
            <p className="text-sm text-foreground">{view.confidence.progressStatement}</p>

            {view.confidence.alreadyDoneNote && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {view.confidence.alreadyDoneNote}
              </p>
            )}

            {view.confidence.recentWins.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs text-muted-foreground">Recently completed:</p>
                <ul className="space-y-1">
                  {view.confidence.recentWins.map((win, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-green-700">
                      <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                      {win}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Can defer */}
          {view.confidence.canDefer.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                You can safely skip these today
              </p>
              <ul className="space-y-1">
                {view.confidence.canDefer.map((item, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What counts as enough */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
              What counts as enough for today
            </p>
            <p className="text-sm text-emerald-800 leading-relaxed">
              {view.confidence.whatCountsAsEnough}
            </p>
          </div>

          {/* Reassurance */}
          <div className="text-center pb-2">
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              &ldquo;{view.confidence.reassurance}&rdquo;
            </p>
          </div>
        </>
      )}
    </div>
  );
}
