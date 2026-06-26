import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  getStudentPreferences,
  savePreferenceDraft,
  submitPreferences,
  type PreferenceInput,
} from '@/lib/services/formation/project-topics';
import { log } from '@/lib/logger';

async function getActiveTerm() {
  return prisma.academicTerm.findFirst({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
}

/** GET /api/project-preferences — student fetches their own preferences */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as { id: string; role?: string };

  if (user.role !== 'STUDENT') {
    return NextResponse.json({ message: 'Only students have project preferences.' }, { status: 403 });
  }

  try {
    const sp = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!sp) {
      // No StudentProfile — return empty preferences gracefully so the page still loads
      return NextResponse.json({ preferences: [], term: null });
    }

    const term = await getActiveTerm();
    if (!term) return NextResponse.json({ preferences: [], term: null });

    const preferences = await getStudentPreferences(term.id, sp.id);
    return NextResponse.json({ preferences, term: { id: term.id, name: term.name } });
  } catch (err) {
    log.error('api.project-preferences.get.failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ message: 'Failed to load preferences.' }, { status: 500 });
  }
}

/** POST /api/project-preferences — save draft or submit */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  const user = session.user as { id: string; role?: string };

  if (user.role !== 'STUDENT') {
    return NextResponse.json({ message: 'Only students can set project preferences.' }, { status: 403 });
  }

  try {
    const sp = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!sp) return NextResponse.json({ message: 'Student profile not found. Please contact your coordinator.' }, { status: 404 });

    const term = await getActiveTerm();
    if (!term) return NextResponse.json({ message: 'No active academic term.' }, { status: 404 });

    const body = await req.json();
    const { action } = body as { action: string };

    if (action === 'save_draft') {
      await savePreferenceDraft(term.id, sp.id, body.preferences as PreferenceInput[]);
      log.info('project-preferences.draft.saved', { userId: user.id });
      return NextResponse.json({ ok: true });
    }

    if (action === 'submit') {
      await submitPreferences(term.id, sp.id);
      log.info('project-preferences.submitted', { userId: user.id });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ message: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    log.error('project-preferences.post.failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Failed.' }, { status: 500 });
  }
}
