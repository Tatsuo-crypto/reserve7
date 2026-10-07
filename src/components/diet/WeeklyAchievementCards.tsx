import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
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
/**
 * AR-2: 横棒グラフの色。オーナー指定により「通常=青、目標を超えたら=赤」に変更した。
 * これはO-1(差し色はオレンジ1色)とS-4(グラフ系列色から赤を排除)を、進捗バーに限って
 * 意図的に見直したもの。進捗バーは「達成度を一目で判断する」ための計器であり、
 * 装飾ではなく状態表示だと整理し直したため、超過を赤で明示する方を優先する。
 * アプリ全体の差し色がオレンジである点は変わらない(バーだけがこの規則に従う)。
 */
export function achievementColor(pct: number): { bar: string; text: string } {
    if (pct > 100) return { bar: 'bg-red-500', text: 'text-red-700' }
    return { bar: 'bg-blue-500', text: 'text-blue-700' }
}

/** AR-1: 'day'(1日分) / 'total'(週合計) / 'average'(記録日平均) の3表示。 */
export type DisplayMode = 'day' | 'total' | 'average'
type MetricStatus = 'empty' | 'normal' | 'warning' | 'danger'

function statusClasses(status: MetricStatus) {
    // AR-2: 通常=青、超過=赤。未達(下限型の未到達)は「超過」とは別の状態なので従来どおり amber。
    const map = {
        empty: { bar: 'bg-surface-overlay', text: 'text-text-muted', badge: 'bg-surface-overlay text-text-muted' },
        normal: { bar: 'bg-blue-500', text: 'text-blue-700', badge: 'bg-blue-500/15 text-blue-700' },
        warning: { bar: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-500/15 text-amber-700' },
        danger: { bar: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-500/15 text-red-700' },
    } satisfies Record<MetricStatus, { bar: string; text: string; badge: string }>
    return map[status]
}

/**
 * BE-4: 画面に出す数値は「小数第1位までの切り上げ」で統一する。
 *
 * 目標値は「週の目標 ÷ 7」のような割り算で出るため 66.42857142857143 のような
 * 生の浮動小数がそのまま表示されてしまっていた(平均表示の目標欄)。
 * 切り捨てでも四捨五入でもなく切り上げにしているのは、目標は「ここまで摂ってよい/
 * ここまで摂るべき」の線であり、表示のために内側に丸めると実際の判定(pct)と
 * ズレて見えるため。整数になる場合は小数点以下を出さない。
 */
function ceil1(value: number) {
    return Math.ceil(value * 10) / 10
}

function fmt1(value: number) {
    return ceil1(value).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

/**
 * BE-5: カロリーだけは小数を出さず整数に切り上げる。
 * 1,699.4kcal のような表示は精度が意味を持たないうえ、桁数が多いぶん
 * 主役の数字の可読性を落とす。g/L/hの項目は0.1刻みに意味があるのでfmt1のまま。
 */
function fmt0(value: number) {
    return Math.ceil(value).toLocaleString()
}

/**
 * オーナー確認後の修正（2026-07-06）: 「週の合計」「平均値」どちらか一方に固定せず、
 * ボタンで切り替えられるようにする。WeeklyProgressPanel/WeeklySummaryPanelそれぞれで
 * mode stateを持ち、このトグルとCalorieHeroCard/AchievementItemCardに渡す。
 * トグル自体がどちらのモードか示しているため、各カード内には「週合計」「記録日平均」
 * といった重複する文言は表示しない。
 */
export type RecordPeriod = '1d' | '1w' | '2w' | '3w' | '1m' | '3m' | '6m' | '1y' | 'all'

export function DisplayModeToggle({ mode, onChange, period = '1w', onPeriodChange }: { mode: DisplayMode; onChange: (mode: DisplayMode) => void; period?: RecordPeriod; onPeriodChange?: (period: RecordPeriod) => void }) {
    const periodOptions: Array<{ key: RecordPeriod; label: string }> = [
        { key: '1d', label: '日' }, { key: '1w', label: '週' }, { key: '2w', label: '2週間' }, { key: '3w', label: '3週間' },
        { key: '1m', label: '月' }, { key: '3m', label: '3ヶ月' }, { key: '6m', label: '半年' }, { key: '1y', label: '1年' }, { key: 'all', label: '全期間' },
    ]
    return (
        <div className="flex items-center justify-center gap-2 px-2">
            <select aria-label="日付の範囲" value={period} onChange={e => onPeriodChange?.(e.target.value as RecordPeriod)} className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-base px-3 py-2 text-xs text-text-primary">
                {periodOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
            <select aria-label="集計方法" value={mode === 'day' ? 'average' : mode} onChange={e => onChange(e.target.value as DisplayMode)} className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-base px-3 py-2 text-xs text-text-primary">
                <option value="average">平均</option>
                <option value="total">合計</option>
            </select>
        </div>
    )
}

/**
 * O-5: 記録チェック表。7日分の食事記録の有無を丸アイコンで見せる。
 * AT-1: 曜日をタップするとその日の数値に切り替わるようにした(onSelectDateを渡したときのみ)。
 *       選択中の日はリングで示す。
 */
export function RecordCheckTable({
    weekDays,
    selectedDate,
    onSelectDate,
}: {
    weekDays: WeekDayRecordFlag[]
    /** AT-1: 「日」表示で選択中の日付。タップ操作を有効にした場合のみ意味を持つ。 */
    selectedDate?: string
    onSelectDate?: (date: string) => void
}) {
    const interactive = Boolean(onSelectDate)

    return (
        <Card padding="xs">
            {/* BE-4: 「曜日をタップでその日を表示」の説明文は削除。丸が押せることは
                タップすれば分かるうえ、この画面は縦の情報量を優先する。 */}
            <div className="mb-1.5">
                <h3 className="text-xs font-semibold text-text-primary">記録チェック表</h3>
            </div>
            <div className="grid grid-cols-7 gap-1">
                {weekDays.map(day => {
                    const isSelected = interactive && day.date === selectedDate
                    const circle = (
                        <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${day.recorded ? 'bg-brand-500 text-white' : 'bg-surface-overlay text-text-muted'} ${
                                isSelected
                                    ? 'ring-2 ring-text-primary ring-offset-1 ring-offset-surface-raised'
                                    : day.isToday ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-surface-raised' : ''
                            }`}
                        >
                            {day.recorded ? <Icon name="check" size={14} /> : <Icon name="plus" size={12} />}
                        </div>
                    )

                    return (
                        <div key={day.date} className="flex flex-col items-center gap-0.5">
                            <span className={`text-xs font-normal leading-none ${day.isToday ? 'text-brand-600' : 'text-text-muted'}`}>{day.label}</span>
                            {interactive ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => onSelectDate?.(day.date)}
                                    className="p-0 bg-transparent active:scale-90 transition-transform"
                                    aria-label={`${day.label}曜日の記録を表示`}
                                >
                                    {circle}
                                </Button>
                            ) : circle}
                        </div>
                    )
                })}
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
    mode, actualTotal, weekTarget, avg, perDayTarget, dayActual, dayTarget,
}: {
    mode: DisplayMode
    actualTotal: number
    weekTarget: number
    avg: number
    perDayTarget: number
    /** AR-1: mode='day'時のその日の実績・目標。 */
    dayActual?: number
    dayTarget?: number
}) {
    const isTotal = mode === 'total'
    const isDay = mode === 'day'
    const baseVal = isDay ? (dayActual ?? 0) : isTotal ? actualTotal : avg
    const targetVal = isDay ? (dayTarget ?? 0) : isTotal ? weekTarget : perDayTarget
    const pct = targetVal > 0 ? Math.round((baseVal / targetVal) * 100) : 0
    const over = baseVal > targetVal
    const diffAbs = Math.round(Math.abs(targetVal - baseVal)).toLocaleString()
    const status = targetVal <= 0 || baseVal <= 0 ? 'empty' : over ? 'danger' : 'normal'
    const { bar } = statusClasses(status)
    const mainUnit = 'kcal'
    const diffUnit = isTotal ? 'kcal' : 'kcal/日'

    return (
        <Card padding="xs">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold text-text-primary">カロリー</h3>
                <Badge tone={over ? 'danger' : 'brand'}>{over ? `+${diffAbs}${diffUnit}` : `あと${diffAbs}${diffUnit}`}</Badge>
            </div>
            {/* BE-4: 「実績/目標 単位」の並びに統一(他の項目カードと同じ形にする) */}
            <div className="flex items-baseline gap-1 mb-1.5">
                <span className="stat-value !text-3xl">{fmt0(baseVal)}</span>
                <span className="stat-unit">/{fmt0(targetVal)} {mainUnit}</span>
            </div>
            <ProgressBar pct={pct} barClassName={bar} segmented={isTotal} heightClassName="h-2" />
        </Card>
    )
}

function ProgressBar({
    pct,
    barClassName,
    segmented = false,
    heightClassName = 'h-1.5',
}: {
    pct: number
    barClassName: string
    segmented?: boolean
    heightClassName?: string
}) {
    if (!segmented) {
        return (
            <div className={`${heightClassName} rounded-full bg-surface-overlay overflow-hidden`}>
                <div className={`h-full rounded-full transition-all ${barClassName}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
        )
    }

    return (
        <div className={`grid grid-cols-7 gap-1 ${heightClassName}`}>
            {Array.from({ length: 7 }).map((_, index) => {
                const segmentStart = (index / 7) * 100
                const segmentEnd = ((index + 1) / 7) * 100
                const fillPct = Math.max(0, Math.min(100, ((pct - segmentStart) / (segmentEnd - segmentStart)) * 100))

                return (
                    <div key={index} className="h-full overflow-hidden rounded-full bg-surface-overlay">
                        <div className={`h-full rounded-full transition-all ${barClassName}`} style={{ width: `${fillPct}%` }} />
                    </div>
                )
            })}
        </div>
    )
}

/**
 * O-5: 2列グリッド用の項目カード。mode='total'/'average'をCalorieHeroCardと
 * 同じ切替ボタンで統一表示する。isFrequency（筋トレ等）はmodeによらず
 * 「今週 X/Y回」の専用表示のまま。
 */
export function AchievementItemCard({
    label, unit, mode, perDayTarget, weekTarget, avg, prevAvg, actualTotal, prevActualTotal, prevRecordedDays, isFrequency, actual, target, dayActual, dayTarget,
}: {
    label: string
    unit: string
    mode: DisplayMode
    /** AR-1: mode='day'時のその日の実績・目標。 */
    dayActual?: number
    dayTarget?: number
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
    // AR-1: 筋トレ等の頻度型は「日」表示でも週の実施回数のままにする(1日単位だと0/1で意味が薄いため)
    const isDay = !isFrequency && mode === 'day'
    const useTotal = !isFrequency && mode === 'total'
    const targetVal = isFrequency ? (target || 0) : isDay ? (dayTarget || 0) : (useTotal ? (weekTarget || 0) : (perDayTarget || 0))
    const baseVal = isFrequency ? (actual || 0) : isDay ? (dayActual || 0) : (useTotal ? (actualTotal || 0) : (avg || 0))
    const pct = targetVal > 0 ? Math.round((baseVal / targetVal) * 100) : 0
    const { bar, text } = achievementColor(pct)

    // BE-4: 3分岐あった数値表示を「実績/目標 単位」の1つに統一する。
    // 平均表示だけ「82.4g（目標94g）」という別形式で、しかも目標を丸めずに出していたため
    // 「66.42857142857143」のような生の値が画面に出ていた。形式を揃えると同時に潰す。
    const hasValue = isFrequency || avg !== undefined || isDay || useTotal

    return (
        <Card padding="xs">
            <div className="flex justify-between items-center gap-1 mb-0.5">
                <p className="min-w-0 text-xs font-normal text-text-muted leading-none truncate">{label}</p>
                <p className={`text-xs font-normal tabular-nums leading-none shrink-0 ${text}`}>{pct}%</p>
            </div>

            <div className="flex items-baseline gap-1">
                <span className="stat-value !text-xl">{hasValue ? fmt1(baseVal) : '-'}</span>
                <span className="stat-unit">/{fmt1(targetVal)} {unit}</span>
            </div>

            <div className="mt-1.5">
                <ProgressBar pct={pct} barClassName={bar} segmented={useTotal} />
            </div>
        </Card>
    )
}
