import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Routes that require authentication. The dashboard layout handles
// fine-grained role checks; middleware only enforces the auth boundary
// and handles the role-based landing page routing.
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    if (!token) return;

    // Redirect /dashboard/overview to the role-appropriate dashboard.
    // Doing this in middleware avoids the Next.js App Router cache bug
    // that occurs when redirect() is called inside a server component
    // during a post-login client-side navigation.
    if (pathname === '/dashboard/overview') {
      const url = req.nextUrl.clone();
      const role = token.role as string | undefined;
      if (role === 'COORDINATOR') {
        url.pathname = '/dashboard/coordinator';
        return NextResponse.redirect(url);
      }
      if (role === 'SUPERVISOR') {
        url.pathname = '/dashboard/supervisor';
        return NextResponse.redirect(url);
      }
      // STUDENT: redirect to /dashboard/my-work
      url.pathname = '/dashboard/my-work';
      // preserve teamId param if present
      return NextResponse.redirect(url);
    }

    // Redirect the legacy /dashboard/student path (no longer used).
    if (pathname === '/dashboard/student') {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard/my-work';
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
