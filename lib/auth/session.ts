import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { UserRole } from '@prisma/client';

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * All roles land at the same /dashboard/overview route — the page itself
 * is role-aware and renders the appropriate view. This simplifies routing
 * and avoids the confusion of maintaining three separate dashboard URLs.
 */
export function getDashboardPath(_role: UserRole): string {
  return '/dashboard/overview';
}
