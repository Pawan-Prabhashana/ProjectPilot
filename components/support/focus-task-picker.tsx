'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Task = {
  id: string;
  title: string;
  priority: string;
  dueDate: Date | null;
};

const PRIORITY_DOT: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-amber-500',
  MEDIUM: 'bg-sky-500',
  LOW: 'bg-slate-400',
};

export function FocusTaskPicker({
  tasks,
  currentTaskId,
}: {
  tasks: Task[];
  currentTaskId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    router.push(`${pathname}?taskId=${id}`);
  }

  return (
    <div className="flex items-center gap-2">
      <p className="text-xs text-muted-foreground shrink-0">Focusing on:</p>
      <div className="relative flex-1 max-w-sm">
        <select
          value={currentTaskId}
          onChange={handleChange}
          className={cn(
            'w-full appearance-none rounded-lg border border-border bg-card px-3 py-1.5 text-sm pr-8',
            'focus:outline-none focus:ring-1 focus:ring-primary/30'
          )}
        >
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}
