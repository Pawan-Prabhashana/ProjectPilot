import { getCurrentUser } from '@/lib/auth/session';
import { getAccessibleWorkspacesForUser } from '@/lib/services/workspace-access';
import { SignOutButton } from './sign-out-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { WorkspaceSelector } from './workspace-selector';
import { NotificationBell } from '@/components/notifications/notification-bell';
import type { AuthenticatedUser } from '@/lib/rbac';

function getInitials(name?: string | null, email?: string) {
  if (name) {
    const parts = name.trim().split(' ');
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? '?';
}

const roleLabel: Record<string, string> = {
  STUDENT:     'Student',
  SUPERVISOR:  'Supervisor',
  COORDINATOR: 'Coordinator',
};

const roleColor: Record<string, string> = {
  STUDENT:     'bg-sky-100 text-sky-700',
  SUPERVISOR:  'bg-indigo-100 text-indigo-700',
  COORDINATOR: 'bg-purple-100 text-purple-700',
};

export async function Topbar() {
  const user = await getCurrentUser();
  if (!user) return null;

  const workspaces = await getAccessibleWorkspacesForUser(user as AuthenticatedUser);
  const initials   = getInitials(user.name, user.email ?? undefined);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-card/80 px-4 backdrop-blur-sm">
      {/* Left: Workspace selector */}
      <div className="flex-1 flex items-center">
        <WorkspaceSelector workspaces={workspaces} />
      </div>

      {/* Right: Notifications + identity + sign out */}
      <div className="flex items-center gap-3">
        {/* Notification bell with dropdown (client component with polling) */}
        <NotificationBell />

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* User identity */}
        <div className="flex items-center gap-2.5">
          <Avatar size="sm">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden flex-col sm:flex">
            <span className="text-xs font-medium leading-none text-foreground">
              {user.name ?? user.email}
            </span>
            <span
              className={`mt-0.5 inline-block rounded px-1 py-0.5 text-[10px] font-medium leading-none ${roleColor[user.role] ?? 'bg-muted text-muted-foreground'}`}
            >
              {roleLabel[user.role] ?? user.role}
            </span>
          </div>
        </div>

        {/* Sign out */}
        <SignOutButton />
      </div>
    </header>
  );
}
