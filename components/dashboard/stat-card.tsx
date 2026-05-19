import { cn } from '@/lib/utils';

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger' | 'success';
  className?: string;
};

const variantStyles: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'border-border bg-card',
  warning: 'border-amber-200 bg-amber-50/60',
  danger: 'border-red-200 bg-red-50/60',
  success: 'border-emerald-200 bg-emerald-50/60',
};

const iconStyles: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-100 text-amber-600',
  danger: 'bg-red-100 text-red-600',
  success: 'bg-emerald-100 text-emerald-600',
};

export function StatCard({
  title,
  value,
  description,
  icon,
  variant = 'default',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 shadow-card transition-shadow hover:shadow-card-hover',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{value}</p>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{description}</p>
          )}
        </div>
        {icon && (
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconStyles[variant])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
