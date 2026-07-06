'use client'

import type { WeightWeeklyStats } from '@/hooks/useWeeklyProgress'
import Card from '@/components/ui/Card'

interface WeightWeeklyCompareProps {
    weight: WeightWeeklyStats | null | undefined
    /** Compact mode drops the card chrome so it can sit inline (e.g. Home card 3). */
    compact?: boolean
}

/**
 * 体重は単日の値がぶれやすいため「今週平均 vs 先週平均」の比較でのみ見せる、
 * 3画面共通の表示コンポーネント（H-3）。
 *   - WeeklyProgressPanel の先頭
 *   - 会員 HomeTab のカード3
 *   - 管理者 diet-plan「サマリー」タブ
 */
export default function WeightWeeklyCompare({ weight, compact = false }: WeightWeeklyCompareProps) {
    const hasThisWeek = weight?.thisWeekAvg !== null && weight?.thisWeekAvg !== undefined
    const hasLastWeek = weight?.lastWeekAvg !== null && weight?.lastWeekAvg !== undefined

    const body = !hasThisWeek ? (
        <p className="text-sm text-gray-400">今週の体重記録がありません</p>
    ) : (
        <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-semibold text-gray-800 tabular-nums">{weight!.thisWeekAvg!.toFixed(1)}kg</span>
            {hasLastWeek && weight!.diffAbs !== null && (
                <span className="text-sm font-normal text-gray-500">
                    先週比 {weight!.diffAbs! > 0 ? '+' : ''}{weight!.diffAbs!.toFixed(1)}kg
                    {weight!.diffPercent !== null && (
                        <>（{weight!.diffPercent! > 0 ? '+' : ''}{weight!.diffPercent!.toFixed(1)}%）</>
                    )}
                </span>
            )}
        </div>
    )

    if (compact) {
        return (
            <div>
                <p className="text-[11px] font-normal text-gray-400 tracking-widest uppercase mb-1">体重（今週平均）</p>
                {body}
            </div>
        )
    }

    return (
        <Card padding="sm">
            <p className="text-[11px] font-normal text-gray-400 tracking-widest uppercase mb-1">体重（今週平均）</p>
            {body}
        </Card>
    )
}
