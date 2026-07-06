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
 * オーナー確認後の修正（2026-07-06）: 当初は週合計/週目標で表示していたが、
 * 「週合計は不要、入力日で割った平均摂取量が知りたい」との指摘を受け、
 * 記録日平均/1日あたりの目安に変更した（他の栄養項目のaverageモードと表記を統一）。
 */
export function CalorieHeroCard({ avg, target }: { avg: number; target: number }) {
    const pct = target > 0 ? Math.round((avg / target) * 100) : 0
    const over = avg > target
    const diffAbs = Math.round(Math.abs(target - avg)).toLocaleString()
    const { bar } = achievementColor(pct)

    return (
        <Card padding="sm">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800">カロリー</h3>
                <Badge tone={over ? 'danger' : 'success'}>{over ? `+${diffAbs}kcal/日` : `あと${diffAbs}kcal/日`}</Badge>
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
                <span className="stat-value">{Math.round(avg).toLocaleString()}</span>
                <span className="stat-unit">kcal/日（目標 {Math.round(target).toLocaleString()}kcal/日・記録日平均）</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
        </Card>
    )
}

/**
 * O-5: 2列グリッド用の項目カード。「記録日平均 / 1日あたりの目安」表記
 * （＝入力した日数で割った平均摂取量）で統一する。isFrequency（筋トレ等）のみ
 * 「今週 X/Y回」の専用表示。
 */
export function AchievementItemCard({
    label, unit, target, avg, prevAvg, prevRecordedDays, isFrequency, actual,
}: {
    label: string
    unit: string
    /** isFrequency時は週目標回数、それ以外は1日あたりの目安値。 */
    target: number
    /** 記録日平均。 */
    avg?: number
    prevAvg?: number
    prevRecordedDays?: number
    isFrequency?: boolean
    /** isFrequency時: 今週の実施回数。 */
    actual?: number
}) {
    const roundVal = (v: number) => (isFrequency ? Math.round(v) : Math.round(v * 10) / 10)
    const baseVal = isFrequency ? (actual || 0) : (avg || 0)
    const pct = target > 0 ? Math.round((baseVal / target) * 100) : 0
    const { bar, text } = achievementColor(pct)
    const hasPrevWeek = !isFrequency && (prevRecordedDays || 0) > 0
    const diff = hasPrevWeek && avg !== undefined && prevAvg !== undefined ? avg - prevAvg : null

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
