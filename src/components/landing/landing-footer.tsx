import { siteConfig } from "@/config/site";

export function LandingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground sm:px-6">
        {siteConfig.name} — Phase 1 foundation
      </div>
    </footer>
  );
}
