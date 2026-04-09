'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Area
} from 'recharts'

interface AnalyzeTabProps {
    userId: string;
    token: string;
    isAdmin: boolean;
}

type PeriodType = '1w' | '1m' | '3m' | '6m' | '1y' | 'all'

export default function AnalyzeTab({ userId, token, isAdmin }: AnalyzeTabProps) {
    const [period, setPeriod] = useState<PeriodType>('1m')
    const [showAvg, setShowAvg] = useState(false)
    const [dietLogs, setDietLogs] = useState<any[]>([])
    const [lifestyleLogs, setLifestyleLogs] = useState<any[]>([])
    const [goals, setGoals] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                // Calculate date range based on period
                const end = new Date()
                let start = new Date()
                if (period === '1w') start.setDate(end.getDate() - 7)
                else if (period === '1m') start.setMonth(end.getMonth() - 1)
                else if (period === '3m') start.setMonth(end.getMonth() - 3)
                else if (period === '6m') start.setMonth(end.getMonth() - 6)
                else if (period === '1y') start.setFullYear(end.getFullYear() - 1)
                else start = new Date(2020, 0, 1) // All time

                const startStr = start.toISOString().split('T')[0]
                const endStr = end.toISOString().split('T')[0]

                const [dietRes, lifeRes, goalRes] = await Promise.all([
                    fetch(`/api/diet/logs?startDate=${startStr}&endDate=${endStr}&token=${token}`),
                    fetch(`/api/lifestyle/logs?startDate=${startStr}&endDate=${endStr}&token=${token}`),
                    fetch(`/api/diet/goals?token=${token}`)
                ])

                const [dietData, lifeData, goalData] = await Promise.all([
                    dietRes.json(),
                    lifeRes.json(),
                    goalRes.json()
                ])

                setDietLogs(dietData.data || [])
                setLifestyleLogs(lifeData.data || [])
                setGoals(goalData.data || [])
            } catch (e) {
                console.error('Fetch error:', e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [userId, period])

    const chartData = useMemo(() => {
        const dateMap: { [key: string]: any } = {}

        const now = new Date()
        let start = new Date()

        if (period === '1w') start.setDate(now.getDate() - 6)
        else if (period === '1m') start.setDate(now.getDate() - 30)
        else if (period === '3m') start.setDate(now.getDate() - 90)
        else if (period === '6m') start.setMonth(now.getMonth() - 6)
        else if (period === '1y') start.setFullYear(now.getFullYear() - 1)
        else {
            const allLogs = [...dietLogs, ...lifestyleLogs]
            if (allLogs.length > 0) {
                const dates = allLogs.map(l => l.date).sort()
                start = new Date(dates[0])
            } else {
                start.setDate(now.getDate() - 30)
            }
        }

        // Align start to YYYY-MM-DD
        start.setHours(0, 0, 0, 0)
        const current = new Date(start)
        while (current <= now) {
            const dStr = current.toISOString().split('T')[0]
            dateMap[dStr] = {
                date: dStr,
                displayDate: dStr.substring(5).replace('-', '/'),
                weight: null,
                calories: null
            }
            current.setDate(current.getDate() + 1)
        }

        dietLogs.forEach(log => {
            if (dateMap[log.date]) dateMap[log.date].calories = log.calories
        })
        lifestyleLogs.forEach(log => {
            if (dateMap[log.date]) dateMap[log.date].weight = log.weight
        })

        const sortedData = Object.values(dateMap).sort((a: any, b: any) => a.date.localeCompare(b.date))

        if (!showAvg) return sortedData

        return sortedData.map((d: any, i, arr) => {
            const window = arr.slice(Math.max(0, i - 6), i + 1)
            const weights = window.map(w => w.weight).filter(w => w != null)
            const calories = window.map(w => w.calories).filter(c => c != null)

            const avgWeight = weights.length > 0 ? weights.reduce((acc, curr) => acc + curr, 0) / weights.length : null
            const avgCal = calories.length > 0 ? calories.reduce((acc, curr) => acc + curr, 0) / calories.length : null

            return {
                ...d,
                weight: avgWeight ?? d.weight,
                calories: avgCal ?? d.calories
            }
        })
    }, [dietLogs, lifestyleLogs, showAvg, period])

    const stats = useMemo(() => {
        const weights = chartData.map(d => d.weight).filter(w => w != null)
        if (weights.length < 2) return null

        const firstWeight = weights[0]
        const lastWeight = weights[weights.length - 1]
        const diff = lastWeight - firstWeight
        const rate = (diff / firstWeight) * 100

        return {
            diff: diff.toFixed(1),
            rate: rate.toFixed(1)
        }
    }, [chartData])

    const currentGoal = goals[0]

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

    const chartMargin = { top: 10, right: 20, left: -20, bottom: 0 }

    return (
        <div className="space-y-6 pb-24">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-6 px-1">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as PeriodType)}
                        className="bg-gray-100 border-none rounded-xl text-sm font-black text-gray-700 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 appearance-none"
                    >
                        <option value="1w">1週間</option>
                        <option value="1m">1ヶ月</option>
                        <option value="3m">3ヶ月</option>
                        <option value="6m">6ヶ月</option>
                        <option value="1y">1年</option>
                        <option value="all">全期間</option>
                    </select>

                    <div className="flex bg-gray-100 rounded-xl p-1">
                        <button
                            onClick={() => setShowAvg(false)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${!showAvg ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                        >
                            日次
                        </button>
                        <button
                            onClick={() => setShowAvg(true)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${showAvg ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                        >
                            週平均
                        </button>
                    </div>
                </div>

                {/* Weight Chart */}
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">体重推移</h3>
                        <div className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md">kg</div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} syncId="analyzeSync" margin={chartMargin}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                                <XAxis
                                    dataKey="displayDate"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: '#aaa', fontWeight: 600 }}
                                    interval="preserveStartEnd"
                                    padding={{ left: 15, right: 15 }}
                                />
                                <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                    labelStyle={{ fontWeight: 'black', color: '#1a1a1a', marginBottom: '4px' }}
                                    itemStyle={{ fontWeight: 'bold' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="weight"
                                    stroke="#3b82f6"
                                    fill="url(#colorWeight)"
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 5, strokeWidth: 0 }}
                                    connectNulls
                                />
                                <defs>
                                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Calories Chart */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">摂取カロリー</h3>
                        <div className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">kcal</div>
                    </div>
                    <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} syncId="analyzeSync" margin={chartMargin}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                                <XAxis
                                    dataKey="displayDate"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: '#aaa', fontWeight: 600 }}
                                    interval="preserveStartEnd"
                                    padding={{ left: 15, right: 15 }}
                                />
                                <YAxis hide />
                                <Tooltip
                                    cursor={{ fill: '#f9fafb' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                    labelStyle={{ fontWeight: 'black', color: '#1a1a1a', marginBottom: '4px' }}
                                    itemStyle={{ fontWeight: 'bold' }}
                                />
                                <Bar dataKey="calories" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={period === 'all' ? undefined : 15} />
                                {currentGoal && (
                                    <ReferenceLine
                                        y={currentGoal.calories}
                                        stroke="#f43f5e"
                                        strokeDasharray="4 4"
                                        label={{ position: 'right', value: '目標', fill: '#f43f5e', fontSize: 9, fontWeight: 'bold' }}
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Reduction Stats - Admin Only */}
                {isAdmin && (
                    <div className="mx-2 px-4 py-6 border-t border-gray-50">
                        {stats ? (
                            <div className="flex gap-4">
                                <div className="flex-1 bg-blue-50/50 rounded-2xl p-4 border border-blue-100">
                                    <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 text-center">期間内の変化</div>
                                    <div className="flex items-baseline justify-center gap-1">
                                        <span className={`text-2xl font-black ${Number(stats.diff) <= 0 ? 'text-blue-600' : 'text-rose-500'}`}>
                                            {Number(stats.diff) > 0 ? '+' : ''}{stats.diff}
                                        </span>
                                        <span className="text-[10px] font-bold text-blue-400">kg</span>
                                    </div>
                                </div>
                                <div className="flex-1 bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100">
                                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 text-center">体重減少率</div>
                                    <div className="flex items-baseline justify-center gap-1">
                                        <span className={`text-2xl font-black ${Number(stats.rate) <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            {Number(stats.rate) > 0 ? '+' : ''}{stats.rate}
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-400">%</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 text-xs font-bold text-gray-300 italic">
                                分析には2日間以上の記録が必要です
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
