import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'T&J GYM 予約システム',
    short_name: 'T&J GYM',
    description: 'T&J GYMの予約管理システム',
    display: 'standalone',
    background_color: '#111827',
    theme_color: '#111827',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/favicon-32x32.png', sizes: '32x32', type: 'image/png', purpose: 'any' },
      { src: '/favicon-16x16.png', sizes: '16x16', type: 'image/png', purpose: 'any' },
    ],
  }
}
