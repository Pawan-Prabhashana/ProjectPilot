import { cn } from '@/lib/utils';
import type { TeamHealthStatus } from '@prisma/client';

type HealthBadgeProps = {
  status: TeamHealthStatus | string;
  showDot?: boolean;
  className?: string;
};

const config: Record<string, { label: string; styles: string; dot: string }> = {
  ON_TRACK: {
    label: 'On Track',
    styles: 'bg-green-100 text-green-800 border-green-200',
    dot: 'bg-green-500',
  },
  AT_RISK: {
    label: 'At Risk',
    styles: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  CRITICAL: {
    label: 'Critical',
    styles: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
  },
};

export function HealthBadge({ status, showDot = true, className }: HealthBadgeProps) {
  const c = config[status] ?? { label: status, styles: 'bg-muted text-muted-foreground border-border', dot: 'bg-gray-400' };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        c.styles,
        className
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />}
      {c.label}
    </span>
  );
}
