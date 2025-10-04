/** @type {import('next').NextConfig} */
const baseConfig = {
  // Force cache busting
  generateEtags: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ]
  },
}

// Enable bundle analyzer when ANALYZE=true
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
  analyzerMode: 'static',
  reportFilename: '.next/analyze/client.html',
  generateStatsFile: true,
  statsFilename: '.next/analyze/stats.json',
})

module.exports = withBundleAnalyzer(baseConfig)
