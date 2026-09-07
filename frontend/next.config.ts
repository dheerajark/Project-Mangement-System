import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['lmh584fz-3001.inc1.devtunnels.ms'],
  async rewrites() {
    return [
      {
        source: '/backend-api/:path*',
        destination: 'http://localhost:3000/:path*',
      },
    ];
  },
};

export default nextConfig;
