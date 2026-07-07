'use client'

import { useState } from 'react'
import { adjustMacroGram, distributeCaloriesToMacros, type MacroGrams } from '@/lib/utils/dietGoalCalc'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/icons'

export interface GoalFormValues extends MacroGrams {
    salt: number
    targetCalories: number
    startDate: string
    title: string
}

export interface HabitTargetsValues {
    steps: number | null
    sleep: number | null
    water: number | null
    workout: number | null
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
    const [distributeInput, setDistributeInput] = useState<string>(String(values.targetCalories))

    const handleGramChange = (key: 'protein' | 'fat' | 'carbs' | 'sugar' | 'fiber', delta: number) => {
        onValuesChange(prev => ({ ...prev, ...adjustMacroGram(prev, key, delta) }))
    }

    const handleDistribute = () => {
        const parsed = parseInt(distributeInput, 10)
        if (!parsed || parsed <= 0) return
        onValuesChange(prev => ({ ...prev, ...distributeCaloriesToMacros(parsed, prev) }))
    }

    const handleHabitChange = (key: keyof HabitTargetsValues, delta: number, base: number) => {
        onHabitTargetsChange(prev => ({ ...prev, [key]: Math.max(0, (prev[key] ?? base) + delta) }))
    }

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

            <div className="space-y-1"><h3 className="text-[10px] font-normal text-text-muted uppercase tracking-widest pl-1">食事・栄養の目標</h3></div>

            {/* K-3: 目標カロリーは常にPFCからの導出値（読み取り専用）。カロリーを起点に決めたい場合はこちらから配分する */}
            <div className="bg-surface-base/80 rounded-[2rem] p-8 text-center border border-border-subtle/50 relative space-y-4">
                <p className="text-[10px] font-normal text-text-muted mb-1 uppercase tracking-widest">目標摂取カロリー（PFCからの導出値）</p>
                <div className="flex items-baseline justify-center gap-1">
                    <span className="stat-value">{Math.round(values.targetCalories).toLocaleString()}</span>
                    <span className="stat-unit">kcal / 日</span>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                    <input
                        type="number"
                        value={distributeInput}
                        onChange={(e) => setDistributeInput(e.target.value)}
                        className="w-28 bg-surface-raised border border-border-strong rounded-xl px-3 py-2 text-sm text-center font-normal"
                        placeholder="kcal"
                    />
                    <button
                        type="button"
                        onClick={handleDistribute}
                        className="text-xs font-normal text-brand-300 bg-brand-500/15 px-4 py-2 rounded-full hover:bg-brand-500/25 transition-colors"
                    >
                        カロリーから配分
                    </button>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">タンパク質は現状維持し、残りを脂質・炭水化物の今の比率で自動配分します</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <AdminStatCard label="タンパク質" value={values.protein} unit="g" color="amber" onIncrement={() => handleGramChange('protein', 1)} onDecrement={() => handleGramChange('protein', -1)} />
                <AdminStatCard label="脂質" value={values.fat} unit="g" color="purple" onIncrement={() => handleGramChange('fat', 1)} onDecrement={() => handleGramChange('fat', -1)} />
                <AdminStatCard label="炭水化物" value={values.carbs} unit="g" color="blue" onIncrement={() => handleGramChange('carbs', 1)} onDecrement={() => handleGramChange('carbs', -1)} />
                <AdminStatCard label="糖質" value={values.sugar} unit="g" color="purple" onIncrement={() => handleGramChange('sugar', 1)} onDecrement={() => handleGramChange('sugar', -1)} />
                <AdminStatCard label="食物繊維" value={values.fiber} unit="g" color="teal" onIncrement={() => handleGramChange('fiber', 1)} onDecrement={() => handleGramChange('fiber', -1)} />
                <AdminStatCard label="塩分" value={values.salt} unit="g" color="gray" onIncrement={() => onValuesChange(prev => ({ ...prev, salt: Math.max(0, prev.salt + 0.5) }))} onDecrement={() => onValuesChange(prev => ({ ...prev, salt: Math.max(0, prev.salt - 0.5) }))} />
            </div>

            <div className="space-y-8 pt-8 border-t border-border-subtle">
                <div className="space-y-1"><h3 className="text-[10px] font-normal text-text-muted uppercase tracking-widest pl-1">生活習慣の目標</h3></div>
                <div className="grid grid-cols-2 gap-4">
                    <AdminStatCard label="水分摂取" value={habitTargets.water ?? DEFAULT_HABIT_TARGETS.water} unit="L" color="sky" onIncrement={() => handleHabitChange('water', 0.5, DEFAULT_HABIT_TARGETS.water)} onDecrement={() => handleHabitChange('water', -0.5, DEFAULT_HABIT_TARGETS.water)} />
                    <AdminStatCard label="目標歩数" value={habitTargets.steps ?? DEFAULT_HABIT_TARGETS.steps} unit="歩" color="cyan" onIncrement={() => handleHabitChange('steps', 500, DEFAULT_HABIT_TARGETS.steps)} onDecrement={() => handleHabitChange('steps', -500, DEFAULT_HABIT_TARGETS.steps)} />
                    <AdminStatCard label="筋トレ回数" value={habitTargets.workout ?? DEFAULT_HABIT_TARGETS.workout} unit="回/週" color="orange" onIncrement={() => handleHabitChange('workout', 1, DEFAULT_HABIT_TARGETS.workout)} onDecrement={() => handleHabitChange('workout', -1, DEFAULT_HABIT_TARGETS.workout)} />
                    <AdminStatCard label="睡眠時間" value={habitTargets.sleep ?? DEFAULT_HABIT_TARGETS.sleep} unit="時間" color="violet" onIncrement={() => handleHabitChange('sleep', 0.5, DEFAULT_HABIT_TARGETS.sleep)} onDecrement={() => handleHabitChange('sleep', -0.5, DEFAULT_HABIT_TARGETS.sleep)} />
                </div>
            </div>

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

function AdminStatCard({ label, value, unit, color, onIncrement, onDecrement }: {
    label: string, value: number | null, unit: string, color: string, onIncrement: () => void, onDecrement: () => void
}) {
    // Q-3: bg-*-50(ほぼ白)+border-*-100(不透明)というライトモードの配色が黒背景の
    // まま残っており、カードが白く浮いて見える不具合だったため、ダークバッジパターン
    // (bg-*-500/15 + border-*-500/25 + 明るめのtext-*-300)に統一する。
    const colorMap: any = {
        amber: 'text-amber-300 bg-amber-500/15 border-amber-500/25',
        blue: 'text-blue-300 bg-blue-500/15 border-blue-500/25',
        purple: 'text-purple-300 bg-purple-500/15 border-purple-500/25',
        teal: 'text-teal-300 bg-teal-500/15 border-teal-500/25',
        gray: 'text-text-secondary bg-surface-base border-border-subtle',
        sky: 'text-sky-300 bg-sky-500/15 border-sky-500/25',
        cyan: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/25',
        orange: 'text-orange-300 bg-orange-500/15 border-orange-500/25',
        violet: 'text-violet-300 bg-violet-500/15 border-violet-500/25'
    }
    const style = colorMap[color] || colorMap.gray;
    const [baseColor, bgColor, borderColor] = style.split(' ');

    return (
        <div className={`${bgColor} rounded-[2rem] p-5 border ${borderColor} transition-all hover:shadow-md group relative overflow-hidden`}>
            <p className="text-[9px] font-normal text-text-muted mb-2 uppercase tracking-widest leading-none">{label}</p>
            <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-semibold tabular-nums leading-none ${baseColor}`}>
                        {value === null ? '-' : unit === 'L' ? value.toFixed(1) : value}
                    </span>
                    <span className="text-[9px] font-normal text-text-muted uppercase tracking-tighter">{unit}</span>
                </div>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <button onClick={(e) => { e.preventDefault(); onIncrement(); }} className="p-1 hover:bg-surface-raised rounded-lg text-text-muted hover:text-text-secondary"><Icon name="chevronUp" size={12} /></button>
                    <button onClick={(e) => { e.preventDefault(); onDecrement(); }} className="p-1 hover:bg-surface-raised rounded-lg text-text-muted hover:text-text-secondary"><Icon name="chevronDown" size={12} /></button>
                </div>
            </div>
        </div>
    )
}
