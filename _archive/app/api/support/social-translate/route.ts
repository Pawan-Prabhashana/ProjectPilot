import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/api-auth';
import { analyzeSocialSubtext } from '@/lib/services/communication-support';

const schema = z.object({
  text: z.string().min(1).max(3000),
});

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    const body = await req.json();
    const { text } = schema.parse(body);
    const result = analyzeSocialSubtext(text);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
