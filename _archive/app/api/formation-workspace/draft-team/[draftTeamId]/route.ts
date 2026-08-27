import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateDraftTeam } from '@/lib/services/formation/formation-workspace';
import { log } from '@/lib/logger';
import type { DraftTeamStatus } from '@prisma/client';

/**
 * PATCH /api/formation-workspace/draft-team/[draftTeamId]
 *
 * Coordinator-only. Updates a draft team's name, status, or assigned topic.
 * Body: { name?: string; status?: DraftTeamStatus; topicId?: string | null }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { draftTeamId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as { id: string; role?: string };

  if (user.role !== 'COORDINATOR') {
    return NextResponse.json({ message: 'Coordinator access only.' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      status?: DraftTeamStatus;
      topicId?: string | null;
    };

    const updated = await updateDraftTeam(params.draftTeamId, {
      name: body.name,
      status: body.status,
      topicId: body.topicId,
    });

    return NextResponse.json(updated);
  } catch (error) {
    log.error('formation-workspace.draft-team.patch', { error: String(error) });
    return NextResponse.json({ message: 'Failed to update draft team.' }, { status: 500 });
  }
}
