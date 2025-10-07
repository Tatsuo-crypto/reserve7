import './globals.css'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import Navigation from './components/Navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'T&J GYM - ジム予約システム',
  description: 'T&J GYMの予約管理システム',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png?v=6', sizes: '180x180' },
      { url: '/apple-touch-icon-precomposed.png?v=6', sizes: '180x180' },
      { url: '/apple-touch-icon-180x180.png?v=6', sizes: '180x180' },
      { url: '/apple-touch-icon-167x167.png?v=6', sizes: '167x167' },
      { url: '/apple-touch-icon-152x152.png?v=6', sizes: '152x152' },
      { url: '/apple-touch-icon-120x120.png?v=6', sizes: '120x120' },
    ],
  },
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
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
