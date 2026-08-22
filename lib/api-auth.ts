/**
 * Secure session helpers for API route handlers.
 *
 * Use these instead of requireAuth() (which calls redirect() and can cause
 * NEXT_REDIRECT errors inside API try/catch blocks) or bare getServerSession()
 * (which requires callers to manually handle the null case every time).
 *
 * Every function returns a structured result so route handlers stay clean:
 *
 *   const auth = await requireApiAuth(req);
 *   if (!auth.ok) return auth.response;
 *   const { user } = auth;  // AuthenticatedUser
 */

import { getServerSession } from 'next-auth/next';
import { NextResponse }      from 'next/server';
import { authOptions }       from '@/lib/auth';
import type { UserRole }     from '@prisma/client';

export type AuthenticatedUser = {
  id:    string;
  email: string;
  name?: string | null;
  role:  UserRole;
};

type AuthOk  = { ok: true;  user: AuthenticatedUser };
type AuthErr = { ok: false; response: NextResponse };
type AuthResult = AuthOk | AuthErr;

/** Require any authenticated session. Returns 401 if unauthenticated. */
export async function requireApiAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }),
    };
  }
  return { ok: true, user: session.user as AuthenticatedUser };
}

/** Require authentication AND one of the allowed roles. Returns 401/403. */
export async function requireApiRole(allowed: UserRole[]): Promise<AuthResult> {
  const result = await requireApiAuth();
  if (!result.ok) return result;

  if (!allowed.includes(result.user.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Access denied. Required role: ${allowed.join(' or ')}.` },
        { status: 403 }
      ),
    };
  }
  return result;
}

/** Coordinator-only shorthand. */
export const requireCoordinator = () => requireApiRole(['COORDINATOR']);

/** Supervisor-only shorthand. */
export const requireSupervisor = () => requireApiRole(['SUPERVISOR']);

/** Staff (SUPERVISOR or COORDINATOR) shorthand. */
export const requireStaff = () => requireApiRole(['SUPERVISOR', 'COORDINATOR']);

/**
 * Assert the authenticated user owns the resource OR is staff.
 * Returns 403 if neither condition holds.
 */
export function assertOwnerOrStaff(
  user: AuthenticatedUser,
  resourceOwnerId: string
): NextResponse | null {
  const isOwner = user.id === resourceOwnerId;
  const isStaff = user.role === 'SUPERVISOR' || user.role === 'COORDINATOR';
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }
  return null;
}
