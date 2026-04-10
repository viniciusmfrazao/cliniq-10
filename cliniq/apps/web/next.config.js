/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@cliniq/ui', '@cliniq/types', '@cliniq/utils'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
}
module.exports = nextConfig
