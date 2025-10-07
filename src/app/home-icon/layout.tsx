import type { Metadata } from 'next'

// Use timestamp to force cache refresh
const timestamp = Date.now()

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: `/favicon-32x32.png?v=${timestamp}`, sizes: '32x32', type: 'image/png' },
      { url: `/favicon-16x16.png?v=${timestamp}`, sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: `/apple-touch-icon.png?v=${timestamp}`, sizes: '180x180', type: 'image/png' },
      { url: `/apple-touch-icon-precomposed.png?v=${timestamp}`, sizes: '180x180', type: 'image/png' },
    ],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
