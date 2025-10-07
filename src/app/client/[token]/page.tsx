'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface User {
  id: string
  name: string
  email: string
  storeId: string
  plan: string
}

interface Reservation {
  id: string
  title: string
  start_time: string
  end_time: string
  notes?: string
  created_at: string
}

export default function ClientReservationsPage() {
  const params = useParams()
  const token = params?.token as string

  const [user, setUser] = useState<User | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Verify token and get user info
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
        setReservations(reservationsData.data.reservations || [])

      } catch (err) {
        console.error('Error fetching data:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchData()
    }
  }, [token])

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    })
  }

  // Format title to show "パーソナル X/Y回目"
  const formatTitle = (title: string) => {
    // Extract the count pattern like "増村浩気1/4" and convert to "パーソナル1/4回目"
    const match = title.match(/(\d+)\/(\d+)$/)
    if (match) {
      return `パーソナル${match[1]}/${match[2]}回目`
    }
    return title
  }

  // Get month key from date (e.g., "2025年10月")
  const getMonthKey = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      timeZone: 'Asia/Tokyo'
    })
  }

  // Separate past and future reservations
  const now = new Date()
  const futureReservations = reservations.filter(r => new Date(r.start_time) >= now)
  const pastReservations = reservations.filter(r => new Date(r.start_time) < now)

  // Group reservations by month
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

  const futureByMonth = groupByMonth(futureReservations)
  const pastByMonth = groupByMonth(pastReservations)

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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-200">予約一覧</h1>
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-blue-600 font-medium mb-1">お名前</div>
                <div className="text-xl font-bold text-gray-900">{user.name} 様</div>
              </div>
            </div>
            <div className="flex items-center p-4 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-green-600 font-medium mb-1">プラン</div>
                <div className="text-lg font-semibold text-gray-900">{user.plan}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Future Reservations */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">今後の予約</h2>
          {futureReservations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              今後の予約はありません
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(futureByMonth)
                .sort((a, b) => {
                  // Sort by the first reservation's date in each month (ascending - oldest first)
                  const dateA = new Date(a[1][0].start_time)
                  const dateB = new Date(b[1][0].start_time)
                  return dateA.getTime() - dateB.getTime()
                })
                .map(([monthKey, reservations]) => (
                <div key={monthKey} className="space-y-3">
                  {/* Month Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 px-4 py-2 rounded">
                    <h3 className="text-lg font-bold text-blue-900">{monthKey}</h3>
                  </div>
                  
                  {/* Reservations in this month */}
                  {reservations
                    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                    .map((reservation) => (
                    <div
                      key={reservation.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ml-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {formatTitle(reservation.title)}
                          </h3>
                          <p className="text-gray-600 mb-2">
                            📅 {formatDate(reservation.start_time)}
                          </p>
                          {reservation.notes && (
                            <p className="text-sm text-gray-500 mt-2">
                              💬 {reservation.notes}
                            </p>
                          )}
                        </div>
                        <div className="ml-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            予約済み
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Reservations */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">過去の予約</h2>
          {pastReservations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              過去の予約はありません
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(pastByMonth)
                .sort((a, b) => {
                  // Sort by the first reservation's date in each month (descending - newest first)
                  const dateA = new Date(a[1][0].start_time)
                  const dateB = new Date(b[1][0].start_time)
                  return dateB.getTime() - dateA.getTime()
                })
                .map(([monthKey, reservations]) => (
                <div key={monthKey} className="space-y-3">
                  {/* Month Header */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-gray-400 px-4 py-2 rounded">
                    <h3 className="text-lg font-bold text-gray-700">{monthKey}</h3>
                  </div>
                  
                  {/* Reservations in this month */}
                  {reservations
                    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                    .map((reservation) => (
                    <div
                      key={reservation.id}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50 ml-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-700 mb-1">
                            {formatTitle(reservation.title)}
                          </h3>
                          <p className="text-gray-500 mb-2">
                            📅 {formatDate(reservation.start_time)}
                          </p>
                          {reservation.notes && (
                            <p className="text-sm text-gray-400 mt-2">
                              💬 {reservation.notes}
                            </p>
                          )}
                        </div>
                        <div className="ml-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-200 text-gray-600">
                            完了
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
