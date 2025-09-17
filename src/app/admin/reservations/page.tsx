'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { Reservation } from '@/types/common'

export default function AdminReservationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [monthlyUsage, setMonthlyUsage] = useState<{[key: string]: {currentCount: number, maxCount: number, planName: string}}>({})

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
          const clientIds = reservationsData.map((r: any) => r.client_id).filter(Boolean) as string[]
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
          const usageMap: {[key: string]: any} = {}
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
  }, [session, status])

  const handleDeleteReservation = async (reservationId: string) => {
    if (!confirm('この予約を削除してもよろしいですか？')) {
      return
    }

    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setReservations(prev => prev.filter(r => r.id !== reservationId))
      } else {
        const errorData = await response.json()
        setError(`予約削除に失敗しました: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Delete Error:', error)
      setError('予約削除中にエラーが発生しました')
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    })
  }

  const formatTime = (timeString?: string) => {
    if (!timeString) return ''
    return timeString.slice(0, 5) // HH:MM format
  }

  const isPastReservation = (date?: string, endTime?: string) => {
    if (!date || !endTime) return false
    const reservationDateTime = new Date(`${date}T${endTime}`)
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">予約管理</h1>
              <p className="mt-2 text-gray-600">全ての予約の確認・管理</p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/admin/reservations/new"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                新規予約作成
              </Link>
              <Link
                href="/dashboard"
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                ダッシュボードに戻る
              </Link>
            </div>
          </div>
        </div>

        {error && (
          <ErrorMessage message={error} className="mb-6" />
        )}

        {/* Reservations Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      回数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      会員名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日付
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      メモ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reservations.map((reservation) => (
                    <tr 
                      key={reservation.id}
                      className={isPastReservation(reservation.date, reservation.end_time) 
                        ? 'bg-gray-50 text-gray-600' 
                        : ''
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {monthlyUsage[reservation.client_id] 
                          ? `1回目 (${monthlyUsage[reservation.client_id].currentCount}/${monthlyUsage[reservation.client_id].maxCount})`
                          : '1回目'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {reservation.client_name || reservation.client?.full_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(reservation.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(reservation.start_time)} - {formatTime(reservation.end_time)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {reservation.memo || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleDeleteReservation(reservation.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          削除
                        </button>
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
    </div>
  )
}
