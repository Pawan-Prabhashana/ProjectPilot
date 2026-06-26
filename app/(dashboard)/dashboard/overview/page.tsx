/**
 * /dashboard/overview — role-based landing page.
 *
 * Role routing is handled entirely in middleware.ts so we never call
 * redirect() inside a server component during a post-login navigation
 * (which triggers the Next.js App Router cache bug).
 *
 * This page is kept as a minimal fallback in case middleware is bypassed.
 */
export default function OverviewPage() {
  return null;
}
