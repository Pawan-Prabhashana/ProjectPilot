import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { EVENT_VISIBILITY } from '@/lib/events/types';

/**
 * GET /api/events
 *
 * Returns recent ActivityLog events visible to the authenticated user.
 *
 * Access rules:
 *   STUDENT    — only events for teams they belong to
 *   SUPERVISOR — only events for their supervised teams (via SupervisorProfile)
 *   COORDINATOR — all events (or system-level)
 *
 * Query params:
 *   teamId    — filter to a specific team
 *   projectId — filter to a specific project
 *   limit=20  — max items (default 20, max 50)
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const url = new URL(req.url);
  const teamIdParam    = url.searchParams.get('teamId') ?? undefined;
  const projectIdParam = url.searchParams.get('projectId') ?? undefined;
  const rawLimit       = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const limit          = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 50);

  // Resolve which teamIds this user can see
  let allowedTeamIds: string[] | undefined;

  if (user.role === 'STUDENT') {
    const memberships = await prisma.teamMember.findMany({
      where:  { userId: user.id },
      select: { teamId: true },
    });
    allowedTeamIds = memberships.map((m) => m.teamId);

    // If a specific teamId was requested, validate it belongs to allowed list
    if (teamIdParam && !allowedTeamIds.includes(teamIdParam)) {
      return NextResponse.json({ events: [] }); // access denied — silent empty
    }
  } else if (user.role === 'SUPERVISOR') {
    const profile = await prisma.supervisorProfile.findUnique({
      where:   { userId: user.id },
      include: { supervisedTeams: { select: { id: true } } },
    });
    allowedTeamIds = profile?.supervisedTeams.map((t) => t.id) ?? [];

    if (teamIdParam && !allowedTeamIds.includes(teamIdParam)) {
      return NextResponse.json({ events: [] }); // access denied
    }
  }
  // COORDINATOR: no restriction on teamIds

  // Build where clause
  const where = {
    // Exclude PRIVATE events from the feed (those are internal signals)
    visibility: { not: EVENT_VISIBILITY.PRIVATE },
    ...(teamIdParam
      ? { teamId: teamIdParam }
      : allowedTeamIds !== undefined
        ? { teamId: { in: allowedTeamIds } }
        : {}),
    ...(projectIdParam ? { projectId: projectIdParam } : {}),
  };

  const events = await prisma.activityLog.findMany({
    where,
    select: {
      id:        true,
      action:    true,
      title:     true,
      message:   true,
      teamId:    true,
      projectId: true,
      entity:    true,
      entityId:  true,
      createdAt: true,
      user: {
        select: { id: true, name: true, role: true },
      },
      team:    { select: { name: true } },
      project: { select: { title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({ events });
}
