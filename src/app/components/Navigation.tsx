'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { getStoreDisplayName } from '@/lib/auth-utils'
import { useState } from 'react'

export default function Navigation() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Don't show navigation on client pages and trainer pages
  if (pathname && (pathname.startsWith('/client/') || pathname.startsWith('/trainer/'))) {
    return null
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  return (
    <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/dashboard" className="text-xl sm:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 hover:opacity-80 transition-opacity">
            T&J GYM
          </Link>

          {/* Right side: Admin info + Navigation */}
          <div className="flex items-center space-x-3">
            {session?.user?.role === 'ADMIN' && (
              <div className="md:hidden flex items-center space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 border border-nebula-blue/30 bg-nebula-blue/10 rounded-lg">
                <span className="text-[10px] sm:text-xs font-semibold text-white">
                  {getStoreDisplayName(session.user.email)}
                </span>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-nebula-blue text-white shadow-[0_0_10px_rgba(76,201,240,0.4)]">
                  ADMIN
                </span>
              </div>
            )}

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {status === 'loading' ? (
                <div className="animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-20"></div>
                </div>
              ) : session ? (
                <>
                  <Link href="/dashboard" className="text-gray-300 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200">ホーム</Link>
                  <Link href={session.user.role === 'ADMIN' ? '/admin/reservations' : '/reservations'} className="text-gray-300 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200">予約</Link>
                  {(session?.user?.role === 'ADMIN' || session?.user?.role === 'TRAINER') && (
                    <Link href="/admin/members" className="text-gray-300 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200">会員管理</Link>
                  )}
                  {session?.user?.role === 'ADMIN' && (
                    <>
                      <Link href="/admin/trainers" className="text-gray-300 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200">トレーナー</Link>
                      <Link href="/admin/stores" className="text-gray-300 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200">店舗</Link>
                    </>
                  )}
                  <button
                    onClick={handleLogout}
                    className="ml-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 border border-red-500/30"
                  >
                    ログアウト
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-gray-300 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200"
                  >
                    ログイン
                  </Link>
                  <Link
                    href="/register"
                    className="ml-2 bg-nebula-gradient text-white px-4 py-2 rounded-md text-sm font-bold hover:opacity-90 transition-all duration-200 shadow-[0_0_15px_rgba(67,97,238,0.3)]"
                  >
                    会員登録
                  </Link>
                </>
              )}
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-white/10 focus:outline-none transition-colors"
              aria-expanded="false"
            >
              <span className="sr-only">メニューを開く</span>
              {/* Hamburger icon */}
              <svg
                className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              {/* Close icon */}
              <svg
                className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-white/10 bg-space-black/95 backdrop-blur-xl absolute left-0 right-0 shadow-xl">
            {status === 'loading' ? (
              <div className="animate-pulse p-4">
                <div className="h-4 bg-white/10 rounded w-20"></div>
              </div>
            ) : session ? (
              <>
                <Link href="/dashboard" className="text-gray-300 hover:text-white hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>ホーム</Link>
                <Link href={session.user.role === 'ADMIN' ? '/admin/reservations' : '/reservations'} className="text-gray-300 hover:text-white hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>予約</Link>
                {(session?.user?.role === 'ADMIN' || session?.user?.role === 'TRAINER') && (
                  <Link href="/admin/members" className="text-gray-300 hover:text-white hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>会員管理</Link>
                )}
                {session?.user?.role === 'ADMIN' && (
                  <>
                    <Link href="/admin/sales" className="text-gray-300 hover:text-white hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>売上管理</Link>
                    <Link href="/admin/trainers" className="text-gray-300 hover:text-white hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>トレーナー</Link>
                    <Link href="/admin/stores" className="text-gray-300 hover:text-white hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>店舗</Link>
                  </>
                )}
                <button
                  onClick={() => {
                    handleLogout()
                    setIsMobileMenuOpen(false)
                  }}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 block w-full text-left px-3 py-2 rounded-md text-base font-medium"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-300 hover:text-white hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  ログイン
                </Link>
                <Link
                  href="/register"
                  className="text-nebula-blue hover:text-nebula-purple hover:bg-white/5 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  会員登録
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
