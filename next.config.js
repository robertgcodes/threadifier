/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist'],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  // Reduce chunk loading issues in development
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      // period (in ms) where the server will keep pages in the buffer
      maxInactiveAge: 25 * 1000,
      // number of pages that should be kept simultaneously without being disposed
      pagesBufferLength: 2,
    },
  }),
}

module.exports = nextConfig 