'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 mb-4">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <h2 className="text-base font-semibold text-red-900">Failed to load this page</h2>
      <p className="mt-1.5 max-w-xs text-sm text-red-700/80">
        {error.message || 'An unexpected error occurred. Your data is safe.'}
      </p>
      <button
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  );
}
