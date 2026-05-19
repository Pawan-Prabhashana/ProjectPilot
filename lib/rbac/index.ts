/**
 * Role-Based Access Control helpers.
 *
 * These are thin, composable utilities for checking permissions in
 * server actions, route handlers, and server components. They are not
 * middleware replacements — the middleware handles coarse route-level
 * protection; these handle fine-grained resource-level access.
 *
 * Usage:
 *   const user = await requireAuth();
 *   requireRole(user, ['SUPERVISOR', 'COORDINATOR']);
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { UserRole } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
};

/**
 * Returns the current session user or redirects to /login.
 * Use in server components and server actions.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  return session.user as AuthenticatedUser;
}

/**
 * Asserts the user has one of the allowed roles.
 * Throws a structured error rather than redirecting — useful in server actions
 * where the caller should receive an error response, not a redirect.
 */
export function requireRole(user: AuthenticatedUser, allowed: UserRole[]): void {
  if (!allowed.includes(user.role)) {
    throw new Error(`Access denied. Required role: ${allowed.join(' | ')}. Got: ${user.role}`);
  }
}

/**
 * Returns true if the user has the given role. Non-throwing.
 */
export function hasRole(user: AuthenticatedUser, role: UserRole): boolean {
  return user.role === role;
}

/**
 * Returns true if the user is a supervisor or coordinator.
 * Useful for gates that allow both academic staff roles.
 */
export function isStaff(user: AuthenticatedUser): boolean {
  return user.role === 'SUPERVISOR' || user.role === 'COORDINATOR';
}

/**
 * Returns the correct dashboard path for the user's role.
 * Used after login and for breadcrumb navigation.
 */
export function dashboardPathForRole(role: UserRole): string {
  switch (role) {
    case 'STUDENT':
      return '/dashboard/overview';
    case 'SUPERVISOR':
      return '/dashboard/overview';
    case 'COORDINATOR':
      return '/dashboard/overview';
  }
}

/**
 * Verifies that the requesting user owns or has permission over the given
 * resource. This is a generic ownership check — extend for specific models.
 */
export function assertOwnerOrStaff(
  user: AuthenticatedUser,
  resourceOwnerId: string
): void {
  if (user.id !== resourceOwnerId && !isStaff(user)) {
    throw new Error('Access denied: you do not own this resource.');
  }
}
