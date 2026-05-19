/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enables minimal Docker image via `node server.js`
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Security headers applied to all routes
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control',     value: 'on' },
          { key: 'X-Frame-Options',             value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options',      value: 'nosniff' },
          { key: 'Referrer-Policy',             value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',          value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval in dev
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  // Disable powered-by header
  poweredByHeader: false,
};

module.exports = nextConfig;
