import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  runTeamFormationEngine,
  getFormationRunDetails,
  resolveDefaultBatchId,
} from '@/lib/services/formation/team-formation-engine';
import { log } from '@/lib/logger';

/**
 * POST /api/formation-engine/run
 *
 * Coordinator-only. Runs the deterministic team-formation engine for the given
 * batch (body.batchId) or, if omitted, the active term's default formation batch.
 * Produces DRAFT teams only — never publishes operational teams (that is Part 6).
 *
 * Uses getServerSession directly (not requireAuth) to avoid NEXT_REDIRECT in
 * route handlers.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as { id: string; role?: string };

  if (user.role !== 'COORDINATOR') {
    return NextResponse.json({ message: 'Only coordinators can run the formation engine.' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const batchId: string | undefined = (body as { batchId?: string }).batchId;

    const resolvedBatchId = batchId ?? (await resolveDefaultBatchId());
    if (!resolvedBatchId) {
      return NextResponse.json(
        { message: 'No formation batch found for the active term. Create or seed a batch first.' },
        { status: 404 }
      );
    }

    const result = await runTeamFormationEngine(resolvedBatchId, user.id);
    const details = await getFormationRunDetails(result.runId);

    log.info('formation-engine.api.run', { userId: user.id, batchId: resolvedBatchId, runId: result.runId, status: result.status });

    return NextResponse.json({ runId: result.runId, status: result.status, details });
  } catch (error) {
    log.error('formation-engine.api.run.failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Failed to run engine.' }, { status: 500 });
  }
}
