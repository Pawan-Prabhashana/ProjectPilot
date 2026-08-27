import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { explainConflictDashboard } from '@/lib/services/explainability/explainability-service';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'COORDINATOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const termId = searchParams.get('termId') ?? undefined;

  try {
    const result = await explainConflictDashboard(termId);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to generate explanation' }, { status: 500 });
  }
}
