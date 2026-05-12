import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  exportPathMap: async function() {
    return {}
  },
}

export default nextConfig