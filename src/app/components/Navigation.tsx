'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Navigation() {
  const { data: session, status } = useSession()
  const router = useRouter()

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
          
          <nav className="flex items-center space-x-4">
            {status === 'loading' ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ) : session ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  ダッシュボード
                </Link>
                {session?.user?.role === 'ADMIN' && (
                  <>
                    <Link
                      href="/admin/reservations/new"
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      新規予約作成
                    </Link>
                    <Link
                      href="/admin/members"
                      className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      会員管理
                    </Link>
                  </>
                )}
                <Link
                  href="/reservations"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {session.user.role === 'ADMIN' ? '予約管理' : 'マイ予約'}
                </Link>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">
                    {session.user.name}さん
                  </span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                    session.user.role === 'ADMIN' 
                      ? 'bg-purple-50 text-purple-700 border-purple-200' 
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {session.user.role === 'ADMIN' ? '管理者' : '会員'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
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
        </div>
      </div>
    </header>
  )
}
