import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canViewTeam, hasLeaderCapability } from '@/lib/rbac/team-permissions';
import { getTeamWorkloadOverview } from '@/lib/services/tasks/task-allocation';
import { log } from '@/lib/logger';
import type { AuthenticatedUser } from '@/lib/rbac';

/**
 * GET /api/task-allocation/team/[teamId]/overview
 *
 * Returns the team workload overview (capacity, current load, role, skill
 * coverage, overload risk). Coordinators, supervisors (of this team), and team
 * leaders see every member; plain student members see only their own row —
 * teammates' weekly capacity and task load are not broadcast more broadly than
 * the existing team-intelligence workload view already allows.
 *
 * Uses getServerSession directly to avoid NEXT_REDIRECT issues in route handlers.
 */
export async function GET(_req: Request, { params }: { params: { teamId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as AuthenticatedUser;
  const { teamId } = params;

  try {
    const allowed = await canViewTeam(user, teamId);
    if (!allowed) return NextResponse.json({ message: 'Access denied.' }, { status: 403 });

    const overview = await getTeamWorkloadOverview(teamId);

    if (user.role === 'STUDENT') {
      const isLeader = await hasLeaderCapability(user.id, teamId);
      if (!isLeader) {
        return NextResponse.json({
          ...overview,
          members: overview.members.filter((m) => m.userId === user.id),
        });
      }
    }

    return NextResponse.json(overview);
  } catch (error) {
    log.error('task-allocation.overview.failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ message: 'Failed to load team workload overview.' }, { status: 500 });
  }
}
