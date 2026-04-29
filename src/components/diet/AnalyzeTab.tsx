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
    Area,
    Legend,
    BarChart,
    LineChart
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
    const [settings, setSettings] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const [dietRes, lifeRes, goalRes, settingRes] = await Promise.all([
                    fetch(`/api/diet/logs?token=${token}`),
                    fetch(`/api/lifestyle/logs?token=${token}`),
                    fetch(`/api/diet/goals?token=${token}`),
                    fetch(`/api/lifestyle/settings?token=${token}`)
                ])

                const [dietData, lifeData, goalData, settingData] = await Promise.all([
                    dietRes.json(),
                    lifeRes.json(),
                    goalRes.json(),
                    settingRes.json()
                ])

                setDietLogs(dietData.data || [])
                setLifestyleLogs(lifeData.data || [])
                setGoals(goalData.data || [])
                setSettings(settingData.data || null)
            } catch (e) {
                console.error('Fetch error:', e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [token])

    const analysisData = useMemo(() => {
        if (!dietLogs.length && !lifestyleLogs.length) return []

        // 1. Get latest date across all data
        const allDates = [
            ...dietLogs.map(l => l.date),
            ...lifestyleLogs.map(l => l.date)
        ].sort()

        if (allDates.length === 0) return []
        const latestDataDate = new Date(allDates[allDates.length - 1])

        // 2. Determine range based on period
        const filterEnd = (period === '1w') ? new Date(latestDataDate) : new Date()
        const filterStart = new Date(filterEnd)

        if (period === '1w') filterStart.setDate(filterEnd.getDate() - 6)
        else if (period === '1m') filterStart.setMonth(filterEnd.getMonth() - 1)
        else if (period === '3m') filterStart.setMonth(filterEnd.getMonth() - 3)
        else if (period === '6m') filterStart.setMonth(filterEnd.getMonth() - 6)
        else if (period === '1y') filterStart.setFullYear(filterEnd.getFullYear() - 1)
        else if (period === 'all') {
            filterStart.setTime(new Date(allDates[0]).getTime())
        }

        const data: any[] = []
        const current = new Date(filterStart)
        const limit = new Date(filterEnd)

        while (current <= limit) {
            const dStr = current.toISOString().split('T')[0]
            const diet = dietLogs.find(l => l.date === dStr)
            const lifestyle = lifestyleLogs.find(l => l.date === dStr)
            const target = [...goals].reverse().find(t => t.start_date <= dStr) || goals[goals.length - 1]

            const item: any = {
                date: dStr,
                displayDate: `${parseInt(dStr.split('-')[1], 10)}/${parseInt(dStr.split('-')[2], 10)}`,
                weight: lifestyle?.weight || null,
                calories: diet?.calories || 0,
                protein_kcal: (diet?.protein || 0) * 4,
                fat_kcal: (diet?.fat || 0) * 9,
                carbs_kcal: (diet?.carbs || 0) * 4,
                target_calories: target?.calories || null,
                steps: lifestyle?.steps || 0,
                sleep: lifestyle?.sleep || 0,
                water: lifestyle?.water || 0,
            }

            // Habits
            if (settings?.quit_goals) {
                settings.quit_goals.forEach((goal: string) => {
                    // Check achievement from habits JSON if exists, or fallback to individual columns
                    const achievement = lifestyle?.habits?.[goal] ?? 
                                      (goal.includes('酒') ? (lifestyle?.alcohol > 0 ? 0 : 1) : null)
                    item[`habit_${goal}`] = achievement
                })
            }

            data.push(item)
            current.setDate(current.getDate() + 1)
        }

        if (!showAvg) return data

        return data.map((d: any, i, arr) => {
            const window = arr.slice(Math.max(0, i - 6), i + 1)
            const weights = window.map(w => w.weight).filter(w => w != null)
            const avgWeight = weights.length > 0 ? weights.reduce((acc, curr) => acc + curr, 0) / weights.length : null
            return {
                ...d,
                weight: avgWeight ? Number(avgWeight.toFixed(1)) : null
            }
        })
    }, [dietLogs, lifestyleLogs, goals, settings, period, showAvg])

    const stats = useMemo(() => {
        const weights = analysisData.map(d => d.weight).filter(w => w != null)
        if (weights.length < 2) return null
        const first = weights[0]
        const last = weights[weights.length - 1]
        const diff = last - first
        const rate = (diff / first) * 100
        return {
            diff: diff.toFixed(1),
            rate: rate.toFixed(1)
        }
    }, [analysisData])

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

    // Common styling for all charts to ensure perfect alignment
    const chartMargin = { top: 10, right: 10, left: -10, bottom: 0 }
    const commonXAxis = (
        <XAxis 
            dataKey="displayDate" 
            axisLine={{ stroke: '#000000', strokeWidth: 0.3 }} 
            tickLine={false} 
            tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} 
            interval="preserveStartEnd"
            minTickGap={20}
        />
    )
    // Fixed width YAxis ensures all charts have the same plotting area width
    const commonYAxis = <YAxis width={40} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#cbd5e1' }} />
    // Unified Tooltip cursor (Line) for all chart types
    const commonTooltip = <Tooltip cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', fontSize: '10px' }} />

    return (
        <div className="space-y-6 pb-24">
            {/* Controls */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-row items-center gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap">
                <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-700 shrink-0">
                    期間：
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as PeriodType)}
                        className="bg-gray-50 border border-gray-200 text-gray-900 text-xs sm:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block py-1.5 px-2 outline-none font-bold"
                    >
                        <option value="1w">7日間</option>
                        <option value="1m">1ヶ月</option>
                        <option value="3m">3ヶ月</option>
                        <option value="6m">6ヶ月</option>
                        <option value="1y">1年</option>
                        <option value="all">すべて</option>
                    </select>
                </label>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-700 shrink-0">
                    表示：
                    <select
                        value={showAvg ? 'week' : 'day'}
                        onChange={(e) => setShowAvg(e.target.value === 'week')}
                        className="bg-gray-50 border border-gray-200 text-gray-900 text-xs sm:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block py-1.5 px-2 outline-none font-bold"
                    >
                        <option value="day">日</option>
                        <option value="week">週平均</option>
                    </select>
                </label>
            </div>

            {/* 1. Weight Chart */}
            <AnalysisChartCard title="体重推移 (kg)" color="blue">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        {commonXAxis}
                        <YAxis width={40} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 9, fontWeight: 700, fill: '#cbd5e1' }} />
                        {commonTooltip}
                        <Line type="monotone" dataKey="weight" name="体重" stroke="#3b82f6" strokeWidth={4} dot={!showAvg ? { r: 4, strokeWidth: 2, fill: '#fff' } : false} connectNulls />
                    </LineChart>
                </ResponsiveContainer>
            </AnalysisChartCard>

            {/* 2. Calories Chart */}
            <AnalysisChartCard title="摂取カロリー (kcal)" color="rose">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        {commonXAxis}
                        {commonYAxis}
                        {commonTooltip}
                        <Bar dataKey="calories" name="摂取カロリー" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="target_calories" name="目標" stroke="#e2e8f0" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </AnalysisChartCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* 3. Protein Chart */}
                <AnalysisChartCard title="P (タンパク質) (g)" color="amber">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            {commonXAxis}
                            {commonYAxis}
                            {commonTooltip}
                            <Bar dataKey="protein" name="タンパク質(g)" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="target_protein" name="目標(g)" stroke="#e2e8f0" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>

                {/* 4. Fat Chart */}
                <AnalysisChartCard title="F (脂質) (g)" color="emerald">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            {commonXAxis}
                            {commonYAxis}
                            {commonTooltip}
                            <Bar dataKey="fat" name="脂質(g)" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="target_fat" name="目標(g)" stroke="#e2e8f0" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>

                {/* 5. Carbs Chart */}
                <AnalysisChartCard title="C (炭水化物) (g)" color="blue">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            {commonXAxis}
                            {commonYAxis}
                            {commonTooltip}
                            <Bar dataKey="carbs" name="炭水化物(g)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="target_carbs" name="目標(g)" stroke="#e2e8f0" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>

                {/* 6. Fiber Chart */}
                <AnalysisChartCard title="食物繊維 (g)" color="teal">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            {commonXAxis}
                            {commonYAxis}
                            {commonTooltip}
                            <Bar dataKey="fiber" name="食物繊維(g)" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="target_fiber" name="目標(g)" stroke="#e2e8f0" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>
            </div>

            {/* 7. Steps Chart */}
            <AnalysisChartCard title="歩数 (歩)" color="emerald">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        {commonXAxis}
                        {commonYAxis}
                        {commonTooltip}
                        <Bar dataKey="steps" name="歩数" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </ComposedChart>
                </ResponsiveContainer>
            </AnalysisChartCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* 8. Sleep Chart */}
                <AnalysisChartCard title="睡眠時間 (時間)" color="indigo">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            {commonXAxis}
                            {commonYAxis}
                            {commonTooltip}
                            <Bar dataKey="sleep" name="睡眠時間" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>

                {/* 5. Water Chart */}
                <AnalysisChartCard title="水分摂取量 (L)" color="sky">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            {commonXAxis}
                            {commonYAxis}
                            {commonTooltip}
                            <Bar dataKey="water" name="水分(L)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>
            </div>

            {/* Custom Habits Charts */}
            {settings?.quit_goals?.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1 pt-4">
                        <div className="w-1.5 h-5 bg-rose-500 rounded-full"></div>
                        <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">習慣の達成状況</h2>
                    </div>
                    {settings.quit_goals.map((goal: string) => (
                        <AnalysisChartCard key={goal} title={`習慣: ${goal}`} color="rose">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    {commonXAxis}
                                    {commonYAxis}
                                    <Tooltip 
                                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                                        formatter={(value: any) => [value === 1 ? '○ 達成' : value === 0 ? '× 未達成' : '-', '状況']}
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', fontSize: '10px' }} 
                                    />
                                    <Bar dataKey={`habit_${goal}`} radius={[2, 2, 0, 0]}>
                                        {analysisData.map((entry, index) => (
                                            <rect 
                                                key={`cell-${index}`} 
                                                fill={entry[`habit_${goal}`] === 1 ? '#10b981' : entry[`habit_${goal}`] === 0 ? '#f43f5e' : 'transparent'} 
                                            />
                                        ))}
                                    </Bar>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </AnalysisChartCard>
                    ))}
                </div>
            )}

            {/* Summary Stats */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 text-center">期間内の変化</div>
                {stats ? (
                    <div className="flex gap-4">
                        <div className="flex-1 bg-blue-50/30 rounded-2xl p-4 border border-blue-100 text-center transition-all hover:bg-blue-50/50">
                            <div className="text-[10px] font-black text-blue-400 uppercase mb-1">体重増減</div>
                            <div className="flex items-baseline justify-center gap-1">
                                <span className={`text-2xl font-black ${Number(stats.diff) <= 0 ? 'text-blue-600' : 'text-rose-500'}`}>
                                    {Number(stats.diff) > 0 ? '+' : ''}{stats.diff}
                                </span>
                                <span className="text-[10px] font-bold text-blue-400">kg</span>
                            </div>
                        </div>
                        <div className="flex-1 bg-emerald-50/30 rounded-2xl p-4 border border-emerald-100 text-center transition-all hover:bg-emerald-50/50">
                            <div className="text-[10px] font-black text-emerald-400 uppercase mb-1">減少率</div>
                            <div className="flex items-baseline justify-center gap-1">
                                <span className={`text-2xl font-black ${Number(stats.rate) <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {Number(stats.rate) > 0 ? '+' : ''}{stats.rate}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-400">%</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 text-xs font-bold text-gray-300 italic">分析には2日以上の記録が必要です</div>
                )}
            </div>
        </div>
    )
}

function AnalysisChartCard({ title, children, color }: { title: string, children: React.ReactNode, color: string }) {
    const colorStyles: Record<string, string> = {
        blue: 'bg-blue-50/30 border-blue-100',
        rose: 'bg-rose-50/30 border-rose-100',
        emerald: 'bg-emerald-50/30 border-emerald-100',
        indigo: 'bg-indigo-50/30 border-indigo-100',
        sky: 'bg-sky-50/30 border-sky-100',
    }
    return (
        <div className={`p-6 rounded-2xl border ${colorStyles[color]} shadow-sm space-y-4`}>
            <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">{title}</h3>
            <div className="h-[250px] w-full">{children}</div>
        </div>
    )
}
