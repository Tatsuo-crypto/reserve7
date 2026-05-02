'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoreDisplayName } from '@/lib/auth-utils'
import CalendarView from '@/components/CalendarView'

interface Trainer {
  id: string
  name: string
  email: string
  storeId: string
}

export default function TrainerDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string

  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month')
  const [calendarKey, setCalendarKey] = useState(0)

  useEffect(() => {
    const fetchTrainer = async () => {
      try {
        setLoading(true)

        // Verify token and get trainer info
        const response = await fetch(`/api/auth/trainer-token?token=${token}`)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          setError(errorData.error || '無効なURLです')
          return
        }
        const data = await response.json()
        setTrainer(data.trainer)

      } catch (err) {
        console.error('Error fetching trainer:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchTrainer()
    }
  }, [token])

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

  if (error || !trainer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-normal text-gray-900 mb-2">アクセスエラー</h1>
          <p className="text-gray-600">{error || '無効なURLです'}</p>
        </div>
      </div>
    )
  }

  const handleBackToMonth = () => {
    setCalendarKey(prev => prev + 1)
    setViewMode('month')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 h-16">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between relative">
          {/* Left: Spacer */}
          <div className="min-w-[44px]">
            {viewMode === 'timeline' && (
              <button
                onClick={handleBackToMonth}
                className="w-10 h-10 flex items-center justify-center text-blue-500 bg-white rounded-full shadow-sm border border-gray-100 transition-all active:scale-90"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>

          {/* Center: Title (Empty as requested) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <h1 className="text-[17px] font-normal text-gray-900 tracking-tight whitespace-nowrap pointer-events-auto">
              {viewMode === 'timeline' ? '予約詳細' : ''}
            </h1>
          </div>

          {/* Right: Account Pill */}
          <div className="z-10 flex justify-end min-w-[44px]">
            <div className="h-10 px-4 flex items-center gap-1 bg-white rounded-full shadow-sm border border-gray-100 transition-all">
              <span className="text-gray-700 text-[13px] font-normal truncate max-w-[100px]">
                {trainer.name}
              </span>
              <div className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-normal whitespace-nowrap bg-blue-500 text-white">
                トレーナー
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full pt-4 pb-12">
        {/* Toolbar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <div className="flex justify-between items-center">
            <div>
              {viewMode === 'month' && (
                <Link
                  href={`/trainer/${token}/shifts`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-normal text-gray-600 hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                >
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  シフト管理
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Calendar Content */}
        <Suspense fallback={<div className="p-8 text-center">読み込み中...</div>}>
          <CalendarView 
            key={calendarKey}
            onViewModeChange={setViewMode}
            onBackToMonth={handleBackToMonth}
            trainerToken={token}
          />
        </Suspense>
      </div>
    </div>
  )
}
