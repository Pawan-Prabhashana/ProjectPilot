'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  getStudentWorkspaceAction,
  getSupervisorOverviewAction,
} from '@/app/actions/dashboardActions';
import { isSuccess, type Result } from '@/lib/types';
import type {
  StudentWorkspace,
  SupervisorOverviewStats,
  SupervisorTeamRow,
} from '@/lib/types/domain';

function unwrapResult<T>(result: Result<T>): T {
  if (!isSuccess(result)) {
    throw new Error(result.error ?? 'Request failed.');
  }
  return result.data;
}

export function useStudentWorkspace(): UseQueryResult<StudentWorkspace, Error> {
  return useQuery({
    queryKey: ['workspace', 'student'],
    queryFn: async (): Promise<StudentWorkspace> => unwrapResult(await getStudentWorkspaceAction()),
  });
}

export function useSupervisorOverview(): UseQueryResult<
  { stats: SupervisorOverviewStats; teams: SupervisorTeamRow[] },
  Error
> {
  return useQuery({
    queryKey: ['workspace', 'supervisor'],
    queryFn: async () => unwrapResult(await getSupervisorOverviewAction()),
  });
}
