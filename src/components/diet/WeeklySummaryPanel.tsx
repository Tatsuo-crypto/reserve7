'use client'

import { useState } from 'react'
import type { WeeklyProgressStats } from '@/hooks/useWeeklyProgress'
import { useDaySelection } from '@/hooks/useDaySelection'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/icons'
import { RecordCheckTable, CalorieHeroCard, AchievementItemCard, DisplayModeToggle, type DisplayMode } from './WeeklyAchievementCards'

interface WeeklySummaryPanelProps {
    weeklyStats: WeeklyProgressStats | null
    weekOffset: number
    setWeekOffset: (updater: (prev: number) => number) => void
    showWeekSwitcher?: boolean
}

/**
 * 食事・生活を1ページにまとめた「週間まとめ」専用パネル。
 * （WeeklyProgressPanelと表示ロジックを共通化: WeeklyAchievementCards）。
 *
 * オーナー確認後の修正（2026-07-06）:
 *   1. 体重（今週平均）カードは「体重」タブに専用の表示があり重複するため、
 *      この週間パネルからは削除した。
 *   2. 「週合計」「記録日平均」をボタンで切り替えられるようにした
 *      （DisplayModeToggle。カロリー主役行・栄養/生活カードすべてに適用。
 *      筋トレ等の頻度型項目のみ、切替によらず「今週 X/Y回」の専用表示のまま）。
 */
export default function WeeklySummaryPanel({
    weeklyStats,
    weekOffset,
    setWeekOffset,
    showWeekSwitcher = true,
}: WeeklySummaryPanelProps) {
    const [mode, setMode] = useState<DisplayMode>('average')
    const { selectedDate, dayLabel, dayActual, dayTarget, goPrevDay, goNextDay, selectDate, isNextDayDisabled } =
        useDaySelection(weeklyStats, weekOffset, setWeekOffset, mode === 'day')

    return (
        <div className="space-y-3">
            {showWeekSwitcher && (
                <div className="px-2 flex flex-col items-center">
                    <div className="flex items-center gap-2 bg-surface-overlay rounded-2xl p-1 w-full max-w-[300px] shadow-sm">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => (mode === 'day' ? goPrevDay() : setWeekOffset(prev => prev - 1))}
                            className="w-10 h-9 shrink-0 flex items-center justify-center hover:bg-surface-raised rounded-xl p-0 transition-all text-text-secondary active:scale-90"
                        >
                            <Icon name="chevronLeft" size={24} />
                        </Button>

                        <div className="flex-1 text-center">
                            <div className="flex items-center justify-center gap-2">
                                {mode === 'day' ? (
                                    <span className="text-sm font-normal text-text-primary tabular-nums">{dayLabel}</span>
                                ) : (
                                    <>
                                        <span className="text-sm font-normal text-text-primary">
                                            {weekOffset === 0 ? '今週' : weekOffset === -1 ? '先週' : `${Math.abs(weekOffset)}週間前`}
                                        </span>
                                        <span className="text-xs font-normal text-text-secondary tabular-nums">
                                            ({weeklyStats?.weekRangeStr})
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => (mode === 'day' ? goNextDay() : setWeekOffset(prev => Math.min(0, prev + 1)))}
                            className={`w-10 h-9 shrink-0 flex items-center justify-center rounded-xl p-0 transition-all active:scale-90 ${(mode === 'day' ? isNextDayDisabled : weekOffset === 0) ? 'text-text-muted cursor-not-allowed' : 'hover:bg-surface-raised text-text-secondary'}`}
                            disabled={mode === 'day' ? isNextDayDisabled : weekOffset === 0}
                        >
                            <Icon name="chevronRight" size={24} />
                        </Button>
                    </div>
                </div>
            )}

            {!weeklyStats ? (
                <EmptyState
                    icon="chartBar"
                    title="今週の記録がありません"
                    description="記録が入ると、週間まとめがここに表示されます。"
                />
            ) : (
                <div className="space-y-3">
                    <DisplayModeToggle mode={mode} onChange={setMode} />

                    <RecordCheckTable
                        weekDays={weeklyStats.weekDays}
                        selectedDate={mode === 'day' ? selectedDate : undefined}
                        onSelectDate={(date) => { setMode('day'); selectDate(date) }}
                    />

                    <CalorieHeroCard
                        mode={mode}
                        actualTotal={weeklyStats.actual.calories}
                        weekTarget={weeklyStats.targets.calories}
                        avg={weeklyStats.avgOnRecordedDays.calories}
                        perDayTarget={weeklyStats.dietTargetPerDay.calories}
                        dayActual={dayActual.calories}
                        dayTarget={dayTarget.calories}
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <AchievementItemCard label="タンパク質 (P)" unit="g" mode={mode} perDayTarget={weeklyStats.dietTargetPerDay.protein} weekTarget={weeklyStats.targets.protein} avg={weeklyStats.avgOnRecordedDays.protein} prevAvg={weeklyStats.previousAvgOnRecordedDays.protein} actualTotal={weeklyStats.actual.protein} prevActualTotal={weeklyStats.previousActual.protein} prevRecordedDays={weeklyStats.previousCounts.protein} dayActual={dayActual.protein} dayTarget={dayTarget.protein} />
                        <AchievementItemCard label="脂質 (F)" unit="g" mode={mode} perDayTarget={weeklyStats.dietTargetPerDay.fat} weekTarget={weeklyStats.targets.fat} avg={weeklyStats.avgOnRecordedDays.fat} prevAvg={weeklyStats.previousAvgOnRecordedDays.fat} actualTotal={weeklyStats.actual.fat} prevActualTotal={weeklyStats.previousActual.fat} prevRecordedDays={weeklyStats.previousCounts.fat} dayActual={dayActual.fat} dayTarget={dayTarget.fat} />
                        <AchievementItemCard label="炭水化物 (C)" unit="g" mode={mode} perDayTarget={weeklyStats.dietTargetPerDay.carbs} weekTarget={weeklyStats.targets.carbs} avg={weeklyStats.avgOnRecordedDays.carbs} prevAvg={weeklyStats.previousAvgOnRecordedDays.carbs} actualTotal={weeklyStats.actual.carbs} prevActualTotal={weeklyStats.previousActual.carbs} prevRecordedDays={weeklyStats.previousCounts.carbs} dayActual={dayActual.carbs} dayTarget={dayTarget.carbs} />
                        <AchievementItemCard label="糖質" unit="g" mode={mode} perDayTarget={weeklyStats.dietTargetPerDay.sugar} weekTarget={weeklyStats.targets.sugar} avg={weeklyStats.avgOnRecordedDays.sugar} prevAvg={weeklyStats.previousAvgOnRecordedDays.sugar} actualTotal={weeklyStats.actual.sugar} prevActualTotal={weeklyStats.previousActual.sugar} prevRecordedDays={weeklyStats.previousCounts.sugar} dayActual={dayActual.sugar} dayTarget={dayTarget.sugar} />
                        <AchievementItemCard label="食物繊維" unit="g" mode={mode} perDayTarget={weeklyStats.dietTargetPerDay.fiber} weekTarget={weeklyStats.targets.fiber} avg={weeklyStats.avgOnRecordedDays.fiber} prevAvg={weeklyStats.previousAvgOnRecordedDays.fiber} actualTotal={weeklyStats.actual.fiber} prevActualTotal={weeklyStats.previousActual.fiber} prevRecordedDays={weeklyStats.previousCounts.fiber} dayActual={dayActual.fiber} dayTarget={dayTarget.fiber} />
                        <AchievementItemCard label="塩分" unit="g" mode={mode} perDayTarget={weeklyStats.dietTargetPerDay.salt} weekTarget={weeklyStats.targets.salt} avg={weeklyStats.avgOnRecordedDays.salt} prevAvg={weeklyStats.previousAvgOnRecordedDays.salt} actualTotal={weeklyStats.actual.salt} prevActualTotal={weeklyStats.previousActual.salt} prevRecordedDays={weeklyStats.previousCounts.salt} dayActual={dayActual.salt} dayTarget={dayTarget.salt} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <AchievementItemCard label="合計歩数" unit="歩" mode={mode} perDayTarget={weeklyStats.lifeTargetPerDay.steps} weekTarget={weeklyStats.targets.steps} avg={weeklyStats.avgOnRecordedDays.steps} prevAvg={weeklyStats.previousAvgOnRecordedDays.steps} actualTotal={weeklyStats.actual.steps} prevActualTotal={weeklyStats.previousActual.steps} prevRecordedDays={weeklyStats.previousCounts.steps} dayActual={dayActual.steps} dayTarget={dayTarget.steps} />
                        <AchievementItemCard label="水分摂取量" unit="L" mode={mode} perDayTarget={weeklyStats.lifeTargetPerDay.water} weekTarget={weeklyStats.targets.water} avg={weeklyStats.avgOnRecordedDays.water} prevAvg={weeklyStats.previousAvgOnRecordedDays.water} actualTotal={weeklyStats.actual.water} prevActualTotal={weeklyStats.previousActual.water} prevRecordedDays={weeklyStats.previousCounts.water} dayActual={dayActual.water} dayTarget={dayTarget.water} />
                        <AchievementItemCard label="睡眠時間" unit="h" mode={mode} perDayTarget={weeklyStats.lifeTargetPerDay.sleep} weekTarget={weeklyStats.targets.sleep} avg={weeklyStats.avgOnRecordedDays.sleep} prevAvg={weeklyStats.previousAvgOnRecordedDays.sleep} actualTotal={weeklyStats.actual.sleep} prevActualTotal={weeklyStats.previousActual.sleep} prevRecordedDays={weeklyStats.previousCounts.sleep} dayActual={dayActual.sleep} dayTarget={dayTarget.sleep} />
                        <AchievementItemCard label="筋トレ実施回数" unit="回" mode={mode} isFrequency actual={weeklyStats.actual.workout} target={weeklyStats.targets.workout} />
                    </div>
                </div>
            )}
        </div>
    )
}
