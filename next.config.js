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
    formats: ['image/avif', 'image/webp'],
  },

  // optimizePackageImports faz tree-shaking seguro nas libs grandes.
  // (modularizeImports manual para supabase-js foi removido: estava
  // mapeando pra um caminho que nem todas as versoes do SDK expoem.)
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js', '@supabase/ssr'],
  },

  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      {
        source: '/dashboard/:path*',
        headers: [
          // Dashboard contem dados privados — nao cacheia em proxies/CDN
          { key: 'Cache-Control', value: 'private, no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/image(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
