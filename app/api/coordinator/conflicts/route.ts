import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCoordinatorConflictGapDashboard } from '@/lib/services/formation/conflict-gap-dashboard';
import { log } from '@/lib/logger';

/**
 * GET /api/coordinator/conflicts?termId=...
 *
 * Coordinator-only. Returns the full conflict and gap detection dashboard DTO.
 * Optional query param: termId — defaults to the active academic term.
 *
 * Uses getServerSession directly to avoid NEXT_REDIRECT issues.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as { id: string; role?: string };

  if (user.role !== 'COORDINATOR') {
    return NextResponse.json({ message: 'Coordinator access only.' }, { status: 403 });
  }

  try {
    const termId = req.nextUrl.searchParams.get('termId') ?? undefined;
    const dashboard = await getCoordinatorConflictGapDashboard(termId);
    return NextResponse.json(dashboard);
  } catch (error) {
    log.error('api.coordinator.conflicts.get', { error: String(error) });
    return NextResponse.json({ message: 'Failed to load conflict dashboard.' }, { status: 500 });
  }
}
