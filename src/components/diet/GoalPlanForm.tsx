'use client'

import type { MacroGrams } from '@/lib/utils/dietGoalCalc'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'

export interface GoalFormValues extends MacroGrams {
    salt: number
    targetCalories: number
    startDate: string
    title: string
    dayTypeEnabled?: boolean
    trainingCalories?: number
    trainingProtein?: number
    trainingFat?: number
    trainingCarbs?: number
    restCalories?: number
    restProtein?: number
    restFat?: number
    restCarbs?: number
    dayTypeFieldsAvailable?: boolean
}

export interface HabitTargetsValues {
    steps: number | null
    sleep: number | null
    water: number | null
    workout: number | null
    diet_day_type_targets?: any
}

interface GoalPlanFormProps {
    values: GoalFormValues
    onValuesChange: (updater: (prev: GoalFormValues) => GoalFormValues) => void
    habitTargets: HabitTargetsValues
    onHabitTargetsChange: (updater: (prev: HabitTargetsValues) => HabitTargetsValues) => void
    /** K-4: モード差は「開始日」フィールドの有無だけ。現在の設定編集ではfalse、新規作成・履歴編集ではtrue。 */
    showStartDate: boolean
    onSave: () => void
    saving: boolean
    saveLabel: string
    onDelete?: () => void
    deleteLabel?: string
    onCancel?: () => void
}

const DEFAULT_HABIT_TARGETS = { steps: 8000, sleep: 7, water: 2, workout: 1 }
type DayTypeKey = 'training' | 'rest'
type HabitTargetKey = 'water' | 'steps' | 'workout' | 'sleep'

function macroCalories(protein: number, fat: number, carbs: number) {
    return {
        protein: Math.round(Number(protein || 0) * 4),
        fat: Math.round(Number(fat || 0) * 9),
        carbs: Math.round(Number(carbs || 0) * 4),
    }
}

function roundedPercentParts(values: number[], target: number, totalPct: number) {
    if (target <= 0) return values.map(() => 0)
    const raw = values.map(value => (value / target) * 100)
    const parts = raw.map(value => Math.floor(value))
    let diff = totalPct - parts.reduce((sum, value) => sum + value, 0)
    const order = raw
        .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
        .sort((a, b) => b.remainder - a.remainder)

    for (let i = 0; diff > 0 && i < order.length; i += 1) {
        parts[order[i].index] += 1
        diff -= 1
    }

    return parts
}

function getPfcSummary(targetCalories: number, protein: number, fat: number, carbs: number) {
    const target = Math.max(0, Math.round(Number(targetCalories || 0)))
    const calories = macroCalories(protein, fat, carbs)
    const total = calories.protein + calories.fat + calories.carbs
    const pct = (value: number) => target > 0 ? Math.round((value / target) * 100) : 0
    const totalPct = pct(total)
    const [proteinPct, fatPct, carbsPct] = roundedPercentParts(
        [calories.protein, calories.fat, calories.carbs],
        target,
        totalPct
    )
    return {
        target,
        calories,
        total,
        totalPct,
        overCalories: Math.max(0, total - target),
        remainingCalories: Math.max(0, target - total),
        proteinPct,
        fatPct,
        carbsPct,
    }
}

/**
 * K-2/K-4: 「現在の目標設定」「新規プランの作成」「履歴バーからの編集」で共通利用する
 * 統一フォーム。開始日フィールドの有無だけがモード差。
 */
export default function GoalPlanForm({
    values,
    onValuesChange,
    habitTargets,
    onHabitTargetsChange,
    showStartDate,
    onSave,
    saving,
    saveLabel,
    onDelete,
    deleteLabel = 'このプランを削除',
    onCancel,
}: GoalPlanFormProps) {
    const handleGramInput = (key: 'protein' | 'fat' | 'carbs' | 'sugar' | 'fiber', value: number) => {
        onValuesChange(prev => {
            const nextValue = Math.max(0, Math.round(value || 0))
            const next = { ...prev, [key]: nextValue }
            if (key === 'sugar' || key === 'fiber') {
                next.carbs = Math.round(next.sugar + next.fiber)
            } else if (key === 'carbs') {
                next.sugar = Math.max(0, Math.round(next.carbs - next.fiber))
            }
            return next
        })
    }

    const handleDayTypeToggle = (checked: boolean) => {
        onValuesChange(prev => {
            const hasDayTypeValues = (
                prev.dayTypeFieldsAvailable
                && prev.trainingCalories !== undefined
                && prev.restCalories !== undefined
            )
            const useExistingDayTypeValues = checked && hasDayTypeValues
            return {
                ...prev,
                dayTypeEnabled: checked,
                dayTypeFieldsAvailable: true,
                trainingCalories: useExistingDayTypeValues ? prev.trainingCalories : (prev.trainingCalories ?? prev.targetCalories),
                trainingProtein: useExistingDayTypeValues ? prev.trainingProtein : (prev.trainingProtein ?? prev.protein),
                trainingFat: useExistingDayTypeValues ? prev.trainingFat : (prev.trainingFat ?? prev.fat),
                trainingCarbs: useExistingDayTypeValues ? prev.trainingCarbs : (prev.trainingCarbs ?? prev.carbs),
                restCalories: useExistingDayTypeValues ? prev.restCalories : (prev.restCalories ?? prev.targetCalories),
                restProtein: useExistingDayTypeValues ? prev.restProtein : (prev.restProtein ?? prev.protein),
                restFat: useExistingDayTypeValues ? prev.restFat : (prev.restFat ?? prev.fat),
                restCarbs: useExistingDayTypeValues ? prev.restCarbs : (prev.restCarbs ?? prev.carbs),
            }
        })
    }

    const setDayGoalValue = (
        key: 'trainingCalories' | 'trainingProtein' | 'trainingFat' | 'trainingCarbs' | 'restCalories' | 'restProtein' | 'restFat' | 'restCarbs',
        value: number
    ) => {
        onValuesChange(prev => ({ ...prev, [key]: Math.max(0, Math.round(value || 0)) }))
    }

    const getDayHabitValue = (dayType: DayTypeKey, key: HabitTargetKey) => {
        const dayTypeTargets = habitTargets.diet_day_type_targets || {}
        const value = dayTypeTargets[`${dayType}_${key}`] ?? habitTargets[key] ?? DEFAULT_HABIT_TARGETS[key]
        return Number(value)
    }

    const setDayHabitValue = (dayType: DayTypeKey, key: HabitTargetKey, value: number) => {
        const nextValue = key === 'water' || key === 'sleep'
            ? Math.max(0, value || 0)
            : Math.max(0, Math.round(value || 0))
        onHabitTargetsChange(prev => ({
            ...prev,
            diet_day_type_targets: {
                ...(prev.diet_day_type_targets || {}),
                [`${dayType}_${key}`]: nextValue,
            },
        }))
    }

    const pfcSummary = getPfcSummary(values.targetCalories, values.protein, values.fat, values.carbs)

    return (
        <div className="space-y-8">
            {showStartDate && (
                <div className="space-y-2">
                    <label className="text-xs font-normal text-text-muted uppercase tracking-widest pl-1">開始日</label>
                    <input
                        type="date"
                        value={values.startDate}
                        onChange={(e) => onValuesChange(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full bg-surface-base border-none rounded-2xl p-4 text-sm font-normal focus:ring-2 focus:ring-brand-500"
                    />
                </div>
            )}

            <div className="space-y-1"><h3 className="text-xs font-normal text-text-muted uppercase tracking-widest pl-1">食事・栄養の目標</h3></div>

            <label className="flex items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-surface-base p-4">
                <div>
                    <p className="text-sm font-normal text-text-primary">筋トレ日別に設定する</p>
                    <p className="mt-1 text-xs text-text-muted">有効な会員だけ、記録前に筋トレ日/休養日を選べます</p>
                </div>
                <input
                    type="checkbox"
                    checked={Boolean(values.dayTypeEnabled)}
                    onChange={(e) => handleDayTypeToggle(e.target.checked)}
                    className="h-5 w-5 accent-brand-600"
                />
            </label>

            {values.dayTypeEnabled ? (
                <div className="space-y-10">
                    <DayTypeGoalCard
                        title="筋トレ日"
                        tone="training"
                        calories={values.trainingCalories ?? values.targetCalories}
                        protein={values.trainingProtein ?? values.protein}
                        fat={values.trainingFat ?? values.fat}
                        carbs={values.trainingCarbs ?? values.carbs}
                        onCaloriesChange={(value) => setDayGoalValue('trainingCalories', value)}
                        onProteinChange={(value) => setDayGoalValue('trainingProtein', value)}
                        onFatChange={(value) => setDayGoalValue('trainingFat', value)}
                        onCarbsChange={(value) => setDayGoalValue('trainingCarbs', value)}
                        habitTargets={{
                            water: getDayHabitValue('training', 'water'),
                            steps: getDayHabitValue('training', 'steps'),
                            workout: getDayHabitValue('training', 'workout'),
                            sleep: getDayHabitValue('training', 'sleep'),
                        }}
                        onHabitChange={(key, value) => setDayHabitValue('training', key, value)}
                    />
                    <DayTypeGoalCard
                        title="休養日"
                        tone="rest"
                        calories={values.restCalories ?? values.targetCalories}
                        protein={values.restProtein ?? values.protein}
                        fat={values.restFat ?? values.fat}
                        carbs={values.restCarbs ?? values.carbs}
                        onCaloriesChange={(value) => setDayGoalValue('restCalories', value)}
                        onProteinChange={(value) => setDayGoalValue('restProtein', value)}
                        onFatChange={(value) => setDayGoalValue('restFat', value)}
                        onCarbsChange={(value) => setDayGoalValue('restCarbs', value)}
                        habitTargets={{
                            water: getDayHabitValue('rest', 'water'),
                            steps: getDayHabitValue('rest', 'steps'),
                            workout: getDayHabitValue('rest', 'workout'),
                            sleep: getDayHabitValue('rest', 'sleep'),
                        }}
                        onHabitChange={(key, value) => setDayHabitValue('rest', key, value)}
                    />
                </div>
            ) : (
                <>
                    <div className="bg-surface-base/80 rounded-2xl p-8 text-center border border-border-subtle/50 relative space-y-4">
                        <h3 className="text-xl font-semibold text-text-primary">目標摂取量</h3>
                        <div className="flex items-center justify-center">
                            <input
                                type="number"
                                inputMode="numeric"
                                step={1}
                                min={0}
                                value={Math.round(values.targetCalories || 0)}
                                onChange={(e) => {
                                    const nextCalories = Math.max(0, Math.round(Number(e.target.value || 0)))
                                    onValuesChange(prev => ({ ...prev, targetCalories: nextCalories }))
                                }}
                                className="w-40 bg-surface-overlay border border-border-strong rounded-none px-4 py-3 text-3xl font-bold text-center tabular-nums focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                    </div>

                    <PfcBalanceEditor
                        values={values}
                        summary={pfcSummary}
                        onProteinChange={(value) => handleGramInput('protein', value)}
                        onFatChange={(value) => handleGramInput('fat', value)}
                        onCarbsChange={(value) => handleGramInput('carbs', value)}
                    />

                    <PfcTotalStatus summary={pfcSummary} />
                </>
            )}

            {!values.dayTypeEnabled && (
                <div className="space-y-8 pt-8 border-t border-border-subtle">
                    <div className="space-y-1"><h3 className="text-xs font-normal text-text-muted uppercase tracking-widest pl-1">生活習慣の目標</h3></div>
                    <div className="grid grid-cols-2 gap-4">
                        <AdminStatCard label="水分摂取" value={habitTargets.water ?? DEFAULT_HABIT_TARGETS.water} unit="L" color="orange" step={0.5} onValueChange={(value) => onHabitTargetsChange(prev => ({ ...prev, water: Math.max(0, value || 0) }))} />
                        <AdminStatCard label="目標歩数" value={habitTargets.steps ?? DEFAULT_HABIT_TARGETS.steps} unit="歩" color="orange" step={500} onValueChange={(value) => onHabitTargetsChange(prev => ({ ...prev, steps: Math.max(0, Math.round(value || 0)) }))} />
                        <AdminStatCard label="筋トレ回数" value={habitTargets.workout ?? DEFAULT_HABIT_TARGETS.workout} unit="回/週" color="orange" onValueChange={(value) => onHabitTargetsChange(prev => ({ ...prev, workout: Math.max(0, Math.round(value || 0)) }))} />
                        <AdminStatCard label="睡眠時間" value={habitTargets.sleep ?? DEFAULT_HABIT_TARGETS.sleep} unit="時間" color="orange" step={0.5} onValueChange={(value) => onHabitTargetsChange(prev => ({ ...prev, sleep: Math.max(0, value || 0) }))} />
                    </div>
                </div>
            )}

            <div className="pt-4 space-y-3">
                <Button onClick={onSave} loading={saving} fullWidth size="md" className="py-5">
                    {!saving && <Icon name="check" />}
                    {saveLabel}
                </Button>
                {onDelete && (
                    <Button onClick={onDelete} variant="destructive" fullWidth>
                        {deleteLabel}
                    </Button>
                )}
                {onCancel && (
                    <Button onClick={onCancel} variant="ghost" fullWidth size="sm">
                        キャンセル
                    </Button>
                )}
            </div>
        </div>
    )
}

function DayTypeGoalCard({
    title,
    tone,
    calories,
    protein,
    fat,
    carbs,
    onCaloriesChange,
    onProteinChange,
    onFatChange,
    onCarbsChange,
    habitTargets,
    onHabitChange,
}: {
    title: string
    tone: 'training' | 'rest'
    calories: number
    protein: number
    fat: number
    carbs: number
    onCaloriesChange: (value: number) => void
    onProteinChange: (value: number) => void
    onFatChange: (value: number) => void
    onCarbsChange: (value: number) => void
    habitTargets: Record<HabitTargetKey, number>
    onHabitChange: (key: HabitTargetKey, value: number) => void
}) {
    const summary = getPfcSummary(calories, protein, fat, carbs)
    const isTraining = tone === 'training'
    const accent = isTraining
        ? {
            dot: 'bg-brand-500',
            text: 'text-brand-200',
            input: 'focus:ring-brand-500',
            pill: 'bg-brand-500/12 text-brand-200 border-brand-500/20',
        }
        : {
            dot: 'bg-sky-400',
            text: 'text-sky-200',
            input: 'focus:ring-sky-400',
            pill: 'bg-sky-400/10 text-sky-200 border-sky-400/20',
        }
    return (
        <section className="space-y-5">
            <div className="flex items-center">
                <div className="flex items-center gap-2">
                    <span className={`h-7 w-1.5 rounded-full ${accent.dot}`} />
                    <h4 className={`text-xl font-semibold tracking-tight ${accent.text}`}>{title}</h4>
                </div>
            </div>

            <div className="bg-surface-base/80 rounded-2xl p-8 text-center border border-border-subtle/50 relative space-y-4">
                <h3 className="text-xl font-semibold text-text-primary">目標摂取量</h3>
                <div className="mt-4 flex items-center justify-center">
                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={Math.round(calories || 0)}
                        onChange={(e) => onCaloriesChange(Number(e.target.value || 0))}
                        className={`w-40 bg-surface-overlay border border-border-strong rounded-none px-4 py-3 text-3xl font-bold text-center tabular-nums outline-none ${accent.input}`}
                    />
                </div>
            </div>

            <div className="rounded-2xl border-2 border-border-strong bg-surface-base/60 p-4">
                <h3 className="text-xs font-semibold text-text-primary">PFCバランス</h3>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <EditableMacroSummary label="P" name="たんぱく質" pct={summary.proteinPct} value={protein} onChange={onProteinChange} />
                    <EditableMacroSummary label="F" name="脂質" pct={summary.fatPct} value={fat} onChange={onFatChange} />
                    <EditableMacroSummary label="C" name="炭水化物" pct={summary.carbsPct} value={carbs} onChange={onCarbsChange} />
                </div>
            </div>

            <PfcTotalStatus summary={summary} />

            <div className="space-y-3">
                <h3 className="text-xs font-normal text-text-muted uppercase tracking-widest pl-1">生活習慣の目標</h3>
                <div className="grid grid-cols-2 gap-4">
                    <AdminStatCard label="水分摂取" value={habitTargets.water} unit="L" color="orange" step={0.5} onValueChange={(value) => onHabitChange('water', value)} />
                    <AdminStatCard label="目標歩数" value={habitTargets.steps} unit="歩" color="orange" step={500} onValueChange={(value) => onHabitChange('steps', value)} />
                    <AdminStatCard label="筋トレ回数" value={habitTargets.workout} unit="回/週" color="orange" onValueChange={(value) => onHabitChange('workout', value)} />
                    <AdminStatCard label="睡眠時間" value={habitTargets.sleep} unit="時間" color="orange" step={0.5} onValueChange={(value) => onHabitChange('sleep', value)} />
                </div>
            </div>
        </section>
    )
}

function PfcTotalStatus({ summary }: { summary: ReturnType<typeof getPfcSummary> }) {
    const over = summary.overCalories > 0
    return (
        <div className="space-y-1 text-center">
            <p className="text-sm font-semibold text-text-primary">
                合計 <span className={over ? 'text-state-danger-400' : 'text-brand-300'}>{summary.total.toLocaleString()}</span>
                <span className="text-sm text-text-muted"> / {summary.target.toLocaleString()}kcal</span>
            </p>
            <p className={`text-xs ${over ? 'text-state-danger-300' : 'text-text-muted'}`}>
                {over
                    ? `目標カロリーを ${summary.overCalories.toLocaleString()}kcal 超えています`
                    : `あと ${summary.remainingCalories.toLocaleString()}kcal まで設定できます`}
            </p>
        </div>
    )
}

function PfcBalanceEditor({
    values,
    summary,
    onProteinChange,
    onFatChange,
    onCarbsChange,
}: {
    values: GoalFormValues
    summary: ReturnType<typeof getPfcSummary>
    onProteinChange: (value: number) => void
    onFatChange: (value: number) => void
    onCarbsChange: (value: number) => void
}) {
    return (
        <div className="rounded-2xl border-2 border-border-strong bg-surface-base/60 p-4">
            <h3 className="text-xs font-semibold text-text-primary">PFCバランス</h3>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <EditableMacroSummary label="P" name="たんぱく質" pct={summary.proteinPct} value={values.protein} onChange={onProteinChange} />
                <EditableMacroSummary label="F" name="脂質" pct={summary.fatPct} value={values.fat} onChange={onFatChange} />
                <EditableMacroSummary label="C" name="炭水化物" pct={summary.carbsPct} value={values.carbs} onChange={onCarbsChange} />
            </div>
        </div>
    )
}

function EditableMacroSummary({
    label,
    name,
    pct,
    value,
    onChange,
}: {
    label: string
    name: string
    pct: number
    value: number
    onChange: (value: number) => void
}) {
    return (
        <div className="space-y-1.5">
            <p className="text-xs font-semibold text-text-primary">{label} {name}</p>
            <div className="flex items-baseline justify-center gap-1">
                <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={Math.round(value || 0)}
                    onChange={(e) => onChange(Number(e.target.value || 0))}
                    className="w-16 bg-transparent border-none p-0 text-center text-3xl font-bold text-text-primary tabular-nums focus:ring-0"
                />
                <span className="text-xs text-text-secondary">g</span>
            </div>
            <p className="text-xs font-normal tabular-nums text-text-muted">{pct}%</p>
        </div>
    )
}

function AdminStatCard({ label, value, unit, color, step = 1, onValueChange }: {
    label: string, value: number | null, unit: string, color: string, step?: number, onValueChange?: (value: number) => void
}) {
    // Q-3: bg-*-50(ほぼ白)+border-*-100(不透明)というライトモードの配色が黒背景の
    // まま残っており、カードが白く浮いて見える不具合だったため、ダークバッジパターン
    // (bg-*-500/15 + border-*-500/25 + 明るめのtext-*-300)に統一する。
    const colorMap: any = {
        amber: 'text-amber-300 bg-surface-base/60 border-border-strong',
        blue: 'text-blue-300 bg-surface-base/60 border-border-strong',
        purple: 'text-purple-300 bg-surface-base/60 border-border-strong',
        teal: 'text-teal-300 bg-surface-base/60 border-border-strong',
        gray: 'text-text-secondary bg-surface-base/60 border-border-strong',
        sky: 'text-sky-300 bg-surface-base/60 border-border-strong',
        cyan: 'text-cyan-300 bg-surface-base/60 border-border-strong',
        orange: 'text-text-primary bg-surface-base/60 border-border-strong',
        violet: 'text-violet-300 bg-surface-base/60 border-border-strong'
    }
    const style = colorMap[color] || colorMap.gray;
    const [baseColor, bgColor, borderColor] = style.split(' ');
    const shouldShowDecimal = step < 1
    const displayValue = value === null
        ? ''
        : shouldShowDecimal
            ? Number(value).toFixed(1)
            : Math.round(value)

    return (
        <div className={`${bgColor} rounded-2xl p-4 border-2 ${borderColor} transition-all hover:shadow-md group relative overflow-hidden`}>
            <p className="text-xs font-normal text-text-muted mb-2 uppercase tracking-widest leading-none">{label}</p>
            <div className="flex items-center">
                <div className="flex items-baseline gap-1">
                    <input
                        type="number"
                        inputMode={shouldShowDecimal ? 'decimal' : 'numeric'}
                        step={step}
                        min={0}
                        value={displayValue}
                        onChange={(e) => onValueChange?.(Number(e.target.value || 0))}
                        className={`w-20 bg-transparent border-none p-0 text-3xl font-bold tabular-nums leading-none focus:ring-0 outline-none ${baseColor}`}
                    />
                    <span className="text-xs font-normal text-text-muted uppercase tracking-tighter">{unit}</span>
                </div>
            </div>
        </div>
    )
}
