'use client'

import { useState, useEffect } from 'react'
import { useStoreChange } from '@/hooks/useStoreChange'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { Reservation } from '@/types/common'

// Helper function to calculate reservation sequence for a specific client
function getReservationSequence(targetReservation: any, allReservations: any[]): number {
  // Filter reservations for the same client and sort by date
  const clientReservations = allReservations
    .filter(r => r.client?.id === targetReservation.client?.id)
    .sort((a, b) => new Date(a.startTime || a.start_time).getTime() - new Date(b.startTime || b.start_time).getTime())

  // Find the index of the target reservation and add 1 (1-based indexing)
  const index = clientReservations.findIndex(r => r.id === targetReservation.id)
  return index >= 0 ? index + 1 : 1
}

export default function AdminReservationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reservations, setReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [monthlyUsage, setMonthlyUsage] = useState<{ [key: string]: { currentCount: number, maxCount: number, planName: string } }>({})
  const [editingReservation, setEditingReservation] = useState<any | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({
    title: '',
    startTime: '',
    endTime: '',
    notes: ''
  })
  const { count: storeChangeCount } = useStoreChange()

  // Check admin access
  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/reservations')
      return
    }
  }, [status, session, router])

  // Fetch reservations and monthly usage
  useEffect(() => {
    const fetchReservations = async () => {
      try {
        const response = await fetch('/api/reservations')
        if (response.ok) {
          const result = await response.json()
          const reservationsData = result.data?.reservations || []
          setReservations(reservationsData)

          // Fetch monthly usage for each unique client
          const clientIds = reservationsData.map((r: any) => r.client?.id).filter(Boolean) as string[]
          const uniqueClients = Array.from(new Set(clientIds))
          const usagePromises = uniqueClients.map(async (clientId: string) => {
            try {
              const usageResponse = await fetch(`/api/reservations/monthly-count?clientId=${clientId}`)
              if (usageResponse.ok) {
                const usageData = await usageResponse.json()
                return { clientId, usage: usageData.data }
              }
            } catch (error) {
              console.error('Failed to fetch usage for client:', clientId, error)
            }
            return null
          })

          const usageResults = await Promise.all(usagePromises)
          const usageMap: { [key: string]: any } = {}
          usageResults.forEach(result => {
            if (result) {
              usageMap[result.clientId] = result.usage
            }
          })
          setMonthlyUsage(usageMap)
        } else {
          const errorData = await response.json()
          setError(`予約データの取得に失敗しました: ${errorData.error || 'Unknown error'}`)
        }
      } catch (error) {
        console.error('Fetch Error:', error)
        setError('予約データの取得中にエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      fetchReservations()
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      setLoading(false)
    }
  }, [session, status, storeChangeCount])

  const handleDeleteReservation = async (reservationId: string) => {
    console.log('🔴 [DEBUG] handleDeleteReservation called with ID:', reservationId);
    alert(`[DEBUG] 削除処理開始\nID: ${reservationId}`);

    if (!confirm('この予約を削除してもよろしいですか？')) {
      console.log('🔴 [DEBUG] User cancelled');
      alert('[DEBUG] キャンセルされました');
      return;
    }

    console.log('🔴 [DEBUG] User confirmed deletion');
    alert('[DEBUG] 削除を実行します');

    try {
      console.log('🔴 [DEBUG] Sending DELETE request to:', `/api/reservations/${reservationId}`);

      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      console.log('🔴 [DEBUG] Response received:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      alert(`[DEBUG] レスポンス受信\nステータス: ${response.status}\nOK: ${response.ok}`);

      if (response.ok) {
        const result = await response.json();
        console.log('🔴 [DEBUG] Delete success:', result);
        alert(`[DEBUG] 削除成功\nメッセージ: ${result.message}`);

        setReservations(prev => prev.filter(r => r.id !== reservationId));
        alert('[DEBUG] リロードします');
        window.location.reload();
      } else {
        const errorData = await response.json();
        console.error('🔴 [DEBUG] Delete error response:', errorData);
        alert(`[DEBUG] 削除失敗\nエラー: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('🔴 [DEBUG] Delete exception:', error);
      alert(`[DEBUG] 例外発生\nエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Handle reservation edit
  const handleEdit = (reservation: any) => {
    setEditingReservation(reservation)

    // Convert UTC time to local time for datetime-local input
    const startDate = new Date(reservation.startTime || reservation.start_time)
    const endDate = new Date(reservation.endTime || reservation.end_time)

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
      notes: reservation.memo || reservation.notes || ''
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
        credentials: 'include',
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
              notes: editFormData.notes,
              memo: editFormData.notes
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const dayNames = ['日', '月', '火', '水', '木', '金', '土']
    const dayOfWeek = dayNames[date.getDay()]
    return `${year}年${month}月${day}日（${dayOfWeek}）`
  }

  const formatTime = (timeString?: string) => {
    if (!timeString) return ''
    try {
      const date = new Date(timeString)
      return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } catch (error) {
      // Fallback to slice method if date parsing fails
      return timeString.slice(0, 5)
    }
  }

  // Calculate monthly reservation count up to this reservation for a client
  const getMonthlyCount = (reservation: any, allReservations: any[]) => {
    if (reservation?.client?.id === 'blocked') return '-'
    const resDate = new Date(reservation.startTime || reservation.start_time)
    const month = resDate.getMonth()
    const year = resDate.getFullYear()
    const clientId = reservation.client?.id

    const clientReservationsInMonth = allReservations
      .filter(r => {
        const d = new Date(r.startTime || r.start_time)
        return r.client?.id === clientId && d.getMonth() === month && d.getFullYear() === year && d <= resDate
      })
      .sort((a, b) => new Date(a.startTime || a.start_time).getTime() - new Date(b.startTime || b.start_time).getTime())

    return clientReservationsInMonth.length
  }

  const isPastReservation = (startTime?: string, endTime?: string) => {
    if (!endTime) return false
    const reservationDateTime = new Date(endTime)
    return reservationDateTime < new Date()
  }

  // Loading states
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-lg">認証状態を確認中...</span>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-lg">ログインページにリダイレクト中...</span>
      </div>
    )
  }

  if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-lg">予約ページにリダイレクト中...</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-lg">予約データを読み込み中...</span>
      </div>
    )
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
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <p className="text-gray-600">
                予約のステータス管理
              </p>
              <div className="w-10"></div>
            </div>
            <Link
              href="/admin/reservations/new"
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
            >
              新規予約作成
            </Link>
          </div>
        </div>

        {error && (
          <ErrorMessage message={error} className="mb-6" />
        )}

        {/* Reservations Table */}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reservations.map((reservation) => (
                    <tr
                      key={reservation.id}
                      className={isPastReservation(reservation.startTime || reservation.start_time, reservation.endTime || reservation.end_time)
                        ? 'bg-gray-50 text-gray-600'
                        : ''
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium min-w-[120px] border-r border-gray-100">
                        <div className="bg-blue-50 text-blue-800 px-2 py-1 rounded-md text-center">
                          {formatDate(reservation.startTime || reservation.start_time)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm min-w-[140px] border-r border-gray-100">
                        <div className="bg-gray-50 text-gray-800 px-2 py-1 rounded-md text-center">
                          {formatTime(reservation.startTime || reservation.start_time)} - {formatTime(reservation.endTime || reservation.end_time)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm min-w-[150px] border-r border-gray-100">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8">
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {reservation.client?.id === 'blocked' ? 'B' : (reservation.client?.fullName || reservation.client?.full_name || reservation.client_name || '-').charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-3">
                            <div className="font-medium text-gray-900">
                              {reservation.client?.id === 'blocked' ? '予約不可時間' : (reservation.client?.fullName || reservation.client?.full_name || reservation.client_name || '-')}
                            </div>
                            <div className="text-gray-500 text-xs">
                              {reservation.client?.id === 'blocked'
                                ? 'blocked@system'
                                : reservation.client?.email === 'guest@system'
                                  ? 'Guest'
                                  : (reservation.client?.email || '-')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm min-w-[120px] border-r border-gray-100">
                        {reservation.client?.id === 'blocked' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            予約不可
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {`${getMonthlyCount(reservation, reservations)}/${monthlyUsage[reservation.client.id]?.maxCount ?? '-'}回（${new Date(reservation.startTime || reservation.start_time).getMonth() + 1}月）`}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm min-w-[150px] border-r border-gray-100">
                        {reservation.memo || reservation.notes || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium min-w-[120px]">
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEdit(reservation);
                            }}
                            className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-3 py-1 rounded-md transition-colors"
                          >
                            変更
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();

                              const resId = reservation.id;
                              console.log('INLINE DELETE CLICKED:', resId);

                              if (!window.confirm('この予約を削除してもよろしいですか？')) {
                                return;
                              }

                              fetch(`/api/reservations/${resId}`, {
                                method: 'DELETE',
                                credentials: 'include'
                              })
                                .then(res => {
                                  console.log('Response status:', res.status);
                                  return res.json();
                                })
                                .then(data => {
                                  console.log('Response data:', data);
                                  alert('削除しました');
                                  window.location.reload();
                                })
                                .catch(err => {
                                  console.error('Error:', err);
                                  alert('エラー: ' + err.message);
                                });
                            }}
                            className="bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1 rounded-md transition-colors"
                          >
                            キャンセル
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {reservations.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">予約が見つかりません</p>
            <Link
              href="/admin/reservations/new"
              className="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              新規予約を作成
            </Link>
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
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始時刻
                  </label>
                  <input
                    type="datetime-local"
                    value={editFormData.startTime}
                    onChange={handleStartTimeChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了時刻
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
                  />
                </div>
                <div className="flex justify-between space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (editingReservation) {
                        setShowEditModal(false);
                        setEditingReservation(null);
                        handleDeleteReservation(editingReservation.id);
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    削除
                  </button>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowEditModal(false);
                        setEditingReservation(null);
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
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
