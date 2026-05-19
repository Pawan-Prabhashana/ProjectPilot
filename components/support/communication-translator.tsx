'use client';

import { useState, useTransition } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Copy, CheckCircle, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TranslationStyle, TranslationResult } from '@/lib/services/communication-support';
import { TRANSLATION_STYLE_META } from '@/lib/services/communication-support';

const STYLES: TranslationStyle[] = [
  'DIRECT', 'GENTLE', 'ACADEMIC_FORMAL', 'SUPERVISOR_READY', 'CONCISE_ACTION', 'PEER_COLLABORATIVE',
];

export function CommunicationTranslator() {
  const [inputText, setInputText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<TranslationStyle>('DIRECT');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleTranslate() {
    if (!inputText.trim()) return;
    startTransition(async () => {
      const res = await fetch('/api/support/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, style: selectedStyle }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data.result);
        setShowChanges(false);
      }
    });
  }

  function handleCopy() {
    if (result?.translated) {
      navigator.clipboard.writeText(result.translated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleStyleSelect(style: TranslationStyle) {
    setSelectedStyle(style);
    setResult(null);
  }

  const charCount = inputText.length;
  const isLong = charCount > 500;

  return (
    <div className="space-y-6">
      {/* Style Picker */}
      <div>
        <p className="text-sm font-medium mb-2.5">Choose a communication style</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STYLES.map((style) => {
            const meta = TRANSLATION_STYLE_META[style];
            const isSelected = selectedStyle === style;
            return (
              <button
                key={style}
                onClick={() => handleStyleSelect(style)}
                className={cn(
                  'group text-left rounded-xl border p-3 transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{meta.icon}</span>
                  <span className={cn('text-sm font-semibold', isSelected && 'text-primary')}>
                    {meta.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {meta.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Your text</label>
          <span className={cn('text-xs text-muted-foreground', isLong && 'text-amber-600')}>
            {charCount} characters{isLong ? ' — consider splitting into sections' : ''}
          </span>
        </div>
        <Textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste or type your message here..."
          className="min-h-[140px] resize-none text-sm leading-relaxed"
        />
      </div>

      {/* Translate Button */}
      <Button
        onClick={handleTranslate}
        disabled={!inputText.trim() || isPending}
        className="w-full sm:w-auto"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Translating...
          </>
        ) : (
          <>
            Rewrite as {TRANSLATION_STYLE_META[selectedStyle].label}
            <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>

      {/* Result */}
      {result && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-base">{TRANSLATION_STYLE_META[result.style].icon}</span>
              <span className="text-sm font-semibold text-foreground">
                {TRANSLATION_STYLE_META[result.style].label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowChanges((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showChanges ? 'Hide' : 'Show'} changes
                {showChanges ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2.5 text-xs"
              >
                {copied ? (
                  <><CheckCircle className="h-3.5 w-3.5 mr-1 text-green-600" />Copied</>
                ) : (
                  <><Copy className="h-3.5 w-3.5 mr-1" />Copy</>
                )}
              </Button>
            </div>
          </div>

          {/* Translated text */}
          <div className="p-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {result.translated}
            </p>
          </div>

          {/* Tip */}
          {result.tip && (
            <div className="px-4 pb-3 border-t border-border/50 pt-3">
              <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                💡 {result.tip}
              </p>
            </div>
          )}

          {/* Changes applied */}
          {showChanges && result.changesApplied.length > 0 && (
            <div className="px-4 pb-4 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground pt-3 mb-2">
                What was changed:
              </p>
              <ul className="space-y-1">
                {Array.from(new Set(result.changesApplied)).map((change, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
