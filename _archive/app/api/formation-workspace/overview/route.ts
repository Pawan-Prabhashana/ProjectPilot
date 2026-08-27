import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCoordinatorFormationWorkspace } from '@/lib/services/formation/formation-workspace';
import { log } from '@/lib/logger';

/**
 * GET /api/formation-workspace/overview
 *
 * Coordinator-only. Returns workspace overview: active term, batch,
 * latest run summary, and whether the run is already published.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as { id: string; role?: string };

  if (user.role !== 'COORDINATOR') {
    return NextResponse.json({ message: 'Coordinator access only.' }, { status: 403 });
  }

  try {
    const overview = await getCoordinatorFormationWorkspace();
    return NextResponse.json(overview);
  } catch (error) {
    log.error('formation-workspace.overview.get', { error: String(error) });
    return NextResponse.json({ message: 'Failed to load workspace overview.' }, { status: 500 });
  }
}
