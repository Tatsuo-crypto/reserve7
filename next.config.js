/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production'

const baseConfig = {
  poweredByHeader: false,
  // 本番ビルドの最適化
  swcMinify: true,
  compress: true,
  // 画像最適化
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30日
  },
  async headers() {
    const headers = [
      // フォントファイルも長期キャッシュ
      {
        source: '/:path*.(woff|woff2|eot|ttf|otf)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // 画像ファイルのキャッシュ
      {
        source: '/:path*.(jpg|jpeg|png|gif|svg|ico|webp|avif)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // APIルートは常に最新データを取得
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ]

    if (isProduction) {
      headers.unshift({
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      })
    }

    return headers
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
