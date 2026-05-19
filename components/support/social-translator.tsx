'use client';

import { useState, useTransition } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Loader2, Copy, MessageSquare, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SocialTranslationResult, SocialSignal } from '@/lib/services/communication-support';

const SEVERITY_CONFIG = {
  high: {
    label: 'High',
    card: 'border-red-200 bg-red-50',
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
  medium: {
    label: 'Medium',
    card: 'border-amber-200 bg-amber-50',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  low: {
    label: 'Low',
    card: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-400',
  },
};

function SignalCard({ signal }: { signal: SocialSignal }) {
  const [showClarify, setShowClarify] = useState(false);
  const cfg = SEVERITY_CONFIG[signal.severity];

  return (
    <div className={cn('rounded-xl border p-4 space-y-2.5', cfg.card)}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-1 h-2 w-2 rounded-full shrink-0', cfg.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold">{signal.label}</span>
            <span className={cn('text-xs font-medium rounded-full border px-2 py-0.5', cfg.badge)}>
              {cfg.label} signal
            </span>
          </div>
          <p className="text-xs italic text-muted-foreground mb-1.5">
            Phrase: &ldquo;{signal.matchedPhrase}&rdquo;
          </p>
          <p className="text-xs leading-relaxed">{signal.interpretation}</p>
        </div>
      </div>
      {signal.suggestedClarification && (
        <div className="pl-5">
          <button
            onClick={() => setShowClarify((v) => !v)}
            className="text-xs text-primary hover:underline underline-offset-2"
          >
            {showClarify ? 'Hide' : 'See'} suggested clarification
          </button>
          {showClarify && (
            <p className="mt-2 text-xs text-muted-foreground bg-white/60 rounded-lg px-3 py-2 border border-current/10">
              {signal.suggestedClarification}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AmbiguityMeter({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.6 ? 'bg-red-400' : score >= 0.3 ? 'bg-amber-400' : 'bg-green-400';
  const label = score >= 0.6 ? 'High ambiguity' : score >= 0.3 ? 'Moderate ambiguity' : 'Low ambiguity';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Ambiguity level</span>
        <span className={cn('font-medium', score >= 0.6 ? 'text-red-700' : score >= 0.3 ? 'text-amber-700' : 'text-green-700')}>
          {label} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function SocialTranslator() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<SocialTranslationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleAnalyze() {
    if (!inputText.trim()) return;
    startTransition(async () => {
      const res = await fetch('/api/support/social-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data.result);
      }
    });
  }

  function handleCopySuggested() {
    if (result?.suggestedResponse) {
      navigator.clipboard.writeText(result.suggestedResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Explanation */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <Info className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
        <p className="text-xs text-blue-800 leading-relaxed">
          Paste any message — from a supervisor, a team member, or a feedback note — and this tool
          will identify hidden expectations, soft deadlines, unclear ownership, and implied signals
          that may be difficult to spot. It will not make accusations about intent; it surfaces
          patterns to help you decide what questions to ask.
        </p>
      </div>

      {/* Input */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Message to analyse</label>
        <Textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste a message from your supervisor, team, or feedback document..."
          className="min-h-[130px] resize-none text-sm leading-relaxed"
        />
      </div>

      <Button
        onClick={handleAnalyze}
        disabled={!inputText.trim() || isPending}
        variant="outline"
        className="w-full sm:w-auto border-primary/30 text-primary hover:bg-primary/5"
      >
        {isPending ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analysing...</>
        ) : (
          <><MessageSquare className="h-4 w-4 mr-2" />Analyse social signals</>
        )}
      </Button>

      {result && (
        <div className="space-y-5">
          {/* Ambiguity meter */}
          <AmbiguityMeter score={result.ambiguityScore} />

          {/* Summary */}
          <div className={cn(
            'rounded-xl border px-4 py-3',
            result.signals.length === 0 ? 'border-green-200 bg-green-50' : 'border-border bg-muted/30'
          )}>
            <div className="flex items-start gap-2">
              {result.signals.length === 0
                ? <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />}
              <p className={cn('text-sm', result.signals.length === 0 ? 'text-green-800' : 'text-foreground')}>
                {result.summary}
              </p>
            </div>
          </div>

          {/* Clear action indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn(
              'h-2 w-2 rounded-full',
              result.hasClearAction ? 'bg-green-500' : 'bg-amber-500'
            )} />
            {result.hasClearAction
              ? 'Message contains a reasonably clear action request'
              : 'No clearly defined action request was found'}
          </div>

          {/* Interpretation */}
          {result.signals.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">What this message may mean:</p>
              <div className="text-sm text-muted-foreground rounded-lg bg-muted/40 px-4 py-3 leading-relaxed">
                {result.clearedInterpretation}
              </div>
            </div>
          )}

          {/* Signals */}
          {result.signals.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-sm font-medium">
                {result.signals.length} signal{result.signals.length !== 1 ? 's' : ''} detected
              </p>
              {result.signals.map((signal, i) => (
                <SignalCard key={i} signal={signal} />
              ))}
            </div>
          )}

          {/* No signals */}
          {result.signals.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl border border-green-200 px-4 py-3">
              <CheckCircle className="h-4 w-4 shrink-0" />
              No ambiguous signals detected. This message appears clear and direct.
            </div>
          )}

          {/* Suggested response */}
          {result.suggestedResponse && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Suggested clarification response</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySuggested}
                  className="h-7 px-2.5 text-xs"
                >
                  {copied
                    ? <><CheckCircle className="h-3.5 w-3.5 mr-1 text-green-600" />Copied</>
                    : <><Copy className="h-3.5 w-3.5 mr-1" />Copy</>}
                </Button>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="text-sm leading-relaxed">{result.suggestedResponse}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                This is a starting point — adjust to match your context before sending.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
