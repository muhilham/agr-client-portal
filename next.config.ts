import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gvfptjmpmycbfeithgyh.supabase.co',
        pathname: '/storage/v1/object/public/product-images/**',
      },
    ],
  },
}

export default nextConfig
