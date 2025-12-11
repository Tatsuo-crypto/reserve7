'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoreDisplayName } from '@/lib/auth-utils'

interface Reservation {
  id: string
  title: string
  startTime: string
  endTime: string
  notes?: string
  calendarId: string
  createdAt: string
  client: {
    id: string
    fullName: string
    email: string
    plan?: string
  }
}

interface ReservationsResponse {
  reservations: Reservation[]
  isAdmin: boolean
}

export default function ReservationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({
    title: '',
    startTime: '',
    endTime: '',
    notes: ''
  })
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [reservationToCancel, setReservationToCancel] = useState<string | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Fetch reservations
  useEffect(() => {
    if (status === 'authenticated') {
      fetchReservations()
    }
  }, [status])

  const fetchReservations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/reservations')

      if (!response.ok) {
        throw new Error('予約の取得に失敗しました')
      }
      if (response.ok) {
        const result = await response.json()
        const data = result.data || result
        setReservations(data.reservations || [])
        setIsAdmin(data.isAdmin || false)
      }
    } catch (error) {
      console.error('Fetch reservations error:', error)
      setError(error instanceof Error ? error.message : '予約の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    })
  }

  const formatDate = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const dayNames = ['日', '月', '火', '水', '木', '金', '土']
    const dayOfWeek = dayNames[date.getDay()]
    return `${year}年${month}月${day}日（${dayOfWeek}）`
  }

  const formatTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Tokyo'
    })
  }

  // Get plan max count
  const getPlanMaxCount = (plan: string | undefined) => {
    if (!plan) return 4 // Default if plan is undefined
    if (plan === 'ダイエットコース') return 8
    if (plan === '月6回プラン' || plan === '月6回' || plan.includes('6回')) return 6
    if (plan === '月8回プラン' || plan === '月8回' || plan.includes('8回')) return 8
    if (plan === '月2回プラン' || plan === '月2回' || plan.includes('2回')) return 2
    return 4 // Default for 月4回プラン or others
  }

  // Calculate monthly reservation count for each reservation
  const getMonthlyCount = (reservation: Reservation, allReservations: Reservation[]) => {
    // For blocked times, don't show count
    if (reservation.client.id === 'blocked') {
      return '-'
    }

    const reservationDate = new Date(reservation.startTime)
    const reservationMonth = reservationDate.getMonth()
    const reservationYear = reservationDate.getFullYear()

    // Get all reservations for the same client in the same month, sorted by start time
    const clientReservationsInMonth = allReservations
      .filter(r => {
        const rDate = new Date(r.startTime)
        return r.client.id === reservation.client.id &&
          rDate.getMonth() === reservationMonth &&
          rDate.getFullYear() === reservationYear &&
          new Date(r.startTime) <= reservationDate
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    // Return the count (length of filtered array)
    return clientReservationsInMonth.length
  }

  // Check if reservation is in the past
  const isPastReservation = (reservation: Reservation) => {
    const now = new Date()
    const reservationEnd = new Date(reservation.endTime)
    return reservationEnd < now
  }

  // Get row styling based on reservation timing
  const getRowClassName = (reservation: Reservation) => {
    const baseClass = "hover:bg-gray-50"
    if (isPastReservation(reservation)) {
      return `${baseClass} bg-gray-100 text-gray-600`
    }
    return `${baseClass} bg-white`
  }


  // Handle reservation cancellation
  const handleCancel = (reservationId: string) => {
    // Check if user is logged in
    if (!session?.user) {
      alert('ログインが必要です。ログインページにリダイレクトします。')
      router.push('/login')
      return
    }

    // Show custom confirm modal
    setReservationToCancel(reservationId)
    setShowConfirmModal(true)
  }

  // Confirm cancellation
  const confirmCancel = async () => {
    if (!reservationToCancel) return

    setShowConfirmModal(false)

    try {
      const response = await fetch(`/api/reservations/${reservationToCancel}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookies
      })

      if (response.ok) {
        // Remove the reservation from the list
        setReservations(prev => prev.filter(r => r.id !== reservationToCancel))
        alert('予約がキャンセルされました')
      } else {
        const data = await response.json()
        if (data.error === '認証が必要です') {
          alert('セッションが期限切れです。再度ログインしてください。')
          router.push('/login')
        } else {
          alert(data.error || '予約のキャンセルに失敗しました')
        }
      }
    } catch (error) {
      console.error('Cancel error:', error)
      alert('予約のキャンセルに失敗しました')
    } finally {
      setReservationToCancel(null)
    }
  }

  // Cancel the cancellation
  const cancelCancel = () => {
    setShowConfirmModal(false)
    setReservationToCancel(null)
  }

  // Handle reservation edit
  const handleEdit = (reservation: Reservation) => {
    setEditingReservation(reservation)

    // Convert UTC time to local time for datetime-local input
    const startDate = new Date(reservation.startTime)
    const endDate = new Date(reservation.endTime)

    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const formatForInput = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    setEditFormData({
      title: reservation.title || '',
      startTime: formatForInput(startDate),
      endTime: formatForInput(endDate),
      notes: reservation.notes || ''
    })
    setShowEditModal(true)
  }

  // Handle edit form submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingReservation) return

    try {
      const response = await fetch(`/api/reservations/${editingReservation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookies
        body: JSON.stringify({
          title: editFormData.title,
          startTime: new Date(editFormData.startTime).toISOString(),
          endTime: new Date(editFormData.endTime).toISOString(),
          notes: editFormData.notes
        })
      })

      if (response.ok) {
        // Update the reservation in the list
        setReservations(prev => prev.map(r =>
          r.id === editingReservation.id
            ? {
              ...r,
              title: editFormData.title,
              startTime: new Date(editFormData.startTime).toISOString(),
              endTime: new Date(editFormData.endTime).toISOString(),
              notes: editFormData.notes
            }
            : r
        ))
        setShowEditModal(false)
        setEditingReservation(null)
        alert('予約が更新されました')
      } else {
        const data = await response.json()
        alert(data.error || '予約の更新に失敗しました')
      }
    } catch (error) {
      console.error('Update error:', error)
      alert('予約の更新に失敗しました')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col items-center space-y-3">
            <h1 className="text-4xl font-bold text-gray-900">
              予約管理
            </h1>
            <div className="flex items-center justify-between w-full">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <p className="text-gray-600">
                すべての予約を管理できます
              </p>
              <div className="w-10"></div>
            </div>
            {isAdmin && (
              <Link
                href="/admin/reservations/new"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                新規予約作成
              </Link>
            )}
          </div>
        </div>
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchReservations}
              className="mt-2 text-red-600 hover:text-red-800 underline"
            >
              再試行
            </button>
          </div>
        )}

        {/* Reservations List */}
        {!reservations || reservations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              予約がありません
            </h3>
            <p className="text-gray-600">
              {isAdmin
                ? '新規予約を作成してください'
                : '予約が作成されると、ここに表示されます'
              }
            </p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <div className="overflow-x-auto">
                <table className="min-w-max divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] border-r border-gray-100">
                        日付
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px] border-r border-gray-100">
                        時間
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px] border-r border-gray-100">
                        会員名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] border-r border-gray-100">
                        回数
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px] border-r border-gray-100">
                        メモ
                      </th>
                      {isAdmin && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                          操作
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reservations && reservations.map((reservation) => (
                      <tr key={reservation.id} className={getRowClassName(reservation)}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium min-w-[120px] border-r border-gray-100">
                          <div className="bg-blue-50 text-blue-800 px-2 py-1 rounded-md text-center">
                            {formatDate(reservation.startTime)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm min-w-[140px] border-r border-gray-100">
                          <div className="bg-gray-50 text-gray-800 px-2 py-1 rounded-md text-center">
                            {formatTime(reservation.startTime)} - {formatTime(reservation.endTime)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm min-w-[150px] border-r border-gray-100">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8">
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-700">
                                  {reservation.client.id === 'blocked' ? 'B' : reservation.client.fullName.charAt(0)}
                                </span>
                              </div>
                            </div>
                            <div className="ml-3">
                              <div className="font-medium text-gray-900">
                                {reservation.client.id === 'blocked' ? '予約不可時間' : reservation.client.fullName}
                              </div>
                              <div className="text-gray-500 text-xs">
                                {reservation.client.id === 'blocked'
                                  ? 'blocked@system'
                                  : reservation.client.email === 'guest@system'
                                    ? 'Guest'
                                    : reservation.client.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm min-w-[120px] border-r border-gray-100">
                          {reservation.client.id === 'blocked' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              予約不可
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {`${getMonthlyCount(reservation, reservations)}/${getPlanMaxCount(reservation.client.plan)}回（${new Date(reservation.startTime).getMonth() + 1}月）`}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm min-w-[150px] border-r border-gray-100">
                          {reservation.notes || '-'}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium min-w-[120px]">
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleEdit(reservation)
                                }}
                                className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-3 py-1 rounded-md transition-colors"
                              >
                                変更
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleCancel(reservation.id)
                                }}
                                className="bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1 rounded-md transition-colors"
                              >
                                キャンセル
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingReservation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                予約の変更
              </h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    タイトル
                  </label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData(prev => ({
                      ...prev,
                      title: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="予約タイトルを入力してください"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始時間
                  </label>
                  <input
                    type="datetime-local"
                    value={editFormData.startTime}
                    onChange={(e) => setEditFormData(prev => ({
                      ...prev,
                      startTime: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了時間
                  </label>
                  <input
                    type="datetime-local"
                    value={editFormData.endTime}
                    onChange={(e) => setEditFormData(prev => ({
                      ...prev,
                      endTime: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メモ
                  </label>
                  <textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData(prev => ({
                      ...prev,
                      notes: e.target.value
                    }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="メモを入力してください（任意）"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingReservation(null)
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    更新
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Cancel Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-4">
                予約をキャンセルしますか？
              </h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                この操作は取り消すことができません。
              </p>
              <div className="flex justify-center space-x-3">
                <button
                  type="button"
                  onClick={cancelCancel}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={confirmCancel}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  削除する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
