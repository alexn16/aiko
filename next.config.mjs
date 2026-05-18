/** @type {import('next').NextConfig} */
const nextConfig = {
  // p-queue v8+ and p-limit v5+ are pure ESM — must be transpiled
  transpilePackages: ['p-queue', 'p-limit', 'eventemitter3', 'yocto-queue'],

  async rewrites() {
    return [
      {
        source: '/screenshots/:path*',
        destination: '/api/screenshots/:path*',
      },
    ]
  },
}

export default nextConfig;
