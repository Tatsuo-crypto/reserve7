'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import TrainingKarteForm from '@/components/TrainingKarteForm'

// AN-4: 管理者向けトレーニングカルテ入力・編集画面(トレーナー向けと同じ共通コンポーネントを使用)。
function AdminKarteContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const sessionId = params?.sessionId as string
  const reservationId = searchParams.get('reservationId')
  const userId = searchParams.get('userId')
  const back = searchParams.get('back')

  return (
    <TrainingKarteForm
      sessionKey={sessionId}
      reservationId={reservationId}
      userId={userId}
      backHref={back || '/admin/members'}
    />
  )
}

export default function AdminKartePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-base" />}>
      <AdminKarteContent />
    </Suspense>
  )
}
