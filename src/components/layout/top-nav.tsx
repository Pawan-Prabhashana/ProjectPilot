'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDevRole, type DevRole } from '@/components/providers/dev-role-provider';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<DevRole, string> = {
  STUDENT: 'Student',
  SUPERVISOR: 'Supervisor',
};

export function TopNav(): JSX.Element {
  const { role, setRole } = useDevRole();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <p className="text-sm text-muted-foreground">Development role switcher</p>
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            View as {ROLE_LABEL[role]}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Switch role</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setRole('STUDENT')}>Student</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setRole('SUPERVISOR')}>Supervisor</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Avatar>
          <AvatarFallback>{role === 'SUPERVISOR' ? 'SV' : 'ST'}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
