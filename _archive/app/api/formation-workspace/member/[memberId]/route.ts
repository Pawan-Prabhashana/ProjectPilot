import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateDraftTeamMember } from '@/lib/services/formation/formation-workspace';
import { log } from '@/lib/logger';

/**
 * PATCH /api/formation-workspace/member/[memberId]
 *
 * Coordinator-only. Updates a draft team member's suggested role key and label.
 * Body: { suggestedRoleKey?: string; suggestedRoleLabel?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as { id: string; role?: string };

  if (user.role !== 'COORDINATOR') {
    return NextResponse.json({ message: 'Coordinator access only.' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      suggestedRoleKey?: string;
      suggestedRoleLabel?: string;
    };

    const updated = await updateDraftTeamMember(params.memberId, {
      suggestedRoleKey: body.suggestedRoleKey,
      suggestedRoleLabel: body.suggestedRoleLabel,
    });

    return NextResponse.json(updated);
  } catch (error) {
    log.error('formation-workspace.member.patch', { error: String(error) });
    return NextResponse.json({ message: 'Failed to update member role.' }, { status: 500 });
  }
}
