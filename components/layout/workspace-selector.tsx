'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { AccessibleWorkspace } from '@/lib/services/workspace-access';

type Props = { workspaces: AccessibleWorkspace[] };

function WorkspaceSelectorInner({ workspaces }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  if (workspaces.length === 0) return null;

  const activeTeamId = searchParams.get('teamId');
  const active = workspaces.find((w) => w.teamId === activeTeamId) ?? workspaces[0];

  function handleChange(teamId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('teamId', teamId);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (workspaces.length === 1) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs">
        <span className="font-medium text-foreground truncate max-w-[140px]">
          {active.teamName}
        </span>
        {active.projectTitle && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground truncate max-w-[120px]">
              {active.projectTitle}
            </span>
          </>
        )}
        <span
          className={`ml-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${capabilityBadgeClass(active.userCapability)}`}
        >
          {capabilityLabel(active.userCapability)}
        </span>
      </div>
    );
  }

  return (
    <div className="hidden sm:flex items-center gap-1.5">
      <select
        value={active.teamId}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer max-w-[200px]"
        aria-label="Switch workspace"
      >
        {workspaces.map((w) => (
          <option key={w.teamId} value={w.teamId}>
            {w.teamName}
            {w.projectTitle ? ` — ${w.projectTitle}` : ''}
          </option>
        ))}
      </select>
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${capabilityBadgeClass(active.userCapability)}`}
      >
        {capabilityLabel(active.userCapability)}
      </span>
    </div>
  );
}

export function WorkspaceSelector({ workspaces }: Props) {
  return (
    <Suspense fallback={null}>
      <WorkspaceSelectorInner workspaces={workspaces} />
    </Suspense>
  );
}

function capabilityLabel(cap: string): string {
  switch (cap) {
    case 'LEADER':      return 'Team Leader';
    case 'CO_LEADER':   return 'Co-Leader';
    case 'SUPERVISOR':  return 'Supervisor';
    case 'COORDINATOR': return 'Coordinator';
    default:            return 'Member';
  }
}

function capabilityBadgeClass(cap: string): string {
  switch (cap) {
    case 'LEADER':      return 'bg-amber-100 text-amber-700';
    case 'CO_LEADER':   return 'bg-orange-100 text-orange-700';
    case 'SUPERVISOR':  return 'bg-indigo-100 text-indigo-700';
    case 'COORDINATOR': return 'bg-purple-100 text-purple-700';
    default:            return 'bg-sky-100 text-sky-700';
  }
}
