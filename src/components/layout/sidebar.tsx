'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDevRole } from '@/components/providers/dev-role-provider';
import { siteConfig } from '@/config/site';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export function Sidebar(): JSX.Element {
  const pathname = usePathname();
  const { role } = useDevRole();

  const items: NavItem[] =
    role === 'SUPERVISOR'
      ? [{ href: '/supervisor', label: 'Supervisor deck', icon: LayoutDashboard }]
      : [{ href: '/student', label: 'My sprint', icon: ListTodo }];

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="border-b px-4 py-4">
        <Link href="/" className="text-sm font-semibold">
          {siteConfig.name}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">Flight decks</p>
      </div>
      <nav className="flex flex-col gap-1 p-3" aria-label="Dashboard">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
