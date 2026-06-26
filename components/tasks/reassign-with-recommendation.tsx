'use client';

/**
 * Reassign With Recommendation (Part 8) — task detail sidebar control.
 *
 * Lets a leader/supervisor/coordinator get a fresh allocation recommendation
 * for an EXISTING task and apply it via POST /api/task-allocation/apply.
 * Manual override (typing in any teammate, not just a recommended one) is not
 * exposed here since the existing assignee select already lives on the
 * create-task flow; this control is specifically for "apply a recommendation
 * to swap the assignee" without re-creating the task.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { TaskAllocationPanel } from '@/components/tasks/task-allocation-panel';
import type { TaskAssigneeRecommendation } from '@/lib/task-allocation/types';

type Props = {
  taskId: string;
  teamId: string;
  currentAssigneeId: string | null;
  estimatedMinutes: number | null;
  cognitiveLoad: number | null;
  dueDate: string | null;
  requiredSkills: string[];
};

export function ReassignWithRecommendation({
  taskId,
  teamId,
  currentAssigneeId,
  estimatedMinutes,
  cognitiveLoad,
  dueDate,
  requiredSkills,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    async (rec: TaskAssigneeRecommendation) => {
      setApplying(true);
      setError(null);
      try {
        const res = await fetch('/api/task-allocation/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, userId: rec.userId, studentProfileId: rec.studentProfileId, recommendation: rec }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? 'Failed to apply recommendation.');
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to apply recommendation.');
      } finally {
        setApplying(false);
      }
    },
    [taskId, router]
  );

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5" />
        {currentAssigneeId ? 'Reassign with recommendation' : 'Get assignee recommendation'}
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {error && <p className="text-xs text-red-600">{error}</p>}
        {applying ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Applying…
          </div>
        ) : (
          <TaskAllocationPanel
            draft={{ teamId, requiredSkills, estimatedMinutes, cognitiveLoad, dueDate, priority: 'MEDIUM' }}
            appliedUserId={currentAssigneeId}
            onApply={(rec) => apply(rec)}
          />
        )}
        <Button type="button" variant="ghost" size="sm" className="w-full gap-1.5" onClick={() => setOpen(false)}>
          <RefreshCw className="h-3 w-3" /> Close
        </Button>
      </CardContent>
    </Card>
  );
}
