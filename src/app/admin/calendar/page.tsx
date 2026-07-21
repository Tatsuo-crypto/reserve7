'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import CalendarView from '@/components/CalendarView'
import Link from 'next/link'
import { getStoreDisplayName } from '@/lib/auth-utils'
import Icon from '@/components/ui/icons'

function AdminCalendarPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const trainerToken = searchParams.get('trainerToken')
  const [, setViewMode] = useState<'month' | 'timeline'>('month')
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
      return
    }

    // /admin/calendar はトークン認証トレーナー専用の入口。
    // セッション認証のADMINが直接アクセスした場合は、正であるダッシュボードのカレンダーへ寄せる。
    if (status === 'authenticated') {
      router.replace('/dashboard?tab=home')
    }
  }, [status, router, trainerToken])

  if (status === 'loading' && !trainerToken) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">読み込み中...</p>
        </div>
      </div>
    )
  }

  // If unauthenticated and no token, show nothing (will redirect)
  if (status === 'unauthenticated' && !trainerToken) {
    return null
  }

  // セッション認証のADMINがトークンなしでアクセスした場合も、ダッシュボードへのリダイレクト待ちのため何も描画しない
  if (status === 'authenticated' && !trainerToken) {
    return null
  }

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Trainer Header */}
      {trainerToken && (
        <header className="bg-gradient-to-b from-white to-gray-50 border-b border-border-subtle shadow mb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="text-xl font-semibold text-text-primary">
                T&J GYM
              </div>
              {trainer && (
                <div className="bg-surface-raised border border-border-strong px-4 py-2 rounded-lg shadow-sm text-sm flex items-center space-x-3">
                  <span className="text-text-secondary font-normal">
                    {getStoreDisplayName(trainer.storeId)}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-normal border bg-brand-500/15 text-brand-300 border-brand-500/30">
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
          <div className="flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-text-primary">予約</h1>
              <p className="mt-1 text-sm text-text-secondary">予約のステータス管理</p>
            </div>
            {!trainerToken && (
              <Link
                href="/admin/shifts"
                className="absolute right-0 flex items-center text-sm text-text-secondary hover:text-brand-600 transition-colors"
              >
                <Icon name="clock" size={20} className="mr-1" />
                シフト
              </Link>
            )}
          </div>
        </div>

        {/* Calendar Component */}
        <CalendarView 
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
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">読み込み中...</p>
        </div>
      </div>
    }>
      <AdminCalendarPageContent />
    </Suspense>
  )
}
