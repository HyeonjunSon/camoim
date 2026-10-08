import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The repo root, not web/. src/lib/legal.ts imports the app's
  // src/constants/legal.js directly so the terms shown here are the same text
  // the app shows; that import only resolves while the root spans both.
  turbopack: { root: path.resolve(import.meta.dirname, '..') },
  // Post images and avatars all live on Cloudinary (see CLAUDE.md — local disk storage is banned).
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The session cookie is the whole auth story here, so framing is denied outright.
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
