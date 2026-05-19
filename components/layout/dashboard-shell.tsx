import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { hasAnyLeaderCapability } from '@/lib/rbac/team-permissions';

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // For students, check if they are a LEADER or CO_LEADER in any team.
  // This drives the sidebar's leader-only nav items.
  const isLeader =
    user.role === 'STUDENT' ? await hasAnyLeaderCapability(user.id) : false;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Fixed sidebar */}
      <Sidebar role={user.role} isLeader={isLeader} />

      {/* Main area — offset for sidebar on md+ */}
      <div className="flex min-h-screen flex-col md:pl-64">
        <Topbar />
        <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
