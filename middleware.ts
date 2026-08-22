import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

// ── Rate limit budgets ─────────────────────────────────────────────────────
//  login:    10 attempts / 15 min per IP  (brute-force protection)
//  register: 5 attempts / 60 min per IP   (account spam protection)
//  api:      120 requests / 60 s per IP   (general API abuse protection)
const RATE_LIMITS = {
  login:    { limit: 10,  windowMs: 15 * 60 * 1000 },
  register: { limit: 5,   windowMs: 60 * 60 * 1000 },
  api:      { limit: 120, windowMs: 60 * 1000       },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

function rateLimitResponse(retryAfterMs: number): NextResponse {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return NextResponse.json(
    { error: 'Too many requests. Please wait before trying again.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(retryAfterSec),
      },
    }
  );
}

// ── Security headers (applied to every response) ─────────────────────────
//
// CSP note: 'unsafe-inline' on script-src is required by Next.js inline
// hydration scripts. In production, swap to a nonce-based policy once
// Next.js supports it natively. 'unsafe-eval' is removed for production.
//
// HSTS: only sent over HTTPS (Vercel / any TLS terminator).

const IS_PROD = process.env.NODE_ENV === 'production';

function addSecurityHeaders(res: NextResponse): NextResponse {
  const cspDirectives = [
    "default-src 'self'",
    IS_PROD
      ? "script-src 'self' 'unsafe-inline'"          // no unsafe-eval in prod
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // needed for HMR in dev
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",                         // blocks clickjacking
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  res.headers.set('Content-Security-Policy', cspDirectives);
  // X-Frame-Options is superseded by CSP frame-ancestors — keep for legacy browsers
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-DNS-Prefetch-Control', 'on');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // HSTS: only useful over HTTPS — ignored by browsers on HTTP
  if (IS_PROD) {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  return res;
}

// ── Core middleware ───────────────────────────────────────────────────────

async function applyRateLimiting(req: NextRequest): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req);

  // Auth endpoint rate limits (applied before authentication checks)
  if (req.method === 'POST' && pathname === '/api/auth/callback/credentials') {
    const { allowed, retryAfterMs } = await checkRateLimit(
      ip, 'login', RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs
    );
    if (!allowed) return rateLimitResponse(retryAfterMs);
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const { allowed, retryAfterMs } = await checkRateLimit(
      ip, 'register', RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs
    );
    if (!allowed) return rateLimitResponse(retryAfterMs);
  }

  // General API rate limit
  if (pathname.startsWith('/api/') &&
      pathname !== '/api/auth/session' &&
      pathname !== '/api/auth/csrf') {
    const { allowed, retryAfterMs } = await checkRateLimit(
      ip, 'api', RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs
    );
    if (!allowed) return rateLimitResponse(retryAfterMs);
  }

  return null;
}

// ── withAuth wraps authenticated dashboard/page routes ────────────────────

export default withAuth(
  async function middleware(req) {
    // 1. Rate limiting
    const rateLimitResult = await applyRateLimiting(req);
    if (rateLimitResult) return addSecurityHeaders(rateLimitResult);

    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    if (!token) {
      const res = NextResponse.next();
      return addSecurityHeaders(res);
    }

    // 2. Role-based redirects for the generic /dashboard/overview landing
    if (pathname === '/dashboard/overview') {
      const url = req.nextUrl.clone();
      const role = token.role as string | undefined;
      if (role === 'COORDINATOR') url.pathname = '/dashboard/coordinator';
      else if (role === 'SUPERVISOR') url.pathname = '/dashboard/supervisor';
      else url.pathname = '/dashboard/my-work';
      const res = NextResponse.redirect(url);
      return addSecurityHeaders(res);
    }

    if (pathname === '/dashboard/student') {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard/my-work';
      const res = NextResponse.redirect(url);
      return addSecurityHeaders(res);
    }

    const res = NextResponse.next();
    return addSecurityHeaders(res);
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    // Authenticated page routes
    '/dashboard/:path*',
    '/projects/:path*',
    '/teams/:path*',
    '/consultations/:path*',
    '/settings/:path*',
    // API routes — rate limiting applied here, auth checked per-handler
    '/api/:path*',
  ],
};
