'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import StatCard from '@/components/ui/StatCard'

type MonthlyRow = {
  month: string
  activeEnd: number
  newCount: number
  newByRoute: { route: string; count: number }[]
  withdrawnCount: number
}

type CurrentMember = {
  id: string
  name: string
  plan: string | null
  monthlyFee: number | null
  storeName: string
  joinDate: string | null
}

type BusinessReport = {
  generatedAt: string
  monthly: MonthlyRow[]
  currentMembers: CurrentMember[]
  planBreakdown: { plan: string; count: number }[]
  revenue: {
    activeMemberCount: number
    activeMonthlyFeeSum: number
    salesTableThisMonth: number
  }
  trial: {
    periodMonths: number
    count: number
  }
}

export default function BusinessReportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [report, setReport] = useState<BusinessReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    let ignore = false
    setLoading(true)
    fetch('/api/admin/business-report')
      .then((res) => {
        if (!res.ok) throw new Error('failed')
        return res.json()
      })
      .then((json) => {
        if (!ignore) setReport(json)
      })
      .catch(() => {
        if (!ignore) setError('データを取得できませんでした')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  if (status === 'loading') return null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12 space-y-8">
      <h1 className="text-xl font-semibold text-text-primary">経営レポート</h1>

      {loading ? (
        <p className="text-sm font-normal text-text-secondary">読み込み中...</p>
      ) : error || !report ? (
        <p className="text-sm font-normal text-text-secondary">{error || 'データを取得できませんでした'}</p>
      ) : (
        <>
          {/* 1〜3. 月末会員数・入会数・退会数(過去6ヶ月) */}
          <section>
            <h2 className="text-xl font-semibold text-text-primary">1〜3. 月次推移(直近6ヶ月・完了月まで)</h2>
            <p className="mt-1 text-xs font-normal text-text-secondary">
              退会理由はアプリ上で記録していないため集計できません(3の「理由」欄は空欄)。
            </p>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-border-subtle">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-base text-xs font-normal text-text-secondary">
                    <th className="px-3 py-2 text-left">月</th>
                    <th className="px-3 py-2 text-right">月末会員数</th>
                    <th className="px-3 py-2 text-right">入会</th>
                    <th className="px-3 py-2 text-right">退会</th>
                    <th className="px-3 py-2 text-left">入会経路の内訳</th>
                  </tr>
                </thead>
                <tbody>
                  {report.monthly.map((m) => (
                    <tr key={m.month} className="border-b border-border-subtle last:border-0">
                      <td className="px-3 py-2 font-normal text-text-primary">{m.month}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{m.activeEnd}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{m.newCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{m.withdrawnCount}</td>
                      <td className="px-3 py-2 text-xs font-normal text-text-secondary">
                        {m.newByRoute.length > 0
                          ? m.newByRoute.map((r) => `${r.route}${r.count}`).join(' / ')
                          : '―'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. 現会員の入会日リスト */}
          <section>
            <h2 className="text-xl font-semibold text-text-primary">4. 現会員 {report.currentMembers.length}名の入会日</h2>
            <div className="mt-3 max-h-96 overflow-y-auto rounded-2xl border border-border-subtle">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised">
                  <tr className="border-b border-border-subtle bg-surface-base text-xs font-normal text-text-secondary">
                    <th className="px-3 py-2 text-left">氏名</th>
                    <th className="px-3 py-2 text-left">プラン</th>
                    <th className="px-3 py-2 text-left">店舗</th>
                    <th className="px-3 py-2 text-left">入会日</th>
                  </tr>
                </thead>
                <tbody>
                  {report.currentMembers.map((m) => (
                    <tr key={m.id} className="border-b border-border-subtle last:border-0">
                      <td className="px-3 py-2 font-normal text-text-primary">{m.name}</td>
                      <td className="px-3 py-2 text-xs font-normal text-text-secondary">{m.plan || '―'}</td>
                      <td className="px-3 py-2 text-xs font-normal text-text-secondary">{m.storeName}</td>
                      <td className="px-3 py-2 tabular-nums text-text-primary">{m.joinDate || '不明'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 5. GBP */}
          <section>
            <h2 className="text-xl font-semibold text-text-primary">5. GBPインサイト</h2>
            <p className="mt-2 text-sm font-normal text-text-secondary">
              Googleビジネスプロフィールの表示回数・ウェブサイトクリック・電話・経路リクエストは、このアプリでは記録していません。Googleビジネスプロフィールの管理画面(パフォーマンス欄)を両店それぞれで確認してください。
            </p>
          </section>

          {/* 6. プラン内訳 */}
          <section>
            <h2 className="text-xl font-semibold text-text-primary">6. 現会員のプラン内訳</h2>
            <div className="mt-3 rounded-2xl border border-border-subtle bg-surface-base p-4">
              {report.planBreakdown.map((p) => (
                <div key={p.plan} className="flex items-center justify-between border-b border-border-subtle py-1.5 text-sm font-normal last:border-0">
                  <span className="text-text-primary">{p.plan}</span>
                  <span className="tabular-nums text-text-secondary">{p.count}名</span>
                </div>
              ))}
            </div>
          </section>

          {/* 7. 月商内訳 */}
          <section>
            <h2 className="text-xl font-semibold text-text-primary">7. 月商の内訳</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatCard label="現会員の月額会費合計(理論値)" value={report.revenue.activeMonthlyFeeSum.toLocaleString()} unit="円" />
              <StatCard label="対象会員数" value={report.revenue.activeMemberCount} unit="名" />
            </div>
            <p className="mt-2 text-xs font-normal text-text-secondary">
              これは「今在籍している会員の月額会費を単純合計した理論値」です。旗艦(高額パッケージ)・体験料・その他の売上はアプリ上に記録がなく、算出できません。月商80万円との差額(理論値との差)は、旗艦や体験料など会費以外の売上と考えられます。
            </p>
          </section>

          {/* 8. 旗艦 */}
          <section>
            <h2 className="text-xl font-semibold text-text-primary">8. 旗艦(20万円)購入者のその後</h2>
            <p className="mt-2 text-sm font-normal text-text-secondary">
              アプリのデータには「旗艦」に相当するプランや単発売上の記録が見当たりませんでした(月額プランと入退会履歴のみ管理)。購入者7名の月額移行状況・継続月数は、アプリ外の記録(手書き・別台帳など)を確認する必要があります。
            </p>
          </section>

          {/* 9. 体験予約数(42%の分母の目安) */}
          <section>
            <h2 className="text-xl font-semibold text-text-primary">9. 体験予約数(直近{report.trial.periodMonths}ヶ月)</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-xs">
              <StatCard label="体験予約数" value={report.trial.count} unit="件" />
            </div>
            <p className="mt-2 text-xs font-normal text-text-secondary">
              予約タイトルに「体験」を含むものをカウントしています。ただし体験予約は正式な会員アカウントに紐づいていないため、そのうち何人が実際に入会したか(分子)はアプリ上で自動集計できません。入会経路が「紹介」以外の新規会員を体験経由とみなすなど、手動での突き合わせが必要です。
            </p>
          </section>

          {/* 10, 11, 12, 14 */}
          <section>
            <h2 className="text-xl font-semibold text-text-primary">10・11・12・14. アプリ外のデータが必要な項目</h2>
            <ul className="mt-3 space-y-2 text-sm font-normal text-text-secondary">
              <li><span className="text-text-primary">10. 広告の表示回数・クリック数・消化額</span> — Google広告(スマートキャンペーン)の管理画面で確認してください。</li>
              <li><span className="text-text-primary">11. 現預金の6ヶ月推移</span> — 銀行口座・会計ソフトの記録が必要です。</li>
              <li><span className="text-text-primary">12. 固定費の内訳</span> — 家賃契約・各種明細など会計側の記録が必要です。</li>
              <li><span className="text-text-primary">14. 問い合わせ件数(フォーム/電話/LINE/店頭)</span> — このアプリは予約・会員管理のみで、体験予約に至る前の問い合わせ自体は記録していません。今後集計したい場合は、問い合わせ受付時に記録する仕組み(フォームやメモ)を別途用意する必要があります。</li>
            </ul>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-xl font-semibold text-text-primary">13. 繁忙枠(平日夜・土曜午前)の埋まり率</h2>
            <p className="mt-2 text-sm font-normal text-text-secondary">
              シフトと予約のデータから算出は可能ですが、今回はまだ実装していません。必要であれば「稼働率」ページの仕組みを応用して追加します。
            </p>
          </section>
        </>
      )}
    </div>
  )
}
