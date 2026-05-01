'use client'

import { useState, useEffect, useMemo } from 'react'

interface HomeTabProps {
    token: string
    userName: string
    todayDraft?: any
}

export default function HomeTab({ token, userName, todayDraft }: HomeTabProps) {
    const [dietLogs, setDietLogs] = useState<any[]>([])
    const [lifestyleLogs, setLifestyleLogs] = useState<any[]>([])
    const [dietGoals, setDietGoals] = useState<any[]>([])
    const [lifestyleSettings, setLifestyleSettings] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [weekOffset, setWeekOffset] = useState(0) // 0: current, -1: last week, etc.

    const todayStr = new Date().toLocaleDateString('sv-SE')

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const [dietLogRes, lifeLogRes, dietGoalRes, lifeSettingRes] = await Promise.all([
                    fetch(`/api/diet/logs?token=${token}`),
                    fetch(`/api/lifestyle/logs?token=${token}`),
                    fetch(`/api/diet/goals?token=${token}`),
                    fetch(`/api/lifestyle/settings?token=${token}`)
                ])

                const [dietLogData, lifeLogData, dietGoalData, lifeSettingData] = await Promise.all([
                    dietLogRes.json(),
                    lifeLogRes.json(),
                    dietGoalRes.json(),
                    lifeSettingRes.json()
                ])

                setDietLogs(dietLogData.data || [])
                setLifestyleLogs(lifeLogData.data || [])
                setDietGoals(dietGoalData.data || [])
                setLifestyleSettings(lifeSettingData.data || null)
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [token])

    const weeklyStats = useMemo(() => {
        const now = new Date();
        now.setDate(now.getDate() + (weekOffset * 7)); // Apply week offset

        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const weekRangeStr = `${monday.getMonth() + 1}/${monday.getDate()} 〜 ${sunday.getMonth() + 1}/${sunday.getDate()}`;

        // Filter and merge today's data based on isSaved
        const processLogs = (logs: any[], isDiet: boolean) => {
            let processed = logs.filter(log => {
                const logDate = new Date(log.date);
                return logDate >= monday && logDate <= sunday;
            });

            // Handle today specifically if it's within the selected week
            if (todayDraft && todayDraft.selectedDate === todayStr) {
                const isTodayInThisWeek = new Date(todayStr) >= monday && new Date(todayStr) <= sunday;
                if (isTodayInThisWeek) {
                    if (!todayDraft.isSaved) {
                        processed = processed.filter(l => l.date !== todayStr);
                    } else {
                        const filtered = processed.filter(l => l.date !== todayStr);
                        const todayData = isDiet ? todayDraft.ocrResult : {
                            date: todayStr,
                            steps: parseInt(todayDraft.steps) || 0,
                            water: parseFloat(todayDraft.water) || 0,
                            sleep: parseFloat(todayDraft.sleep) || 0,
                            habits: todayDraft.habits || { workout: 0 }
                        };
                        if (todayData) processed = [...filtered, todayData];
                    }
                }
            }
            
            return processed;
        };

        const thisWeekDietLogs = processLogs(dietLogs, true);
        const thisWeekLifeLogs = processLogs(lifestyleLogs, false);

        // Target for the week (using target as of the end of that week)
        const targetDateStr = sunday.toLocaleDateString('sv-SE');
        const currentDietGoal = [...dietGoals]
            .filter(g => g.start_date <= targetDateStr)
            .sort((a, b) => b.start_date.localeCompare(a.start_date))[0] 
            || dietGoals[dietGoals.length - 1] 
            || { calories: 0, protein: 0, fat: 0, carbs: 0 };

        const lifeTargets = lifestyleSettings?.habit_targets || { 
            steps: 8000, 
            water: 2.0, 
            workout: 3
        };
        const daysInWeek = 7;

        const actual = {
            calories: thisWeekDietLogs.reduce((sum, log) => sum + (log.calories || 0), 0),
            protein: thisWeekDietLogs.reduce((sum, log) => sum + (log.protein || 0), 0),
            fat: thisWeekDietLogs.reduce((sum, log) => sum + (log.fat || 0), 0),
            carbs: thisWeekDietLogs.reduce((sum, log) => sum + (log.carbs || 0), 0),
            steps: thisWeekLifeLogs.reduce((sum, log) => sum + (log.steps || 0), 0),
            water: thisWeekLifeLogs.reduce((sum, log) => sum + (log.water_liters || log.water || 0), 0),
            sleep: thisWeekLifeLogs.reduce((sum, log) => sum + (log.sleep_hours || log.sleep || 0), 0),
            workout: thisWeekLifeLogs.reduce((sum, log) => sum + ((log.habits?.workout || 0) > 0 ? 1 : 0), 0),
        };
 
        const targets = {
            calories: (currentDietGoal.calories || 0) * daysInWeek,
            protein: (currentDietGoal.protein || 0) * daysInWeek,
            fat: (currentDietGoal.fat || 0) * daysInWeek,
            carbs: (currentDietGoal.carbs || 0) * daysInWeek,
            steps: (lifeTargets.steps || 8000) * daysInWeek,
            water: (lifeTargets.water || 2.0) * daysInWeek,
            sleep: (lifeTargets.sleep || 8.0) * daysInWeek,
            workout: lifeTargets.workout || 3,
        };
 
        return { 
            actual, 
            targets, 
            weekRangeStr,
            dietTargetPerDay: currentDietGoal,
            lifeTargetPerDay: {
                steps: lifeTargets.steps || 8000,
                water: lifeTargets.water || 2.0,
                sleep: lifeTargets.sleep || 8.0,
                workout: lifeTargets.workout || 3
            }
        };
    }, [dietLogs, lifestyleLogs, dietGoals, lifestyleSettings, todayDraft, todayStr, weekOffset]);

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

    return (
        <div className="space-y-4 animate-fadeIn">
            {/* 1. Integrated Header Section */}
            <div className="px-2 flex flex-col items-center">
                <h2 className="text-2xl font-black text-gray-800 tracking-tight mb-3">
                    週間目標
                </h2>
                
                <div className="flex items-center gap-3 bg-gray-100 rounded-2xl p-1.5 w-full max-w-[300px] shadow-sm">
                    <button 
                        onClick={() => setWeekOffset(prev => prev - 1)}
                        className="w-9 h-9 flex items-center justify-center hover:bg-white rounded-xl transition-all text-gray-500 active:scale-90"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    
                    <div className="flex-1 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-sm font-black text-gray-800">
                                {weekOffset === 0 ? '今週' : weekOffset === -1 ? '先週' : `${Math.abs(weekOffset)}週間前`}
                            </span>
                            <span className="text-[10px] font-bold text-gray-500 tabular-nums">
                                ({weeklyStats?.weekRangeStr})
                            </span>
                        </div>
                    </div>

                    <button 
                        onClick={() => setWeekOffset(prev => Math.min(0, prev + 1))}
                        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 ${weekOffset === 0 ? 'text-gray-100 cursor-not-allowed' : 'hover:bg-white text-gray-500'}`}
                        disabled={weekOffset === 0}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>

            {/* 2. Weekly Progress Cards */}
            <div className="space-y-4">
                {/* Diet Section */}
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 bg-rose-500 rounded-full"></div>
                        <h3 className="text-sm font-black text-gray-800">食事・栄養</h3>
                    </div>
                    
                    <div className="space-y-5">
                        <WeeklyProgressItem 
                            label="合計摂取カロリー" 
                            actual={weeklyStats?.actual.calories || 0} 
                            target={weeklyStats?.targets.calories || 0} 
                            unit="kcal" 
                            color="rose"
                            perDay={weeklyStats?.dietTargetPerDay.calories || 0}
                        />
                        <div className="grid grid-cols-1 gap-5">
                            <WeeklyProgressItem 
                                label="タンパク質 (P)" 
                                actual={weeklyStats?.actual.protein || 0} 
                                target={weeklyStats?.targets.protein || 0} 
                                unit="g" 
                                color="amber"
                                perDay={weeklyStats?.dietTargetPerDay.protein || 0}
                            />
                            <WeeklyProgressItem 
                                label="脂質 (F)" 
                                actual={weeklyStats?.actual.fat || 0} 
                                target={weeklyStats?.targets.fat || 0} 
                                unit="g" 
                                color="emerald"
                                perDay={weeklyStats?.dietTargetPerDay.fat || 0}
                            />
                            <WeeklyProgressItem 
                                label="炭水化物 (C)" 
                                actual={weeklyStats?.actual.carbs || 0} 
                                target={weeklyStats?.targets.carbs || 0} 
                                unit="g" 
                                color="blue"
                                perDay={weeklyStats?.dietTargetPerDay.carbs || 0}
                            />
                        </div>
                    </div>
                </div>

                {/* Lifestyle Section */}
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                        <h3 className="text-sm font-black text-gray-800">運動・生活</h3>
                    </div>
                    
                    <div className="space-y-5">
                        <WeeklyProgressItem 
                            label="合計歩数" 
                            actual={weeklyStats?.actual.steps || 0} 
                            target={weeklyStats?.targets.steps || 0} 
                            unit="歩" 
                            color="emerald"
                            perDay={weeklyStats?.lifeTargetPerDay.steps || 0}
                        />
                        <WeeklyProgressItem 
                            label="水分摂取量" 
                            actual={weeklyStats?.actual.water || 0} 
                            target={weeklyStats?.targets.water || 0} 
                            unit="L" 
                            color="sky"
                            perDay={weeklyStats?.lifeTargetPerDay.water || 0}
                        />
                        <WeeklyProgressItem 
                            label="睡眠時間" 
                            actual={weeklyStats?.actual.sleep || 0} 
                            target={weeklyStats?.targets.sleep || 0} 
                            unit="h" 
                            color="indigo"
                            perDay={weeklyStats?.lifeTargetPerDay.sleep || 0}
                        />
                        <WeeklyProgressItem 
                            label="筋トレ実施回数" 
                            actual={weeklyStats?.actual.workout || 0} 
                            target={weeklyStats?.targets.workout || 0} 
                            unit="回" 
                            color="orange"
                            perDay={weeklyStats?.lifeTargetPerDay.workout || 0}
                            isFrequency
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

function WeeklyProgressItem({ label, actual, target, unit, color, perDay, isFrequency }: { label: string, actual: number, target: number, unit: string, color: string, perDay: number, isFrequency?: boolean }) {
    const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
    const colors: Record<string, string> = {
        rose: 'bg-rose-500',
        amber: 'bg-amber-500',
        emerald: 'bg-emerald-500',
        blue: 'bg-blue-500',
        sky: 'bg-sky-500',
        orange: 'bg-orange-500',
        indigo: 'bg-indigo-500',
    }
    const textColors: Record<string, string> = {
        rose: 'text-rose-600',
        amber: 'text-amber-600',
        emerald: 'text-emerald-600',
        blue: 'text-blue-600',
        sky: 'text-sky-600',
        orange: 'text-orange-600',
        indigo: 'text-indigo-600',
    }

    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-end">
                <div className="space-y-0.5">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">{label}</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-gray-800 tabular-nums leading-none">{isFrequency ? actual : actual.toLocaleString()}</span>
                        <span className="text-[9px] font-bold text-gray-300">/ {target.toLocaleString()} {unit}</span>
                    </div>
                </div>
                <div className="text-right">
                    <p className={`text-sm font-black tabular-nums leading-none ${pct >= 100 ? 'text-emerald-500' : textColors[color]}`}>
                        {pct}%
                    </p>
                </div>
            </div>
            <div className="h-2 bg-gray-50 rounded-full overflow-hidden p-0.5 border border-gray-100">
                <div 
                    className={`h-full transition-all duration-1000 rounded-full ${colors[color]} shadow-sm`} 
                    style={{ width: `${pct}%` }} 
                />
            </div>
            <div className="flex justify-between items-center text-[7px] font-black text-gray-300 uppercase tracking-tighter leading-none">
                <span>累計</span>
                <span>{isFrequency ? `目標: ${target}${unit}` : `1日: ${perDay}${unit}`}</span>
            </div>
        </div>
    )
}
