import Link from 'next/link';
import { siteConfig } from '@/config/site';

const outlineLinkClass =
  'inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted';
const primaryLinkClass =
  'inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90';

export function LandingHeader() {
  return (
    <header className="border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight text-foreground">
          {siteConfig.name}
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-2">
          <Link href="/student" className={outlineLinkClass}>
            Student deck
          </Link>
          <Link href="/supervisor" className={primaryLinkClass}>
            Supervisor deck
          </Link>
        </nav>
      </div>
    </header>
  );
}
