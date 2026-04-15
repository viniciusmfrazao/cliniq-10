/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js'],
  },
  
  // Compression
  compress: true,
  
  // Headers for caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
        ],
      },
      {
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  
  // Reduce bundle size
  modularizeImports: {
    '@supabase/supabase-js': {
      transform: '@supabase/supabase-js/dist/module/{{member}}',
    },
  },
}
module.exports = nextConfig
