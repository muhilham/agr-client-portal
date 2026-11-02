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
      {
        protocol: 'https',
        hostname: 'cdn.agroastery.com',
        pathname: '/produk/**',
      },
    ],
  },
}

export default nextConfig
