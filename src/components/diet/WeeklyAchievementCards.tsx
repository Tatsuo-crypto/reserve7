import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'
import Badge from '@/components/ui/Badge'
import type { WeekDayRecordFlag } from '@/hooks/useWeeklyProgress'

/**
 * O-5: 週間パネル（週間目標／週間まとめ）共通の達成色ロジックと表示部品。
 * WeeklyProgressPanel / WeeklySummaryPanel の両方から使う（ロジックの二重管理を避けるため集約）。
 *
 * オーナー確認後の修正（2026-07-06）: 当初はO-2の「上限型/下限型」で色ロジックを
 * 分けていた（下限型は未達=グレー）が、グレーだと進捗バーが背景と同化して
 * 「進んでいるのか分からない」という指摘を受けた。以後は項目タイプを問わず
 * 「目標以内(100%以下)=緑、超過(100%超)=赤」のシンプルな二値ルールに統一する。
 */
export function achievementColor(pct: number): { bar: string; text: string } {
    if (pct > 100) return { bar: 'bg-state-danger-500', text: 'text-state-danger-600' }
    return { bar: 'bg-state-success-500', text: 'text-state-success-700' }
}

export type DisplayMode = 'total' | 'average'

/**
 * オーナー確認後の修正（2026-07-06）: 「週合計」「記録日平均」どちらか一方に固定せず、
 * ボタンで切り替えられるようにする。WeeklyProgressPanel/WeeklySummaryPanelそれぞれで
 * mode stateを持ち、このトグルとCalorieHeroCard/AchievementItemCardに渡す。
 */
export function DisplayModeToggle({ mode, onChange }: { mode: DisplayMode; onChange: (mode: DisplayMode) => void }) {
    return (
        <div className="px-2 flex justify-center">
            <div className="inline-flex bg-gray-100 rounded-full p-1">
                <button
                    onClick={() => onChange('total')}
                    className={`px-4 py-1.5 rounded-full text-xs font-normal transition-all ${mode === 'total' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                >
                    週の合計
                </button>
                <button
                    onClick={() => onChange('average')}
                    className={`px-4 py-1.5 rounded-full text-xs font-normal transition-all ${mode === 'average' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                >
                    記録日平均
                </button>
            </div>
        </div>
    )
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

/**
 * O-5: カロリー主役行。stat-value/stat-unitで数値ファーストに見せる。
 * オーナー確認後の修正（2026-07-06）: 「週合計」「記録日平均」をボタンで切替可能にした
 * （DisplayModeToggleでmodeを親から受け取る）。
 */
export function CalorieHeroCard({
    mode, actualTotal, weekTarget, avg, perDayTarget,
}: {
    mode: DisplayMode
    actualTotal: number
    weekTarget: number
    avg: number
    perDayTarget: number
}) {
    const isTotal = mode === 'total'
    const baseVal = isTotal ? actualTotal : avg
    const targetVal = isTotal ? weekTarget : perDayTarget
    const pct = targetVal > 0 ? Math.round((baseVal / targetVal) * 100) : 0
    const over = baseVal > targetVal
    const diffAbs = Math.round(Math.abs(targetVal - baseVal)).toLocaleString()
    const { bar } = achievementColor(pct)
    const unitSuffix = isTotal ? 'kcal' : 'kcal/日'

    return (
        <Card padding="sm">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800">カロリー</h3>
                <Badge tone={over ? 'danger' : 'success'}>{over ? `+${diffAbs}${unitSuffix}` : `あと${diffAbs}${unitSuffix}`}</Badge>
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
                <span className="stat-value">{Math.round(baseVal).toLocaleString()}</span>
                <span className="stat-unit">
                    {isTotal
                        ? `/ ${Math.round(targetVal).toLocaleString()} kcal（週合計）`
                        : `kcal/日（目標 ${Math.round(targetVal).toLocaleString()}kcal/日・記録日平均）`}
                </span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
        </Card>
    )
}

/**
 * O-5: 2列グリッド用の項目カード。mode='total'/'average'をCalorieHeroCardと
 * 同じ切替ボタンで統一表示する。isFrequency（筋トレ等）はmodeによらず
 * 「今週 X/Y回」の専用表示のまま。
 */
export function AchievementItemCard({
    label, unit, mode, perDayTarget, weekTarget, avg, prevAvg, actualTotal, prevActualTotal, prevRecordedDays, isFrequency, actual, target,
}: {
    label: string
    unit: string
    mode: DisplayMode
    /** mode='average'時の1日あたりの目安値。 */
    perDayTarget?: number
    /** mode='total'時の週合計目標値。 */
    weekTarget?: number
    /** mode='average'時: 記録日平均。 */
    avg?: number
    prevAvg?: number
    /** mode='total'時: 週合計実績。 */
    actualTotal?: number
    prevActualTotal?: number
    prevRecordedDays?: number
    isFrequency?: boolean
    /** isFrequency時: 今週の実施回数。 */
    actual?: number
    /** isFrequency時: 週目標回数。 */
    target?: number
}) {
    const useTotal = !isFrequency && mode === 'total'
    const roundVal = (v: number) => (isFrequency || useTotal ? Math.round(v) : Math.round(v * 10) / 10)
    const targetVal = isFrequency ? (target || 0) : (useTotal ? (weekTarget || 0) : (perDayTarget || 0))
    const baseVal = isFrequency ? (actual || 0) : (useTotal ? (actualTotal || 0) : (avg || 0))
    const pct = targetVal > 0 ? Math.round((baseVal / targetVal) * 100) : 0
    const { bar, text } = achievementColor(pct)
    const hasPrevWeek = !isFrequency && (prevRecordedDays || 0) > 0
    const curBase = useTotal ? actualTotal : avg
    const prevBase = useTotal ? prevActualTotal : prevAvg
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
            ) : useTotal ? (
                <div className="flex items-baseline gap-1">
                    <span className="stat-value !text-xl">{actualTotal !== undefined ? Math.round(actualTotal).toLocaleString() : '-'}</span>
                    <span className="stat-unit">/ {Math.round(targetVal).toLocaleString()}{unit}（週合計）</span>
                </div>
            ) : (
                <div className="flex items-baseline gap-1">
                    <span className="stat-value !text-xl">{avg !== undefined ? roundVal(avg).toLocaleString() : '-'}</span>
                    <span className="stat-unit">{unit}（目標{targetVal}{unit}）</span>
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
