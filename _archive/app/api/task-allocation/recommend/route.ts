import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canManageTeam } from '@/lib/rbac/team-permissions';
import { recommendAssigneesForTask } from '@/lib/services/tasks/task-allocation';
import { log } from '@/lib/logger';
import type { AuthenticatedUser } from '@/lib/rbac';

/**
 * POST /api/task-allocation/recommend
 *
 * Returns ranked, explainable assignee recommendations for a (possibly draft)
 * task. Never assigns anything — purely advisory. Restricted to users who can
 * manage the team (LEADER/CO_LEADER, the team's SUPERVISOR, or COORDINATOR),
 * matching the existing canCreateTask/canAssignTask gate.
 *
 * Uses getServerSession directly to avoid NEXT_REDIRECT issues in route handlers.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as AuthenticatedUser;

  try {
    const body = await req.json();
    const { teamId } = body as { teamId?: string };
    if (!teamId) return NextResponse.json({ message: 'teamId is required.' }, { status: 400 });

    const allowed = await canManageTeam(user, teamId);
    if (!allowed) {
      return NextResponse.json({ message: 'Only team leaders, supervisors, and coordinators can view allocation recommendations.' }, { status: 403 });
    }

    const result = await recommendAssigneesForTask(body);
    return NextResponse.json(result);
  } catch (error) {
    log.error('task-allocation.recommend.failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Failed to compute recommendations.' }, { status: 500 });
  }
}
