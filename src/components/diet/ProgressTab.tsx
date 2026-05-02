'use client'

import { useState, useEffect, useMemo } from 'react'

interface ProgressTabProps {
    userId: string;
    token: string;
}

export default function ProgressTab({ userId, token }: ProgressTabProps) {
    const [dietLogs, setDietLogs] = useState<any[]>([])
    const [lifestyleLogs, setLifestyleLogs] = useState<any[]>([])
    const [dietGoals, setDietGoals] = useState<any[]>([])
    const [lifestyleSettings, setLifestyleSettings] = useState<any>(null)
    const [loading, setLoading] = useState(true)

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
        if (!dietLogs.length && !lifestyleLogs.length) return null;

        // 1. Get current week range (Monday to Sunday)
        const now = new Date();
        const day = now.getDay(); // 0 (Sun) to 6 (Sat)
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        // 2. Filter logs for this week
        const thisWeekDietLogs = dietLogs.filter(log => {
            const logDate = new Date(log.date);
            return logDate >= monday && logDate <= sunday;
        });
        const thisWeekLifeLogs = lifestyleLogs.filter(log => {
            const logDate = new Date(log.date);
            return logDate >= monday && logDate <= sunday;
        });

        // 3. Get targets
        const dietTarget = dietGoals[0] || { calories: 0, protein: 0, fat: 0, carbs: 0 };
        const lifeTargets = lifestyleSettings || { 
            step_target: 8000, 
            water_target: 2.0, 
            habit_targets: { workout: 3 } 
        };
        const daysInWeek = 7;

        const actual = {
            calories: thisWeekDietLogs.reduce((sum, log) => sum + (log.calories || 0), 0),
            protein: thisWeekDietLogs.reduce((sum, log) => sum + (log.protein || 0), 0),
            fat: thisWeekDietLogs.reduce((sum, log) => sum + (log.fat || 0), 0),
            carbs: thisWeekDietLogs.reduce((sum, log) => sum + (log.carbs || 0), 0),
            steps: thisWeekLifeLogs.reduce((sum, log) => sum + (log.steps || 0), 0),
            water: thisWeekLifeLogs.reduce((sum, log) => sum + (log.water || 0), 0),
            workout: thisWeekLifeLogs.reduce((sum, log) => sum + ((log.habits?.workout || 0) > 0 ? 1 : 0), 0),
        };

        const targets = {
            calories: dietTarget.calories * daysInWeek,
            protein: dietTarget.protein * daysInWeek,
            fat: dietTarget.fat * daysInWeek,
            carbs: dietTarget.carbs * daysInWeek,
            steps: (lifeTargets.step_target || 8000) * daysInWeek,
            water: (lifeTargets.water_target || 2.0) * daysInWeek,
            workout: lifeTargets.habit_targets?.workout || 3,
        };

        return { 
            actual, 
            targets, 
            dietTargetPerDay: dietTarget,
            lifeTargetPerDay: {
                steps: lifeTargets.step_target || 8000,
                water: lifeTargets.water_target || 2.0,
                workout: lifeTargets.habit_targets?.workout || 3
            }
        };
    }, [dietLogs, lifestyleLogs, dietGoals, lifestyleSettings]);

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

    if (!weeklyStats) return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-400 font-bold italic">今週の記録または目標がありません</p>
        </div>
    )

    return (
        <div className="space-y-6 pb-24">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-8">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-rose-500 rounded-full"></div>
                    <h2 className="text-lg font-normal text-gray-900">今週の達成状況 (月〜日)</h2>
                </div>

                <div className="grid gap-12">
                    <div className="space-y-8">
                        <h3 className="text-xs font-normal text-gray-300 uppercase tracking-widest border-b pb-2">食事・栄養バランス</h3>
                        <WeeklyProgressItem 
                            label="合計カロリー" 
                            actual={weeklyStats.actual.calories} 
                            target={weeklyStats.targets.calories} 
                            unit="kcal" 
                            color="rose"
                            perDay={weeklyStats.dietTargetPerDay.calories}
                        />
                        <WeeklyProgressItem 
                            label="タンパク質 (P)" 
                            actual={weeklyStats.actual.protein} 
                            target={weeklyStats.targets.protein} 
                            unit="g" 
                            color="amber"
                            perDay={weeklyStats.dietTargetPerDay.protein}
                        />
                        <WeeklyProgressItem 
                            label="脂質 (F)" 
                            actual={weeklyStats.actual.fat} 
                            target={weeklyStats.targets.fat} 
                            unit="g" 
                            color="emerald"
                            perDay={weeklyStats.dietTargetPerDay.fat}
                        />
                        <WeeklyProgressItem 
                            label="炭水化物 (C)" 
                            actual={weeklyStats.actual.carbs} 
                            target={weeklyStats.targets.carbs} 
                            unit="g" 
                            color="blue"
                            perDay={weeklyStats.dietTargetPerDay.carbs}
                        />
                    </div>

                    <div className="space-y-8">
                        <h3 className="text-xs font-normal text-gray-300 uppercase tracking-widest border-b pb-2">ライフスタイル・運動</h3>
                        <WeeklyProgressItem 
                            label="合計歩数" 
                            actual={weeklyStats.actual.steps} 
                            target={weeklyStats.targets.steps} 
                            unit="歩" 
                            color="emerald"
                            perDay={weeklyStats.lifeTargetPerDay.steps}
                        />
                        <WeeklyProgressItem 
                            label="水分摂取" 
                            actual={weeklyStats.actual.water} 
                            target={weeklyStats.targets.water} 
                            unit="L" 
                            color="sky"
                            perDay={weeklyStats.lifeTargetPerDay.water}
                        />
                        <WeeklyProgressItem 
                            label="筋トレ" 
                            actual={weeklyStats.actual.workout} 
                            target={weeklyStats.targets.workout} 
                            unit="回" 
                            color="orange"
                            perDay={weeklyStats.lifeTargetPerDay.workout}
                            isFrequency
                        />
                    </div>
                </div>
            </div>
            
            <div className="text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">Weekly Progress Sync with Trainer Settings</p>
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
    }
    const textColors: Record<string, string> = {
        rose: 'text-rose-600',
        amber: 'text-amber-600',
        emerald: 'text-emerald-600',
        blue: 'text-blue-600',
        sky: 'text-sky-600',
        orange: 'text-orange-600',
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <div className="text-xs font-normal text-gray-400 uppercase tracking-wider">{label}</div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-normal tabular-nums text-gray-900">{isFrequency ? actual : actual.toLocaleString()}</span>
                        <span className="text-sm font-bold text-gray-300">/ {target.toLocaleString()} {unit}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-normal text-gray-400">
                        {isFrequency ? `週目標: ${target}${unit}` : `1日目標: ${perDay}${unit}`}
                    </div>
                    <div className={`text-xl font-normal tabular-nums ${pct >= 100 ? 'text-emerald-500' : textColors[color]}`}>
                        {pct}%
                    </div>
                </div>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner p-1">
                <div 
                    className={`h-full transition-all duration-1000 rounded-full ${colors[color]} shadow-sm`} 
                    style={{ width: `${pct}%` }} 
                />
            </div>
            <div className="flex justify-between text-[8px] font-normal text-gray-300 uppercase tracking-widest">
                <span>0%</span>
                <span>50%</span>
                <span>100%達成</span>
            </div>
        </div>
    )
}
