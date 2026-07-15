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
import { useWeeklyProgress } from '@/hooks/useWeeklyProgress'
import WeeklyProgressPanel from './WeeklyProgressPanel'
import Icon from '@/components/ui/icons'

interface AnalyzeTabProps {
    userId: string
    token: string
    isAdmin?: boolean
    todayDraft?: any
    /** 週間目標(WeeklyProgressPanel)セクションを表示するか。管理者側「サマリー」タブに常設表示がある場合はfalseにして重複を避ける。 */
    showWeeklyGoals?: boolean
}

type PeriodType = '1w' | '1m' | '3m' | '6m' | '1y' | 'all'

export default function AnalyzeTab({ userId, token, isAdmin, todayDraft, showWeeklyGoals = true }: AnalyzeTabProps) {
    const [period, setPeriod] = useState<PeriodType>('1m')
    const [showAvg, setShowAvg] = useState(false)
    const [dietLogs, setDietLogs] = useState<any[]>([])
    const [lifestyleLogs, setLifestyleLogs] = useState<any[]>([])
    const [goals, setGoals] = useState<any[]>([])
    const [settings, setSettings] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const [fetchError, setFetchError] = useState<string | null>(null)

    const formatDate = (d: Date) => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const selectedDate = todayDraft?.selectedDate || formatDate(new Date())

    const { weeklyStats, weekOffset, setWeekOffset } = useWeeklyProgress(token, {
        userId,
        isAdmin,
        todayDraft,
        enabled: showWeeklyGoals,
    })

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            setFetchError(null)
            try {
                const params = isAdmin
                    ? `userId=${encodeURIComponent(userId)}`
                    : `token=${encodeURIComponent(token || '')}`
                const rangeEnd = new Date()
                rangeEnd.setHours(23, 59, 59, 999)
                const rangeStart = new Date()
                rangeStart.setHours(0, 0, 0, 0)

                if (period === '1w') rangeStart.setDate(rangeEnd.getDate() - 6)
                else if (period === '1m') rangeStart.setMonth(rangeEnd.getMonth() - 1)
                else if (period === '3m') rangeStart.setMonth(rangeEnd.getMonth() - 3)
                else if (period === '6m') rangeStart.setMonth(rangeEnd.getMonth() - 6)
                else if (period === '1y') rangeStart.setFullYear(rangeEnd.getFullYear() - 1)

                const logParams = new URLSearchParams(params)
                if (period !== 'all') {
                    logParams.set('startDate', formatDate(rangeStart))
                    logParams.set('endDate', formatDate(rangeEnd))
                }

                const [dietRes, lifeRes, goalRes, settingRes] = await Promise.all([
                    fetch(`/api/diet/logs?${logParams.toString()}`),
                    fetch(`/api/lifestyle/logs?${logParams.toString()}`),
                    fetch(`/api/diet/goals?${params}`),
                    fetch(`/api/lifestyle/settings?${params}`)
                ])

                const failed = [dietRes, lifeRes, goalRes, settingRes].find(res => !res.ok)
                if (failed) {
                    throw new Error(`記録の取得に失敗しました (${failed.status})`)
                }

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
                console.error('Fetch error in AnalyzeTab:', e)
                setFetchError(e instanceof Error ? e.message : '記録の取得に失敗しました')
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [userId, token, isAdmin, period])

    const analysisData = useMemo(() => {
        const end = new Date()
        end.setHours(23, 59, 59, 999)
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        
        if (period === '1w') start.setDate(end.getDate() - 6)
        else if (period === '1m') start.setMonth(end.getMonth() - 1)
        else if (period === '3m') start.setMonth(end.getMonth() - 3)
        else if (period === '6m') start.setMonth(end.getMonth() - 6)
        else if (period === '1y') start.setFullYear(end.getFullYear() - 1)
        else if (period === 'all') {
            const allDates = [...dietLogs, ...lifestyleLogs].map(l => l.date).sort()
            if (allDates.length > 0) start.setTime(new Date(allDates[0]).getTime())
            else start.setMonth(end.getMonth() - 1)
            start.setHours(0, 0, 0, 0)
        }

        const sortedGoals = [...goals].sort((a, b) => a.start_date.localeCompare(b.start_date))

        const data: any[] = []
        const current = new Date(start)
        const limit = new Date(end)

        while (current <= limit) {
            const dStr = formatDate(current)
            let diet = dietLogs.find(l => l.date === dStr)
            let lifestyle = lifestyleLogs.find(l => l.date === dStr)
            
            const target = [...sortedGoals].reverse().find(t => t.start_date <= dStr) || sortedGoals[0]

            const hasDraftChanges = Boolean(todayDraft?.isSaved || (Array.isArray(todayDraft?.touchedFields) && todayDraft.touchedFields.length > 0) || todayDraft?.ocrResult)
            if (dStr === selectedDate && todayDraft && hasDraftChanges) {
                if (todayDraft.isSaved) {
                    lifestyle = {
                        ...lifestyle,
                        weight: todayDraft.weight ? parseFloat(todayDraft.weight) : (lifestyle?.weight || null),
                        water_liters: todayDraft.water ? parseFloat(todayDraft.water) : (lifestyle?.water_liters ?? lifestyle?.water ?? 0),
                        steps: todayDraft.steps ? parseInt(todayDraft.steps) : (lifestyle?.steps || 0),
                        sleep_hours: todayDraft.sleep ? parseFloat(todayDraft.sleep) : (lifestyle?.sleep_hours ?? lifestyle?.sleep ?? 0),
                        habits: todayDraft.habits || { workout: 0 }
                    }
                    diet = todayDraft.ocrResult || diet || null
                } else {
                    lifestyle = {
                        ...lifestyle,
                        ...(todayDraft.touchedFields?.includes('weight') ? { weight: todayDraft.weight ? parseFloat(todayDraft.weight) : null } : {}),
                        ...(todayDraft.touchedFields?.includes('water') ? { water_liters: todayDraft.water ? parseFloat(todayDraft.water) : 0 } : {}),
                        ...(todayDraft.touchedFields?.includes('steps') ? { steps: todayDraft.steps ? parseInt(todayDraft.steps) : 0 } : {}),
                        ...(todayDraft.touchedFields?.includes('sleep') ? { sleep_hours: todayDraft.sleep ? parseFloat(todayDraft.sleep) : 0 } : {}),
                        habits: todayDraft.habits || lifestyle?.habits || { workout: 0 }
                    }
                    diet = todayDraft.ocrResult || diet
                }
            }

            const item: any = {
                date: dStr,
                displayDate: `${parseInt(dStr.split('-')[1], 10)}/${parseInt(dStr.split('-')[2], 10)}`,
                weight: lifestyle?.weight || null,
                calories: diet?.calories || 0,
                protein: diet?.protein || 0,
                fat: diet?.fat || 0,
                carbs: diet?.carbs || 0,
                sugar: diet?.sugar ?? Math.max(0, (diet?.carbs || 0) - (diet?.fiber || 0)),
                fiber: diet?.fiber || 0,
                salt: diet?.salt || 0,
                target_calories: target?.calories || null,
                target_protein: target?.protein || null,
                target_fat: target?.fat || null,
                target_carbs: target?.carbs || null,
                target_sugar: target?.sugar ?? (target ? Math.max(0, target.carbs - (target.fiber || 20)) : null),
                target_fiber: target?.fiber || null,
                target_salt: target?.salt || null,
                steps: lifestyle?.steps || 0,
                sleep: lifestyle?.sleep_hours ?? lifestyle?.sleep ?? 0,
                water: lifestyle?.water_liters ?? lifestyle?.water ?? 0,
                workout: (lifestyle?.habits?.workout || 0) > 0 ? 1 : 0,
                target_steps: settings?.habit_targets?.steps || 8000,
                target_water: settings?.habit_targets?.water || 2.0,
                target_sleep: settings?.habit_targets?.sleep || 8.0,
                target_workout: settings?.habit_targets?.workout || 1,
            }

            // Habits
            if (settings?.quit_goals) {
                settings.quit_goals.forEach((goal: string) => {
                    const habitsObj = lifestyle?.habits || {}
                    const achievement = habitsObj[goal] ?? 
                                      (goal && goal.includes('酒') ? (lifestyle?.alcohol > 0 ? 0 : 1) : null)
                    item[`habit_${goal}`] = achievement
                    item[`target_habit_${goal}`] = 1 // Target is always 1 (Done/Avoided)
                })
            }

            data.push(item)
            current.setDate(current.getDate() + 1)
        }

        if (!showAvg) return data

        return data.map((d: any, i: number, arr: any[]) => {
            const window = arr.slice(Math.max(0, i - 6), i + 1)
            const weights = window.map(w => w.weight).filter(w => w != null)
            const avgWeight = weights.length > 0 ? weights.reduce((acc, curr) => acc + curr, 0) / weights.length : null
            return {
                ...d,
                weight: avgWeight ? Number(avgWeight.toFixed(1)) : null
            }
        })
    }, [dietLogs, lifestyleLogs, goals, settings, period, showAvg, todayDraft, selectedDate])

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

    const [calendarDate, setCalendarDate] = useState(new Date())

    const handlePrevMonth = () => {
        const d = new Date(calendarDate)
        d.setMonth(d.getMonth() - 1)
        setCalendarDate(d)
    }

    const handleNextMonth = () => {
        const d = new Date(calendarDate)
        d.setMonth(d.getMonth() + 1)
        setCalendarDate(d)
    }

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>
    if (fetchError) {
        return (
            <div className="bg-surface-raised rounded-2xl border border-red-500/25 p-6 text-sm text-red-400">
                分析データを取得できませんでした。画面を再読み込みしてください。
            </div>
        )
    }

    // Common styling for all charts to ensure perfect alignment
    const chartMargin = { top: 10, right: 10, left: -10, bottom: 0 }
    const commonXAxis = (
        <XAxis 
            dataKey="displayDate" 
            axisLine={{ stroke: '#3f3f46', strokeWidth: 0.5 }} 
            tickLine={false} 
            tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }} 
            interval="preserveStartEnd"
            minTickGap={20}
        />
    )
    // Fixed width YAxis ensures all charts have the same plotting area width
    const commonYAxis = <YAxis width={40} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }} />
    // Unified Tooltip cursor (Line) for all chart types
    const commonTooltip = <Tooltip cursor={{ stroke: '#52525b', strokeWidth: 1 }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', fontSize: '10px' }} />

    return (
        <div className="space-y-6 pb-24">
            {/* 週間目標（旧ホームタブのバー11本の移設先。デフォルト折りたたみ）
                管理者側「サマリー」タブには常設表示があるため、showWeeklyGoals=falseで重複を避ける */}
            {showWeeklyGoals && (
                <WeeklyProgressPanel
                    weeklyStats={weeklyStats}
                    weekOffset={weekOffset}
                    setWeekOffset={setWeekOffset}
                    collapsible
                    defaultOpen={false}
                />
            )}

            {/* Controls */}
            <div className="bg-surface-raised p-3 sm:p-4 rounded-2xl border border-border-strong shadow-sm flex flex-row items-center gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap">
                <label className="flex items-center gap-2 text-xs sm:text-sm font-normal text-text-secondary shrink-0">
                    期間：
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as PeriodType)}
                        className="bg-surface-base border border-border-strong text-text-primary text-xs sm:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block py-1.5 px-2 outline-none font-normal"
                    >
                        <option value="1w">7日間</option>
                        <option value="1m">1ヶ月</option>
                        <option value="3m">3ヶ月</option>
                        <option value="6m">6ヶ月</option>
                        <option value="1y">1年</option>
                        <option value="all">すべて</option>
                    </select>
                </label>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-normal text-text-secondary shrink-0">
                    表示：
                    <select
                        value={showAvg ? 'week' : 'day'}
                        onChange={(e) => setShowAvg(e.target.value === 'week')}
                        className="bg-surface-base border border-border-strong text-text-primary text-xs sm:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block py-1.5 px-2 outline-none font-normal"
                    >
                        <option value="day">日</option>
                        <option value="week">週平均</option>
                    </select>
                </label>
            </div>

            {/* 1. Weight Chart */}
            <AnalysisChartCard title="体重推移" color="blue">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                        {commonXAxis}
                        <YAxis width={40} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }} />
                        {commonTooltip}
                        <Line type="monotone" dataKey="weight" name="体重" stroke="#3b82f6" strokeWidth={4} dot={!showAvg ? { r: 4, strokeWidth: 2, fill: '#fff' } : false} connectNulls />
                    </LineChart>
                </ResponsiveContainer>
            </AnalysisChartCard>

            {/* 2. Calories Chart */}
            <AnalysisChartCard title="摂取カロリー" color="purple">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                        {commonXAxis}
                        <YAxis 
                            width={40} 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }}
                            domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, analysisData[analysisData.length - 1]?.target_calories || 0) * 1.2)]}
                        />
                        {commonTooltip}
                        <Bar dataKey="calories" name="摂取カロリー" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        <Line type="stepAfter" dataKey="target_calories" name="目標設定" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </AnalysisChartCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* 3. Protein Chart */}
                <AnalysisChartCard title="タンパク質 (P)" color="amber">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                            {commonXAxis}
                            <YAxis 
                                width={40} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }}
                                domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, analysisData[analysisData.length - 1]?.target_protein || 0) * 1.2)]}
                            />
                            {commonTooltip}
                            <Bar dataKey="protein" name="摂取量" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                            <Line type="stepAfter" dataKey="target_protein" name="目標設定" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>

                {/* 4. Fat Chart */}
                <AnalysisChartCard title="脂質 (F)" color="purple">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                            {commonXAxis}
                            <YAxis
                                width={40}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }}
                                domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, analysisData[analysisData.length - 1]?.target_fat || 0) * 1.2)]}
                            />
                            {commonTooltip}
                            <Bar dataKey="fat" name="摂取量" fill="#a855f7" radius={[4, 4, 0, 0]} />
                            <Line type="stepAfter" dataKey="target_fat" name="目標設定" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>

                {/* 5. Carbs Chart */}
                <AnalysisChartCard title="炭水化物 (C)" color="blue">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                            {commonXAxis}
                            <YAxis 
                                width={40} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }}
                                domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, analysisData[analysisData.length - 1]?.target_carbs || 0) * 1.2)]}
                            />
                            {commonTooltip}
                            <Bar dataKey="carbs" name="摂取量" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Line type="stepAfter" dataKey="target_carbs" name="目標設定" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>

                {/* 6. Sugar Chart */}
                <AnalysisChartCard title="糖質" color="sky">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                            {commonXAxis}
                            <YAxis 
                                width={40} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }}
                                domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, analysisData[analysisData.length - 1]?.target_sugar || 0) * 1.2)]}
                            />
                            {commonTooltip}
                            <Bar dataKey="sugar" name="摂取量" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                            <Line type="stepAfter" dataKey="target_sugar" name="目標設定" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>

                {/* 7. Fiber Chart */}
                <AnalysisChartCard title="食物繊維" color="teal">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                            {commonXAxis}
                            <YAxis 
                                width={40} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }}
                                domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, analysisData[analysisData.length - 1]?.target_fiber || 0) * 1.2)]}
                            />
                            {commonTooltip}
                            <Bar dataKey="fiber" name="摂取量" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                            <Line type="stepAfter" dataKey="target_fiber" name="目標設定" stroke="#14b8a6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>

                {/* 8. Salt Chart */}
                <AnalysisChartCard title="塩分" color="gray">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                            {commonXAxis}
                            <YAxis 
                                width={40} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }}
                                domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, analysisData[analysisData.length - 1]?.target_salt || 0) * 1.2)]}
                            />
                            {commonTooltip}
                            <Bar dataKey="salt" name="摂取量" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                            <Line type="stepAfter" dataKey="target_salt" name="目標設定" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>
            </div>

            {/* 7. Steps Chart */}
            <AnalysisChartCard title="歩数" color="cyan">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                        {commonXAxis}
                        <YAxis
                            width={40}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }}
                            domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, analysisData[analysisData.length - 1]?.target_steps || 8000) * 1.2)]}
                        />
                        {commonTooltip}
                        <Bar dataKey="steps" name="歩数" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                        <Line type="stepAfter" dataKey="target_steps" name="目標設定" stroke="#06b6d4" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </AnalysisChartCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* 8. Sleep Chart */}
                <AnalysisChartCard title="睡眠時間" color="violet">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                            {commonXAxis}
                            <YAxis 
                                width={40} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }}
                                domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, analysisData[analysisData.length - 1]?.target_sleep || 8) * 1.2)]}
                            />
                            {commonTooltip}
                            <Bar dataKey="sleep" name="睡眠時間" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Line type="stepAfter" dataKey="target_sleep" name="目標設定" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>

                {/* 5. Water Chart */}
                <AnalysisChartCard title="水分摂取量" color="sky">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                            {commonXAxis}
                            <YAxis 
                                width={40} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }}
                                domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, analysisData[analysisData.length - 1]?.target_water || 2) * 1.2)]}
                            />
                            {commonTooltip}
                            <Bar dataKey="water" name="水分摂取量" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                            <Line type="stepAfter" dataKey="target_water" name="目標設定" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>
            </div>

            {/* 9. Workout Chart - Spanning full width with enough height */}
            <div className="bg-surface-raised rounded-3xl p-4 sm:p-6 border border-border-subtle shadow-sm flex flex-col min-h-[450px]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                            <h3 className="text-lg font-normal text-text-primary">筋トレカレンダー</h3>
                        </div>
                        <div className="pl-3.5 text-sm font-normal text-orange-600">
                            {calendarDate.getFullYear()}年 {calendarDate.getMonth() + 1}月
                        </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-center gap-2 bg-orange-500/15 rounded-full p-1 shadow-inner w-full sm:w-auto">
                        <button 
                            onClick={handlePrevMonth}
                            className="w-8 h-8 flex items-center justify-center hover:bg-surface-raised rounded-full transition-all text-orange-500 active:scale-90"
                        >
                            <Icon name="chevronLeft" size={20} />
                        </button>
                        <span className="text-xs font-normal text-orange-500 min-w-[72px] text-center">月移動</span>
                        <button 
                            onClick={handleNextMonth}
                            className="w-8 h-8 flex items-center justify-center hover:bg-surface-raised rounded-full transition-all text-orange-500 active:scale-90"
                        >
                            <Icon name="chevronRight" size={20} />
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-col flex-1">
                    <div className="grid grid-cols-7 gap-3 mb-4">
                        {['日', '月', '火', '水', '木', '金', '土'].map(d => (
                            <div key={d} className="text-[10px] font-normal text-text-muted text-center uppercase tracking-widest">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-3 flex-1">
                        {(() => {
                            const calendarDays = []
                            const start = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1)
                            start.setDate(start.getDate() - start.getDay()) 

                            const todayStr = formatDate(new Date())

                            for (let i = 0; i < 35; i++) {
                                const date = new Date(start)
                                date.setDate(start.getDate() + i)
                                const dStr = formatDate(date)
                                
                                const dayData = analysisData.find(d => d.date === dStr)
                                const isDone = dayData?.workout === 1
                                const isToday = dStr === todayStr
                                const isSelected = dStr === selectedDate
                                const isCurrentMonth = date.getMonth() === calendarDate.getMonth()
                                
                                calendarDays.push(
                                    <div key={dStr} className={`relative aspect-square flex flex-col items-center justify-center rounded-2xl border-2 transition-all overflow-hidden ${!isCurrentMonth ? 'opacity-10 pointer-events-none' : ''} ${isSelected ? 'border-orange-500 bg-orange-500/10' : 'border-border-subtle bg-surface-base/30 hover:border-border-subtle'}`}>
                                        <span className={`text-[10px] font-normal z-10 ${isDone ? 'text-white opacity-40' : isToday ? 'text-blue-500' : 'text-text-muted'}`}>
                                            {date.getDate()}
                                        </span>
                                        {isDone && (
                                            <div className="absolute inset-0 flex items-center justify-center animate-popIn">
                                                <div className="w-10 h-10 bg-[#FF6B00] rounded-full shadow-lg flex items-center justify-center relative">
                                                    <Icon name="check" size={24} className="text-white" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                            return calendarDays
                        })()}
                    </div>
                    <div className="mt-10 flex items-center justify-center gap-10 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-orange-500 rounded-full shadow-md flex items-center justify-center">
                                <Icon name="check" size={14} className="text-white" />
                            </div>
                            <span className="text-xs font-normal text-text-secondary uppercase tracking-tighter">実施済み</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-surface-base rounded-xl border-2 border-border-subtle"></div>
                            <span className="text-xs font-normal text-text-muted uppercase tracking-tighter">未実施</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Habits Charts */}
            {settings?.quit_goals?.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1 pt-4">
                        <div className="w-1.5 h-5 bg-purple-500 rounded-full"></div>
                        <h2 className="text-sm font-normal text-text-primary uppercase tracking-widest">習慣の達成状況</h2>
                    </div>
                    {settings.quit_goals.map((goal: string) => (
                        <AnalysisChartCard key={goal} title={`習慣: ${goal}`} color="purple">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={analysisData} syncId="analyzeSync" margin={chartMargin}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                                    {commonXAxis}
                                    {commonYAxis}
                                    <Tooltip 
                                        cursor={{ stroke: '#52525b', strokeWidth: 1 }}
                                        formatter={(value: any, name: any) => [value === 1 ? '○ 達成' : value === 0 ? '× 未達成' : '-', '状況']}
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

        </div>
    )
}

function AnalysisChartCard({ title, children, color }: { title: string, children: React.ReactNode, color: string }) {
    // Q-3: 旧ライトモードの bg-*-50/30 + border-*-100(不透明) は、黒背景では
    // カード面がグレーに沈む一方で枠線だけ明るく浮いてしまいコントラストが不揃いだったため、
    // 他画面のダークバッジパターンに揃えて bg-*-500/10 + border-*-500/20 に統一する。
    const colorStyles: Record<string, string> = {
        blue: 'bg-blue-500/10 border-blue-500/20',
        purple: 'bg-purple-500/10 border-purple-500/20',
        cyan: 'bg-cyan-500/10 border-cyan-500/20',
        violet: 'bg-violet-500/10 border-violet-500/20',
        sky: 'bg-sky-500/10 border-sky-500/20',
        teal: 'bg-teal-500/10 border-teal-500/20',
        gray: 'bg-surface-base/50 border-border-subtle',
    }
    return (
        <div className={`p-6 rounded-2xl border ${colorStyles[color]} shadow-sm space-y-4`}>
            <h3 className="text-sm font-normal text-text-secondary tracking-widest">{title}</h3>
            <div className="h-[250px] w-full">{children}</div>
        </div>
    )
}
