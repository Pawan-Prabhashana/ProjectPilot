import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScoreFactor } from '@/lib/metrics/types';

type Props = {
  factors: ScoreFactor[];
  /** Show at most this many items before truncating. Default: all */
  maxItems?: number;
};

export function ScoreFactorList({ factors, maxItems }: Props) {
  const visible = maxItems ? factors.slice(0, maxItems) : factors;
  const hidden  = maxItems ? Math.max(0, factors.length - maxItems) : 0;

  if (factors.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No factors recorded for this score.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {visible.map((f, idx) => (
        <li key={idx} className="flex items-start gap-2.5">
          {/* Impact icon */}
          <span
            className={cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
              f.impact === 'positive' ? 'bg-emerald-100 text-emerald-700'
              : f.impact === 'negative' ? 'bg-red-100 text-red-700'
              : 'bg-muted text-muted-foreground'
            )}
            aria-label={f.impact}
          >
            {f.impact === 'positive' ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : f.impact === 'negative' ? (
              <TrendingDown className="h-2.5 w-2.5" />
            ) : (
              <Minus className="h-2.5 w-2.5" />
            )}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-xs font-medium text-foreground">{f.label}</span>
              <span className={cn(
                'text-[11px] font-semibold',
                f.impact === 'positive' ? 'text-emerald-700'
                : f.impact === 'negative' ? 'text-red-700'
                : 'text-muted-foreground'
              )}>
                {typeof f.value === 'number'
                  ? f.impact === 'positive' ? `−${Math.abs(f.weight ?? 0)}pts` : `+${f.weight ?? 0}pts`
                  : String(f.value)}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              {f.explanation}
            </p>
          </div>
        </li>
      ))}
      {hidden > 0 && (
        <li className="text-[11px] text-muted-foreground italic pl-6">
          +{hidden} more factor{hidden !== 1 ? 's' : ''}
        </li>
      )}
    </ul>
  );
}
