'use client'

import type { WeeklyProgressStats } from '@/hooks/useWeeklyProgress'
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
 * 食事・生活を1ページにまとめた「週間まとめ」専用パネル。
 * O-5改訂: 「週の合計」「週の平均」の切替トグルは廃止した。新レイアウトでは
 * カロリーは常に週合計をカロリー主役行で、それ以外の項目は常に記録日平均を
 * 2列グリッドで見せる、という表現に固定したため、切替の必要がなくなったため
 * （WeeklyProgressPanelと表示ロジックを共通化: WeeklyAchievementCards）。
 *
 * オーナー確認後の修正（2026-07-06）:
 *   1. 体重（今週平均）カードは「体重」タブに専用の表示があり重複するため、
 *      この週間パネルからは削除した。
 *   2. タンパク質・脂質・炭水化物・糖質・食物繊維・塩分（食事・栄養ドメイン）は、
 *      カロリー主役行と同じ「週合計 / 週目標」表記に統一した（mode="total"）。
 *      以前は日平均表記だったため、カロリーだけ週合計・他は日平均という
 *      見え方の不整合があった。歩数・水分・睡眠（生活ドメイン）は引き続き
 *      日平均表記のまま（週合計より1日の目安のほうが実用的なため）。
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
                    <RecordCheckTable weekDays={weeklyStats.weekDays} />

                    <CalorieHeroCard actual={weeklyStats.actual.calories} target={weeklyStats.targets.calories} />

                    <div className="grid grid-cols-2 gap-3">
                        <AchievementItemCard label="タンパク質 (P)" type="lower" unit="g" mode="total" actual={weeklyStats.actual.protein} target={weeklyStats.targets.protein} prevActual={weeklyStats.previousActual.protein} prevRecordedDays={weeklyStats.previousCounts.protein} />
                        <AchievementItemCard label="脂質 (F)" type="upper" unit="g" mode="total" actual={weeklyStats.actual.fat} target={weeklyStats.targets.fat} prevActual={weeklyStats.previousActual.fat} prevRecordedDays={weeklyStats.previousCounts.fat} />
                        <AchievementItemCard label="炭水化物 (C)" type="upper" unit="g" mode="total" actual={weeklyStats.actual.carbs} target={weeklyStats.targets.carbs} prevActual={weeklyStats.previousActual.carbs} prevRecordedDays={weeklyStats.previousCounts.carbs} />
                        <AchievementItemCard label="糖質" type="upper" unit="g" mode="total" actual={weeklyStats.actual.sugar} target={weeklyStats.targets.sugar} prevActual={weeklyStats.previousActual.sugar} prevRecordedDays={weeklyStats.previousCounts.sugar} />
                        <AchievementItemCard label="食物繊維" type="lower" unit="g" mode="total" actual={weeklyStats.actual.fiber} target={weeklyStats.targets.fiber} prevActual={weeklyStats.previousActual.fiber} prevRecordedDays={weeklyStats.previousCounts.fiber} />
                        <AchievementItemCard label="塩分" type="upper" unit="g" mode="total" actual={weeklyStats.actual.salt} target={weeklyStats.targets.salt} prevActual={weeklyStats.previousActual.salt} prevRecordedDays={weeklyStats.previousCounts.salt} />
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
