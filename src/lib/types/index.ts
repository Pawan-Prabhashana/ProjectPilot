export type Result<T> = {
  data?: T;
  error?: string;
};

export function success<T>(data: T): Result<T> {
  return { data };
}

export function failure<T = never>(error: string): Result<T> {
  return { error };
}

export function isSuccess<T>(result: Result<T>): result is { data: T; error?: undefined } {
  return result.error === undefined && result.data !== undefined;
}

export * from './domain';
