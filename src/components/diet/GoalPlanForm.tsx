'use client'

import { useEffect, useRef, useState } from 'react'
import type { MacroGrams } from '@/lib/utils/dietGoalCalc'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'

export interface GoalFormValues extends MacroGrams {
    salt: number
    targetCalories: number
    startDate: string
    endDate?: string | null
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
type MacroKey = 'protein' | 'fat' | 'carbs'
type MacroScope = 'base' | DayTypeKey

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
    const macroEditOrderRef = useRef<Partial<Record<MacroScope, MacroKey[]>>>({})

    const rememberMacroEdit = (scope: MacroScope, key: MacroKey) => {
        const current = macroEditOrderRef.current[scope] || []
        const next = [...current.filter(item => item !== key), key].slice(-2)
        macroEditOrderRef.current = { ...macroEditOrderRef.current, [scope]: next }
        return next
    }

    const getMacroValue = (source: GoalFormValues, scope: MacroScope, key: MacroKey) => {
        if (scope === 'training') {
            if (key === 'protein') return source.trainingProtein ?? source.protein
            if (key === 'fat') return source.trainingFat ?? source.fat
            return source.trainingCarbs ?? source.carbs
        }
        if (scope === 'rest') {
            if (key === 'protein') return source.restProtein ?? source.protein
            if (key === 'fat') return source.restFat ?? source.fat
            return source.restCarbs ?? source.carbs
        }
        return source[key]
    }

    const getCaloriesValue = (source: GoalFormValues, scope: MacroScope) => {
        if (scope === 'training') return source.trainingCalories ?? source.targetCalories
        if (scope === 'rest') return source.restCalories ?? source.targetCalories
        return source.targetCalories
    }

    const setMacroValue = (source: GoalFormValues, scope: MacroScope, key: MacroKey, value: number) => {
        const nextValue = Math.max(0, Math.round(value || 0))
        if (scope === 'training') {
            const field = key === 'protein' ? 'trainingProtein' : key === 'fat' ? 'trainingFat' : 'trainingCarbs'
            return { ...source, [field]: nextValue }
        }
        if (scope === 'rest') {
            const field = key === 'protein' ? 'restProtein' : key === 'fat' ? 'restFat' : 'restCarbs'
            return { ...source, [field]: nextValue }
        }
        const next = { ...source, [key]: nextValue }
        if (key === 'carbs') {
            next.sugar = Math.max(0, Math.round(next.carbs - next.fiber))
        }
        return next
    }

    const applyMacroAutoFill = (source: GoalFormValues, scope: MacroScope, order: MacroKey[]) => {
        if (order.length < 2) return source
        const fillKey = (['protein', 'fat', 'carbs'] as MacroKey[]).find(key => !order.includes(key))
        if (!fillKey) return source

        const calories = getCaloriesValue(source, scope)
        const usedCalories = (['protein', 'fat', 'carbs'] as MacroKey[])
            .filter(key => key !== fillKey)
            .reduce((sum, key) => {
                const grams = getMacroValue(source, scope, key)
                return sum + grams * (key === 'fat' ? 9 : 4)
            }, 0)
        const remainingCalories = Math.max(0, Math.round(calories - usedCalories))
        const nextGrams = fillKey === 'fat'
            ? Math.round(remainingCalories / 9)
            : Math.round(remainingCalories / 4)

        return setMacroValue(source, scope, fillKey, nextGrams)
    }

    const handleCaloriesInput = (scope: MacroScope, value: number) => {
        onValuesChange(prev => {
            const nextCalories = Math.max(0, Math.round(value || 0))
            const next = scope === 'training'
                ? { ...prev, trainingCalories: nextCalories }
                : scope === 'rest'
                    ? { ...prev, restCalories: nextCalories }
                    : { ...prev, targetCalories: nextCalories }
            return applyMacroAutoFill(next, scope, macroEditOrderRef.current[scope] || [])
        })
    }

    const handleMacroInput = (scope: MacroScope, key: MacroKey, value: number) => {
        const order = rememberMacroEdit(scope, key)
        onValuesChange(prev => applyMacroAutoFill(setMacroValue(prev, scope, key, value), scope, order))
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
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <label className="text-xs font-normal text-text-muted uppercase tracking-widest pl-1">開始日</label>
                        <input
                            type="date"
                            value={values.startDate}
                            onChange={(e) => onValuesChange(prev => ({ ...prev, startDate: e.target.value }))}
                            className="w-full bg-surface-base border-none rounded-2xl p-4 text-sm font-normal focus:ring-2 focus:ring-brand-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-normal text-text-muted uppercase tracking-widest pl-1">終了日</label>
                        <input
                            type="date"
                            value={values.endDate || ''}
                            min={values.startDate || undefined}
                            onChange={(e) => onValuesChange(prev => ({ ...prev, endDate: e.target.value || null }))}
                            className="w-full bg-surface-base border-none rounded-2xl p-4 text-sm font-normal focus:ring-2 focus:ring-brand-500"
                        />
                        <p className="pl-1 text-xs text-text-muted">空欄なら継続</p>
                    </div>
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
                        onCaloriesChange={(value) => handleCaloriesInput('training', value)}
                        onProteinChange={(value) => handleMacroInput('training', 'protein', value)}
                        onFatChange={(value) => handleMacroInput('training', 'fat', value)}
                        onCarbsChange={(value) => handleMacroInput('training', 'carbs', value)}
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
                        onCaloriesChange={(value) => handleCaloriesInput('rest', value)}
                        onProteinChange={(value) => handleMacroInput('rest', 'protein', value)}
                        onFatChange={(value) => handleMacroInput('rest', 'fat', value)}
                        onCarbsChange={(value) => handleMacroInput('rest', 'carbs', value)}
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
                            <NumericInput
                                value={Math.round(values.targetCalories || 0)}
                                onValueChange={(value) => handleCaloriesInput('base', value)}
                                className="w-40 bg-surface-overlay border border-border-strong rounded-none px-4 py-3 text-3xl font-bold text-center tabular-nums focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                    </div>

                    <PfcBalanceEditor
                        values={values}
                        summary={pfcSummary}
                        onProteinChange={(value) => handleMacroInput('base', 'protein', value)}
                        onFatChange={(value) => handleMacroInput('base', 'fat', value)}
                        onCarbsChange={(value) => handleMacroInput('base', 'carbs', value)}
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
            text: 'text-brand-600',
            input: 'focus:ring-brand-500',
            pill: 'bg-brand-500/12 text-brand-600 border-brand-500/20',
        }
        : {
            dot: 'bg-sky-400',
            text: 'text-sky-700',
            input: 'focus:ring-sky-400',
            pill: 'bg-sky-400/10 text-sky-700 border-sky-400/20',
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
                    <NumericInput
                        value={Math.round(calories || 0)}
                        onValueChange={onCaloriesChange}
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
                合計 <span className={over ? 'text-state-danger-700' : 'text-brand-600'}>{summary.total.toLocaleString()}</span>
                <span className="text-sm text-text-muted"> / {summary.target.toLocaleString()}kcal</span>
            </p>
            <p className={`text-xs ${over ? 'text-state-danger-700' : 'text-text-muted'}`}>
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
                <NumericInput
                    value={Math.round(value || 0)}
                    onValueChange={onChange}
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
        amber: 'text-amber-700 bg-surface-base/60 border-border-strong',
        blue: 'text-blue-700 bg-surface-base/60 border-border-strong',
        purple: 'text-purple-700 bg-surface-base/60 border-border-strong',
        teal: 'text-teal-700 bg-surface-base/60 border-border-strong',
        gray: 'text-text-secondary bg-surface-base/60 border-border-strong',
        sky: 'text-sky-700 bg-surface-base/60 border-border-strong',
        cyan: 'text-cyan-700 bg-surface-base/60 border-border-strong',
        orange: 'text-text-primary bg-surface-base/60 border-border-strong',
        violet: 'text-violet-700 bg-surface-base/60 border-border-strong'
    }
    const style = colorMap[color] || colorMap.gray;
    const [baseColor, bgColor, borderColor] = style.split(' ');
    const shouldShowDecimal = step < 1
    return (
        <div className={`${bgColor} rounded-2xl p-4 border-2 ${borderColor} transition-all hover:shadow-md group relative overflow-hidden`}>
            <p className="text-xs font-normal text-text-muted mb-2 uppercase tracking-widest leading-none">{label}</p>
            <div className="flex items-center">
                <div className="flex items-baseline gap-1">
                    <NumericInput
                        step={step}
                        value={value ?? 0}
                        integer={!shouldShowDecimal}
                        onValueChange={(nextValue) => onValueChange?.(nextValue)}
                        className={`w-20 bg-transparent border-none p-0 text-3xl font-bold tabular-nums leading-none focus:ring-0 outline-none ${baseColor}`}
                    />
                    <span className="text-xs font-normal text-text-muted uppercase tracking-tighter">{unit}</span>
                </div>
            </div>
        </div>
    )
}

function formatNumericInputValue(nextValue: number, integer: boolean) {
    const numeric = Number(nextValue || 0)
    return integer ? String(Math.round(numeric)) : String(numeric)
}

function NumericInput({
    value,
    onValueChange,
    className,
    step = 1,
    integer = true,
}: {
    value: number
    onValueChange: (value: number) => void
    className?: string
    step?: number
    integer?: boolean
}) {
    const [draft, setDraft] = useState(formatNumericInputValue(value, integer))
    const [focused, setFocused] = useState(false)

    useEffect(() => {
        if (!focused) setDraft(formatNumericInputValue(value, integer))
    }, [focused, integer, value])

    return (
        <input
            type="number"
            inputMode={integer ? 'numeric' : 'decimal'}
            min={0}
            step={step}
            value={draft}
            onFocus={() => setFocused(true)}
            onBlur={() => {
                setFocused(false)
                if (draft === '') setDraft('0')
            }}
            onChange={(e) => {
                const raw = e.target.value
                setDraft(raw)
                if (raw === '') {
                    onValueChange(0)
                    return
                }
                const parsed = Number(raw)
                if (!Number.isFinite(parsed)) return
                onValueChange(integer ? Math.round(parsed) : parsed)
            }}
            className={className}
        />
    )
}
