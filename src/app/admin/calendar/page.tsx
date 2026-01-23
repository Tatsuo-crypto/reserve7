'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import CalendarView from '@/components/CalendarView'
import Link from 'next/link'
import { getStoreDisplayName } from '@/lib/auth-utils'

function AdminCalendarPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const trainerToken = searchParams.get('trainerToken')
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month')
  const [calendarKey, setCalendarKey] = useState(0)
  const [trainer, setTrainer] = useState<{ name: string; storeId: string } | null>(null)

  useEffect(() => {
    if (trainerToken) {
      fetch(`/api/auth/trainer-token?token=${trainerToken}`)
        .then(res => res.json())
        .then(data => {
          if (data.trainer) setTrainer(data.trainer)
        })
        .catch(console.error)
    }
  }, [trainerToken])

  useEffect(() => {
    if (status === 'loading') return
    // If we have a trainer token, we don't need session auth
    if (trainerToken) return
    
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router, trainerToken])

  if (status === 'loading' && !trainerToken) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  // If unauthenticated and no token, show nothing (will redirect)
  if (status === 'unauthenticated' && !trainerToken) {
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
      {/* Trainer Header */}
      {trainerToken && (
        <header className="bg-gradient-to-b from-white to-gray-50 border-b border-gray-100 shadow mb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="text-xl font-semibold text-gray-900">
                T&J GYM
              </div>
              {trainer && (
                <div className="bg-white border border-gray-300 px-4 py-2 rounded-lg shadow-sm text-sm flex items-center space-x-3">
                  <span className="text-gray-700 font-medium">
                    {getStoreDisplayName(trainer.storeId)}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium border bg-blue-100 text-blue-700 border-blue-300">
                    トレーナー
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <div className="w-full">
        {/* Header */}
        <div className="mb-6 px-4">
          <div className="relative flex items-center justify-center">
            <button
              onClick={handleBackClick}
              className="absolute left-0 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">予約</h1>
              <p className="mt-1 text-sm text-gray-500">予約のステータス管理</p>
            </div>
          </div>
        </div>

        {/* Calendar Component */}
        <CalendarView 
          key={calendarKey}
          onViewModeChange={setViewMode}
          onBackToMonth={() => setViewMode('month')}
          trainerToken={trainerToken}
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
