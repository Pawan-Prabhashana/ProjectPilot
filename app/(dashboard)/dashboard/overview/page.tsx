import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/rbac';

/**
 * /dashboard/overview — smart landing page.
 *
 * Immediately redirects each role to their primary dashboard while
 * preserving the teamId query parameter so workspace context is not lost.
 *
 * STUDENT      → /dashboard/my-work
 * SUPERVISOR   → /dashboard/supervisor
 * COORDINATOR  → /dashboard/coordinator
 */
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const user = await requireAuth();
  const { teamId } = await searchParams;

  const params = teamId ? `?teamId=${teamId}` : '';

  if (user.role === 'SUPERVISOR') {
    redirect(`/dashboard/supervisor`);
  }

  if (user.role === 'COORDINATOR') {
    redirect(`/dashboard/coordinator`);
  }

  // STUDENT (default)
  redirect(`/dashboard/my-work${params}`);
}
