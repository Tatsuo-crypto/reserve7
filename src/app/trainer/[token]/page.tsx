'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoreDisplayName } from '@/lib/auth-utils'
import CalendarView from '@/components/CalendarView'
import Icon from '@/components/ui/icons'

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
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error || !trainer) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-normal text-text-primary mb-2">アクセスエラー</h1>
          <p className="text-text-secondary">{error || '無効なURLです'}</p>
        </div>
      </div>
    )
  }

  const handleBackToMonth = () => {
    setCalendarKey(prev => prev + 1)
    setViewMode('month')
  }

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Top Navigation */}
      <header className="bg-surface-raised/80 backdrop-blur-md border-b border-border-subtle sticky top-0 z-50 h-16">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between relative">
          {/* Left: Spacer */}
          <div className="min-w-[44px]">
            {viewMode === 'timeline' && (
              <button
                onClick={handleBackToMonth}
                className="w-10 h-10 flex items-center justify-center text-brand-500 bg-surface-raised rounded-full shadow-sm border border-border-subtle transition-all active:scale-90"
              >
                <Icon name="chevronLeft" size={24} />
              </button>
            )}
          </div>

          {/* Center: Title (Empty as requested) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <h1 className="text-[17px] font-normal text-text-primary tracking-tight whitespace-nowrap pointer-events-auto">
              {viewMode === 'timeline' ? '予約詳細' : ''}
            </h1>
          </div>

          {/* Right: Account Pill */}
          <div className="z-10 flex justify-end min-w-[44px]">
            <div className="h-10 px-4 flex items-center gap-1 bg-surface-raised rounded-full shadow-sm border border-border-subtle transition-all">
              <span className="text-text-secondary text-[13px] font-normal truncate max-w-[100px]">
                {trainer.name}
              </span>
              <div className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-normal whitespace-nowrap bg-brand-500 text-white">
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-surface-raised border border-border-strong rounded-full text-sm font-normal text-text-secondary hover:bg-surface-base transition-all shadow-sm active:scale-95"
                >
                  <Icon name="clock" size={16} className="text-brand-500" />
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
