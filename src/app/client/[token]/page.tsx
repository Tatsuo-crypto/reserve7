'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'

// TrackingModalを遅延読み込み（パフォーマンス向上）
const TrackingModal = dynamic(() => import('@/app/admin/members/TrackingModal'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">読み込み中...</p>
      </div>
    </div>
  )
})

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

interface GoalCheckData {
  id: string
  text: string
  checked: boolean
}

interface Streak {
  current_streak: number
  max_streak: number
  total_rewards: number
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
  
  const [fromAdmin, setFromAdmin] = useState(false)
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
  const [goalChecks, setGoalChecks] = useState<GoalCheckData[]>([])
  const [streak, setStreak] = useState<Streak | null>(null)
  const [showReward, setShowReward] = useState(false)
  const [rewardAmount, setRewardAmount] = useState(0)
  const [isTodayCompleted, setIsTodayCompleted] = useState(false)
  const { data: session, status: sessionStatus } = useSession()
  const isAdmin = sessionStatus === 'authenticated' && session?.user?.role === 'ADMIN'

  // クエリパラメータを取得（Safari対応）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      setFromAdmin(urlParams.get('from') === 'admin')
    }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('[Client Page] Fetching user data with token')
        // ユーザー情報を最初に取得（これが失敗したら他は実行しない）
        const userResponse = await fetch(`/api/auth/token?token=${token}`)
        if (!userResponse.ok) {
          const errorData = await userResponse.json().catch(() => ({}))
          const errorMsg = errorData.error || '無効なURLです'
          console.error('[Client Page] Token validation failed:', userResponse.status, errorMsg)
          setError(errorMsg)
          setLoading(false)
          return
        }
        const userData = await userResponse.json()
        console.log('[Client Page] User data fetched successfully')
        setUser(userData.user)

        // 予約とトラッキングデータを並列で取得（高速化）
        const [reservationsResult, trackingResult] = await Promise.allSettled([
          fetch(`/api/client/reservations?token=${token}`).then(async (res) => {
            if (res.ok) {
              const data = await res.json()
              return data
            }
            throw new Error('予約の取得に失敗')
          }),
          fetch(`/api/client/tracking?token=${token}`).then(async (res) => {
            if (res.ok) {
              const data = await res.json()
              return data
            }
            throw new Error('トラッキングの取得に失敗')
          })
        ])

        // 予約データの処理
        if (reservationsResult.status === 'fulfilled') {
          setFutureReservations(reservationsResult.value.data.futureReservations || [])
          setPastReservations(reservationsResult.value.data.pastReservations || [])
        } else {
          console.error('予約データ取得エラー:', reservationsResult.reason)
        }

        // トラッキングデータの処理
        if (trackingResult.status === 'fulfilled') {
          setYearlyGoals(trackingResult.value.data.yearlyGoals || [])
          setMonthlyGoals(trackingResult.value.data.monthlyGoals || [])
          setWeightRecords(trackingResult.value.data.weightRecords || [])
          setSquatRecords(trackingResult.value.data.squatRecords || [])
        } else {
          console.error('トラッキングデータ取得エラー:', trackingResult.reason)
        }

        // チェック情報とストリークを取得
        try {
          const checkResponse = await fetch(`/api/client/goal-check?token=${token}`)
          if (checkResponse.ok) {
            const checkData = await checkResponse.json()
            const goals = checkData.data.monthlyGoals || []
            setGoalChecks(goals)
            setStreak(checkData.data.streak)
            
            // 全てチェック済みか判定
            const allChecked = goals.length > 0 && goals.every((g: GoalCheckData) => g.checked)
            setIsTodayCompleted(allChecked)
          }
        } catch (err) {
          console.error('チェック情報取得エラー:', err)
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

  // 目標チェックのハンドラー
  const handleGoalCheck = async (goalId: string, currentlyChecked: boolean) => {
    // 本日達成済みの場合は変更不可
    if (isTodayCompleted) {
      return
    }

    // 既にチェック済みの場合はアンチェック不可
    if (currentlyChecked) {
      return
    }

    try {
      const response = await fetch(`/api/client/goal-check?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, checked: true })
      })

      if (response.ok) {
        const result = await response.json()
        
        // チェック状況を更新
        setGoalChecks(prev => prev.map(goal => 
          goal.id === goalId ? { ...goal, checked: true } : goal
        ))

        // ストリーク情報を更新
        if (result.data.streak) {
          setStreak(result.data.streak)
        }

        // 全てチェックされた場合、報酬を表示
        if (result.data.isCompleted && result.data.reward > 0) {
          setIsTodayCompleted(true)
          setRewardAmount(result.data.reward)
          setShowReward(true)
          setTimeout(() => setShowReward(false), 3000)
        }
      }
    } catch (error) {
      console.error('チェック処理エラー:', error)
    }
  }

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
      {/* 報酬通知 */}
      {showReward && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <div>
              <div className="font-bold text-lg">全目標達成！</div>
              <div className="text-sm">+{rewardAmount}pt 獲得！</div>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center gap-2">
              {fromAdmin && isAdmin && (
                <a
                  href="/admin/members"
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                  title="会員管理に戻る"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </a>
              )}
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 whitespace-nowrap">T&J GYM</h1>
            </div>
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
                  {/* タイトルを最上部に表示 */}
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-base font-bold text-gray-700">
                      {currentYear}年{currentMonth}月の目標
                      {isInherited && <span className="text-xs text-gray-500 ml-2">({goalYear}年{goalMonth}月から引き継ぎ)</span>}
                    </h3>
                  </div>

                  {/* ストリーク表示 */}
                  {streak && streak.current_streak > 0 && (
                    <div className="mb-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <div>
                            <div className="text-lg font-bold text-orange-700">{streak.current_streak}日連続達成！</div>
                            <div className="text-xs text-gray-600">最高記録: {streak.max_streak}日</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">累計報酬</div>
                          <div className="text-xl font-bold text-orange-600">{streak.total_rewards}pt</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 今月の目標（３つまで横並び） - チェック機能付き */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {displayGoals.slice(0, 3).map((goal) => {
                      const checkData = goalChecks.find(g => g.id === goal.id)
                      const isChecked = checkData?.checked || false
                      const isDisabled = isTodayCompleted || isChecked
                      return (
                        <button
                          key={goal.id}
                          onClick={() => handleGoalCheck(goal.id, isChecked)}
                          disabled={isDisabled}
                          className={`${
                            isChecked 
                              ? 'bg-gray-300 border-2 border-gray-500 shadow-none' 
                              : 'bg-gradient-to-br from-blue-400 to-indigo-500 border-2 border-blue-600 shadow-lg'
                          } w-full p-4 rounded-xl flex flex-col items-center justify-center min-h-[100px] transition-all ${
                            !isDisabled ? 'hover:scale-105 hover:shadow-xl active:scale-95 cursor-pointer' : 'cursor-not-allowed opacity-60'
                          }`}
                        >
                          <div className={`text-base font-bold text-center mb-1 ${
                            isChecked ? 'text-gray-600' : 'text-white'
                          }`}>
                            {goal.goal_text}
                          </div>
                          <div className={`text-xs ${
                            isChecked ? 'text-gray-500' : 'text-blue-100'
                          }`}>
                            {isChecked ? '達成済み' : 'タップしてチェック'}
                          </div>
                        </button>
                      )
                    })}
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
        {fromAdmin && isAdmin && user && (
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
        {fromAdmin && isAdmin && user && showTrackingModal && (
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
