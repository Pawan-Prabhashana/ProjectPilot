import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getLatestFormationRun,
  getFormationRunDetails,
  resolveDefaultBatchId,
} from '@/lib/services/formation/team-formation-engine';
import { log } from '@/lib/logger';

/**
 * GET /api/formation-engine/latest?batchId=...
 *
 * Coordinator-only. Returns the latest run summary + full details for the given
 * batch, or the active term's default batch when batchId is omitted.
 * Students must never access formation engine output.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as { id: string; role?: string };

  if (user.role !== 'COORDINATOR') {
    return NextResponse.json({ message: 'Only coordinators can view formation engine results.' }, { status: 403 });
  }

  try {
    const batchId = req.nextUrl.searchParams.get('batchId') ?? (await resolveDefaultBatchId());
    if (!batchId) {
      return NextResponse.json({ batchId: null, run: null, details: null });
    }

    const run = await getLatestFormationRun(batchId);
    const details = run ? await getFormationRunDetails(run.id) : null;

    return NextResponse.json({ batchId, run, details });
  } catch (error) {
    log.error('formation-engine.api.latest.failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ message: 'Failed to load latest run.' }, { status: 500 });
  }
}
