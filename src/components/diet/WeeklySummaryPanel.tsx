'use client'

import { useState } from 'react'
import type { WeeklyProgressStats } from '@/hooks/useWeeklyProgress'
import WeightWeeklyCompare from './WeightWeeklyCompare'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/icons'

interface WeeklySummaryPanelProps {
    weeklyStats: WeeklyProgressStats | null
    weekOffset: number
    setWeekOffset: (updater: (prev: number) => number) => void
    showWeekSwitcher?: boolean
}

/**
 * 体重・食事・生活を1ページにまとめた「週間まとめ」専用パネル。
 * 既存の WeeklyProgressPanel（週間タブ／サマリータブの標準ビュー）とは別物として新設。
 * 「週の合計」「週の平均」をボタンで切り替えられ、合計モードでは
 * 「経過日数なりの目安位置（ペースライン）」を薄い線でバーに重ねて表示する。
 */
export default function WeeklySummaryPanel({
    weeklyStats,
    weekOffset,
    setWeekOffset,
    showWeekSwitcher = true,
}: WeeklySummaryPanelProps) {
    const [mode, setMode] = useState<'total' | 'average'>('total')

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

            <div className="px-2 flex justify-center">
                <div className="inline-flex bg-gray-100 rounded-full p-1">
                    <button
                        onClick={() => setMode('total')}
                        className={`px-4 py-1.5 rounded-full text-xs font-normal transition-all ${mode === 'total' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                    >
                        週の合計
                    </button>
                    <button
                        onClick={() => setMode('average')}
                        className={`px-4 py-1.5 rounded-full text-xs font-normal transition-all ${mode === 'average' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                    >
                        週の平均
                    </button>
                </div>
            </div>

            {!weeklyStats ? (
                <Card padding="lg" className="text-center">
                    <p className="text-gray-400 font-normal italic">今週の記録または目標がありません</p>
                </Card>
            ) : (
                <div className="space-y-4">
                    <WeightWeeklyCompare weight={weeklyStats.weight} />

                    <Card padding="sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                            <h3 className="text-sm font-semibold text-gray-800">食事・栄養</h3>
                        </div>

                        <div className="space-y-5">
                            <WeeklySummaryItem mode={mode} label="合計摂取カロリー" actual={weeklyStats.actual.calories} target={weeklyStats.targets.calories} unit="kcal" color="purple" perDay={weeklyStats.dietTargetPerDay.calories} recordedDays={weeklyStats.counts.calories} avg={weeklyStats.avgOnRecordedDays.calories} prevAvg={weeklyStats.previousAvgOnRecordedDays.calories} prevRecordedDays={weeklyStats.previousCounts.calories} />
                            <div className="grid gap-5">
                                <WeeklySummaryItem mode={mode} label="タンパク質 (P)" actual={weeklyStats.actual.protein} target={weeklyStats.targets.protein} unit="g" color="amber" perDay={weeklyStats.dietTargetPerDay.protein} recordedDays={weeklyStats.counts.protein} avg={weeklyStats.avgOnRecordedDays.protein} prevAvg={weeklyStats.previousAvgOnRecordedDays.protein} prevRecordedDays={weeklyStats.previousCounts.protein} />
                                <WeeklySummaryItem mode={mode} label="脂質 (F)" actual={weeklyStats.actual.fat} target={weeklyStats.targets.fat} unit="g" color="emerald" perDay={weeklyStats.dietTargetPerDay.fat} recordedDays={weeklyStats.counts.fat} avg={weeklyStats.avgOnRecordedDays.fat} prevAvg={weeklyStats.previousAvgOnRecordedDays.fat} prevRecordedDays={weeklyStats.previousCounts.fat} />
                                <WeeklySummaryItem mode={mode} label="炭水化物 (C)" actual={weeklyStats.actual.carbs} target={weeklyStats.targets.carbs} unit="g" color="blue" perDay={weeklyStats.dietTargetPerDay.carbs} recordedDays={weeklyStats.counts.carbs} avg={weeklyStats.avgOnRecordedDays.carbs} prevAvg={weeklyStats.previousAvgOnRecordedDays.carbs} prevRecordedDays={weeklyStats.previousCounts.carbs} />
                                <WeeklySummaryItem mode={mode} label="└ 糖質" actual={weeklyStats.actual.sugar} target={weeklyStats.targets.sugar} unit="g" color="sky" perDay={weeklyStats.dietTargetPerDay.sugar} recordedDays={weeklyStats.counts.sugar} avg={weeklyStats.avgOnRecordedDays.sugar} prevAvg={weeklyStats.previousAvgOnRecordedDays.sugar} prevRecordedDays={weeklyStats.previousCounts.sugar} />
                                <WeeklySummaryItem mode={mode} label="└ 食物繊維" actual={weeklyStats.actual.fiber} target={weeklyStats.targets.fiber} unit="g" color="teal" perDay={weeklyStats.dietTargetPerDay.fiber} recordedDays={weeklyStats.counts.fiber} avg={weeklyStats.avgOnRecordedDays.fiber} prevAvg={weeklyStats.previousAvgOnRecordedDays.fiber} prevRecordedDays={weeklyStats.previousCounts.fiber} />
                                <WeeklySummaryItem mode={mode} label="└ 塩分" actual={weeklyStats.actual.salt} target={weeklyStats.targets.salt} unit="g" color="gray" perDay={weeklyStats.dietTargetPerDay.salt} recordedDays={weeklyStats.counts.salt} avg={weeklyStats.avgOnRecordedDays.salt} prevAvg={weeklyStats.previousAvgOnRecordedDays.salt} prevRecordedDays={weeklyStats.previousCounts.salt} />
                            </div>
                        </div>
                    </Card>

                    <Card padding="sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-4 bg-brand-600 rounded-full"></div>
                            <h3 className="text-sm font-semibold text-gray-800">運動・生活</h3>
                        </div>

                        <div className="space-y-5">
                            <WeeklySummaryItem mode={mode} label="合計歩数" actual={weeklyStats.actual.steps} target={weeklyStats.targets.steps} unit="歩" color="emerald" perDay={weeklyStats.lifeTargetPerDay.steps} recordedDays={weeklyStats.counts.steps} avg={weeklyStats.avgOnRecordedDays.steps} prevAvg={weeklyStats.previousAvgOnRecordedDays.steps} prevRecordedDays={weeklyStats.previousCounts.steps} />
                            <WeeklySummaryItem mode={mode} label="水分摂取量" actual={weeklyStats.actual.water} target={weeklyStats.targets.water} unit="L" color="sky" perDay={weeklyStats.lifeTargetPerDay.water} recordedDays={weeklyStats.counts.water} avg={weeklyStats.avgOnRecordedDays.water} prevAvg={weeklyStats.previousAvgOnRecordedDays.water} prevRecordedDays={weeklyStats.previousCounts.water} />
                            <WeeklySummaryItem mode={mode} label="睡眠時間" actual={weeklyStats.actual.sleep} target={weeklyStats.targets.sleep} unit="h" color="violet" perDay={weeklyStats.lifeTargetPerDay.sleep} recordedDays={weeklyStats.counts.sleep} avg={weeklyStats.avgOnRecordedDays.sleep} prevAvg={weeklyStats.previousAvgOnRecordedDays.sleep} prevRecordedDays={weeklyStats.previousCounts.sleep} />
                            <WeeklySummaryItem mode={mode} label="筋トレ実施回数" actual={weeklyStats.actual.workout} target={weeklyStats.targets.workout} unit="回" color="orange" perDay={weeklyStats.lifeTargetPerDay.workout} isFrequency recordedDays={weeklyStats.counts.workout} avg={weeklyStats.avgOnRecordedDays.workout} prevAvg={weeklyStats.previousAvgOnRecordedDays.workout} prevRecordedDays={weeklyStats.previousCounts.workout} />
                        </div>
                    </Card>
                </div>
            )}
        </div>
    )
}

function WeeklySummaryItem({
    label, actual, target, unit, color, perDay, isFrequency, recordedDays, avg, prevAvg, prevRecordedDays, mode,
}: {
    label: string
    actual: number
    target: number
    unit: string
    color: string
    perDay: number
    isFrequency?: boolean
    recordedDays?: number
    avg?: number
    prevAvg?: number
    prevRecordedDays?: number
    mode: 'total' | 'average'
}) {
    const pct = target > 0 ? Math.round((actual / target) * 100) : 0
    const barPct = Math.min(100, pct)
    // 筋トレ等の頻度型は「週の目標回数」＝ブロック数（例: 週3回目標なら3分割）。
    // それ以外は曜日の目安として7分割のまま。
    const blockCount = isFrequency ? Math.max(1, Math.round(target)) : 7
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

    if (mode === 'average' && !isFrequency) {
        const avgPct = perDay > 0 && avg !== undefined ? Math.min(100, Math.round((avg / perDay) * 100)) : 0
        return (
            <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                    <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest leading-none">{label}</p>
                    <p className={`text-sm font-normal tabular-nums leading-none ${avgPct >= 100 ? 'text-emerald-500' : textColors[color]}`}>{avgPct}%</p>
                </div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-semibold text-gray-800 tabular-nums leading-none">{avg !== undefined ? roundVal(avg).toLocaleString() : '-'}</span>
                    <span className="text-[9px] font-normal text-gray-300">{unit}/日（目安 {perDay}{unit}/日）</span>
                    {avgDiff !== null ? (
                        <span className="text-[10px] font-normal text-gray-400 tabular-nums">
                            {avgDiff === 0 ? '±0' : avgDiff > 0 ? `↑+${roundVal(avgDiff).toLocaleString()}` : `↓${roundVal(avgDiff).toLocaleString()}`}
                            <span className="ml-0.5">前週比</span>
                        </span>
                    ) : (
                        <span className="text-[10px] font-normal text-gray-300">前週比 −</span>
                    )}
                </div>
                <div className="relative h-2.5 rounded-full overflow-hidden bg-gray-50 border border-gray-100">
                    <div className={`h-full rounded-full ${colors[color]}`} style={{ width: `${avgPct}%` }} />
                </div>
            </div>
        )
    }

    // total mode（筋トレ等の頻度型は常にこちらの表示のまま。平均の概念がなじまないため）
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center">
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest leading-none">{label}</p>
                <p className={`text-sm font-normal tabular-nums leading-none ${pct >= 100 ? 'text-emerald-500' : textColors[color]}`}>{pct}%</p>
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold text-gray-800 tabular-nums leading-none">{isFrequency ? actual : actual.toLocaleString()}</span>
                <span className="text-[9px] font-normal text-gray-300">/ {target.toLocaleString()} {unit}</span>
            </div>
            <div
                className={isFrequency ? 'flex gap-1 h-3' : 'grid grid-cols-7 gap-1 h-3'}
            >
                {Array.from({ length: blockCount }).map((_, i) => {
                    // ブロックの区切りとは無関係に、週合計に対する割合をそのまま連続的に塗る。
                    // ブロックiが担当する範囲 [i/blockCount, (i+1)/blockCount] のうち、barPctがどこまで埋めるかを計算。
                    const blockStart = (i / blockCount) * 100
                    const blockEnd = ((i + 1) / blockCount) * 100
                    let fillFraction = 0
                    if (barPct >= blockEnd) fillFraction = 100
                    else if (barPct > blockStart) fillFraction = ((barPct - blockStart) / (blockEnd - blockStart)) * 100
                    // 頻度型（筋トレ等）はブロック数が7未満でも、1ブロックのサイズは7分割時と同じ幅のまま
                    // 固定する（3回目標なら3ブロックぶんの幅だけ埋まる、7分割全体は伸ばさない）。
                    const style = isFrequency ? { width: `${100 / 7}%`, flex: '0 0 auto' } : undefined
                    return (
                        <div key={i} className="relative rounded-full overflow-hidden bg-gray-50 border border-gray-100" style={style}>
                            <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ${colors[color]}`} style={{ width: `${fillFraction}%` }} />
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-between items-center text-[7px] font-normal text-gray-300 uppercase tracking-tighter leading-none">
                <span>累計 {actual.toLocaleString()} {unit}</span>
                <span>週目標: {target.toLocaleString()}{unit}</span>
            </div>
        </div>
    )
}
