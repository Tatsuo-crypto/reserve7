'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading
    if (!session) {
      router.push('/login')
    }
  }, [session, status, router])

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const isAdmin = session.user.role === 'ADMIN'

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg mb-6">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                ダッシュボード
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                ようこそ、{session.user.name}さん
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Role-specific content */}
      {isAdmin ? (
        <AdminDashboard />
      ) : (
        <ClientDashboard />
      )}
    </div>
  )
}

function AdminDashboard() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            管理者機能
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              href="/admin/reservations"
              className="group bg-white hover:bg-gray-50 border border-gray-200 p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center mb-4">
                <div className="bg-blue-500 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6m-6 0a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-4" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">予約管理</h3>
              <p className="text-sm text-gray-600">予約の確認・管理</p>
            </Link>

            <Link
              href="/admin/reservations/new"
              className="group bg-white hover:bg-gray-50 border border-gray-200 p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center mb-4">
                <div className="bg-green-500 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">新規予約作成</h3>
              <p className="text-sm text-gray-600">新しい予約を作成</p>
            </Link>

            <Link
              href="/admin/members"
              className="group bg-white hover:bg-gray-50 border border-gray-200 p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center mb-4">
                <div className="bg-purple-500 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">会員管理</h3>
              <p className="text-sm text-gray-600">会員情報の管理</p>
            </Link>
          </div>
        </div>
      </div>

    </div>
  )
}

function ClientDashboard() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            会員機能
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-gray-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6m-6 0a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-4" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              マイ予約
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              自分の予約一覧を確認
            </p>
            <button
              onClick={() => router.push('/reservations')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              マイ予約を見る
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
