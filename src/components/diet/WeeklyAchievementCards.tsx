import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'
import Badge from '@/components/ui/Badge'
import type { WeekDayRecordFlag } from '@/hooks/useWeeklyProgress'

/**
 * O-5: 週間パネル（週間目標／週間まとめ）共通の達成色ロジックと表示部品。
 * WeeklyProgressPanel / WeeklySummaryPanel の両方から使う（ロジックの二重管理を避けるため集約）。
 *
 * O-2: 項目タイプごとの達成色ロジック。
 * 上限型(超えたくない): calories/fat/carbs/sugar/salt → 超過=赤、圏内=緑。
 * 下限型(満たしたい): protein/fiber/water/steps/sleep/workout → 達成=緑、未達=グレー（赤は使わない）。
 * O-3が求める「連続的なグラデーション」の簡易近似として、上限型のみ3段階（緑/黄/赤）の
 * ステップカラーで代替している（実装コストと視認性のバランスを取った簡略化）。
 */
export function upperBoundColors(pct: number): { bar: string; text: string } {
    if (pct > 100) return { bar: 'bg-state-danger-500', text: 'text-state-danger-600' }
    if (pct >= 90) return { bar: 'bg-amber-500', text: 'text-amber-600' }
    return { bar: 'bg-state-success-500', text: 'text-state-success-700' }
}
export function lowerBoundColors(pct: number): { bar: string; text: string } {
    if (pct >= 100) return { bar: 'bg-state-success-500', text: 'text-state-success-700' }
    return { bar: 'bg-gray-300', text: 'text-gray-400' }
}

/** O-5: 記録チェック表。7日分の食事記録の有無を丸アイコンで見せる。 */
export function RecordCheckTable({ weekDays }: { weekDays: WeekDayRecordFlag[] }) {
    return (
        <Card padding="sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">記録チェック表</h3>
            <div className="grid grid-cols-7 gap-1.5">
                {weekDays.map(day => (
                    <div key={day.date} className="flex flex-col items-center gap-1">
                        <span className={`text-[10px] font-normal ${day.isToday ? 'text-brand-600' : 'text-gray-400'}`}>{day.label}</span>
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${day.recorded ? 'bg-state-success-500 text-white' : 'bg-gray-100 text-gray-300'} ${day.isToday ? 'ring-2 ring-brand-500 ring-offset-1' : ''}`}
                        >
                            {day.recorded ? <Icon name="check" size={14} /> : <Icon name="plus" size={12} />}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    )
}

/** O-5: カロリー主役行。stat-value/stat-unitで数値ファーストに見せる。 */
export function CalorieHeroCard({ actual, target }: { actual: number; target: number }) {
    const pct = target > 0 ? Math.round((actual / target) * 100) : 0
    const over = actual > target
    const diffAbs = Math.round(Math.abs(target - actual)).toLocaleString()
    const { bar } = upperBoundColors(pct)

    return (
        <Card padding="sm">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800">カロリー</h3>
                <Badge tone={over ? 'danger' : 'success'}>{over ? `+${diffAbs}kcal` : `あと${diffAbs}kcal`}</Badge>
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
                <span className="stat-value">{Math.round(actual).toLocaleString()}</span>
                <span className="stat-unit">/ {Math.round(target).toLocaleString()} kcal（週合計）</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
        </Card>
    )
}

/**
 * O-5: 2列グリッド用の項目カード。上限型/下限型で達成色ロジックを切り替える。
 *
 * mode:
 *   - 'total'   : カロリー主役行と同じ「週合計 / 週目標」表記（食事・栄養系の項目で使用。
 *                 実績・比率の基準をカロリーと完全に揃え、「カロリーだけ週合計、他は日平均」
 *                 という見え方の不整合を解消する）。
 *   - 'average' : 「記録日平均 / 目安（日）」表記（歩数・水分・睡眠など生活系の項目で使用。
 *                 週合計より1日あたりの目安のほうが実用的なため維持）。
 * isFrequency（筋トレ等）は上記どちらとも異なる「今週 X/Y回」の専用表示のまま。
 */
export function AchievementItemCard({
    label, type, unit, target, avg, prevAvg, prevRecordedDays, isFrequency, actual, mode = 'average', prevActual,
}: {
    label: string
    type: 'upper' | 'lower'
    unit: string
    /** mode='total'/'frequency'时は週合計の目標値、mode='average'時は1日あたりの目安値。 */
    target: number
    /** mode='average'時: 記録日平均。 */
    avg?: number
    prevAvg?: number
    prevRecordedDays?: number
    isFrequency?: boolean
    /** mode='total'/'frequency'時: 週合計の実績値。 */
    actual?: number
    mode?: 'total' | 'average'
    /** mode='total'時の前週合計値。 */
    prevActual?: number
}) {
    const roundVal = (v: number) => (isFrequency ? Math.round(v) : Math.round(v * 10) / 10)
    const useTotal = isFrequency || mode === 'total'
    const baseVal = useTotal ? (actual || 0) : (avg || 0)
    const pct = target > 0 ? Math.round((baseVal / target) * 100) : 0
    const { bar, text } = type === 'upper' ? upperBoundColors(pct) : lowerBoundColors(pct)
    const hasPrevWeek = !isFrequency && (prevRecordedDays || 0) > 0
    const prevBase = mode === 'total' ? prevActual : prevAvg
    const curBase = mode === 'total' ? actual : avg
    const diff = hasPrevWeek && curBase !== undefined && prevBase !== undefined ? curBase - prevBase : null

    return (
        <Card padding="sm">
            <div className="flex justify-between items-center mb-1">
                <p className="text-[10px] font-normal text-gray-400 uppercase tracking-widest leading-none">{label}</p>
                <p className={`text-xs font-normal tabular-nums leading-none ${text}`}>{pct}%</p>
            </div>

            {isFrequency ? (
                <div className="flex items-baseline gap-1">
                    <span className="stat-value !text-xl">{actual}</span>
                    <span className="stat-unit">/{target}{unit}</span>
                </div>
            ) : mode === 'total' ? (
                <div className="flex items-baseline gap-1">
                    <span className="stat-value !text-xl">{actual !== undefined ? Math.round(actual).toLocaleString() : '-'}</span>
                    <span className="stat-unit">/ {Math.round(target).toLocaleString()}{unit}（週合計）</span>
                </div>
            ) : (
                <div className="flex items-baseline gap-1">
                    <span className="stat-value !text-xl">{avg !== undefined ? roundVal(avg).toLocaleString() : '-'}</span>
                    <span className="stat-unit">{unit}（目標{target}{unit}）</span>
                </div>
            )}

            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-2">
                <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>

            {/* 前週比: H-2の「判断色をつけずグレー表示」ルールを維持 */}
            <p className="mt-1.5 text-[10px] font-normal text-gray-400 tabular-nums">
                {!isFrequency ? (
                    diff !== null ? (
                        <>{diff === 0 ? '±0' : diff > 0 ? `↑+${roundVal(diff).toLocaleString()}` : `↓${roundVal(diff).toLocaleString()}`} 前週比</>
                    ) : '前週比 −'
                ) : ' '}
            </p>
        </Card>
    )
}
