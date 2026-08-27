import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { explainTaskRecommendation } from '@/lib/services/explainability/explainability-service';
import type { TaskRecommendationExplainInput } from '@/lib/services/explainability/types';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: TaskRecommendationExplainInput = await req.json();
    const result = explainTaskRecommendation(body);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to generate explanation' }, { status: 500 });
  }
}
