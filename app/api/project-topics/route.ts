import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import {
  getAllTopicsForTerm,
  getOpenTopicsForTerm,
  createProjectTopic,
  getCoordinatorTopicCatalogue,
  recalculateConflicts,
  type CreateTopicInput,
} from '@/lib/services/formation/project-topics';
import { log } from '@/lib/logger';

async function getActiveTerm() {
  return prisma.academicTerm.findFirst({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
}

/** GET /api/project-topics?role=coordinator|student */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = req.nextUrl;
    const role = searchParams.get('role');

    const term = await getActiveTerm();
    if (!term) return NextResponse.json({ topics: [], conflicts: [], readiness: null, term: null });

    if (user.role === 'COORDINATOR' || role === 'coordinator') {
      const data = await getCoordinatorTopicCatalogue(term.id);
      return NextResponse.json({ ...data, term: { id: term.id, name: term.name, code: term.code } });
    }

    // STUDENT and SUPERVISOR: open topics only
    const topics = await getOpenTopicsForTerm(term.id);
    return NextResponse.json({ topics, term: { id: term.id, name: term.name, code: term.code } });
  } catch {
    return NextResponse.json({ message: 'Failed to load topics.' }, { status: 500 });
  }
}

/** POST /api/project-topics — coordinator creates a topic or triggers recalculate */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'COORDINATOR' && user.role !== 'SUPERVISOR') {
      return NextResponse.json({ message: 'Only coordinators can manage project topics.' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body as { action: string };
    const term = await getActiveTerm();
    if (!term) return NextResponse.json({ message: 'No active academic term.' }, { status: 404 });

    if (action === 'recalculate_conflicts') {
      const conflicts = await recalculateConflicts(term.id);
      log.info('project-topics.conflicts.recalculated', { userId: user.id, termId: term.id, count: conflicts.length });
      return NextResponse.json({ conflicts });
    }

    if (action === 'create_topic') {
      if (user.role !== 'COORDINATOR') {
        return NextResponse.json({ message: 'Only coordinators can create topics.' }, { status: 403 });
      }
      const topic = await createProjectTopic(term.id, { ...body as CreateTopicInput, createdById: user.id });
      log.info('project-topics.created', { userId: user.id, topicId: topic.id });
      return NextResponse.json({ topic });
    }

    return NextResponse.json({ message: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    log.error('project-topics.failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Failed.' }, { status: 500 });
  }
}
