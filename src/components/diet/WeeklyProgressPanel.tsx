'use client'

import { useState } from 'react'
import type { WeeklyProgressStats } from '@/hooks/useWeeklyProgress'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'
import { RecordCheckTable, CalorieHeroCard, AchievementItemCard, DisplayModeToggle, NutritionListCard, MemberWeeklyResultListCard, type DisplayMode } from './WeeklyAchievementCards'

interface WeeklyProgressPanelProps {
    weeklyStats: WeeklyProgressStats | null
    weekOffset: number
    setWeekOffset: (updater: (prev: number) => number) => void
    showWeekSwitcher?: boolean
    /** Render inside a collapsible "週間目標" section, closed by default (used on the Analyze tab). */
    collapsible?: boolean
    defaultOpen?: boolean
    /**
     * どのドメインを表示するか（I-4）。管理者側は「食事・栄養」タブで'nutrition'、
     * 「体重・生活」タブで'life'を渡してパネルを分割する。会員側は常にデフォルト'all'
     * のまま（週間目標を隠さない、という絶対制約を遵守）。
     */
    sections?: 'all' | 'nutrition' | 'life'
    /** 会員側の週間タブ用。切替・前週比・複数カードを減らし、栄養を1枚の一覧で見せる。 */
    simpleMemberView?: boolean
}

export default function WeeklyProgressPanel({
    weeklyStats,
    weekOffset,
    setWeekOffset,
    showWeekSwitcher = true,
    collapsible = false,
    defaultOpen = false,
    sections = 'all',
    simpleMemberView = false,
}: WeeklyProgressPanelProps) {
    const [open, setOpen] = useState(defaultOpen)
    const [mode, setMode] = useState<DisplayMode>('average')
    const showNutrition = sections === 'all' || sections === 'nutrition'
    const showLife = sections === 'all' || sections === 'life'

    const body = (
        <div className="space-y-4">
            {showWeekSwitcher && (
                <div className="px-2 flex flex-col items-center">
                    <div className="flex items-center gap-3 bg-surface-overlay rounded-2xl p-1.5 w-full max-w-[300px] shadow-sm">
                        <button
                            onClick={() => setWeekOffset(prev => prev - 1)}
                            className="w-9 h-9 flex items-center justify-center hover:bg-surface-raised rounded-xl transition-all text-text-secondary active:scale-90"
                        >
                            <Icon name="chevronLeft" size={16} />
                        </button>

                        <div className="flex-1 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-sm font-normal text-text-primary">
                                    {weekOffset === 0 ? '今週' : weekOffset === -1 ? '先週' : `${Math.abs(weekOffset)}週間前`}
                                </span>
                                <span className="text-[10px] font-normal text-text-secondary tabular-nums">
                                    ({weeklyStats?.weekRangeStr})
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => setWeekOffset(prev => Math.min(0, prev + 1))}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 ${weekOffset === 0 ? 'text-text-muted cursor-not-allowed' : 'hover:bg-surface-raised text-text-secondary'}`}
                            disabled={weekOffset === 0}
                        >
                            <Icon name="chevronRight" size={16} />
                        </button>
                    </div>
                </div>
            )}

            {!weeklyStats ? (
                <Card padding="lg" className="text-center">
                    <p className="text-text-muted font-normal italic">今週の記録または目標がありません</p>
                </Card>
            ) : (
                <div className="space-y-4">
                    <DisplayModeToggle mode={mode} onChange={setMode} />

                    {simpleMemberView ? (
                        <>
                            <RecordCheckTable weekDays={weeklyStats.weekDays} />
                            <MemberWeeklyResultListCard
                                mode={mode}
                                items={[
                                    {
                                        label: 'カロリー',
                                        unit: 'kcal',
                                        actual: mode === 'total' ? weeklyStats.actual.calories : weeklyStats.avgOnRecordedDays.calories,
                                        target: mode === 'total' ? weeklyStats.targets.calories : weeklyStats.dietTargetPerDay.calories,
                                        rule: 'upper',
                                        fractionDigits: 0,
                                    },
                                    {
                                        label: 'P',
                                        unit: 'g',
                                        actual: mode === 'total' ? weeklyStats.actual.protein : weeklyStats.avgOnRecordedDays.protein,
                                        target: mode === 'total' ? weeklyStats.targets.protein : weeklyStats.dietTargetPerDay.protein,
                                        rule: 'minimum',
                                        fractionDigits: 0,
                                    },
                                    {
                                        label: 'F',
                                        unit: 'g',
                                        actual: mode === 'total' ? weeklyStats.actual.fat : weeklyStats.avgOnRecordedDays.fat,
                                        target: mode === 'total' ? weeklyStats.targets.fat : weeklyStats.dietTargetPerDay.fat,
                                        rule: 'upper',
                                        fractionDigits: 0,
                                    },
                                    {
                                        label: 'C',
                                        unit: 'g',
                                        actual: mode === 'total' ? weeklyStats.actual.carbs : weeklyStats.avgOnRecordedDays.carbs,
                                        target: mode === 'total' ? weeklyStats.targets.carbs : weeklyStats.dietTargetPerDay.carbs,
                                        rule: 'upper',
                                        fractionDigits: 0,
                                    },
                                    {
                                        label: '食物繊維',
                                        unit: 'g',
                                        actual: mode === 'total' ? weeklyStats.actual.fiber : weeklyStats.avgOnRecordedDays.fiber,
                                        target: mode === 'total' ? weeklyStats.targets.fiber : weeklyStats.dietTargetPerDay.fiber,
                                        rule: 'minimum',
                                        fractionDigits: 0,
                                    },
                                    {
                                        label: '水分',
                                        unit: 'L',
                                        actual: mode === 'total' ? weeklyStats.actual.water : weeklyStats.avgOnRecordedDays.water,
                                        target: mode === 'total' ? weeklyStats.targets.water : weeklyStats.lifeTargetPerDay.water,
                                        rule: 'minimum',
                                        fractionDigits: 1,
                                    },
                                    {
                                        label: '歩数',
                                        unit: '歩',
                                        actual: mode === 'total' ? weeklyStats.actual.steps : weeklyStats.avgOnRecordedDays.steps,
                                        target: mode === 'total' ? weeklyStats.targets.steps : weeklyStats.lifeTargetPerDay.steps,
                                        rule: 'minimum',
                                        fractionDigits: 0,
                                    },
                                    {
                                        label: '筋トレ',
                                        unit: '回',
                                        actual: weeklyStats.actual.workout,
                                        target: weeklyStats.targets.workout,
                                        rule: 'minimum',
                                        fractionDigits: 0,
                                    },
                                    {
                                        label: '睡眠',
                                        unit: 'h',
                                        actual: mode === 'total' ? weeklyStats.actual.sleep : weeklyStats.avgOnRecordedDays.sleep,
                                        target: mode === 'total' ? weeklyStats.targets.sleep : weeklyStats.lifeTargetPerDay.sleep,
                                        rule: 'minimum',
                                        fractionDigits: 1,
                                    },
                                ]}
                            />
                        </>
                    ) : showNutrition && (
                        <>
                            {/* O-5: 記録チェック表。7日分の食事記録の有無を一目で見せる */}
                            <RecordCheckTable weekDays={weeklyStats.weekDays} />

                            {/* O-5: カロリー主役行。週合計/記録日平均をボタンで切替 */}
                            <CalorieHeroCard
                                mode={simpleMemberView ? 'average' : mode}
                                actualTotal={weeklyStats.actual.calories}
                                weekTarget={weeklyStats.targets.calories}
                                avg={weeklyStats.avgOnRecordedDays.calories}
                                perDayTarget={weeklyStats.dietTargetPerDay.calories}
                            />

                            {simpleMemberView ? (
                                <NutritionListCard
                                    items={[
                                        { label: 'タンパク質', shortLabel: 'P', unit: 'g', actual: weeklyStats.avgOnRecordedDays.protein, target: weeklyStats.dietTargetPerDay.protein, rule: 'minimum' },
                                        { label: '脂質', shortLabel: 'F', unit: 'g', actual: weeklyStats.avgOnRecordedDays.fat, target: weeklyStats.dietTargetPerDay.fat, rule: 'upper' },
                                        { label: '炭水化物', shortLabel: 'C', unit: 'g', actual: weeklyStats.avgOnRecordedDays.carbs, target: weeklyStats.dietTargetPerDay.carbs, rule: 'upper' },
                                        { label: '糖質', shortLabel: 'Sugar', unit: 'g', actual: weeklyStats.avgOnRecordedDays.sugar, target: weeklyStats.dietTargetPerDay.sugar, rule: 'upper' },
                                    ]}
                                />
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <AchievementItemCard label="タンパク質 (P)" unit="g" mode={mode} perDayTarget={weeklyStats.dietTargetPerDay.protein} weekTarget={weeklyStats.targets.protein} avg={weeklyStats.avgOnRecordedDays.protein} prevAvg={weeklyStats.previousAvgOnRecordedDays.protein} actualTotal={weeklyStats.actual.protein} prevActualTotal={weeklyStats.previousActual.protein} prevRecordedDays={weeklyStats.previousCounts.protein} />
                                    <AchievementItemCard label="脂質 (F)" unit="g" mode={mode} perDayTarget={weeklyStats.dietTargetPerDay.fat} weekTarget={weeklyStats.targets.fat} avg={weeklyStats.avgOnRecordedDays.fat} prevAvg={weeklyStats.previousAvgOnRecordedDays.fat} actualTotal={weeklyStats.actual.fat} prevActualTotal={weeklyStats.previousActual.fat} prevRecordedDays={weeklyStats.previousCounts.fat} />
                                    <AchievementItemCard label="炭水化物 (C)" unit="g" mode={mode} perDayTarget={weeklyStats.dietTargetPerDay.carbs} weekTarget={weeklyStats.targets.carbs} avg={weeklyStats.avgOnRecordedDays.carbs} prevAvg={weeklyStats.previousAvgOnRecordedDays.carbs} actualTotal={weeklyStats.actual.carbs} prevActualTotal={weeklyStats.previousActual.carbs} prevRecordedDays={weeklyStats.previousCounts.carbs} />
                                    <AchievementItemCard label="糖質" unit="g" mode={mode} perDayTarget={weeklyStats.dietTargetPerDay.sugar} weekTarget={weeklyStats.targets.sugar} avg={weeklyStats.avgOnRecordedDays.sugar} prevAvg={weeklyStats.previousAvgOnRecordedDays.sugar} actualTotal={weeklyStats.actual.sugar} prevActualTotal={weeklyStats.previousActual.sugar} prevRecordedDays={weeklyStats.previousCounts.sugar} />
                                    <AchievementItemCard label="食物繊維" unit="g" mode={mode} perDayTarget={weeklyStats.dietTargetPerDay.fiber} weekTarget={weeklyStats.targets.fiber} avg={weeklyStats.avgOnRecordedDays.fiber} prevAvg={weeklyStats.previousAvgOnRecordedDays.fiber} actualTotal={weeklyStats.actual.fiber} prevActualTotal={weeklyStats.previousActual.fiber} prevRecordedDays={weeklyStats.previousCounts.fiber} />
                                    <AchievementItemCard label="塩分" unit="g" mode={mode} perDayTarget={weeklyStats.dietTargetPerDay.salt} weekTarget={weeklyStats.targets.salt} avg={weeklyStats.avgOnRecordedDays.salt} prevAvg={weeklyStats.previousAvgOnRecordedDays.salt} actualTotal={weeklyStats.actual.salt} prevActualTotal={weeklyStats.previousActual.salt} prevRecordedDays={weeklyStats.previousCounts.salt} />
                                </div>
                            )}
                        </>
                    )}

                    {showLife && !simpleMemberView && (
                        <div className="grid grid-cols-2 gap-3">
                            <AchievementItemCard label="合計歩数" unit="歩" mode={mode} perDayTarget={weeklyStats.lifeTargetPerDay.steps} weekTarget={weeklyStats.targets.steps} avg={weeklyStats.avgOnRecordedDays.steps} prevAvg={weeklyStats.previousAvgOnRecordedDays.steps} actualTotal={weeklyStats.actual.steps} prevActualTotal={weeklyStats.previousActual.steps} prevRecordedDays={weeklyStats.previousCounts.steps} />
                            <AchievementItemCard label="水分摂取量" unit="L" mode={mode} perDayTarget={weeklyStats.lifeTargetPerDay.water} weekTarget={weeklyStats.targets.water} avg={weeklyStats.avgOnRecordedDays.water} prevAvg={weeklyStats.previousAvgOnRecordedDays.water} actualTotal={weeklyStats.actual.water} prevActualTotal={weeklyStats.previousActual.water} prevRecordedDays={weeklyStats.previousCounts.water} />
                            <AchievementItemCard label="睡眠時間" unit="h" mode={mode} perDayTarget={weeklyStats.lifeTargetPerDay.sleep} weekTarget={weeklyStats.targets.sleep} avg={weeklyStats.avgOnRecordedDays.sleep} prevAvg={weeklyStats.previousAvgOnRecordedDays.sleep} actualTotal={weeklyStats.actual.sleep} prevActualTotal={weeklyStats.previousActual.sleep} prevRecordedDays={weeklyStats.previousCounts.sleep} />
                            <AchievementItemCard label="筋トレ実施回数" unit="回" mode={mode} isFrequency actual={weeklyStats.actual.workout} target={weeklyStats.targets.workout} />
                        </div>
                    )}
                </div>
            )}
        </div>
    )

    if (!collapsible) return body

    return (
        <div className="space-y-4">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full px-6 py-4 bg-surface-base rounded-2xl border border-transparent hover:border-border-strong transition-all"
            >
                <span className="text-sm font-normal text-text-secondary">週間目標{weeklyStats ? `（${weeklyStats.weekRangeStr}）` : ''}</span>
                <Icon name="chevronDown" size={20} className={`text-text-muted transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="animate-fadeIn">{body}</div>}
        </div>
    )
}
