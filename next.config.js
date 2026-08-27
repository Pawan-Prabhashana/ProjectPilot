/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Security headers are set dynamically in middleware.ts so they can be
  // environment-aware (e.g. HSTS only in prod, relaxed CSP in dev).
  // next.config.js headers() is kept only for static-file routes that bypass
  // middleware (/_next/static, /public assets).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // X-Frame-Options DENY — defence-in-depth alongside CSP frame-ancestors
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  // Never expose Next.js version to clients
  poweredByHeader: false,
};

module.exports = nextConfig;
