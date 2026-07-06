'use client'

import { useState } from 'react'
import type { WeeklyProgressStats } from '@/hooks/useWeeklyProgress'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'
import { RecordCheckTable, CalorieHeroCard, AchievementItemCard } from './WeeklyAchievementCards'

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
}

export default function WeeklyProgressPanel({
    weeklyStats,
    weekOffset,
    setWeekOffset,
    showWeekSwitcher = true,
    collapsible = false,
    defaultOpen = false,
    sections = 'all',
}: WeeklyProgressPanelProps) {
    const [open, setOpen] = useState(defaultOpen)
    const showNutrition = sections === 'all' || sections === 'nutrition'
    const showLife = sections === 'all' || sections === 'life'

    const body = (
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
                    {showNutrition && (
                        <>
                            {/* O-5: 記録チェック表。7日分の食事記録の有無を一目で見せる */}
                            <RecordCheckTable weekDays={weeklyStats.weekDays} />

                            {/* O-5: カロリー主役行。週合計/目標を数値ファーストで見せる */}
                            <CalorieHeroCard
                                actual={weeklyStats.actual.calories}
                                target={weeklyStats.targets.calories}
                            />

                            {/* オーナー確認後の修正: 食事・栄養ドメインはカロリーと同じ「週合計/週目標」表記に統一 */}
                            <div className="grid grid-cols-2 gap-3">
                                <AchievementItemCard label="タンパク質 (P)" unit="g" mode="total" actual={weeklyStats.actual.protein} target={weeklyStats.targets.protein} prevActual={weeklyStats.previousActual.protein} prevRecordedDays={weeklyStats.previousCounts.protein} />
                                <AchievementItemCard label="脂質 (F)" unit="g" mode="total" actual={weeklyStats.actual.fat} target={weeklyStats.targets.fat} prevActual={weeklyStats.previousActual.fat} prevRecordedDays={weeklyStats.previousCounts.fat} />
                                <AchievementItemCard label="炭水化物 (C)" unit="g" mode="total" actual={weeklyStats.actual.carbs} target={weeklyStats.targets.carbs} prevActual={weeklyStats.previousActual.carbs} prevRecordedDays={weeklyStats.previousCounts.carbs} />
                                <AchievementItemCard label="糖質" unit="g" mode="total" actual={weeklyStats.actual.sugar} target={weeklyStats.targets.sugar} prevActual={weeklyStats.previousActual.sugar} prevRecordedDays={weeklyStats.previousCounts.sugar} />
                                <AchievementItemCard label="食物繊維" unit="g" mode="total" actual={weeklyStats.actual.fiber} target={weeklyStats.targets.fiber} prevActual={weeklyStats.previousActual.fiber} prevRecordedDays={weeklyStats.previousCounts.fiber} />
                                <AchievementItemCard label="塩分" unit="g" mode="total" actual={weeklyStats.actual.salt} target={weeklyStats.targets.salt} prevActual={weeklyStats.previousActual.salt} prevRecordedDays={weeklyStats.previousCounts.salt} />
                            </div>
                        </>
                    )}

                    {showLife && (
                        <div className="grid grid-cols-2 gap-3">
                            <AchievementItemCard label="合計歩数" unit="歩" target={weeklyStats.lifeTargetPerDay.steps} avg={weeklyStats.avgOnRecordedDays.steps} prevAvg={weeklyStats.previousAvgOnRecordedDays.steps} prevRecordedDays={weeklyStats.previousCounts.steps} />
                            <AchievementItemCard label="水分摂取量" unit="L" target={weeklyStats.lifeTargetPerDay.water} avg={weeklyStats.avgOnRecordedDays.water} prevAvg={weeklyStats.previousAvgOnRecordedDays.water} prevRecordedDays={weeklyStats.previousCounts.water} />
                            <AchievementItemCard label="睡眠時間" unit="h" target={weeklyStats.lifeTargetPerDay.sleep} avg={weeklyStats.avgOnRecordedDays.sleep} prevAvg={weeklyStats.previousAvgOnRecordedDays.sleep} prevRecordedDays={weeklyStats.previousCounts.sleep} />
                            <AchievementItemCard label="筋トレ実施回数" unit="回" isFrequency actual={weeklyStats.actual.workout} target={weeklyStats.targets.workout} />
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
                className="flex items-center justify-between w-full px-6 py-4 bg-gray-50 rounded-2xl border border-transparent hover:border-gray-200 transition-all"
            >
                <span className="text-sm font-normal text-gray-700">週間目標{weeklyStats ? `（${weeklyStats.weekRangeStr}）` : ''}</span>
                <Icon name="chevronDown" size={20} className={`text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="animate-fadeIn">{body}</div>}
        </div>
    )
}
