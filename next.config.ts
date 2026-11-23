import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Type errors now fail the build. Previously suppressed, which meant a broken
  // API route could deploy silently. Run `npm run typecheck` before pushing.
  typescript: {
    ignoreBuildErrors: false,
  },

  poweredByHeader: false,

  // The profile photo was renamed for image search; the old URL is already
  // indexed, so send it on rather than 404.
  async redirects() {
    return [{ source: '/profile.jpg', destination: '/hakkan-shah.jpg', permanent: true }];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // The assistant's voice input needs the mic; nothing else is used.
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
        ],
      },
      {
        // The chat endpoint is dynamic and per-visitor — never let a CDN or
        // browser serve someone else's answer.
        source: '/api/chat',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },

  // react-icons ships one huge barrel per icon set; rewriting the imports to
  // direct paths keeps the ~25 icons we use from dragging the rest in.
  experimental: {
    optimizePackageImports: ['react-icons/si', 'react-icons/di', 'react-icons/fa', 'react-icons/vsc', 'react-icons/fc'],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'github.githubassets.com',
        port: '',
        pathname: '/**',
      },
      {
        // Hosts the Pair Extraordinaire achievement badge.
        protocol: 'https',
        hostname: 'user-images.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;