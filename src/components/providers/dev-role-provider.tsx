'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type DevRole = 'STUDENT' | 'SUPERVISOR';

const STORAGE_KEY = 'projectpilot-dev-role';

interface DevRoleContextValue {
  role: DevRole;
  setRole: (role: DevRole) => void;
}

const DevRoleContext = createContext<DevRoleContextValue | null>(null);

export function DevRoleProvider({ children }: { children: ReactNode }): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRoleState] = useState<DevRole>('STUDENT');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'STUDENT' || stored === 'SUPERVISOR') {
      setRoleState(stored);
    }
  }, []);

  const setRole = useCallback(
    (next: DevRole): void => {
      setRoleState(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      const target = next === 'SUPERVISOR' ? '/supervisor' : '/student';
      if (pathname !== target) {
        router.push(target);
      }
    },
    [pathname, router],
  );

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);

  return <DevRoleContext.Provider value={value}>{children}</DevRoleContext.Provider>;
}

export function useDevRole(): DevRoleContextValue {
  const context = useContext(DevRoleContext);
  if (!context) {
    throw new Error('useDevRole must be used within DevRoleProvider.');
  }
  return context;
}
