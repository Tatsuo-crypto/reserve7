'use client'

import { useState } from 'react'
import type { WeeklyProgressStats } from '@/hooks/useWeeklyProgress'
import WeightWeeklyCompare from './WeightWeeklyCompare'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'

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
                    {showLife && <WeightWeeklyCompare weight={weeklyStats.weight} />}

                    {showNutrition && (
                    <Card padding="sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                            <h3 className="text-sm font-semibold text-gray-800">食事・栄養</h3>
                        </div>

                        <div className="space-y-5">
                            <WeeklyProgressItem label="合計摂取カロリー" actual={weeklyStats.actual.calories} target={weeklyStats.targets.calories} unit="kcal" color="purple" perDay={weeklyStats.dietTargetPerDay.calories} recordedDays={weeklyStats.counts.calories} avg={weeklyStats.avgOnRecordedDays.calories} prevAvg={weeklyStats.previousAvgOnRecordedDays.calories} prevRecordedDays={weeklyStats.previousCounts.calories} />
                            <div className="grid gap-5">
                                <WeeklyProgressItem label="タンパク質 (P)" actual={weeklyStats.actual.protein} target={weeklyStats.targets.protein} unit="g" color="amber" perDay={weeklyStats.dietTargetPerDay.protein} recordedDays={weeklyStats.counts.protein} avg={weeklyStats.avgOnRecordedDays.protein} prevAvg={weeklyStats.previousAvgOnRecordedDays.protein} prevRecordedDays={weeklyStats.previousCounts.protein} />
                                <WeeklyProgressItem label="脂質 (F)" actual={weeklyStats.actual.fat} target={weeklyStats.targets.fat} unit="g" color="emerald" perDay={weeklyStats.dietTargetPerDay.fat} recordedDays={weeklyStats.counts.fat} avg={weeklyStats.avgOnRecordedDays.fat} prevAvg={weeklyStats.previousAvgOnRecordedDays.fat} prevRecordedDays={weeklyStats.previousCounts.fat} />
                                <WeeklyProgressItem label="炭水化物 (C)" actual={weeklyStats.actual.carbs} target={weeklyStats.targets.carbs} unit="g" color="blue" perDay={weeklyStats.dietTargetPerDay.carbs} recordedDays={weeklyStats.counts.carbs} avg={weeklyStats.avgOnRecordedDays.carbs} prevAvg={weeklyStats.previousAvgOnRecordedDays.carbs} prevRecordedDays={weeklyStats.previousCounts.carbs} />
                                <WeeklyProgressItem label="└ 糖質" actual={weeklyStats.actual.sugar} target={weeklyStats.targets.sugar} unit="g" color="sky" perDay={weeklyStats.dietTargetPerDay.sugar} recordedDays={weeklyStats.counts.sugar} avg={weeklyStats.avgOnRecordedDays.sugar} prevAvg={weeklyStats.previousAvgOnRecordedDays.sugar} prevRecordedDays={weeklyStats.previousCounts.sugar} />
                                <WeeklyProgressItem label="└ 食物繊維" actual={weeklyStats.actual.fiber} target={weeklyStats.targets.fiber} unit="g" color="teal" perDay={weeklyStats.dietTargetPerDay.fiber} recordedDays={weeklyStats.counts.fiber} avg={weeklyStats.avgOnRecordedDays.fiber} prevAvg={weeklyStats.previousAvgOnRecordedDays.fiber} prevRecordedDays={weeklyStats.previousCounts.fiber} />
                                <WeeklyProgressItem label="└ 塩分" actual={weeklyStats.actual.salt} target={weeklyStats.targets.salt} unit="g" color="gray" perDay={weeklyStats.dietTargetPerDay.salt} recordedDays={weeklyStats.counts.salt} avg={weeklyStats.avgOnRecordedDays.salt} prevAvg={weeklyStats.previousAvgOnRecordedDays.salt} prevRecordedDays={weeklyStats.previousCounts.salt} />
                            </div>
                        </div>
                    </Card>
                    )}

                    {showLife && (
                    <Card padding="sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-4 bg-brand-600 rounded-full"></div>
                            <h3 className="text-sm font-semibold text-gray-800">運動・生活</h3>
                        </div>

                        <div className="space-y-5">
                            <WeeklyProgressItem label="合計歩数" actual={weeklyStats.actual.steps} target={weeklyStats.targets.steps} unit="歩" color="emerald" perDay={weeklyStats.lifeTargetPerDay.steps} recordedDays={weeklyStats.counts.steps} avg={weeklyStats.avgOnRecordedDays.steps} prevAvg={weeklyStats.previousAvgOnRecordedDays.steps} prevRecordedDays={weeklyStats.previousCounts.steps} />
                            <WeeklyProgressItem label="水分摂取量" actual={weeklyStats.actual.water} target={weeklyStats.targets.water} unit="L" color="sky" perDay={weeklyStats.lifeTargetPerDay.water} recordedDays={weeklyStats.counts.water} avg={weeklyStats.avgOnRecordedDays.water} prevAvg={weeklyStats.previousAvgOnRecordedDays.water} prevRecordedDays={weeklyStats.previousCounts.water} />
                            <WeeklyProgressItem label="睡眠時間" actual={weeklyStats.actual.sleep} target={weeklyStats.targets.sleep} unit="h" color="violet" perDay={weeklyStats.lifeTargetPerDay.sleep} recordedDays={weeklyStats.counts.sleep} avg={weeklyStats.avgOnRecordedDays.sleep} prevAvg={weeklyStats.previousAvgOnRecordedDays.sleep} prevRecordedDays={weeklyStats.previousCounts.sleep} />
                            <WeeklyProgressItem label="筋トレ実施回数" actual={weeklyStats.actual.workout} target={weeklyStats.targets.workout} unit="回" color="orange" perDay={weeklyStats.lifeTargetPerDay.workout} isFrequency recordedDays={weeklyStats.counts.workout} avg={weeklyStats.avgOnRecordedDays.workout} prevAvg={weeklyStats.previousAvgOnRecordedDays.workout} prevRecordedDays={weeklyStats.previousCounts.workout} />
                        </div>
                    </Card>
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

function WeeklyProgressItem({
    label, actual, target, unit, color, perDay, isFrequency, recordedDays, avg, prevAvg, prevRecordedDays,
}: {
    label: string
    actual: number
    target: number
    unit: string
    color: string
    perDay: number
    isFrequency?: boolean
    recordedDays?: number
    /** 記録した日数だけで割った平均値（今週）。 */
    avg?: number
    /** 前週の「記録日数分の平均」。前週比の算出に使う。 */
    prevAvg?: number
    /** 前週の記録日数。0なら「前週データなし」として比較を出さない。 */
    prevRecordedDays?: number
}) {
    const pct = target > 0 ? Math.round((actual / target) * 100) : 0
    const filledDays = Math.min(7, recordedDays || 0)
    const hasPrevWeek = (prevRecordedDays || 0) > 0
    const avgDiff = hasPrevWeek && avg !== undefined && prevAvg !== undefined ? avg - prevAvg : null
    const roundVal = (v: number) => (isFrequency ? Math.round(v) : Math.round(v * 10) / 10)

    const colors: Record<string, string> = {
        purple: 'bg-purple-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500', blue: 'bg-blue-500',
        sky: 'bg-sky-500', teal: 'bg-teal-500', orange: 'bg-orange-500', violet: 'bg-violet-500', gray: 'bg-gray-500',
    }
    const textColors: Record<string, string> = {
        purple: 'text-purple-600', amber: 'text-amber-600', emerald: 'text-emerald-600', blue: 'text-blue-600',
        sky: 'text-sky-600', teal: 'text-teal-600', orange: 'text-orange-600', violet: 'text-violet-600', gray: 'text-gray-600',
    }

    return (
        <div className="space-y-1.5">
            {/* 1行目: ラベル + 達成率（既存ロジックのまま） */}
            <div className="flex justify-between items-center">
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest leading-none">{label}</p>
                <p className={`text-sm font-normal tabular-nums leading-none ${pct >= 100 ? 'text-emerald-500' : textColors[color]}`}>
                    {pct}%
                </p>
            </div>

            {/* 2行目: 記録日数分の平均 + 前週比（筋トレのみ「今週 X/Y回」表記） */}
            <div className="flex items-baseline gap-1.5">
                {isFrequency ? (
                    <span className="text-lg font-semibold text-gray-800 tabular-nums leading-none">今週 {actual}/{target}回</span>
                ) : (
                    <>
                        <span className="text-lg font-semibold text-gray-800 tabular-nums leading-none">{avg !== undefined ? roundVal(avg).toLocaleString() : '-'}</span>
                        <span className="text-[9px] font-normal text-gray-300">{unit}/日（記録日平均）</span>
                    </>
                )}
                {!isFrequency && (
                    avgDiff !== null ? (
                        <span className="text-[10px] font-normal text-gray-400 tabular-nums">
                            {avgDiff === 0 ? '±0' : avgDiff > 0 ? `↑+${roundVal(avgDiff).toLocaleString()}` : `↓${roundVal(avgDiff).toLocaleString()}`}
                            <span className="ml-0.5">前週比</span>
                        </span>
                    ) : (
                        <span className="text-[10px] font-normal text-gray-300">前週比 −</span>
                    )
                )}
            </div>

            {/* 3行目: 7ブロック（記録済み日数を左詰めで色付け）+ X/7日記録 */}
            <div className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-7 gap-1 h-2.5">
                    {Array.from({ length: 7 }).map((_, index) => (
                        <span key={index} className={`rounded-full ${index < filledDays ? colors[color] : 'bg-gray-100'}`} />
                    ))}
                </div>
                <span className="text-[9px] font-normal text-gray-400 tabular-nums whitespace-nowrap">{filledDays}/7日記録</span>
            </div>

            {/* 4行目: 累計/目標（小さくグレー）。筋トレは1〜3行目で完結するため非表示 */}
            {!isFrequency && (
                <div className="flex justify-between items-center text-[7px] font-normal text-gray-300 uppercase tracking-tighter leading-none">
                    <span>累計 {actual.toLocaleString()} / {target.toLocaleString()} {unit}</span>
                    <span>1日目安: {perDay}{unit}</span>
                </div>
            )}
        </div>
    )
}
