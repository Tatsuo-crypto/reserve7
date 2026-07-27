'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/components/ui/icons'
import Button from '@/components/ui/Button'

type HistoryRow = {
  id: string
  sessionDate: string
  sessionType: string | null
  trainerName: string | null
  exerciseCount: number
}

type MemberDetail = {
  member: { id: string; fullName: string; plan: string | null; status: string | null }
  history: HistoryRow[]
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00+09:00`).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  })
}

// AN-4: 管理者向け会員カルテ履歴画面(会員詳細ページの「トレーニングカルテ」から遷移)。
export default function AdminMemberKartePage() {
  const params = useParams()
  const router = useRouter()
  const memberId = params?.id as string
  const [data, setData] = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!memberId) return
    const fetchDetail = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/training-records/members/${memberId}`, { cache: 'no-store', credentials: 'include' })
        if (res.ok) setData(await res.json())
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [memberId])

  const backHref = `/admin/members/${memberId}/karte`

  return (
    <div className="min-h-screen bg-surface-base pb-12 pt-4">
      <div className="mx-auto max-w-lg px-4 sm:px-6">
        <div className="relative mb-6 flex items-center justify-center">
          <button
            type="button"
            onClick={() => router.push(`/admin/members/${memberId}`)}
            className="absolute left-0 flex h-10 w-10 items-center justify-center text-text-secondary"
          >
            <Icon name="chevronLeft" size={22} />
          </button>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">トレーニングカルテ</h1>
        </div>

        {loading && (
          <div className="rounded-2xl bg-surface-raised px-4 py-5 text-center text-sm text-text-secondary">
            読み込み中...
          </div>
        )}

        {!loading && data && (
          <>
            <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
              <div className="text-xl font-semibold text-text-primary">{data.member.fullName}</div>
              <div className="mt-1 text-sm font-normal text-text-secondary">{data.member.plan || '未設定'}</div>
            </div>

            <Button
              type="button"
              variant="primary"
              fullWidth
              className="mt-4"
              onClick={() => router.push(`/admin/karte/new?userId=${memberId}&back=${encodeURIComponent(backHref)}`)}
            >
              + 新規カルテを書く
            </Button>

            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-brand-500" />
                <h2 className="text-xl font-semibold text-text-primary">カルテ履歴</h2>
              </div>

              {data.history.length === 0 && (
                <div className="rounded-2xl bg-surface-raised px-4 py-5 text-center text-sm text-text-secondary">
                  まだカルテがありません
                </div>
              )}

              <div className="space-y-2">
                {data.history.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => router.push(`/admin/karte/${row.id}?back=${encodeURIComponent(backHref)}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-raised px-4 py-3 text-left active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-normal text-text-primary">{formatDate(row.sessionDate)}</div>
                      <div className="mt-0.5 text-xs font-normal text-text-muted">
                        {row.sessionType || '通常'} ・ {row.trainerName || '担当未設定'} ・ 種目{row.exerciseCount}件
                      </div>
                    </div>
                    <Icon name="chevronRight" size={16} className="shrink-0 text-text-muted" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
