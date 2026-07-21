'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/icons'

type CapacityData = {
  monthlySessions: number
  durationBreakdown: { durationMinutes: number; count: number }[]
  mostCommonDuration: number
  popularSlots: { weekday: number; weekdayLabel: string; hour: number; count: number }[]
  activeTrainerCount: number
  trainerWeeklyHours: { trainerId: string; fullName: string; weeklyHours: number }[]
  totalWeeklyHours: number
  maxMonthlySessions: number
  utilizationRate: number | null
  calculatedAt: string
}

export default function CapacityPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<CapacityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
  }, [status, session, router])

  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.role !== 'ADMIN') return
    let cancelled = false
    setLoading(true)
    fetch('/api/admin/capacity')
      .then((res) => {
        if (!res.ok) throw new Error('failed')
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setError('データの取得に失敗しました')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [status, session])

  if (status !== 'authenticated' || session?.user?.role !== 'ADMIN') return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-2">
        <Icon name="chartBar" size={24} className="text-brand-400" />
        <h1 className="text-xl font-semibold text-text-primary">稼働率</h1>
      </div>

      {loading && <p className="text-sm font-normal text-text-secondary">読み込み中...</p>}
      {error && <p className="text-sm font-normal text-red-300">{error}</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="今月のセッション数" value={data.monthlySessions} unit="件" />
            <StatCard
              label="稼働率"
              value={data.utilizationRate != null ? data.utilizationRate : '-'}
              unit={data.utilizationRate != null ? '%' : ''}
            />
            <StatCard label="月間最大セッション数" value={data.maxMonthlySessions} unit="件" />
            <StatCard label="在籍トレーナー数" value={data.activeTrainerCount} unit="名" />
          </div>

          <section className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
            <h2 className="text-sm font-semibold text-text-primary">1回の所要時間の内訳</h2>
            <p className="mt-1 text-xs font-normal text-text-secondary">
              最も多いのは{data.mostCommonDuration}分(稼働率の計算にはこの値を使用)
            </p>
            <div className="mt-3 space-y-1.5">
              {data.durationBreakdown.map((d) => (
                <div key={d.durationMinutes} className="flex items-center justify-between text-sm font-normal text-text-secondary">
                  <span>{d.durationMinutes}分</span>
                  <span className="tabular-nums text-text-primary">{d.count}件</span>
                </div>
              ))}
              {data.durationBreakdown.length === 0 && (
                <p className="text-sm font-normal text-text-secondary">データがありません</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
            <h2 className="text-sm font-semibold text-text-primary">トレーナー別 週間シフト時間</h2>
            <p className="mt-1 text-xs font-normal text-text-secondary">
              合計 {data.totalWeeklyHours}時間/週(シフトテンプレート登録分のみ集計)
            </p>
            <div className="mt-3 space-y-1.5">
              {data.trainerWeeklyHours.map((t) => (
                <div key={t.trainerId} className="flex items-center justify-between text-sm font-normal text-text-secondary">
                  <span className="text-text-primary">{t.fullName}</span>
                  <span className="tabular-nums">{t.weeklyHours}時間/週</span>
                </div>
              ))}
              {data.trainerWeeklyHours.length === 0 && (
                <p className="text-sm font-normal text-text-secondary">シフトテンプレートが登録されていません</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
            <h2 className="text-sm font-semibold text-text-primary">予約が埋まりやすい時間帯(直近3ヶ月・上位10)</h2>
            <div className="mt-3 space-y-1.5">
              {data.popularSlots.map((s, i) => (
                <div key={`${s.weekday}-${s.hour}`} className="flex items-center justify-between text-sm font-normal text-text-secondary">
                  <span className="text-text-primary">
                    {i + 1}. {s.weekdayLabel}曜 {s.hour}:00〜
                  </span>
                  <span className="tabular-nums">{s.count}件</span>
                </div>
              ))}
              {data.popularSlots.length === 0 && (
                <p className="text-sm font-normal text-text-secondary">データがありません</p>
              )}
            </div>
          </section>

          <p className="text-xs font-normal text-text-secondary">
            ※月間最大セッション数は「週間シフト時間合計 × 4.345週 ÷ 所要時間」の理論値です。休憩・移動時間は考慮していないため、実際の上限はこれよりやや低くなります。
          </p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-raised p-4">
      <div className="text-xs font-normal text-text-secondary">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="stat-value">{value}</span>
        {unit && <span className="text-xs font-normal text-text-secondary">{unit}</span>}
      </div>
    </div>
  )
}
