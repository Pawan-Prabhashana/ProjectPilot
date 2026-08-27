import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  validateRunForPublish,
  publishFormationRun,
} from '@/lib/services/formation/formation-workspace';
import { log } from '@/lib/logger';

/**
 * POST /api/formation-workspace/publish
 *
 * Coordinator-only. Validates and publishes a completed formation run into real
 * operational Team, TeamMember, and Project records.
 *
 * Body: { runId: string; validateOnly?: boolean }
 *
 * - validateOnly: if true, runs validation and returns the result without publishing.
 * - If false (default), validates and then publishes (idempotent — blocked if
 *   already published).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as { id: string; role?: string };

  if (user.role !== 'COORDINATOR') {
    return NextResponse.json({ message: 'Coordinator access only.' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      runId?: string;
      validateOnly?: boolean;
    };

    if (!body.runId) {
      return NextResponse.json({ message: 'runId is required.' }, { status: 400 });
    }

    const validation = await validateRunForPublish(body.runId);

    if (body.validateOnly) {
      return NextResponse.json({ validation });
    }

    if (!validation.valid) {
      return NextResponse.json(
        { message: 'Validation failed. Cannot publish.', validation },
        { status: 422 }
      );
    }

    const result = await publishFormationRun(body.runId, user.id);

    if (!result.success) {
      log.error('formation-workspace.publish.failed', {
        userId: user.id,
        runId: body.runId,
        message: result.message,
      });
      return NextResponse.json({ message: result.message }, { status: 500 });
    }

    log.info('formation-workspace.publish.success', {
      userId: user.id,
      runId: body.runId,
      summary: result.summary,
    });

    return NextResponse.json({
      message: result.message,
      summary: result.summary,
    });
  } catch (error) {
    log.error('formation-workspace.publish', { error: String(error) });
    return NextResponse.json({ message: 'Failed to publish formation run.' }, { status: 500 });
  }
}
