import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { explainTeamFormationRun, explainDraftTeam } from '@/lib/services/explainability/explainability-service';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'COORDINATOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');
  const draftTeamId = searchParams.get('draftTeamId');

  try {
    if (draftTeamId) {
      const result = await explainDraftTeam(draftTeamId);
      return NextResponse.json(result);
    }
    if (runId) {
      const result = await explainTeamFormationRun(runId);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'Provide runId or draftTeamId query param' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to generate explanation' }, { status: 500 });
  }
}
