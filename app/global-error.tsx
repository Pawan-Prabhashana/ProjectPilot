'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center font-sans">
        <div className="max-w-md w-full">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 mb-6 mx-auto">
            <svg
              className="h-7 w-7 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Application error</h1>
          {error.message && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left">
              <p className="text-xs font-semibold text-red-700 mb-1">Error details:</p>
              <p className="text-xs text-red-600 font-mono break-all">{error.message}</p>
              {error.digest && (
                <p className="text-[10px] text-red-500 mt-1">Digest: {error.digest}</p>
              )}
            </div>
          )}
          <p className="mt-3 text-sm text-gray-500">
            An unexpected error occurred. Check the browser console for the full stack trace.
          </p>
          <button
            onClick={reset}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
