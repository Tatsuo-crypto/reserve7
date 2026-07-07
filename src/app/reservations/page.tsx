'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoreDisplayName } from '@/lib/auth-utils'
import Icon from '@/components/ui/icons'

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
    const baseClass = "hover:bg-surface-base"
    if (isPastReservation(reservation)) {
      return `${baseClass} bg-surface-overlay text-text-secondary`
    }
    return `${baseClass} bg-surface-raised`
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

  // Start time change handler to preserve duration
  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartTime = e.target.value
    
    if (editFormData.startTime && editFormData.endTime && newStartTime) {
      const currentStart = new Date(editFormData.startTime)
      const currentEnd = new Date(editFormData.endTime)
      const newStart = new Date(newStartTime)
      
      if (!isNaN(currentStart.getTime()) && !isNaN(currentEnd.getTime()) && !isNaN(newStart.getTime())) {
        const duration = currentEnd.getTime() - currentStart.getTime()
        const newEnd = new Date(newStart.getTime() + duration)
        
        // Format new end time as YYYY-MM-DDThh:mm
        const year = newEnd.getFullYear()
        const month = String(newEnd.getMonth() + 1).padStart(2, '0')
        const day = String(newEnd.getDate()).padStart(2, '0')
        const hours = String(newEnd.getHours()).padStart(2, '0')
        const minutes = String(newEnd.getMinutes()).padStart(2, '0')
        const newEndTime = `${year}-${month}-${day}T${hours}:${minutes}`
        
        setEditFormData(prev => ({
          ...prev,
          startTime: newStartTime,
          endTime: newEndTime
        }))
        return
      }
    }
    
    setEditFormData(prev => ({ ...prev, startTime: newStartTime }))
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
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-surface-base py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col items-center space-y-3">
            <h1 className="text-4xl font-normal text-text-primary">
              予約管理
            </h1>
            <div className="flex items-center justify-between w-full">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-surface-overlay rounded-full transition-colors"
              >
                <Icon name="chevronLeft" size={20} className="text-text-secondary" />
              </button>
              <p className="text-text-secondary">
                すべての予約を管理できます
              </p>
              <div className="w-10"></div>
            </div>
            {isAdmin && (
              <Link
                href="/admin/reservations/new"
                className="bg-brand-600 text-white px-4 py-2 rounded-md hover:bg-brand-700 transition-colors"
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
          <div className="bg-surface-raised rounded-lg shadow p-8 text-center">
            <div className="text-text-muted mb-4">
              <Icon name="calendar" size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-normal text-text-primary mb-2">
              予約がありません
            </h3>
            <p className="text-text-secondary">
              {isAdmin
                ? '新規予約を作成してください'
                : '予約が作成されると、ここに表示されます'
              }
            </p>
          </div>
        ) : (
          <div className="bg-surface-raised shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <div className="overflow-x-auto">
                <table className="min-w-max divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-brand-50 to-brand-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-normal text-text-secondary uppercase tracking-wider min-w-[120px] border-r border-border-subtle">
                        日付
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-normal text-text-secondary uppercase tracking-wider min-w-[140px] border-r border-border-subtle">
                        時間
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-normal text-text-secondary uppercase tracking-wider min-w-[150px] border-r border-border-subtle">
                        会員名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-normal text-text-secondary uppercase tracking-wider min-w-[120px] border-r border-border-subtle">
                        回数
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-normal text-text-secondary uppercase tracking-wider min-w-[150px] border-r border-border-subtle">
                        メモ
                      </th>
                      {isAdmin && (
                        <th className="px-6 py-3 text-left text-xs font-normal text-text-secondary uppercase tracking-wider min-w-[120px]">
                          操作
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-surface-raised divide-y divide-gray-200">
                    {reservations && reservations.map((reservation) => (
                      <tr key={reservation.id} className={getRowClassName(reservation)}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-normal min-w-[120px] border-r border-border-subtle">
                          <div className="bg-brand-500/15 text-brand-300 px-2 py-1 rounded-md text-center">
                            {formatDate(reservation.startTime)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm min-w-[140px] border-r border-border-subtle">
                          <div className="bg-surface-base text-text-primary px-2 py-1 rounded-md text-center">
                            {formatTime(reservation.startTime)} - {formatTime(reservation.endTime)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm min-w-[150px] border-r border-border-subtle">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8">
                              <div className="h-8 w-8 rounded-full bg-surface-overlay flex items-center justify-center">
                                <span className="text-sm font-normal text-text-secondary">
                                  {reservation.client.id === 'blocked' ? 'B' : reservation.client.fullName.charAt(0)}
                                </span>
                              </div>
                            </div>
                            <div className="ml-3">
                              <div className="font-normal text-text-primary">
                                {reservation.client.id === 'blocked' ? '予約不可時間' : reservation.client.fullName}
                              </div>
                              <div className="text-text-secondary text-xs">
                                {reservation.client.id === 'blocked'
                                  ? 'blocked@system'
                                  : reservation.client.email === 'guest@system'
                                    ? 'Guest'
                                    : reservation.client.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm min-w-[120px] border-r border-border-subtle">
                          {reservation.client.id === 'blocked' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-red-500/15 text-red-300">
                              予約不可
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-green-500/15 text-green-300">
                              {`${getMonthlyCount(reservation, reservations)}/${getPlanMaxCount(reservation.client.plan)}回（${new Date(reservation.startTime).getMonth() + 1}月）`}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm min-w-[150px] border-r border-border-subtle">
                          {reservation.notes || '-'}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-normal min-w-[120px]">
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleEdit(reservation)
                                }}
                                className="bg-brand-500/15 text-brand-300 hover:bg-brand-500/25 px-3 py-1 rounded-md transition-colors"
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
                                className="bg-red-500/15 text-red-300 hover:bg-red-500/25 px-3 py-1 rounded-md transition-colors"
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
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-surface-raised">
            <div className="mt-3">
              <h3 className="text-lg font-normal text-text-primary mb-4">
                予約の変更
              </h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-normal text-text-secondary mb-1">
                    タイトル
                  </label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData(prev => ({
                      ...prev,
                      title: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="予約タイトルを入力してください"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-normal text-text-secondary mb-1">
                    開始時間
                  </label>
                  <input
                    type="datetime-local"
                    value={editFormData.startTime}
                    onChange={handleStartTimeChange}
                    className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-normal text-text-secondary mb-1">
                    終了時間
                  </label>
                  <input
                    type="datetime-local"
                    value={editFormData.endTime}
                    onChange={(e) => setEditFormData(prev => ({
                      ...prev,
                      endTime: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-normal text-text-secondary mb-1">
                    メモ
                  </label>
                  <textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData(prev => ({
                      ...prev,
                      notes: e.target.value
                    }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                    className="px-4 py-2 bg-surface-overlay text-text-secondary rounded-md hover:bg-surface-overlay transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors"
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
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-surface-raised">
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <Icon name="warning" size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-normal text-text-primary text-center mb-4">
                予約をキャンセルしますか？
              </h3>
              <p className="text-sm text-text-secondary text-center mb-6">
                この操作は取り消すことができません。
              </p>
              <div className="flex justify-center space-x-3">
                <button
                  type="button"
                  onClick={cancelCancel}
                  className="px-4 py-2 bg-surface-overlay text-text-secondary rounded-md hover:bg-surface-overlay transition-colors"
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
