'use client'

import { useState, useEffect, useMemo } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/icons'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { fetchJsonCached } from '@/lib/client-fetch-cache'

interface PlanTabProps {
    token: string
    onEditPlan?: () => void
}

type GoalRow = {
    date: string
    displayDate: string
    periodLabel: string
    periodDays: number
    isCurrent: boolean
    dayTypeEnabled: boolean
    calories: number
    protein: number
    fat: number
    carbs: number
    trainingCalories: number
    trainingProtein: number
    trainingFat: number
    trainingCarbs: number
    restCalories: number
    restProtein: number
    restFat: number
    restCarbs: number
    trainingWater: number
    trainingSteps: number
    trainingWorkout: number
    trainingSleep: number
    restWater: number
    restSteps: number
    restWorkout: number
    restSleep: number
    water: number
    steps: number
    workout: number
    sleep: number
}

export default function PlanTab({ token, onEditPlan }: PlanTabProps) {
    const [goals, setGoals] = useState<any[]>([])
    const [lifestyleSettings, setLifestyleSettings] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [goalsData, lifeData] = await Promise.all([
                    fetchJsonCached<any>(`/api/diet/goals?token=${token}`),
                    fetchJsonCached<any>(`/api/lifestyle/settings?token=${token}`)
                ])
                setGoals(goalsData.data || [])
                setLifestyleSettings(lifeData.data || null)
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [token])

    const habitTargets = lifestyleSettings?.habit_targets || {}
    const dayTypeTargets = habitTargets?.diet_day_type_targets || {}

    const goalRows = useMemo<GoalRow[]>(() => {
        const sorted = [...goals]
            .filter(goal => goal?.start_date)
            .sort((a, b) => a.start_date.localeCompare(b.start_date))

        return sorted.map((goal, index) => {
            const [year, month, day] = goal.start_date.split('-')
            const next = sorted[index + 1]
            const startDate = new Date(goal.start_date)
            const endDate = next ? new Date(next.start_date) : new Date()
            const periodDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
            const isCurrent = index === sorted.length - 1
            const endLabel = next ? `${endDate.getMonth() + 1}/${endDate.getDate()}` : '継続中'
            const baseCalories = Math.round(Number(goal.calories || 0))
            const baseProtein = Math.round(Number(goal.protein || 0))
            const baseFat = Math.round(Number(goal.fat || 0))
            const baseCarbs = Math.round(Number(goal.carbs || 0))
            const dayTypeEnabled = Boolean(goal.day_type_enabled || (isCurrent && dayTypeTargets.day_type_enabled))
            const latestDayValue = (key: string, fallback: number) => isCurrent
                ? Number(dayTypeTargets[key] ?? fallback)
                : fallback

            return {
                date: goal.start_date,
                displayDate: `${Number(month)}/${Number(day)}`,
                periodLabel: `${Number(month)}/${Number(day)}〜${endLabel}（${periodDays}日間）`,
                periodDays,
                isCurrent,
                dayTypeEnabled,
                calories: baseCalories,
                protein: baseProtein,
                fat: baseFat,
                carbs: baseCarbs,
                trainingCalories: Math.round(Number(goal.training_calories ?? latestDayValue('training_calories', baseCalories))),
                trainingProtein: Math.round(Number(goal.training_protein ?? latestDayValue('training_protein', baseProtein))),
                trainingFat: Math.round(Number(goal.training_fat ?? latestDayValue('training_fat', baseFat))),
                trainingCarbs: Math.round(Number(goal.training_carbs ?? latestDayValue('training_carbs', baseCarbs))),
                restCalories: Math.round(Number(goal.rest_calories ?? latestDayValue('rest_calories', baseCalories))),
                restProtein: Math.round(Number(goal.rest_protein ?? latestDayValue('rest_protein', baseProtein))),
                restFat: Math.round(Number(goal.rest_fat ?? latestDayValue('rest_fat', baseFat))),
                restCarbs: Math.round(Number(goal.rest_carbs ?? latestDayValue('rest_carbs', baseCarbs))),
                trainingWater: latestDayValue('training_water', Number(habitTargets.water ?? 2)),
                trainingSteps: latestDayValue('training_steps', Number(habitTargets.steps ?? 9000)),
                trainingWorkout: latestDayValue('training_workout', Number(habitTargets.workout ?? 4)),
                trainingSleep: latestDayValue('training_sleep', Number(habitTargets.sleep ?? 7)),
                restWater: latestDayValue('rest_water', Number(habitTargets.water ?? 2)),
                restSteps: latestDayValue('rest_steps', Number(habitTargets.steps ?? 9000)),
                restWorkout: latestDayValue('rest_workout', Number(habitTargets.workout ?? 4)),
                restSleep: latestDayValue('rest_sleep', Number(habitTargets.sleep ?? 7)),
                water: Number(habitTargets.water ?? 2),
                steps: Number(habitTargets.steps ?? 9000),
                workout: Number(habitTargets.workout ?? 4),
                sleep: Number(habitTargets.sleep ?? 7),
            }
        })
    }, [goals, habitTargets, dayTypeTargets])

    const currentGoal = goalRows[goalRows.length - 1]

    if (loading) {
        return (
            <div className="space-y-4 pb-24">
                <SkeletonCard />
                <SkeletonCard />
            </div>
        )
    }

    if (!currentGoal) {
        return (
            <EmptyState
                icon="flag"
                title="食事計画がありません"
                description="目標を設定すると、摂取カロリーやPFCの計画が表示されます。"
                actionLabel={onEditPlan ? '目標を設定' : undefined}
                onAction={onEditPlan}
            />
        )
    }

    return (
        <div className="space-y-8 animate-fadeIn pb-24">
            <Card padding="lg" className="!rounded-2xl">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <SectionTitle>現在の目標</SectionTitle>
                    {onEditPlan && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onEditPlan}
                            aria-label="目標を編集"
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/15 p-0 text-brand-300 transition-colors active:scale-95"
                        >
                            <Icon name="pencil" size={17} />
                        </Button>
                    )}
                </div>

                {currentGoal.dayTypeEnabled ? (
                    <div className="space-y-3">
                        <TargetSetCard row={currentGoal} type="training" />
                        <TargetSetCard row={currentGoal} type="rest" />
                    </div>
                ) : (
                    <TargetSetCard row={currentGoal} />
                )}
            </Card>

            <GoalHistoryChart rows={goalRows} onEditPlan={onEditPlan} />
        </div>
    )
}

function SectionTitle({ children }: { children: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="h-6 w-1.5 rounded-full bg-brand-500" />
            <h2 className="text-xl font-normal tracking-tight text-text-primary">{children}</h2>
        </div>
    )
}

function formatKcal(value: number) {
    return Math.round(Number(value || 0)).toLocaleString()
}

function formatHabit(value: number, type: 'water' | 'steps' | 'workout' | 'sleep') {
    if (type === 'water') return `${Number(value || 0).toFixed(1)}L`
    if (type === 'sleep') return `${Number(value || 0).toFixed(1)}h`
    if (type === 'workout') return `${Math.round(Number(value || 0))}回`
    return `${Math.round(Number(value || 0)).toLocaleString()}`
}

function pfcValues(row: GoalRow, type?: 'training' | 'rest') {
    if (type === 'training') return { p: row.trainingProtein, f: row.trainingFat, c: row.trainingCarbs }
    if (type === 'rest') return { p: row.restProtein, f: row.restFat, c: row.restCarbs }
    return { p: row.protein, f: row.fat, c: row.carbs }
}

function lifeValues(row: GoalRow, type?: 'training' | 'rest') {
    if (type === 'training') {
        return { water: row.trainingWater, steps: row.trainingSteps, workout: row.trainingWorkout, sleep: row.trainingSleep }
    }
    if (type === 'rest') {
        return { water: row.restWater, steps: row.restSteps, workout: row.restWorkout, sleep: row.restSleep }
    }
    return { water: row.water, steps: row.steps, workout: row.workout, sleep: row.sleep }
}

function TargetSetCard({ row, type }: { row: GoalRow; type?: 'training' | 'rest' }) {
    const label = type === 'training' ? '筋トレ日' : type === 'rest' ? '休養日' : '目標'
    const calories = type === 'training' ? row.trainingCalories : type === 'rest' ? row.restCalories : row.calories
    const pfc = pfcValues(row, type)
    const life = lifeValues(row, type)
    const isTraining = type === 'training'
    const isRest = type === 'rest'

    return (
        <div className={`rounded-2xl border px-4 py-4 ${isTraining ? 'border-brand-500/25 bg-brand-500/10' : 'border-border-subtle bg-surface-base'}`}>
            <p className={`text-sm font-normal ${isTraining ? 'text-brand-300' : isRest ? 'text-blue-300' : 'text-text-muted'}`}>
                {label}
            </p>
            <p className="mt-1 text-3xl font-normal tabular-nums text-text-primary">
                {formatKcal(calories)}<span className="ml-1 text-sm text-text-muted">kcal</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
                <Chip label="P" value={`${pfc.p}g`} tone="p" />
                <Chip label="F" value={`${pfc.f}g`} tone="f" />
                <Chip label="C" value={`${pfc.c}g`} tone="c" />
                <Chip label="水分" value={formatHabit(life.water, 'water')} />
                <Chip label="歩数" value={formatHabit(life.steps, 'steps')} />
                <Chip label="筋トレ" value={formatHabit(life.workout, 'workout')} />
                <Chip label="睡眠" value={formatHabit(life.sleep, 'sleep')} />
            </div>
        </div>
    )
}

function Chip({ label, value, tone }: { label: string; value: string; tone?: 'p' | 'f' | 'c' }) {
    const color = tone === 'p' ? 'text-orange-300' : tone === 'f' ? 'text-amber-700' : tone === 'c' ? 'text-amber-200' : 'text-text-muted'
    return (
        <span className="rounded-full border border-border-subtle bg-surface-base px-3 py-1.5 text-xs tabular-nums text-text-secondary">
            <span className={color}>{label}</span> {value}
        </span>
    )
}

function GoalHistoryChart({ rows, onEditPlan }: { rows: GoalRow[]; onEditPlan?: () => void }) {
    const [selectedDate, setSelectedDate] = useState<string | null>(rows[rows.length - 1]?.date || null)
    const selected = rows.find(row => row.date === selectedDate) || rows[rows.length - 1]
    const chartRows = rows.slice(-6)
    const hasDayType = rows.some(row => row.dayTypeEnabled)
    const chart = { width: 320, height: 198, left: 38, right: 14, top: 20, bottom: 30 }
    const plotWidth = chart.width - chart.left - chart.right
    const plotHeight = chart.height - chart.top - chart.bottom
    const displayCalories = (row: GoalRow) => row.dayTypeEnabled ? row.trainingCalories : row.calories
    const displayProtein = (row: GoalRow) => row.dayTypeEnabled ? row.trainingProtein : row.protein
    const displayFat = (row: GoalRow) => row.dayTypeEnabled ? row.trainingFat : row.fat
    const maxCalories = Math.max(...chartRows.map(displayCalories), 1)
    const domainMax = Math.max(500, Math.ceil(maxCalories / 500) * 500)
    const yTicks = Array.from({ length: Math.floor(domainMax / 500) }, (_, index) => (index + 1) * 500).reverse()
    const valueToY = (value: number) => chart.top + ((domainMax - value) / Math.max(1, domainMax)) * plotHeight
    const totalDays = chartRows.reduce((sum, row) => sum + row.periodDays, 0) || 1
    const minBarWidth = 10
    const rawWidths = chartRows.map(row => Math.max(minBarWidth, (row.periodDays / totalDays) * plotWidth))
    const widthScale = plotWidth / rawWidths.reduce((sum, width) => sum + width, 0)
    const barWidths = rawWidths.map(width => width * widthScale)
    const barXs = barWidths.reduce<number[]>((positions, width, index) => {
        positions.push(index === 0 ? chart.left : positions[index - 1] + barWidths[index - 1])
        return positions
    }, [])
    const segments = (row: GoalRow) => {
        const calories = displayCalories(row)
        const proteinCalories = Math.max(0, Math.round(displayProtein(row) * 4))
        const fatCalories = Math.max(0, Math.round(displayFat(row) * 9))
        const carbCalories = Math.max(0, calories - proteinCalories - fatCalories)
        return [
            { key: 'C', value: carbCalories, color: '#e5c07b' },
            { key: 'F', value: fatCalories, color: '#9a5b2e' },
            { key: 'P', value: proteinCalories, color: '#f97316' },
        ]
    }

    useEffect(() => {
        setSelectedDate(rows[rows.length - 1]?.date || null)
    }, [rows])

    return (
        <Card padding="lg" className="!rounded-2xl">
            <div className="mb-6 flex items-center justify-between gap-3">
                <SectionTitle>カロリー推移</SectionTitle>
                {hasDayType && (
                    <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs text-brand-300">筋トレ日基準</span>
                )}
            </div>

            {chartRows.length === 1 ? (
                <div className="flex h-44 flex-col items-center justify-center rounded-2xl border border-border-subtle bg-surface-base text-center">
                    <p className="text-3xl font-normal tabular-nums text-text-primary">
                        {formatKcal(displayCalories(chartRows[0]))}<span className="ml-1 text-sm text-text-muted">kcal</span>
                    </p>
                </div>
            ) : (
                <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-auto w-full overflow-visible">
                    {yTicks.map(tick => {
                        const y = valueToY(tick)
                        return (
                            <g key={tick}>
                                <line x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />
                                <text x={chart.left - 6} y={y + 3} textAnchor="end" className="fill-text-muted text-xs">{tick}</text>
                            </g>
                        )
                    })}
                    <line x1={chart.left} x2={chart.left} y1={chart.top} y2={chart.top + plotHeight} stroke="rgba(255,255,255,0.16)" />
                    <line x1={chart.left} x2={chart.width - chart.right} y1={chart.top + plotHeight} y2={chart.top + plotHeight} stroke="rgba(255,255,255,0.16)" />
                    {chartRows.map((row, index) => {
                        const x = barXs[index]
                        const barWidth = Math.max(4, barWidths[index] - 2)
                        const calories = displayCalories(row)
                        const isSelected = selected?.date === row.date
                        const showSegmentLabels = row.periodDays >= 7 && barWidth >= 34
                        let stackBase = 0
                        return (
                            <g
                                key={row.date}
                                className="cursor-pointer"
                                onMouseEnter={() => setSelectedDate(row.date)}
                                onClick={() => setSelectedDate(row.date)}
                            >
                                <line x1={x + 1} x2={x + 1} y1={chart.top + plotHeight} y2={chart.top + plotHeight + 5} stroke="rgba(255,255,255,0.34)" />
                                {segments(row).map(segment => {
                                    const yTop = valueToY(stackBase + segment.value)
                                    const yBottom = valueToY(stackBase)
                                    const height = Math.max(0, yBottom - yTop)
                                    stackBase += segment.value
                                    return (
                                        <g key={segment.key}>
                                            <rect x={x + 1} y={yTop} width={barWidth} height={height} fill={segment.color} opacity={isSelected ? 1 : 0.82} />
                                            {showSegmentLabels && height >= 18 && (
                                                <text x={x + 1 + barWidth / 2} y={yTop + height / 2 + 4} textAnchor="middle" className="fill-white text-xs font-semibold">
                                                    {segment.key}
                                                </text>
                                            )}
                                        </g>
                                    )
                                })}
                                <rect
                                    x={x + 1}
                                    y={valueToY(calories)}
                                    width={barWidth}
                                    height={valueToY(0) - valueToY(calories)}
                                    fill="transparent"
                                    stroke={isSelected ? '#fb923c' : 'rgba(255,255,255,0.18)'}
                                    strokeWidth={isSelected ? 2 : 1}
                                    rx="2"
                                />
                                <text x={x + 1} y={chart.top + plotHeight + 17} textAnchor="middle" className="fill-text-muted text-xs">{row.displayDate}</text>
                            </g>
                        )
                    })}
                    <text x={chart.left - 24} y={chart.top - 6} textAnchor="start" className="fill-text-muted text-xs">kcal</text>
                </svg>
            )}

            {selected && (
                <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full border border-border-subtle bg-surface-base px-2.5 py-1 text-xs text-text-muted">{selected.periodLabel}</span>
                        {onEditPlan && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onEditPlan}
                                aria-label="目標を編集"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 p-0 text-brand-300 transition-colors active:scale-95"
                            >
                                <Icon name="pencil" size={15} />
                            </Button>
                        )}
                    </div>
                    {selected.dayTypeEnabled ? (
                        <div className="space-y-3">
                            <TargetSetCard row={selected} type="training" />
                            <TargetSetCard row={selected} type="rest" />
                        </div>
                    ) : (
                        <TargetSetCard row={selected} />
                    )}
                </div>
            )}
        </Card>
    )
}
