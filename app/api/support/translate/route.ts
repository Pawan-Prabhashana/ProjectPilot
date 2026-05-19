import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/rbac';
import { translateMessage, TRANSLATION_STYLE_META } from '@/lib/services/communication-support';
import type { TranslationStyle } from '@/lib/services/communication-support';

const schema = z.object({
  text: z.string().min(1).max(3000),
  style: z.enum(['DIRECT', 'GENTLE', 'ACADEMIC_FORMAL', 'SUPERVISOR_READY', 'CONCISE_ACTION', 'PEER_COLLABORATIVE']),
});

export async function POST(req: Request) {
  try {
    await requireAuth();
    const body = await req.json();
    const { text, style } = schema.parse(body);
    const result = translateMessage(text, style as TranslationStyle);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
