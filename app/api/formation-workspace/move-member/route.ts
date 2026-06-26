import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { moveDraftTeamMember } from '@/lib/services/formation/formation-workspace';
import { log } from '@/lib/logger';

/**
 * POST /api/formation-workspace/move-member
 *
 * Coordinator-only. Moves a draft team member from one draft team to another
 * within the same formation run.
 * Body: { memberId: string; targetDraftTeamId: string }
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
      memberId?: string;
      targetDraftTeamId?: string;
    };

    if (!body.memberId || !body.targetDraftTeamId) {
      return NextResponse.json(
        { message: 'memberId and targetDraftTeamId are required.' },
        { status: 400 }
      );
    }

    const result = await moveDraftTeamMember(body.memberId, body.targetDraftTeamId);
    if (!result.success) {
      return NextResponse.json({ message: result.message }, { status: 400 });
    }

    return NextResponse.json({ message: result.message });
  } catch (error) {
    log.error('formation-workspace.move-member', { error: String(error) });
    return NextResponse.json({ message: 'Failed to move member.' }, { status: 500 });
  }
}
