import type { ReactNode } from 'react';
import { DevRoleProvider } from '@/components/providers/dev-role-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { TopNav } from '@/components/layout/top-nav';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DevRoleProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </DevRoleProvider>
  );
}
