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
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* 会員管理 */}
          <Link
            href="/admin/members"
            className="group bg-gradient-to-br from-white to-purple-50 hover:from-purple-50 hover:to-purple-100 border border-purple-200 p-6 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col min-h-[160px] transform hover:-translate-y-1"
          >
            <div className="flex items-center mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center group-hover:from-purple-200 group-hover:to-purple-300 transition-all duration-300 shadow-sm">
                <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-800 transition-colors duration-200">会員管理</h3>
              <p className="text-sm text-gray-600 leading-relaxed">会員情報の管理</p>
            </div>
          </Link>


          {/* 新規予約作成 */}
          <Link
            href="/admin/reservations/new"
            className="group bg-gradient-to-br from-white to-green-50 hover:from-green-50 hover:to-green-100 border border-green-200 p-6 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col min-h-[160px] transform hover:-translate-y-1"
          >
            <div className="flex items-center mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center group-hover:from-green-200 group-hover:to-green-300 transition-all duration-300 shadow-sm">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-green-800 transition-colors duration-200">新規予約作成</h3>
              <p className="text-sm text-gray-600 leading-relaxed">新しい予約を作成</p>
            </div>
          </Link>

          {/* 予約一覧 */}
          <Link
            href="/admin/reservations"
            className="group bg-gradient-to-br from-white to-blue-50 hover:from-blue-50 hover:to-blue-100 border border-blue-200 p-6 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col min-h-[160px] transform hover:-translate-y-1"
          >
            <div className="flex items-center mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center group-hover:from-blue-200 group-hover:to-blue-300 transition-all duration-300 shadow-sm">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-800 transition-colors duration-200">予約一覧</h3>
              <p className="text-sm text-gray-600 leading-relaxed">すべての予約を確認・管理</p>
            </div>
          </Link>
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

  // Helper: derive max count from plan string when API doesn't provide it
  const getPlanMaxCount = (plan?: string, fallbackMax?: number) => {
    if (typeof fallbackMax === 'number') return fallbackMax
    if (!plan) return 4
    if (plan.includes('8回')) return 8
    if (plan.includes('6回')) return 6
    if (plan.includes('2回')) return 2
    return 4
  }

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
                        ? `${userInfo.monthlyUsage.planName}`
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
            <div className="space-y-6">
              {(() => {
                // helpers
                const formatJPDate = (dateString: string) => {
                  const date = new Date(dateString)
                  const month = date.getMonth() + 1
                  const day = date.getDate()
                  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
                  const dayOfWeek = dayNames[date.getDay()]
                  return `${month}月${day}日（${dayOfWeek}）`
                }

                // split reservations
                const upcoming = [...reservations]
                  .filter(r => !r.isPast)
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                const completed = [...reservations]
                  .filter(r => r.isPast)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

                // Build monthly counters to show idx/max per month
                const monthlyCounters: Record<string, number> = {}
                const monthlyIndexById: Record<string, { idx: number; month: number }> = {}
                const sortedAll = [...reservations].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                sortedAll.forEach(r => {
                  const d = new Date(r.date)
                  const key = `${d.getFullYear()}-${d.getMonth()}`
                  monthlyCounters[key] = (monthlyCounters[key] || 0) + 1
                  monthlyIndexById[r.id] = { idx: monthlyCounters[key], month: d.getMonth() + 1 }
                })

                const monthMax = (() => {
                  return (userInfo.monthlyUsage?.maxCount) ?? (() => {
                    const plan = userInfo.monthlyUsage?.planName || userInfo.plan || ''
                    if (plan.includes('8回')) return 8
                    if (plan.includes('6回')) return 6
                    if (plan.includes('2回')) return 2
                    return 4
                  })()
                })()

                // Render sections with card layout
                const Section = ({ title, items }: { title: string; items: any[] }) => {
                  // group items by year-month
                  const groups: Record<string, { year: number; month: number; list: any[] }> = {}
                  const sorted = [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  sorted.forEach(it => {
                    const [y, m] = String(it.date).split('/')
                    const key = `${y}-${m}`
                    if (!groups[key]) groups[key] = { year: Number(y), month: Number(m), list: [] }
                    groups[key].list.push(it)
                  })

                  const dayNames = ['日','月','火','水','木','金','土']

                  return (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
                      {items.length === 0 ? (
                        <div className="text-gray-500 text-sm">該当の予約はありません</div>
                      ) : (
                        <div className="space-y-5">
                          {Object.values(groups).map(group => (
                            <div key={`${group.year}-${group.month}`} className="space-y-2">
                              {/* monthly cards */}
                              <div className="space-y-3">
                                {group.list.map(item => {
                                  const [yearStr, monthStr, dayStr] = String(item.date).split('/')
                                  const year = Number(yearStr)
                                  const month = Number(monthStr)
                                  const day = Number(dayStr)
                                  const dateObj = new Date(year, month - 1, day)
                                  const dateLabel = `${month}月${day}日（${dayNames[dateObj.getDay()]}）`
                                  const idxInfo = monthlyIndexById[item.id]

                                  return (
                                    <div key={item.id} className="flex items-stretch gap-3">
                                      {/* Left month mini-card */}
                                      <div className="w-16 sm:w-20 flex-shrink-0">
                                        <div className="h-full rounded-lg border border-purple-200 bg-purple-50 text-purple-800 flex flex-col items-center justify-center py-2">
                                          <div className="text-[10px] sm:text-xs opacity-70">{year}</div>
                                          <div className="text-base sm:text-lg font-bold leading-tight">{month}月</div>
                                        </div>
                                      </div>

                                      {/* Right detail card */}
                                      <div className={`flex-1 border rounded-lg p-4 ${title === '予約済み' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-gray-900 text-lg">{`${idxInfo?.idx ?? '-'}回目（${idxInfo?.idx ?? '-'} / ${monthMax}）`}</div>
                                            <div className="mt-1 text-gray-700">
                                              <div className="font-medium">{dateLabel}</div>
                                              <div className="font-medium">{item.time}</div>
                                            </div>
                                          </div>
                                          <div className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${title === '予約済み' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'}`}>
                                            {title === '予約済み' ? '予約済' : '完了'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <>
                    <Section title="予約済み" items={upcoming} />
                    <Section title="完了" items={completed} />
                  </>
                )
              })()}
            </div>
          )}
      </div>
    </div>
  </div>

  )
}
