import './globals.css'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import Navigation from './components/Navigation'
import MainWrapper from './components/MainWrapper'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
})

// Use build-time timestamp to force cache refresh
const iconVersion = Date.now()

export const metadata = {
  title: 'T&J GYM - ジム予約システム',
  description: 'T&J GYMの予約管理システム',
  icons: {
    icon: [
      { url: `/favicon-16x16.png?v=${iconVersion}`, sizes: '16x16', type: 'image/png' },
      { url: `/favicon-32x32.png?v=${iconVersion}`, sizes: '32x32', type: 'image/png' },
      { url: `/android-chrome-192x192.png?v=${iconVersion}`, sizes: '192x192', type: 'image/png' },
      { url: `/android-chrome-512x512.png?v=${iconVersion}`, sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: `/apple-touch-icon.png?v=${iconVersion}`, sizes: '180x180' },
      { url: `/apple-touch-icon-precomposed.png?v=${iconVersion}`, sizes: '180x180' },
      { url: `/apple-touch-icon-180x180.png?v=${iconVersion}`, sizes: '180x180' },
      { url: `/apple-touch-icon-167x167.png?v=${iconVersion}`, sizes: '167x167' },
      { url: `/apple-touch-icon-152x152.png?v=${iconVersion}`, sizes: '152x152' },
      { url: `/apple-touch-icon-120x120.png?v=${iconVersion}`, sizes: '120x120' },
    ],
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <MainWrapper>
              {children}
            </MainWrapper>
          </div>
        </Providers>
      </body>
    </html>
  )
}
