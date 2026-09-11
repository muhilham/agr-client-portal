import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.agroastery.com',
        pathname: '/products/**',
      },
    ],
  },
}

export default nextConfig
