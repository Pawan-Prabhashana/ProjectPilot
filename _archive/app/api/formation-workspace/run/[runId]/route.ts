import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFormationWorkspaceRun } from '@/lib/services/formation/formation-workspace';
import { log } from '@/lib/logger';

/**
 * GET /api/formation-workspace/run/[runId]
 *
 * Coordinator-only. Returns full workspace details for a specific formation run,
 * including all draft teams, members, scores, and warnings.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as { id: string; role?: string };

  if (user.role !== 'COORDINATOR') {
    return NextResponse.json({ message: 'Coordinator access only.' }, { status: 403 });
  }

  try {
    const details = await getFormationWorkspaceRun(params.runId);
    if (!details) {
      return NextResponse.json({ message: 'Formation run not found.' }, { status: 404 });
    }
    return NextResponse.json(details);
  } catch (error) {
    log.error('formation-workspace.run.get', { error: String(error) });
    return NextResponse.json({ message: 'Failed to load run details.' }, { status: 500 });
  }
}
