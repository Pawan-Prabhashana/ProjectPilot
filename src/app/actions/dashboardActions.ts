'use server';

import { failure, success, type Result } from '@/lib/types';
import type {
  StudentWorkspace,
  SupervisorOverviewStats,
  SupervisorTeamRow,
} from '@/lib/types/domain';
import { DomainError } from '@/server/services/team.service';
import {
  getStudentWorkspace,
  getSupervisorOverview,
} from '@/server/services/dashboard.service';

function toResult<T>(error: unknown): Result<T> {
  if (error instanceof DomainError) {
    return failure(error.message);
  }
  return failure('An unexpected error occurred.');
}

export async function getSupervisorOverviewAction(): Promise<
  Result<{ stats: SupervisorOverviewStats; teams: SupervisorTeamRow[] }>
> {
  try {
    const data = await getSupervisorOverview();
    return success(data);
  } catch (error: unknown) {
    return toResult(error);
  }
}

export async function getStudentWorkspaceAction(): Promise<Result<StudentWorkspace>> {
  try {
    const data = await getStudentWorkspace();
    return success(data);
  } catch (error: unknown) {
    return toResult(error);
  }
}
