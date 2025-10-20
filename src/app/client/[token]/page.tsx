'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import TrackingModal from '@/app/admin/members/TrackingModal'

interface User {
  id: string
  name: string
  email: string
  plan: string
}

interface Reservation {
  id: string
  title: string
  start_time: string
  end_time: string
  notes: string | null
  created_at: string
}

interface YearlyGoal {
  id: string
  year: number
  goal_text: string
}

interface MonthlyGoal {
  id: string
  year: number
  month: number
  goal_text: string
}

interface WeightRecord {
  id: string
  recorded_date: string
  weight_kg: number
  notes: string | null
}

interface SquatRecord {
  id: string
  recorded_date: string
  weight_kg: number
  reps: number | null
  sets: number | null
  notes: string | null
}

export default function ClientReservationsPage() {
  const params = useParams()
  const token = params?.token as string

  const [user, setUser] = useState<User | null>(null)
  const [futureReservations, setFutureReservations] = useState<Reservation[]>([])
  const [pastReservations, setPastReservations] = useState<Reservation[]>([])
  const [yearlyGoals, setYearlyGoals] = useState<YearlyGoal[]>([])
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([])
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([])
  const [squatRecords, setSquatRecords] = useState<SquatRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllWeight, setShowAllWeight] = useState(false)
  const [showAllSquat, setShowAllSquat] = useState(false)
  const [showMonthlyGoals, setShowMonthlyGoals] = useState(false)
  const [showOlderMonths, setShowOlderMonths] = useState(false)
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const { data: session, status: sessionStatus } = useSession()
  const isAdmin = sessionStatus === 'authenticated' && session?.user?.role === 'ADMIN'

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get user info
        const userResponse = await fetch(`/api/auth/token?token=${token}`)
        if (!userResponse.ok) {
          setError('無効なURLです')
          return
        }
        const userData = await userResponse.json()
        setUser(userData.user)

        // Get reservations
        const reservationsResponse = await fetch(`/api/client/reservations?token=${token}`)
        if (!reservationsResponse.ok) {
          setError('予約の取得に失敗しました')
          return
        }
        const reservationsData = await reservationsResponse.json()
        
        setFutureReservations(reservationsData.data.futureReservations || [])
        setPastReservations(reservationsData.data.pastReservations || [])

        // Get tracking data
        const trackingResponse = await fetch(`/api/client/tracking?token=${token}`)
        if (trackingResponse.ok) {
          const trackingData = await trackingResponse.json()
          setYearlyGoals(trackingData.data.yearlyGoals || [])
          setMonthlyGoals(trackingData.data.monthlyGoals || [])
          setWeightRecords(trackingData.data.weightRecords || [])
          setSquatRecords(trackingData.data.squatRecords || [])
        }
      } catch (err) {
        console.error('Error:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchData()
    }
  }, [token])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}年${month}月${day}日 ${hours}:${minutes}`
  }

  const formatTitle = (title: string, userPlan: string) => {
    // Match both formats: "山口1/4" and "山口12" (cumulative count)
    const matchWithSlash = title.match(/(\d+)\/(\d+)$/)
    const matchWithoutSlash = title.match(/(\d+)$/)
    
    if (matchWithSlash) {
      // Format: "山口1/4" -> "パーソナル1回目"
      const currentCount = matchWithSlash[1]
      return `パーソナル${currentCount}回目`
    } else if (matchWithoutSlash) {
      // Format: "山口12" -> "パーソナル12回目" (cumulative count)
      const currentCount = matchWithoutSlash[1]
      return `パーソナル${currentCount}回目`
    }
    
    return title
  }

  const getMonthKey = (dateStr: string) => {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    return `${year}年${month}月`
  }

  const groupByMonth = (reservations: Reservation[]) => {
    const grouped: { [key: string]: Reservation[] } = {}
    reservations.forEach(reservation => {
      const monthKey = getMonthKey(reservation.start_time)
      if (!grouped[monthKey]) {
        grouped[monthKey] = []
      }
      grouped[monthKey].push(reservation)
    })
    return grouped
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">アクセスエラー</h1>
          <p className="text-gray-600">{error || '無効なURLです'}</p>
        </div>
      </div>
    )
  }

  const futureByMonth = groupByMonth(futureReservations)
  const pastByMonth = groupByMonth(pastReservations)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 whitespace-nowrap">T&J GYM</h1>
            <div className="flex items-center gap-1 flex-shrink min-w-0">
              <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{user.name}　様</span>
              </div>
              <button className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex-shrink-0" aria-label="メニュー">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-4">

        {/* プラン名表示 */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
            <h2 className="text-lg font-bold text-gray-900">{user.plan}</h2>
          </div>
        </div>

        {/* トラッキング情報 */}
        {(yearlyGoals.length > 0 || monthlyGoals.length > 0 || weightRecords.length > 0 || squatRecords.length > 0) && (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
              <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-900">トレーニング記録</h2>
            </div>
            
            {/* 年次目標 */}
            {yearlyGoals.length > 0 && (
              <div className="mb-8">
                <div className="bg-gradient-to-br from-yellow-100 via-orange-100 to-yellow-50 border-4 border-orange-400 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <h3 className="text-base font-bold text-gray-900">{yearlyGoals[0].year}年の目標</h3>
                    <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-orange-600 leading-relaxed">{yearlyGoals[0].goal_text}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 月次目標 */}
            {monthlyGoals.length > 0 && (() => {
              // 現在の年月を取得
              const now = new Date()
              const currentYear = now.getFullYear()
              const currentMonth = now.getMonth() + 1
              const currentKey = `${currentYear}-${currentMonth}`
              
              // 年月でグループ化
              const groupedGoals = monthlyGoals.reduce((acc, goal) => {
                const key = `${goal.year}-${goal.month}`
                if (!acc[key]) acc[key] = []
                acc[key].push(goal)
                return acc
              }, {} as Record<string, typeof monthlyGoals>)
              
              const sortedKeys = Object.keys(groupedGoals).sort((a, b) => {
                const [yearA, monthA] = a.split('-').map(Number)
                const [yearB, monthB] = b.split('-').map(Number)
                return yearB * 12 + monthB - (yearA * 12 + monthA)
              })
              
              // 今月の目標があればそれを、なければ最新の目標を表示
              const hasCurrentMonth = groupedGoals[currentKey]
              const displayKey = hasCurrentMonth ? currentKey : sortedKeys[0]
              const displayGoals = groupedGoals[displayKey]
              const [goalYear, goalMonth] = displayKey.split('-').map(Number)
              const isInherited = !hasCurrentMonth && (goalYear !== currentYear || goalMonth !== currentMonth)
              
              // 表示中の月以外の古い目標
              const olderKeys = sortedKeys.filter(key => key !== displayKey)
              
              return (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-sm font-bold text-gray-700">
                      {currentYear}年{currentMonth}月の目標
                      {isInherited && <span className="text-xs text-gray-500 ml-2">({goalYear}年{goalMonth}月から引き継ぎ)</span>}
                    </h3>
                  </div>
                  
                  {/* 今月の目標（3つまで横並び） */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {displayGoals.slice(0, 3).map((goal) => (
                      <div key={goal.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-400 p-3 rounded-lg shadow-sm flex items-center justify-center min-h-[60px]">
                        <div className="text-sm font-bold text-blue-700 text-center line-clamp-2">{goal.goal_text}</div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 古い月の目標（折りたたみ） */}
                  {olderKeys.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowMonthlyGoals(!showMonthlyGoals)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                      >
                        <svg className={`w-3 h-3 transition-transform ${showMonthlyGoals ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        過去の目標を表示 ({olderKeys.length}ヶ月)
                      </button>
                      
                      {showMonthlyGoals && (
                        <div className="mt-2 space-y-2">
                          {olderKeys.map(key => {
                            const goals = groupedGoals[key]
                            const [year, month] = key.split('-').map(Number)
                            return (
                              <div key={key} className="border-l-2 border-gray-300 pl-3">
                                <div className="text-xs text-gray-600 font-bold mb-1">{year}年{month}月</div>
                                <div className="space-y-1">
                                  {goals.map(goal => (
                                    <div key={goal.id} className="text-xs text-gray-700">• {goal.goal_text}</div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* 体重推移とSQ推移を横並び */}
            {(weightRecords.length > 0 || squatRecords.length > 0) && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {/* 体重推移 */}
                {weightRecords.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <h3 className="text-sm font-bold text-gray-700">体重</h3>
                    </div>
                    <div className="space-y-2">
                      {(showAllWeight ? weightRecords : weightRecords.slice(0, 3)).map((record) => (
                        <div key={record.id} className="pt-3 pb-4 px-4 bg-green-50 rounded-lg border border-green-200 h-[90px] flex flex-col gap-1 overflow-hidden">
                          <div className="flex items-center justify-between">
                            <div className="text-base font-bold text-gray-900">{new Date(record.recorded_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</div>
                            <div className="text-2xl font-bold text-green-600">{record.weight_kg}kg</div>
                          </div>
                          {record.notes && (
                            <div className="text-xs text-gray-500 break-words leading-tight">{record.notes}</div>
                          )}
                        </div>
                      ))}
                      {weightRecords.length > 3 && (
                        <button
                          onClick={() => setShowAllWeight(!showAllWeight)}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                        >
                          <svg className={`w-3 h-3 transition-transform ${showAllWeight ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          {showAllWeight ? '閉じる' : `過去の記録を表示 (${weightRecords.length - 3}件)`}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* SQ推移 */}
                {squatRecords.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                      </svg>
                      <h3 className="text-sm font-bold text-gray-700">スクワット重量</h3>
                    </div>
                    <div className="space-y-2">
                      {(showAllSquat ? squatRecords : squatRecords.slice(0, 3)).map((record) => (
                        <div key={record.id} className="pt-3 pb-4 px-4 bg-purple-50 rounded-lg border border-purple-200 h-[90px] flex flex-col gap-1 overflow-hidden">
                          <div className="flex items-center justify-between">
                            <div className="text-base font-bold text-gray-900">{new Date(record.recorded_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</div>
                            <div className="text-2xl font-bold text-purple-600">{record.weight_kg}kg</div>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {(record.reps || record.sets) && (
                              <div className="text-xs text-gray-500 leading-tight">
                                {record.reps && record.sets && `${record.reps}回 × ${record.sets}セット`}
                                {record.reps && !record.sets && `${record.reps}回`}
                                {!record.reps && record.sets && `${record.sets}セット`}
                              </div>
                            )}
                            {record.notes && (
                              <div className="text-xs text-gray-500 break-words leading-tight">{record.notes}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {squatRecords.length > 3 && (
                        <button
                          onClick={() => setShowAllSquat(!showAllSquat)}
                          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
                        >
                          <svg className={`w-3 h-3 transition-transform ${showAllSquat ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          {showAllSquat ? '閉じる' : `過去の記録を表示 (${squatRecords.length - 3}件)`}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">今後の予約</h2>
          {futureReservations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">今後の予約はありません</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(futureByMonth)
                .sort((a, b) => new Date(a[1][0].start_time).getTime() - new Date(b[1][0].start_time).getTime())
                .map(([monthKey, reservations]) => (
                  <div key={monthKey} className="space-y-3">
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 px-4 py-2 rounded">
                      <h3 className="text-lg font-bold text-blue-900">{monthKey}</h3>
                    </div>
                    {reservations
                      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                      .map((reservation) => (
                        <div key={reservation.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ml-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">{formatTitle(reservation.title, user.plan)}</h3>
                              <div className="flex items-center gap-1 text-gray-600 mb-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p>{formatDate(reservation.start_time)}</p>
                              </div>
                              {reservation.notes && (
                                <div className="flex items-center gap-1 text-sm text-gray-500 mt-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                  <p>{reservation.notes}</p>
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">予約済み</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">過去の予約</h2>
          {pastReservations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">過去の予約はありません</div>
          ) : (() => {
            const now = new Date()
            const currentYear = now.getFullYear()
            const currentMonth = now.getMonth() + 1
            const currentMonthKey = `${currentYear}年${currentMonth}月`
            
            const sortedMonths = Object.entries(pastByMonth)
              .sort((a, b) => new Date(b[1][0].start_time).getTime() - new Date(a[1][0].start_time).getTime())
            
            const currentMonthData = sortedMonths.filter(([monthKey]) => monthKey === currentMonthKey)
            const olderMonthsData = sortedMonths.filter(([monthKey]) => monthKey !== currentMonthKey)
            
            return (
              <div className="space-y-6">
                {/* 当月の予約 */}
                {currentMonthData.map(([monthKey, reservations]) => (
                  <div key={monthKey} className="space-y-3">
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-gray-400 px-4 py-2 rounded">
                      <h3 className="text-lg font-bold text-gray-700">{monthKey}</h3>
                    </div>
                    {reservations
                      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                      .map((reservation) => (
                        <div key={reservation.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 ml-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-700 mb-1">{formatTitle(reservation.title, user.plan)}</h3>
                              <div className="flex items-center gap-1 text-gray-500 mb-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p>{formatDate(reservation.start_time)}</p>
                              </div>
                              {reservation.notes && (
                                <div className="flex items-center gap-1 text-sm text-gray-400 mt-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                  <p>{reservation.notes}</p>
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-200 text-gray-600">完了</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
                
                {/* それ以前の月（折りたたみ） */}
                {olderMonthsData.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowOlderMonths(!showOlderMonths)}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
                    >
                      <svg className={`w-4 h-4 transition-transform ${showOlderMonths ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {showOlderMonths ? 'それ以前の予約を隠す' : `それ以前の予約を表示 (${olderMonthsData.length}ヶ月)`}
                    </button>
                    
                    {showOlderMonths && (
                      <div className="mt-4 space-y-6">
                        {olderMonthsData.map(([monthKey, reservations]) => (
                          <div key={monthKey} className="space-y-3">
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-gray-400 px-4 py-2 rounded">
                              <h3 className="text-lg font-bold text-gray-700">{monthKey}</h3>
                            </div>
                            {reservations
                              .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                              .map((reservation) => (
                                <div key={reservation.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 ml-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h3 className="text-lg font-semibold text-gray-700 mb-1">{formatTitle(reservation.title, user.plan)}</h3>
                                      <div className="flex items-center gap-1 text-gray-500 mb-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p>{formatDate(reservation.start_time)}</p>
                                      </div>
                                      {reservation.notes && (
                                        <div className="flex items-center gap-1 text-sm text-gray-400 mt-2">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                          </svg>
                                          <p>{reservation.notes}</p>
                                        </div>
                                      )}
                                    </div>
                                    <div className="ml-4">
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-200 text-gray-600">完了</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* 管理者用編集ボタン */}
        {isAdmin && user && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setShowTrackingModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              編集
            </button>
          </div>
        )}

        {/* TrackingModal */}
        {isAdmin && user && showTrackingModal && (
          <TrackingModal
            isOpen={showTrackingModal}
            onClose={() => {
              setShowTrackingModal(false)
              // データを再読み込み
              const fetchData = async () => {
                try {
                  const trackingResponse = await fetch(`/api/client/tracking?token=${token}`)
                  if (trackingResponse.ok) {
                    const trackingData = await trackingResponse.json()
                    setYearlyGoals(trackingData.data.yearlyGoals || [])
                    setMonthlyGoals(trackingData.data.monthlyGoals || [])
                    setWeightRecords(trackingData.data.weightRecords || [])
                    setSquatRecords(trackingData.data.squatRecords || [])
                  }
                } catch (error) {
                  console.error('データ再読み込みエラー:', error)
                }
              }
              fetchData()
            }}
            memberId={user.id}
            memberName={user.name}
          />
        )}
      </div>
    </div>
  )
}
