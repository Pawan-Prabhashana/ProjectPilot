/**
 * Simple sliding-window rate limiter for Next.js Edge middleware.
 *
 * Uses an in-process Map keyed by IP + action. Sufficient for single-instance
 * deployments and development. For multi-instance / Vercel production at scale,
 * swap the store for Upstash Redis (@upstash/ratelimit).
 *
 * Privacy: IPs are hashed (SHA-256) before storage so raw IPs are never held
 * in memory longer than the window.
 */

type RateLimitEntry = { count: number; resetAt: number };
const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes to avoid unbounded memory growth.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  for (const [key, entry] of Array.from(store.entries())) {
    if (entry.resetAt < now) store.delete(key);
  }
  lastCleanup = now;
}

async function hashKey(ip: string, action: string): Promise<string> {
  const data = new TextEncoder().encode(`${action}:${ip}`);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function checkRateLimit(
  ip: string,
  action: string,
  /** Maximum requests allowed in the window */
  limit: number,
  /** Window duration in milliseconds */
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  cleanup();

  const key  = await hashKey(ip, action);
  const now  = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 };
}
