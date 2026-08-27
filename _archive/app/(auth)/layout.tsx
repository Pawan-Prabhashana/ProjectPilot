import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold text-white">
        <Zap className="h-5 w-5 text-sky-400" />
        ProjectPilot
        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-xs font-semibold text-sky-300">
          Neuro
        </span>
      </Link>
      {children}
    </div>
  );
}
