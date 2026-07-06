'use client'

import type { WeeklyProgressStats } from '@/hooks/useWeeklyProgress'
import WeightWeeklyCompare from './WeightWeeklyCompare'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'
import { RecordCheckTable, CalorieHeroCard, AchievementItemCard } from './WeeklyAchievementCards'

interface WeeklySummaryPanelProps {
    weeklyStats: WeeklyProgressStats | null
    weekOffset: number
    setWeekOffset: (updater: (prev: number) => number) => void
    showWeekSwitcher?: boolean
}

/**
 * 体重・食事・生活を1ページにまとめた「週間まとめ」専用パネル。
 * O-5改訂: 「週の合計」「週の平均」の切替トグルは廃止した。新レイアウトでは
 * カロリーは常に週合計をカロリー主役行で、それ以外の項目は常に記録日平均を
 * 2列グリッドで見せる、という表現に固定したため、切替の必要がなくなったため
 * （WeeklyProgressPanelと表示ロジックを共通化: WeeklyAchievementCards）。
 */
export default function WeeklySummaryPanel({
    weeklyStats,
    weekOffset,
    setWeekOffset,
    showWeekSwitcher = true,
}: WeeklySummaryPanelProps) {
    return (
        <div className="space-y-4">
            {showWeekSwitcher && (
                <div className="px-2 flex flex-col items-center">
                    <div className="flex items-center gap-3 bg-gray-100 rounded-2xl p-1.5 w-full max-w-[300px] shadow-sm">
                        <button
                            onClick={() => setWeekOffset(prev => prev - 1)}
                            className="w-9 h-9 flex items-center justify-center hover:bg-white rounded-xl transition-all text-gray-500 active:scale-90"
                        >
                            <Icon name="chevronLeft" size={16} />
                        </button>

                        <div className="flex-1 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-sm font-normal text-gray-800">
                                    {weekOffset === 0 ? '今週' : weekOffset === -1 ? '先週' : `${Math.abs(weekOffset)}週間前`}
                                </span>
                                <span className="text-[10px] font-normal text-gray-500 tabular-nums">
                                    ({weeklyStats?.weekRangeStr})
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => setWeekOffset(prev => Math.min(0, prev + 1))}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 ${weekOffset === 0 ? 'text-gray-100 cursor-not-allowed' : 'hover:bg-white text-gray-500'}`}
                            disabled={weekOffset === 0}
                        >
                            <Icon name="chevronRight" size={16} />
                        </button>
                    </div>
                </div>
            )}

            {!weeklyStats ? (
                <Card padding="lg" className="text-center">
                    <p className="text-gray-400 font-normal italic">今週の記録または目標がありません</p>
                </Card>
            ) : (
                <div className="space-y-4">
                    <WeightWeeklyCompare weight={weeklyStats.weight} />

                    <RecordCheckTable weekDays={weeklyStats.weekDays} />

                    <CalorieHeroCard actual={weeklyStats.actual.calories} target={weeklyStats.targets.calories} />

                    <div className="grid grid-cols-2 gap-3">
                        <AchievementItemCard label="タンパク質 (P)" type="lower" unit="g" target={weeklyStats.dietTargetPerDay.protein} avg={weeklyStats.avgOnRecordedDays.protein} prevAvg={weeklyStats.previousAvgOnRecordedDays.protein} prevRecordedDays={weeklyStats.previousCounts.protein} />
                        <AchievementItemCard label="脂質 (F)" type="upper" unit="g" target={weeklyStats.dietTargetPerDay.fat} avg={weeklyStats.avgOnRecordedDays.fat} prevAvg={weeklyStats.previousAvgOnRecordedDays.fat} prevRecordedDays={weeklyStats.previousCounts.fat} />
                        <AchievementItemCard label="炭水化物 (C)" type="upper" unit="g" target={weeklyStats.dietTargetPerDay.carbs} avg={weeklyStats.avgOnRecordedDays.carbs} prevAvg={weeklyStats.previousAvgOnRecordedDays.carbs} prevRecordedDays={weeklyStats.previousCounts.carbs} />
                        <AchievementItemCard label="糖質" type="upper" unit="g" target={weeklyStats.dietTargetPerDay.sugar} avg={weeklyStats.avgOnRecordedDays.sugar} prevAvg={weeklyStats.previousAvgOnRecordedDays.sugar} prevRecordedDays={weeklyStats.previousCounts.sugar} />
                        <AchievementItemCard label="食物繊維" type="lower" unit="g" target={weeklyStats.dietTargetPerDay.fiber} avg={weeklyStats.avgOnRecordedDays.fiber} prevAvg={weeklyStats.previousAvgOnRecordedDays.fiber} prevRecordedDays={weeklyStats.previousCounts.fiber} />
                        <AchievementItemCard label="塩分" type="upper" unit="g" target={weeklyStats.dietTargetPerDay.salt} avg={weeklyStats.avgOnRecordedDays.salt} prevAvg={weeklyStats.previousAvgOnRecordedDays.salt} prevRecordedDays={weeklyStats.previousCounts.salt} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <AchievementItemCard label="合計歩数" type="lower" unit="歩" target={weeklyStats.lifeTargetPerDay.steps} avg={weeklyStats.avgOnRecordedDays.steps} prevAvg={weeklyStats.previousAvgOnRecordedDays.steps} prevRecordedDays={weeklyStats.previousCounts.steps} />
                        <AchievementItemCard label="水分摂取量" type="lower" unit="L" target={weeklyStats.lifeTargetPerDay.water} avg={weeklyStats.avgOnRecordedDays.water} prevAvg={weeklyStats.previousAvgOnRecordedDays.water} prevRecordedDays={weeklyStats.previousCounts.water} />
                        <AchievementItemCard label="睡眠時間" type="lower" unit="h" target={weeklyStats.lifeTargetPerDay.sleep} avg={weeklyStats.avgOnRecordedDays.sleep} prevAvg={weeklyStats.previousAvgOnRecordedDays.sleep} prevRecordedDays={weeklyStats.previousCounts.sleep} />
                        <AchievementItemCard label="筋トレ実施回数" type="lower" unit="回" isFrequency actual={weeklyStats.actual.workout} target={weeklyStats.targets.workout} />
                    </div>
                </div>
            )}
        </div>
    )
}
