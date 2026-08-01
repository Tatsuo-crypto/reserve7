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
    if (pct > 100) return { bar: 'bg-red-500', text: 'text-red-300' }
    return { bar: 'bg-blue-500', text: 'text-blue-300' }
}

/** AR-1: 'day'(1日分) / 'total'(週合計) / 'average'(記録日平均) の3表示。 */
export type DisplayMode = 'day' | 'total' | 'average'
type MetricRule = 'upper' | 'minimum'
type MetricStatus = 'empty' | 'normal' | 'warning' | 'danger'

function metricStatus(actual: number, target: number, rule: MetricRule): MetricStatus {
    if (target <= 0 || actual <= 0) return 'empty'
    const pct = (actual / target) * 100
    if (rule === 'minimum') return pct >= 100 ? 'normal' : 'warning'
    return pct > 100 ? 'danger' : 'normal'
}

function statusClasses(status: MetricStatus) {
    // AR-2: 通常=青、超過=赤。未達(下限型の未到達)は「超過」とは別の状態なので従来どおり amber。
    const map = {
        empty: { bar: 'bg-surface-overlay', text: 'text-text-muted', badge: 'bg-surface-overlay text-text-muted' },
        normal: { bar: 'bg-blue-500', text: 'text-blue-300', badge: 'bg-blue-500/15 text-blue-300' },
        warning: { bar: 'bg-amber-500', text: 'text-amber-300', badge: 'bg-amber-500/15 text-amber-300' },
        danger: { bar: 'bg-red-500', text: 'text-red-300', badge: 'bg-red-500/15 text-red-300' },
    } satisfies Record<MetricStatus, { bar: string; text: string; badge: string }>
    return map[status]
}

function formatMetricValue(value: number, fractionDigits = 1) {
    const rounded = Math.round(value * Math.pow(10, fractionDigits)) / Math.pow(10, fractionDigits)
    return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toLocaleString(undefined, { maximumFractionDigits: fractionDigits })
}

/**
 * オーナー確認後の修正（2026-07-06）: 「週の合計」「平均値」どちらか一方に固定せず、
 * ボタンで切り替えられるようにする。WeeklyProgressPanel/WeeklySummaryPanelそれぞれで
 * mode stateを持ち、このトグルとCalorieHeroCard/AchievementItemCardに渡す。
 * トグル自体がどちらのモードか示しているため、各カード内には「週合計」「記録日平均」
 * といった重複する文言は表示しない。
 */
export function DisplayModeToggle({ mode, onChange }: { mode: DisplayMode; onChange: (mode: DisplayMode) => void }) {
    // AR-1: 「日」を追加して 日/週/平均 の3択に。
    // AR-3: ラベルが短くなったことに合わせ、選択中の背景も文字の形に沿った丸(pill)にする
    // (以前は長い文言に引きずられて角ばった四角に見えていた)。
    const options: Array<{ key: DisplayMode; label: string }> = [
        { key: 'day', label: '日' },
        { key: 'total', label: '週' },
        { key: 'average', label: '平均' },
    ]

    // AT-2: 外側の枠が丸(pill)で、選択中の背景が角丸四角という組み合わせになっていて形が揃って
    // いなかったため、外枠も選択中も同じ角丸四角に統一する。
    return (
        <div className="px-2 flex justify-center">
            <div className="inline-flex items-center gap-0.5 bg-surface-overlay rounded-xl p-0.5">
                {options.map(opt => (
                    <Button
                        key={opt.key}
                        type="button"
                        variant="ghost"
                        onClick={() => onChange(opt.key)}
                        className={`min-w-[3.5rem] px-4 py-1 rounded-lg text-xs font-normal leading-none transition-all ${
                            mode === opt.key ? 'bg-surface-raised text-text-primary shadow-sm' : 'text-text-muted'
                        }`}
                    >
                        {opt.label}
                    </Button>
                ))}
            </div>
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
        <Card padding="sm">
            <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-text-primary">記録チェック表</h3>
                {interactive && <span className="text-xs font-normal text-text-muted">曜日をタップでその日を表示</span>}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
                {weekDays.map(day => {
                    const isSelected = interactive && day.date === selectedDate
                    const circle = (
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${day.recorded ? 'bg-brand-500 text-white' : 'bg-surface-overlay text-text-muted'} ${
                                isSelected
                                    ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-raised'
                                    : day.isToday ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-surface-raised' : ''
                            }`}
                        >
                            {day.recorded ? <Icon name="check" size={14} /> : <Icon name="plus" size={12} />}
                        </div>
                    )

                    return (
                        <div key={day.date} className="flex flex-col items-center gap-1">
                            <span className={`text-xs font-normal ${day.isToday ? 'text-brand-600' : 'text-text-muted'}`}>{day.label}</span>
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
        <Card padding="sm">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-text-primary">カロリー</h3>
                <Badge tone={over ? 'danger' : 'brand'}>{over ? `+${diffAbs}${diffUnit}` : `あと${diffAbs}${diffUnit}`}</Badge>
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
                <span className="stat-value">{Math.round(baseVal).toLocaleString()}</span>
                <span className="stat-unit">/{Math.round(targetVal).toLocaleString()}{mainUnit}</span>
            </div>
            <ProgressBar pct={pct} barClassName={bar} segmented={isTotal} heightClassName="h-2.5" />
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
    const roundVal = (v: number) => (isFrequency || useTotal || isDay ? Math.round(v) : Math.round(v * 10) / 10)
    const targetVal = isFrequency ? (target || 0) : isDay ? (dayTarget || 0) : (useTotal ? (weekTarget || 0) : (perDayTarget || 0))
    const baseVal = isFrequency ? (actual || 0) : isDay ? (dayActual || 0) : (useTotal ? (actualTotal || 0) : (avg || 0))
    const pct = targetVal > 0 ? Math.round((baseVal / targetVal) * 100) : 0
    const { bar, text } = achievementColor(pct)

    return (
        <Card padding="sm">
            <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-normal text-text-muted uppercase tracking-widest leading-none">{label}</p>
                <p className={`text-xs font-normal tabular-nums leading-none ${text}`}>{pct}%</p>
            </div>

            {isFrequency ? (
                <div className="flex items-baseline gap-1">
                    <span className="stat-value !text-xl">{actual}</span>
                    <span className="stat-unit">/{target}{unit}</span>
                </div>
            ) : isDay || useTotal ? (
                <div className="flex items-baseline gap-1">
                    <span className="stat-value !text-xl">{roundVal(baseVal).toLocaleString()}</span>
                    <span className="stat-unit">/ {roundVal(targetVal).toLocaleString()}{unit}</span>
                </div>
            ) : (
                <div className="flex items-baseline gap-1">
                    <span className="stat-value !text-xl">{avg !== undefined ? roundVal(avg).toLocaleString() : '-'}</span>
                    <span className="stat-unit">{unit}（目標{targetVal}{unit}）</span>
                </div>
            )}

            <div className="mt-2">
                <ProgressBar pct={pct} barClassName={bar} segmented={useTotal} />
            </div>
        </Card>
    )
}

export function NutritionListCard({
    items,
}: {
    items: Array<{
        label: string
        shortLabel: string
        unit: string
        actual: number
        target: number
        rule: MetricRule
    }>
}) {
    return (
        <Card padding="sm">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">栄養バランス</h3>
                <span className="text-xs font-normal text-text-muted">実績/目標</span>
            </div>
            <div className="divide-y divide-border-subtle">
                {items.map(item => {
                    const pct = item.target > 0 ? Math.round((item.actual / item.target) * 100) : 0
                    const status = metricStatus(item.actual, item.target, item.rule)
                    const classes = statusClasses(status)
                    const actualText = formatMetricValue(item.actual)
                    const targetText = formatMetricValue(item.target)
                    const statusText = status === 'danger' ? '超過' : status === 'warning' ? '未達' : status === 'empty' ? '未記録' : 'OK'

                    return (
                        <div key={item.label} className="py-3 first:pt-0 last:pb-0">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                                    <p className="text-xs text-text-muted">{item.shortLabel}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <p className="text-sm font-semibold tabular-nums text-text-primary">
                                        {actualText}/{targetText}<span className="ml-0.5 text-xs font-normal text-text-muted">{item.unit}</span>
                                    </p>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-normal ${classes.badge}`}>{statusText}</span>
                                </div>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-surface-overlay">
                                <div className={`h-full rounded-full transition-all ${classes.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                        </div>
                    )
                })}
            </div>
        </Card>
    )
}

export function HabitListCard({
    items,
}: {
    items: Array<{
        label: string
        unit: string
        actual: number
        target: number
        rule: MetricRule
        fractionDigits?: number
    }>
}) {
    return (
        <Card padding="sm">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">習慣の進み具合</h3>
                <span className="text-xs font-normal text-text-muted">実績/目標</span>
            </div>
            <div className="divide-y divide-border-subtle">
                {items.map(item => {
                    const pct = item.target > 0 ? Math.round((item.actual / item.target) * 100) : 0
                    const status = metricStatus(item.actual, item.target, item.rule)
                    const classes = statusClasses(status)
                    const actualText = formatMetricValue(item.actual, item.fractionDigits ?? 1)
                    const targetText = formatMetricValue(item.target, item.fractionDigits ?? 1)
                    const statusText = status === 'warning' ? '未達' : status === 'empty' ? '未記録' : 'OK'

                    return (
                        <div key={item.label} className="py-3 first:pt-0 last:pb-0">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="min-w-0 text-sm font-semibold text-text-primary">{item.label}</p>
                                <div className="flex shrink-0 items-center gap-2">
                                    <p className="text-sm font-semibold tabular-nums text-text-primary">
                                        {actualText}/{targetText}<span className="ml-0.5 text-xs font-normal text-text-muted">{item.unit}</span>
                                    </p>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-normal ${classes.badge}`}>{statusText}</span>
                                </div>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-surface-overlay">
                                <div className={`h-full rounded-full transition-all ${classes.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                        </div>
                    )
                })}
            </div>
        </Card>
    )
}

export function MemberWeeklyResultListCard({
    mode,
    items,
}: {
    mode: DisplayMode
    items: Array<{
        label: string
        unit: string
        actual: number
        target: number
        rule: MetricRule
        fractionDigits?: number
    }>
}) {
    return (
        <Card padding="sm">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-text-primary">{mode === 'day' ? 'この日の結果' : '今週の結果'}</h3>
                <span className="text-xs font-normal text-text-muted">{mode === 'day' ? '1日' : mode === 'total' ? '週合計' : '平均'}</span>
            </div>
            <div className="divide-y divide-border-subtle">
                {items.map(item => {
                    const pct = item.target > 0 ? Math.round((item.actual / item.target) * 100) : 0
                    const status = metricStatus(item.actual, item.target, item.rule)
                    const classes = statusClasses(status)
                    const actualText = formatMetricValue(item.actual, item.fractionDigits ?? 1)
                    const targetText = formatMetricValue(item.target, item.fractionDigits ?? 1)

                    return (
                        <div key={item.label} className="py-3 first:pt-0 last:pb-0">
                            <div className="mb-2 flex items-baseline justify-between gap-3">
                                <p className="min-w-0 text-sm font-normal text-text-secondary">{item.label}</p>
                                <p className="shrink-0 text-sm font-normal tabular-nums text-text-primary">
                                    {actualText}<span className="mx-0.5 text-xs font-normal text-text-muted">/</span>{targetText}
                                    <span className="ml-0.5 text-xs font-normal text-text-muted">{item.unit}</span>
                                </p>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-surface-overlay">
                                <div className={`h-full rounded-full transition-all ${classes.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                        </div>
                    )
                })}
            </div>
        </Card>
    )
}
