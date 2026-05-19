import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type InfoCalloutProps = {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  className?: string;
};

const styles = {
  info: {
    container: 'bg-sky-50 border-sky-200 text-sky-900',
    icon: <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />,
  },
  success: {
    container: 'bg-green-50 border-green-200 text-green-900',
    icon: <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />,
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-900',
    icon: <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />,
  },
};

export function InfoCallout({ variant = 'info', title, children, className }: InfoCalloutProps) {
  const s = styles[variant];
  return (
    <div className={cn('flex gap-3 rounded-lg border p-4 text-sm', s.container, className)}>
      {s.icon}
      <div>
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
