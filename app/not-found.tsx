import Link from 'next/link';
import { Zap, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0f1e] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/20 mb-6">
        <Zap className="h-7 w-7 text-sky-400" />
      </div>
      <p className="text-sm font-semibold uppercase tracking-widest text-sky-400 mb-2">404</p>
      <h1 className="text-3xl font-bold text-white">Page not found</h1>
      <p className="mt-3 max-w-sm text-white/50">
        The page you&apos;re looking for doesn&apos;t exist or you may not have access to it.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>
    </div>
  );
}
