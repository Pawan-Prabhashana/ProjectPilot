import { cn } from '@/lib/utils';
import type { ScoreStatus } from '@/lib/metrics/types';

type Props = {
  status: ScoreStatus;
  /**
   * Optional display override — allows callers to show context-appropriate
   * labels (e.g. "Healthy" instead of "Low" for a health score).
   */
  label?: string;
  size?: 'sm' | 'md';
};

const STATUS_CONFIG: Record<
  ScoreStatus,
  { defaultLabel: string; bg: string; text: string; dot: string }
> = {
  LOW:      { defaultLabel: 'Low',      bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  BALANCED: { defaultLabel: 'Balanced', bg: 'bg-sky-100',     text: 'text-sky-800',     dot: 'bg-sky-500'     },
  WATCH:    { defaultLabel: 'Watch',    bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500'   },
  HIGH:     { defaultLabel: 'High',     bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-500'  },
  CRITICAL: { defaultLabel: 'Critical', bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-500'     },
  UNKNOWN:  { defaultLabel: 'Unknown',  bg: 'bg-muted',       text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

export function MetricStatusBadge({ status, label, size = 'md' }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        cfg.bg, cfg.text,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
      {label ?? cfg.defaultLabel}
    </span>
  );
}
