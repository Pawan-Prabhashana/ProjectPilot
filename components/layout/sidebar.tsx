'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Brain,
  Users,
  Calendar,
  Settings,
  Menu,
  X,
  ClipboardList,
  BookOpen,
  BarChart3,
  Lightbulb,
  Zap,
  Focus,
  Crown,
  Shield,
  Target,
  TrendingUp,
  Bell,
  Layers,
  GitMerge,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Global roles that see this item */
  roles: string[];
  description: string;
  /** Only shown when isLeader = true (STUDENT + LEADER/CO_LEADER) */
  leaderOnly?: boolean;
};

// ── Navigation definitions ────────────────────────────────────────────────────

const navItems: NavItem[] = [
  // ── STUDENT ──────────────────────────────────────────────────────────────────
  {
    href: '/dashboard/my-work',
    label: 'My Dashboard',
    icon: LayoutDashboard,
    roles: ['STUDENT'],
    description: 'Your personal tasks and support dashboard',
  },
  {
    href: '/dashboard/tasks',
    label: 'Tasks',
    icon: ClipboardList,
    roles: ['STUDENT'],
    description: 'Smart task board and tracking',
  },
  {
    href: '/dashboard/team',
    label: 'Team Workspace',
    icon: Users,
    roles: ['STUDENT'],
    description: 'Members, roles, and collaboration',
  },
  {
    href: '/dashboard/project-brain',
    label: 'Project Brain',
    icon: Brain,
    roles: ['STUDENT'],
    description: 'Decisions, questions, and memory',
  },
  {
    href: '/dashboard/contributions',
    label: 'Contributions',
    icon: BarChart3,
    roles: ['STUDENT'],
    description: 'Contribution overview and balance',
  },
  {
    href: '/dashboard/consultations',
    label: 'Consultations',
    icon: Calendar,
    roles: ['STUDENT'],
    description: 'Book and manage supervisor meetings',
  },
  {
    href: '/dashboard/cognitive-profile',
    label: 'Support Profile',
    icon: Lightbulb,
    roles: ['STUDENT'],
    description: 'Cognitive preferences and accessibility',
  },
  {
    href: '/dashboard/support-tools',
    label: 'Support Tools',
    icon: Focus,
    roles: ['STUDENT'],
    description: 'Focus mode, low-energy mode, and communication tools',
  },
  {
    href: '/dashboard/notifications',
    label: 'Notifications',
    icon: Bell,
    roles: ['STUDENT'],
    description: 'Your notification centre',
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['STUDENT'],
    description: 'Accessibility and notification preferences',
  },

  {
    href: '/dashboard/student/formation-profile',
    label: 'Formation Profile',
    icon: Target,
    roles: ['STUDENT'],
    description: 'Skills, availability, capacity, and support preferences',
  },
  {
    href: '/dashboard/student/project-preferences',
    label: 'Project Preferences',
    icon: BookOpen,
    roles: ['STUDENT'],
    description: 'Rank preferred capstone topics',
  },

  // ── STUDENT LEADER-ONLY ───────────────────────────────────────────────────
  {
    href: '/dashboard/leader',
    label: 'Leader Dashboard',
    icon: Crown,
    roles: ['STUDENT'],
    description: 'Team leadership tools and planning',
    leaderOnly: true,
  },
  {
    href: '/dashboard/team-insights',
    label: 'Team Insights',
    icon: TrendingUp,
    roles: ['STUDENT'],
    description: 'Health signals, ambiguity, and team intelligence',
    leaderOnly: true,
  },

  // ── SUPERVISOR ────────────────────────────────────────────────────────────
  {
    href: '/dashboard/supervisor',
    label: 'Supervisor Dashboard',
    icon: LayoutDashboard,
    roles: ['SUPERVISOR'],
    description: 'Assigned teams, consultation queue, and attention items',
  },
  {
    href: '/dashboard/supervisor-workspace',
    label: 'Supervised Teams',
    icon: BookOpen,
    roles: ['SUPERVISOR'],
    description: 'Team oversight and feedback tools',
  },
  {
    href: '/dashboard/consultations',
    label: 'Consultations',
    icon: Calendar,
    roles: ['SUPERVISOR'],
    description: 'Book and manage supervisor meetings',
  },
  {
    href: '/dashboard/project-brain',
    label: 'Project Brain',
    icon: Brain,
    roles: ['SUPERVISOR'],
    description: 'Team decisions, questions, and memory',
  },
  {
    href: '/dashboard/notifications',
    label: 'Notifications',
    icon: Bell,
    roles: ['SUPERVISOR'],
    description: 'Your notification centre',
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['SUPERVISOR'],
    description: 'Accessibility and notification preferences',
  },

  // ── COORDINATOR ───────────────────────────────────────────────────────────
  {
    href: '/dashboard/coordinator',
    label: 'Coordinator Dashboard',
    icon: Shield,
    roles: ['COORDINATOR'],
    description: 'Team formation control centre and platform overview',
  },
  {
    href: '/dashboard/team-management',
    label: 'Team Management',
    icon: Users,
    roles: ['COORDINATOR'],
    description: 'Operational team overview and formation foundation',
  },
  {
    href: '/dashboard/supervisor-management',
    label: 'Supervisor Management',
    icon: BookOpen,
    roles: ['COORDINATOR'],
    description: 'Supervisor capacity and team coverage overview',
  },
  {
    href: '/dashboard/coordinator/formation-setup',
    label: 'Formation Setup',
    icon: Layers,
    roles: ['COORDINATOR'],
    description: 'Academic terms, student intake, and formation batches',
  },
  {
    href: '/dashboard/coordinator/project-topics',
    label: 'Project Topics',
    icon: BookOpen,
    roles: ['COORDINATOR'],
    description: 'Catalogue, demand, and selection conflicts',
  },
  {
    href: '/dashboard/coordinator/team-formation',
    label: 'Team Formation',
    icon: GitMerge,
    roles: ['COORDINATOR'],
    description: 'Review, adjust, and publish draft teams',
  },
  {
    href: '/dashboard/consultations',
    label: 'Consultations',
    icon: Calendar,
    roles: ['COORDINATOR'],
    description: 'View all consultation bookings',
  },
  {
    href: '/dashboard/notifications',
    label: 'Notifications',
    icon: Bell,
    roles: ['COORDINATOR'],
    description: 'Your notification centre',
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['COORDINATOR'],
    description: 'Accessibility and notification preferences',
  },
];

type SidebarProps = {
  role: string;
  /** True if the student is a LEADER or CO_LEADER in any team */
  isLeader?: boolean;
};

export function Sidebar({ role, isLeader = false }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Deduplicate by href so the same href only appears once
  const seen = new Set<string>();
  const visible = navItems.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (item.leaderOnly && !isLeader) return false;
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });

  const roleIndicatorColor = {
    STUDENT: isLeader ? 'bg-amber-500' : 'bg-sky-500',
    SUPERVISOR: 'bg-indigo-500',
    COORDINATOR: 'bg-purple-500',
  }[role] ?? 'bg-muted-foreground';

  const roleIndicatorLabel = {
    STUDENT: isLeader ? 'Student · Team Leader' : 'Student',
    SUPERVISOR: 'Supervisor',
    COORDINATOR: 'Coordinator',
  }[role] ?? role;

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed left-4 top-3.5 z-50 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-border bg-card transition-transform duration-200 ease-in-out md:translate-x-0',
          mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link
            href="/dashboard/overview"
            className="flex items-center gap-2 font-semibold text-foreground transition-opacity hover:opacity-80"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span>ProjectPilot</span>
            <span className="rounded bg-secondary/15 px-1.5 py-0.5 text-[10px] font-semibold text-secondary">
              Neuro
            </span>
          </Link>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3"
          aria-label="Main navigation"
        >
          {role === 'STUDENT' && isLeader && (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
              <p className="text-[10px] font-semibold text-amber-700 flex items-center gap-1.5">
                <Crown className="h-3 w-3" />
                Leader tools available
              </p>
              <p className="text-[10px] text-amber-600 mt-0.5">
                You have leader access in at least one team.
              </p>
            </div>
          )}

          {visible.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={item.description}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  item.leaderOnly && !isActive
                    ? 'border border-amber-200/60 hover:border-amber-300/60'
                    : ''
                )}
              >
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform duration-150',
                    isActive
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground group-hover:text-foreground',
                    !isActive && 'group-hover:scale-110'
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {item.leaderOnly && !isActive && (
                  <Crown className="h-3 w-3 text-amber-400 shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Role / capability indicator */}
        <div className="border-t px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <div className={cn('h-2 w-2 rounded-full', roleIndicatorColor)} />
            <span className="text-xs font-medium text-muted-foreground">
              {roleIndicatorLabel}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
