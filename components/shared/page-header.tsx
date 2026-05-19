import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  description?: string;
  badge?: { label: string; variant?: 'info' | 'success' | 'warning' | 'critical' };
  actions?: React.ReactNode;
  className?: string;
};

const badgeStyles = {
  info: 'bg-sky-100 text-sky-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
};

export function PageHeader({ title, description, badge, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1 mb-6 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {badge && (
            <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', badgeStyles[badge.variant ?? 'info'])}>
              {badge.label}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 mt-2 sm:mt-0">{actions}</div>}
    </div>
  );
}
