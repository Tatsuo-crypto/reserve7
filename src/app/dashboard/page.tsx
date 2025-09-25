'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <Link
              href="/admin/reservations"
              className="group bg-white hover:bg-gray-50 border border-gray-200 p-4 sm:p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 min-h-[140px] flex flex-col"
            >
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="bg-blue-500 p-2 sm:p-3 rounded-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6m-6 0a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-4" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2 whitespace-nowrap">予約管理</h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">全ての予約の確認・管理</p>
              </div>
            </Link>

            <Link
              href="/admin/reservations/new"
              className="group bg-white hover:bg-gray-50 border border-gray-200 p-4 sm:p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 min-h-[140px] flex flex-col"
            >
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="bg-green-500 p-2 sm:p-3 rounded-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2 whitespace-nowrap">新規予約作成</h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">新しい予約を作成</p>
              </div>
            </Link>

            <Link
              href="/admin/members"
              className="group bg-white hover:bg-gray-50 border border-gray-200 p-4 sm:p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 min-h-[140px] flex flex-col sm:col-span-2 lg:col-span-1"
            >
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="bg-purple-500 p-2 sm:p-3 rounded-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2 whitespace-nowrap">会員管理</h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">会員情報の管理</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

    </div>
  )
}

function ClientDashboard() {
  const router = useRouter()
  const { data: session } = useSession()
  const [userInfo, setUserInfo] = useState<{plan?: string, status?: string, monthlyUsage?: {currentCount: number, maxCount: number, planName: string}}>({})
  const [reservations, setReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reservationsLoading, setReservationsLoading] = useState(true)

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/user/profile')
        if (response.ok) {
          const result = await response.json()
          setUserInfo(result.data || result)
        } else {
          // If API fails, show default plan without usage info
          setUserInfo({ plan: '月4回', status: 'active' })
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error)
        // Fallback to default values
        setUserInfo({ plan: '月4回', status: 'active' })
      } finally {
        setLoading(false)
      }
    }

    const fetchReservations = async () => {
      try {
        const response = await fetch('/api/user/reservations')
        if (response.ok) {
          const result = await response.json()
          setReservations(result.data?.reservations || [])
        }
      } catch (error) {
        console.error('Failed to fetch reservations:', error)
      } finally {
        setReservationsLoading(false)
      }
    }

    if (session?.user) {
      fetchUserInfo()
      fetchReservations()
    } else {
      setLoading(false)
      setReservationsLoading(false)
    }
  }, [session])

  return (
    <div className="space-y-6">
      {/* ユーザー情報カード */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            会員情報
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="bg-blue-500 p-2 rounded-lg mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800">現在のプラン</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {loading ? '読み込み中...' : (
                      userInfo.monthlyUsage 
                        ? `${userInfo.monthlyUsage.planName} (${userInfo.monthlyUsage.currentCount}/${userInfo.monthlyUsage.maxCount})`
                        : (userInfo.plan || '月4回')
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="bg-green-500 p-2 rounded-lg mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">ステータス</p>
                  <p className="text-lg font-semibold text-green-900">
                    {loading ? '読み込み中...' : (
                      userInfo.status === 'active' ? '在籍' :
                      userInfo.status === 'suspended' ? '休会' :
                      userInfo.status === 'withdrawn' ? '退会' : '在籍'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 予約一覧 */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              マイ予約
            </h2>
          </div>
          
          {reservationsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">読み込み中...</p>
            </div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-8">
              <div className="bg-gray-100 p-3 rounded-lg inline-block mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6m-6 0a2 2 0 00-2-2v10a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-4" />
                </svg>
              </div>
              <p className="text-gray-600">予約がありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map((reservation, index) => {
                // Format date with day of week
                const formatDateWithDay = (dateString: string) => {
                  const date = new Date(dateString)
                  const year = date.getFullYear()
                  const month = String(date.getMonth() + 1).padStart(2, '0')
                  const day = String(date.getDate()).padStart(2, '0')
                  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
                  const dayOfWeek = dayNames[date.getDay()]
                  return `${year}/${month}/${day}(${dayOfWeek})`
                }

                // Extract time from time string (e.g., "12:00 - 13:00" -> "12:00")
                const extractStartTime = (timeString: string) => {
                  return timeString.split(' - ')[0]
                }

                const isFirstReservation = reservation.sequenceNumber === 1

                return (
                  <div 
                    key={reservation.id} 
                    className={`border rounded-lg p-4 transition-all ${
                      isFirstReservation && !reservation.isPast
                        ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-300 shadow-md'
                        : reservation.isPast 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {isFirstReservation && !reservation.isPast && (
                          <div className="flex items-center mb-2">
                            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full mr-2">
                              初回
                            </span>
                            <span className="text-orange-700 text-sm font-medium">
                              体験レッスン
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span className={`font-semibold text-lg ${
                            isFirstReservation && !reservation.isPast
                              ? 'text-orange-800'
                              : reservation.isPast 
                              ? 'text-gray-700' 
                              : 'text-blue-900'
                          }`}>
                            {reservation.sequenceNumber}回目
                          </span>
                          <div className={`font-medium ${
                            isFirstReservation && !reservation.isPast
                              ? 'text-orange-700'
                              : reservation.isPast 
                              ? 'text-gray-600' 
                              : 'text-blue-800'
                          }`}>
                            <span className="block sm:inline">{formatDateWithDay(reservation.date)}</span>
                            <span className="block sm:inline sm:ml-2">{extractStartTime(reservation.time)}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${
                        reservation.isPast 
                          ? 'bg-gray-200 text-gray-700' 
                          : isFirstReservation
                          ? 'bg-orange-200 text-orange-800'
                          : 'bg-blue-200 text-blue-800'
                      }`}>
                        {reservation.isPast ? '完了' : '予約済'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
