import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { cognitiveProfileSchema } from '@/lib/validations/cognitive-profile';
import { upsertCognitiveProfile } from '@/lib/services/cognitive-support';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'STUDENT') {
      return NextResponse.json({ message: 'Only students have a cognitive profile.' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = cognitiveProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const profile = await upsertCognitiveProfile(user.id, parsed.data);
    log.info('cognitive-profile.saved', { userId: user.id });
    return NextResponse.json(profile);
  } catch (error) {
    log.error('cognitive-profile.save.failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ message: 'Failed to save profile.' }, { status: 500 });
  }
}
