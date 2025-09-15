'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function CalendarTestPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/reservations')
    }
  }, [status, session, router])

  const handleTestCalendar = async () => {
    setIsLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/admin/calendar-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'テスト予約',
          startTime: '2025-09-15T17:00:00.000Z',
          endTime: '2025-09-15T18:00:00.000Z',
          clientName: 'テストクライアント',
          clientEmail: 'test@example.com',
          notes: 'Googleカレンダー連携のテストイベントです'
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`成功: ${data.message}${data.eventId ? ` (イベントID: ${data.eventId})` : ''}`)
      } else {
        setError(`エラー: ${data.error}`)
      }
    } catch (err) {
      setError(`ネットワークエラー: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Googleカレンダー連携テスト
          </h1>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              このテストでは、Googleカレンダーにテストイベントを作成して連携が正常に動作するかを確認します。
            </p>
            
            <button
              onClick={handleTestCalendar}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading ? 'テスト中...' : 'カレンダー連携テスト実行'}
            </button>

            {message && (
              <div className="p-4 rounded-md bg-green-50 border border-green-200">
                <p className="text-sm text-green-800">{message}</p>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-md bg-red-50 border border-red-200">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="mt-6 text-xs text-gray-500">
              <h3 className="font-medium mb-2">設定確認項目:</h3>
              <ul className="space-y-1">
                <li>• Google Cloud ProjectでCalendar APIが有効</li>
                <li>• サービスアカウントキーが正しく設定</li>
                <li>• カレンダーIDが正しく設定</li>
                <li>• サービスアカウントがカレンダーに共有済み</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
