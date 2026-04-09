'use client'

import { useState, useEffect, useMemo } from 'react'

interface ProgressTabProps {
    userId: string;
    token: string;
}

export default function ProgressTab({ userId, token }: ProgressTabProps) {
    const [lastWeekAvg, setLastWeekAvg] = useState<any>(null)
    const [thisWeekAvg, setThisWeekAvg] = useState<any>(null)
    const [goal, setGoal] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const now = new Date()

                // Last Week (Mon-Sun or 7-14 days ago)
                const lastWeekStart = new Date()
                lastWeekStart.setDate(now.getDate() - 14)
                const lastWeekEnd = new Date()
                lastWeekEnd.setDate(now.getDate() - 7)

                // This Week (Last 7 days)
                const thisWeekStart = new Date()
                thisWeekStart.setDate(now.getDate() - 7)

                const [lastRes, thisRes, goalRes] = await Promise.all([
                    fetch(`/api/diet/logs?startDate=${lastWeekStart.toISOString().split('T')[0]}&endDate=${lastWeekEnd.toISOString().split('T')[0]}&token=${token}`),
                    fetch(`/api/diet/logs?startDate=${thisWeekStart.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}&token=${token}`),
                    fetch(`/api/diet/goals?token=${token}`)
                ])

                const [lastData, thisData, goalData] = await Promise.all([
                    lastRes.json(),
                    thisRes.json(),
                    goalRes.json()
                ])

                setLastWeekAvg(calculateAverage(lastData.data || []))
                setThisWeekAvg(calculateAverage(thisData.data || []))
                setGoal(goalData.data?.[0] || null)
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [userId])

    const calculateAverage = (logs: any[]) => {
        if (logs.length === 0) return null
        const count = logs.length
        return {
            calories: Math.round(logs.reduce((acc, l) => acc + (l.calories || 0), 0) / count),
            protein: (logs.reduce((acc, l) => acc + (l.protein || 0), 0) / count).toFixed(1),
            fat: (logs.reduce((acc, l) => acc + (l.fat || 0), 0) / count).toFixed(1),
            carbs: (logs.reduce((acc, l) => acc + (l.carbs || 0), 0) / count).toFixed(1),
            fiber: (logs.reduce((acc, l) => acc + (l.fiber || 0), 0) / count).toFixed(1),
        }
    }

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

    return (
        <div className="space-y-6">
            {/* Last Week Average Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center space-x-2 mb-6">
                    <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">先週の平均実績</h2>
                </div>

                {!lastWeekAvg ? (
                    <p className="text-center text-gray-400 py-4 text-sm font-medium">データがありません</p>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 bg-gray-50 p-4 rounded-xl flex items-baseline justify-between">
                            <span className="text-sm font-bold text-gray-400">エネルギー</span>
                            <div>
                                <span className="text-3xl font-black text-gray-900">{lastWeekAvg.calories}</span>
                                <span className="text-sm font-bold text-gray-400 ml-1">kcal</span>
                            </div>
                        </div>

                        <AvgItem label="タンパク質" value={lastWeekAvg.protein} unit="g" />
                        <AvgItem label="脂質" value={lastWeekAvg.fat} unit="g" />
                        <AvgItem label="炭水化物" value={lastWeekAvg.carbs} unit="g" />
                        <AvgItem label="食物繊維" value={lastWeekAvg.fiber} unit="g" />
                    </div>
                )}
            </div>

            {/* Goal Achievement Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center space-x-2 mb-6">
                    <div className="w-1 h-4 bg-green-500 rounded-full"></div>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">今週の目標達成率</h2>
                </div>

                {!goal || !thisWeekAvg ? (
                    <p className="text-center text-gray-400 py-4 text-sm font-medium">目標またはデータが未設定です</p>
                ) : (
                    <div className="space-y-8">
                        <AchievementBar
                            label="カロリー"
                            current={thisWeekAvg.calories}
                            target={goal.calories}
                            unit="kcal"
                            color="bg-blue-600"
                        />
                        <AchievementBar
                            label="タンパク質"
                            current={parseFloat(thisWeekAvg.protein)}
                            target={goal.protein}
                            unit="g"
                            color="bg-orange-500"
                        />
                        <AchievementBar
                            label="脂質"
                            current={parseFloat(thisWeekAvg.fat)}
                            target={goal.fat}
                            unit="g"
                            color="bg-yellow-500"
                        />
                        <AchievementBar
                            label="炭水化物"
                            current={parseFloat(thisWeekAvg.carbs)}
                            target={goal.carbs}
                            unit="g"
                            color="bg-green-500"
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

function AvgItem({ label, value, unit }: { label: string, value: string, unit: string }) {
    return (
        <div className="p-3 border border-gray-50 rounded-xl">
            <div className="text-[10px] font-bold text-gray-400 mb-1">{label}</div>
            <div className="flex items-baseline">
                <span className="text-lg font-black text-gray-700">{value}</span>
                <span className="text-[10px] font-bold text-gray-400 ml-0.5">{unit}</span>
            </div>
        </div>
    )
}

function AchievementBar({ label, current, target, unit, color }: { label: string, current: number, target: number, unit: string, color: string }) {
    const percent = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <div>
                    <span className="text-sm font-black text-gray-800">{label}</span>
                    <span className="text-xs text-gray-400 ml-2">{current} / {target} {unit}</span>
                </div>
                <span className={`text-lg font-black ${percent >= 100 ? 'text-green-500' : 'text-blue-600'}`}>
                    {percent}%
                </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} transition-all duration-1000 ease-out`}
                    style={{ width: `${percent}%` }}
                ></div>
            </div>
        </div>
    )
}
