'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getStoreDisplayName } from '@/lib/auth-utils'
import { useState } from 'react'

export default function Navigation() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-xl font-semibold text-gray-900 hover:text-gray-700">
            T&J GYM
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            {status === 'loading' ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ) : session ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors"
                >
                  ダッシュボード
                </Link>
                <Link
                  href="/reservations"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors"
                >
                  {session.user.role === 'ADMIN' ? '予約管理' : 'マイ予約'}
                </Link>
                {session?.user?.role === 'ADMIN' && (
                  <>
                    <Link
                      href="/admin/reservations/new"
                      className="text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors"
                    >
                      新規予約作成
                    </Link>
                    <Link
                      href="/admin/members"
                      className="text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors"
                    >
                      会員管理
                    </Link>
                  </>
                )}
                <div className="bg-white border border-gray-300 px-4 py-2 rounded-lg shadow-sm text-sm flex items-center space-x-3">
                  <span className="text-gray-700 font-medium">
                    {getStoreDisplayName(session.user.email)}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    session.user.role === 'ADMIN' 
                      ? 'bg-green-100 text-green-700 border-green-300' 
                      : 'bg-gray-100 text-gray-700 border-gray-300'
                  }`}>
                    {session.user.role === 'ADMIN' ? '管理者' : '会員'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors border border-red-600"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  ログイン
                </Link>
                <Link
                  href="/register"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  会員登録
                </Link>
              </>
            )}
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
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
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200 bg-white">
            {status === 'loading' ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ) : session ? (
              <>
                <div className="px-3 py-2 border-b border-gray-200 mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-700 font-medium text-sm">
                      {getStoreDisplayName(session.user.email)}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                      session.user.role === 'ADMIN' 
                        ? 'bg-green-100 text-green-700 border-green-300' 
                        : 'bg-gray-100 text-gray-700 border-gray-300'
                    }`}>
                      {session.user.role === 'ADMIN' ? '管理者' : '会員'}
                    </span>
                  </div>
                </div>
                <Link
                  href="/dashboard"
                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  ダッシュボード
                </Link>
                <Link
                  href="/reservations"
                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {session.user.role === 'ADMIN' ? '予約管理' : 'マイ予約'}
                </Link>
                {session?.user?.role === 'ADMIN' && (
                  <>
                    <Link
                      href="/admin/reservations/new"
                      className="text-gray-700 hover:text-gray-900 hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      新規予約作成
                    </Link>
                    <Link
                      href="/admin/members"
                      className="text-gray-700 hover:text-gray-900 hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      会員管理
                    </Link>
                  </>
                )}
                <button
                  onClick={() => {
                    handleLogout()
                    setIsMobileMenuOpen(false)
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 block w-full text-left px-3 py-2 rounded-md text-base font-medium"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  ログイン
                </Link>
                <Link
                  href="/register"
                  className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 block px-3 py-2 rounded-md text-base font-medium"
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
