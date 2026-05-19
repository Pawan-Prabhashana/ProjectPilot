import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { upsertAccessibilitySettings } from '@/lib/services/cognitive-support';
import { log } from '@/lib/logger';
import { z } from 'zod';

const schema = z.object({
  reducedMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  fontScale: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
  focusMode: z.boolean().optional(),
  lowEnergyMode: z.boolean().optional(),
  digestMode: z.enum(['REALTIME', 'DAILY', 'WEEKLY', 'NONE']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: 'Invalid settings.' }, { status: 400 });
    }
    const result = await upsertAccessibilitySettings(user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    log.error('settings.accessibility.save.failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ message: 'Failed to save settings.' }, { status: 500 });
  }
}
