'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Tokyo'
    })
  }

  const formatTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    })
  }

  // Calculate monthly reservation count for each reservation
  const getMonthlyCount = (reservation: Reservation, allReservations: Reservation[]) => {
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
    setEditFormData({
      title: reservation.title || '',
      startTime: reservation.startTime.slice(0, 16), // Format for datetime-local input
      endTime: reservation.endTime.slice(0, 16),
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isAdmin ? '予約管理' : 'マイ予約'}
              </h1>
              <p className="mt-2 text-gray-600">
                {isAdmin 
                  ? 'すべての予約を管理できます' 
                  : 'あなたの予約一覧です'
                }
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/reservations/new')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                新規予約作成
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
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
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <table className="min-w-max divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    {isAdmin ? (
                      <>
                        <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[120px] border-r border-gray-200">
                          日付
                        </th>
                        <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[160px] border-r border-gray-200">
                          時間
                        </th>
                        <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[200px] border-r border-gray-200">
                          クライアント
                        </th>
                        <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[120px] border-r border-gray-200">
                          回数
                        </th>
                        <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[180px] border-r border-gray-200">
                          メモ
                        </th>
                        <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[140px]">
                          操作
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[120px] border-r border-gray-200">
                          回数
                        </th>
                        <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[120px] border-r border-gray-200">
                          日付
                        </th>
                        <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[160px] border-r border-gray-200">
                          時間
                        </th>
                        <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[180px]">
                          メモ
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reservations && reservations.map((reservation) => (
                    <tr key={reservation.id} className={getRowClassName(reservation)}>
                      {isAdmin ? (
                        <>
                          <td className="px-8 py-4 whitespace-nowrap text-sm font-medium border-r border-gray-100">
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                              {formatDate(reservation.startTime)}
                            </div>
                          </td>
                          <td className="px-8 py-4 whitespace-nowrap text-sm border-r border-gray-100">
                            <div className="bg-gray-50 px-3 py-1 rounded-full text-center">
                              {formatTime(reservation.startTime)} - {formatTime(reservation.endTime)}
                            </div>
                          </td>
                          <td className="px-8 py-4 whitespace-nowrap text-sm border-r border-gray-100">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                {reservation.client.fullName.charAt(0)}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{reservation.client.fullName}</div>
                                <div className="text-gray-500 text-xs">{reservation.client.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-4 whitespace-nowrap text-sm border-r border-gray-100">
                            <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-center font-medium">
                              {getMonthlyCount(reservation, reservations)}回目 ({getMonthlyCount(reservation, reservations)}/{reservation.client.plan === 'ダイエットコース' ? 8 : 4})
                            </div>
                          </td>
                          <td className="px-8 py-4 text-sm border-r border-gray-100">
                            <div className="max-w-[150px] truncate" title={reservation.notes || '-'}>
                              {reservation.notes || <span className="text-gray-400">-</span>}
                            </div>
                          </td>
                          <td className="px-8 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleEdit(reservation)
                                }}
                                className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-md text-xs font-medium transition-colors"
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
                                className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                              >
                                キャンセル
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-8 py-4 whitespace-nowrap text-sm border-r border-gray-100">
                            <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-center font-medium">
                              {getMonthlyCount(reservation, reservations)}回目 ({getMonthlyCount(reservation, reservations)}/{reservation.client.plan === 'ダイエットコース' ? 8 : 4})
                            </div>
                          </td>
                          <td className="px-8 py-4 whitespace-nowrap text-sm font-medium border-r border-gray-100">
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                              {formatDate(reservation.startTime)}
                            </div>
                          </td>
                          <td className="px-8 py-4 whitespace-nowrap text-sm border-r border-gray-100">
                            <div className="bg-gray-50 px-3 py-1 rounded-full text-center">
                              {formatTime(reservation.startTime)} - {formatTime(reservation.endTime)}
                            </div>
                          </td>
                          <td className="px-8 py-4 text-sm">
                            <div className="max-w-[150px] truncate" title={reservation.notes || '-'}>
                              {reservation.notes || <span className="text-gray-400">-</span>}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
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
