import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Routes that require authentication. The dashboard layout handles
// fine-grained role checks; middleware only enforces the auth boundary.
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    if (!token) return;

    // Redirect legacy dashboard paths (from Part 1) to the new unified overview.
    const legacyRedirects: Record<string, string> = {
      '/dashboard/student': '/dashboard/overview',
      '/dashboard/supervisor': '/dashboard/overview',
      '/dashboard/coordinator': '/dashboard/overview',
    };

    if (legacyRedirects[pathname]) {
      const url = req.nextUrl.clone();
      url.pathname = legacyRedirects[pathname];
      return NextResponse.redirect(url);
    }
  },
  {
    callbacks: {
      // Allow the request if a valid JWT exists
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/teams/:path*',
    '/consultations/:path*',
    '/settings/:path*',
  ],
};
