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
    ResponsiveContainer
} from 'recharts'
import { useWeeklyProgress } from '@/hooks/useWeeklyProgress'
import WeeklyProgressPanel from './WeeklyProgressPanel'
import EmptyState from '@/components/ui/EmptyState'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import { fetchJsonCached } from '@/lib/client-fetch-cache'
import { getGoalForDate } from '@/lib/utils/dietDayType'

interface AnalyzeTabProps {
    userId: string
    token: string
    isAdmin?: boolean
    todayDraft?: any
    /** 週間目標(WeeklyProgressPanel)セクションを表示するか。管理者側「サマリー」タブに常設表示がある場合はfalseにして重複を避ける。 */
    showWeeklyGoals?: boolean
}

type PeriodType = '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | 'all'

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

                if (period === '1d') rangeStart.setDate(rangeEnd.getDate())
                else if (period === '1w') rangeStart.setDate(rangeEnd.getDate() - 6)
                else if (period === '1m') rangeStart.setMonth(rangeEnd.getMonth() - 1)
                else if (period === '3m') rangeStart.setMonth(rangeEnd.getMonth() - 3)
                else if (period === '6m') rangeStart.setMonth(rangeEnd.getMonth() - 6)
                else if (period === '1y') rangeStart.setFullYear(rangeEnd.getFullYear() - 1)

                const logParams = new URLSearchParams(params)
                if (period !== 'all') {
                    logParams.set('startDate', formatDate(rangeStart))
                    logParams.set('endDate', formatDate(rangeEnd))
                }

                const [dietData, lifeData, goalData, settingData] = await Promise.all([
                    fetchJsonCached<any>(`/api/diet/logs?${logParams.toString()}`),
                    fetchJsonCached<any>(`/api/lifestyle/logs?${logParams.toString()}`),
                    fetchJsonCached<any>(`/api/diet/goals?${params}`),
                    fetchJsonCached<any>(`/api/lifestyle/settings?${params}`)
                ])

                setDietLogs(dietData.data || [])
                setLifestyleLogs(lifeData.data || [])
                setGoals(goalData.data || [])
                setSettings(settingData.data || null)
            } catch (e) {
                console.error('Fetch error in AnalyzeTab:', e)
                setFetchError(e instanceof Error ? e.message : '記録を取得できませんでした。画面を再読み込みしてください。')
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
        
        if (period === '1d') start.setDate(end.getDate())
        else if (period === '1w') start.setDate(end.getDate() - 6)
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
            
            const target = getGoalForDate(sortedGoals, dStr) || sortedGoals[0]

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
                calories_chart: Number(diet?.calories) > 0 ? Number(diet.calories) : null,
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

        const weekGroups = new Map<string, any[]>()
        data.forEach((item) => {
            const itemDate = new Date(`${item.date}T00:00:00`)
            const day = itemDate.getDay()
            const monday = new Date(itemDate)
            monday.setDate(itemDate.getDate() - (day === 0 ? 6 : day - 1))
            const key = formatDate(monday)
            weekGroups.set(key, [...(weekGroups.get(key) || []), item])
        })

        const averageRecorded = (rows: any[], key: string, digits = 1) => {
            const values = rows
                .map(row => Number(row[key]))
                .filter(value => Number.isFinite(value) && value > 0)
            return values.length > 0
                ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(digits))
                : null
        }

        return Array.from(weekGroups.entries()).map(([weekStart, rows]) => {
            const first = rows[0]
            const last = rows[rows.length - 1]
            return {
                ...last,
                date: weekStart,
                displayDate: first.displayDate === last.displayDate
                    ? first.displayDate
                    : `${first.displayDate}〜${last.displayDate}`,
                weight: averageRecorded(rows, 'weight'),
                calories: averageRecorded(rows, 'calories', 0) ?? 0,
                calories_chart: averageRecorded(rows, 'calories_chart', 0),
                protein: averageRecorded(rows, 'protein') ?? 0,
                fat: averageRecorded(rows, 'fat') ?? 0,
                carbs: averageRecorded(rows, 'carbs') ?? 0,
                sugar: averageRecorded(rows, 'sugar') ?? 0,
                fiber: averageRecorded(rows, 'fiber') ?? 0,
                salt: averageRecorded(rows, 'salt') ?? 0,
                steps: averageRecorded(rows, 'steps', 0) ?? 0,
                sleep: averageRecorded(rows, 'sleep') ?? 0,
                water: averageRecorded(rows, 'water') ?? 0,
                target_calories: averageRecorded(rows, 'target_calories', 0),
                target_protein: averageRecorded(rows, 'target_protein'),
                target_fat: averageRecorded(rows, 'target_fat'),
                target_carbs: averageRecorded(rows, 'target_carbs'),
                target_sugar: averageRecorded(rows, 'target_sugar'),
                target_fiber: averageRecorded(rows, 'target_fiber'),
                target_salt: averageRecorded(rows, 'target_salt'),
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

    if (loading) {
        return (
            <div className="space-y-4 pb-24">
                <ChartSkeleton />
                <ChartSkeleton />
            </div>
        )
    }
    if (fetchError) {
        return (
            <EmptyState
                icon="warning"
                title="分析データを取得できませんでした"
                description="通信状況を確認して、画面を再読み込みしてください。"
                className="border-state-danger-500/25"
            />
        )
    }
    if (analysisData.length === 0) {
        return (
            <div className="space-y-6 pb-24">
                {showWeeklyGoals && (
                    <WeeklyProgressPanel
                        weeklyStats={weeklyStats}
                        weekOffset={weekOffset}
                        setWeekOffset={setWeekOffset}
                        collapsible
                        defaultOpen={false}
                    />
                )}
                <EmptyState
                    icon="chartBar"
                    title="分析できる記録がありません"
                    description="食事・体重・生活の記録が入ると、推移グラフが表示されます。"
                />
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

    const buildTicks = (valueKey: string, targetKey: string, step: number) => {
        const maxValue = Math.max(
            ...analysisData.map(row => Number(row[valueKey]) || 0),
            ...analysisData.map(row => Number(row[targetKey]) || 0),
            step,
        )
        const upper = Math.ceil(maxValue / step) * step
        return Array.from({ length: Math.floor(upper / step) + 1 }, (_, index) =>
            Number((index * step).toFixed(2))
        )
    }

    const axisTicks = {
        calories: buildTicks('calories', 'target_calories', 500),
        protein: buildTicks('protein', 'target_protein', 50),
        fat: buildTicks('fat', 'target_fat', 20),
        carbs: buildTicks('carbs', 'target_carbs', 50),
        sugar: buildTicks('sugar', 'target_sugar', 50),
        fiber: buildTicks('fiber', 'target_fiber', 10),
        steps: buildTicks('steps', 'target_steps', 2000),
        sleep: buildTicks('sleep', 'target_sleep', 2),
        water: buildTicks('water', 'target_water', 0.5),
    }
    const calorieChartTicks = buildTicks('calories_chart', 'target_calories', 500)

    const recordedWeights = analysisData
        .map(row => Number(row.weight))
        .filter(value => Number.isFinite(value) && value > 0)
    const weightMin = recordedWeights.length > 0 ? Math.floor(Math.min(...recordedWeights) - 1) : 0
    const weightMax = recordedWeights.length > 0 ? Math.ceil(Math.max(...recordedWeights) + 1) : 100
    const weightDomain: [number, number] = weightMin === weightMax
        ? [Math.max(0, weightMin - 1), weightMax + 1]
        : [Math.max(0, weightMin), weightMax]

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
                    表示：
                    <select
                        value={showAvg ? 'week' : 'day'}
                        onChange={(e) => setShowAvg(e.target.value === 'week')}
                        className="bg-surface-base border border-border-strong text-text-primary text-xs sm:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block py-1.5 px-2 outline-none font-normal"
                    >
                        <option value="day">毎日</option>
                        <option value="week">週平均</option>
                    </select>
                </label>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-normal text-text-secondary shrink-0">
                    期間：
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as PeriodType)}
                        className="bg-surface-base border border-border-strong text-text-primary text-xs sm:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block py-1.5 px-2 outline-none font-normal"
                    >
                        <option value="1d">日</option>
                        <option value="1w">週</option>
                        <option value="1m">月</option>
                        <option value="3m">3ヶ月</option>
                        <option value="6m">半年</option>
                        <option value="1y">一年</option>
                        <option value="all">全期間</option>
                    </select>
                </label>
            </div>

            {/* 体重と摂取カロリーを同じ時間軸で確認するメイングラフ */}
            <AnalysisChartCard title="体重・摂取カロリー" color="blue">
                <div className="flex h-full min-h-0 flex-col">
                    <div className="mb-3 flex items-center justify-end gap-4 text-xs font-normal text-text-secondary">
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />カロリー</span>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" />体重</span>
                    </div>
                    <div className="min-h-0 flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={analysisData} syncId="analyzeSync" margin={{ top: 8, right: -4, left: -8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                                {commonXAxis}
                                <YAxis
                                    yAxisId="calories"
                                    width={38}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fontWeight: 600, fill: '#60a5fa' }}
                                    ticks={calorieChartTicks}
                                    domain={[0, calorieChartTicks[calorieChartTicks.length - 1]]}
                                    unit=""
                                />
                                <YAxis
                                    yAxisId="weight"
                                    orientation="right"
                                    width={38}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fontWeight: 600, fill: '#f97316' }}
                                    domain={weightDomain}
                                />
                                <Tooltip
                                    cursor={{ stroke: '#52525b', strokeWidth: 1 }}
                                    formatter={(value: any, name: any) => [
                                        name === '体重' ? `${Number(value).toFixed(1)} kg` : `${Math.round(Number(value))} kcal`,
                                        name,
                                    ]}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.15)', padding: '10px', fontSize: '11px' }}
                                />
                                <Line
                                    yAxisId="calories"
                                    type="monotone"
                                    dataKey="calories_chart"
                                    name="カロリー"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ r: showAvg ? 4 : 2.5, strokeWidth: 0, fill: '#3b82f6' }}
                                    activeDot={{ r: 5 }}
                                    connectNulls
                                />
                                <Line
                                    yAxisId="weight"
                                    type="monotone"
                                    dataKey="weight"
                                    name="体重"
                                    stroke="#f97316"
                                    strokeWidth={3}
                                    dot={{ r: showAvg ? 4 : 2.5, strokeWidth: 0, fill: '#f97316' }}
                                    activeDot={{ r: 5 }}
                                    connectNulls
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
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
                                ticks={axisTicks.protein}
                                domain={[0, axisTicks.protein[axisTicks.protein.length - 1]]}
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
                                ticks={axisTicks.fat}
                                domain={[0, axisTicks.fat[axisTicks.fat.length - 1]]}
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
                                ticks={axisTicks.carbs}
                                domain={[0, axisTicks.carbs[axisTicks.carbs.length - 1]]}
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
                                ticks={axisTicks.sugar}
                                domain={[0, axisTicks.sugar[axisTicks.sugar.length - 1]]}
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
                                ticks={axisTicks.fiber}
                                domain={[0, axisTicks.fiber[axisTicks.fiber.length - 1]]}
                            />
                            {commonTooltip}
                            <Bar dataKey="fiber" name="摂取量" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                            <Line type="stepAfter" dataKey="target_fiber" name="目標設定" stroke="#14b8a6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
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
                            ticks={axisTicks.steps}
                            domain={[0, axisTicks.steps[axisTicks.steps.length - 1]]}
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
                                ticks={axisTicks.sleep}
                                domain={[0, axisTicks.sleep[axisTicks.sleep.length - 1]]}
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
                                ticks={axisTicks.water}
                                domain={[0, axisTicks.water[axisTicks.water.length - 1]]}
                            />
                            {commonTooltip}
                            <Bar dataKey="water" name="水分摂取量" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                            <Line type="stepAfter" dataKey="target_water" name="目標設定" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </AnalysisChartCard>
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
