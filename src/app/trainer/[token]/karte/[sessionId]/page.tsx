'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import TrainingKarteForm from '@/components/TrainingKarteForm'

// AN-4: トレーナー向けトレーニングカルテ入力・編集画面。
// sessionIdが'new'の場合はreservationId(予約タップ経由)またはuserId(会員詳細経由)を
// クエリで受け取り、find-or-createでセッションを作る。
function TrainerKarteContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params?.token as string
  const sessionId = params?.sessionId as string
  const reservationId = searchParams.get('reservationId')
  const userId = searchParams.get('userId')
  const back = searchParams.get('back')

  return (
    <TrainingKarteForm
      trainerToken={token}
      sessionKey={sessionId}
      reservationId={reservationId}
      userId={userId}
      backHref={back || `/trainer/${token}`}
    />
  )
}

export default function TrainerKartePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-base" />}>
      <TrainerKarteContent />
    </Suspense>
  )
}
