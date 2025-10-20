'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import CalendarView from '@/components/CalendarView'
import Link from 'next/link'

function AdminCalendarPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const trainerToken = searchParams.get('trainerToken')
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month')
  const [calendarKey, setCalendarKey] = useState(0)

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  const handleBackClick = () => {
    if (viewMode === 'timeline') {
      // タイムライン表示の場合は月表示に戻る
      setCalendarKey(prev => prev + 1)
      setViewMode('month')
    } else {
      // 月表示の場合はダッシュボードに戻る
      router.push(trainerToken ? `/trainer/${trainerToken}` : '/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full">
        {/* Header */}
        <div className="mb-4">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleBackClick}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-7 h-7 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 text-center">
                <h1 className="text-3xl sm:text-2xl font-bold text-gray-900">予約</h1>
                <p className="mt-1 text-base sm:text-sm text-gray-600">予約のステータス管理</p>
              </div>
              <div className="w-7 sm:w-6" />
              {/* Header actions removed as requested */}
            </div>
          </div>
        </div>

        {/* Calendar Component */}
        <CalendarView 
          key={calendarKey}
          onViewModeChange={setViewMode}
          onBackToMonth={() => setViewMode('month')}
        />
      </div>
    </div>
  )
}

export default function AdminCalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <AdminCalendarPageContent />
    </Suspense>
  )
}
