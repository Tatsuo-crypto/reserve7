'use client'

import { useState, useEffect, useMemo } from 'react'

interface ProgressTabProps {
    userId: string;
    token: string;
}

export default function ProgressTab({ userId, token }: ProgressTabProps) {
    const [dietLogs, setDietLogs] = useState<any[]>([])
    const [goals, setGoals] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const [logRes, goalRes] = await Promise.all([
                    fetch(`/api/diet/logs?token=${token}`),
                    fetch(`/api/diet/goals?token=${token}`)
                ])

                const [logData, goalData] = await Promise.all([
                    logRes.json(),
                    goalRes.json()
                ])

                setDietLogs(logData.data || [])
                setGoals(goalData.data || [])
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [token])

    const weeklyStats = useMemo(() => {
        if (!dietLogs.length || !goals.length) return null;

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
        const thisWeekLogs = dietLogs.filter(log => {
            const logDate = new Date(log.date);
            return logDate >= monday && logDate <= sunday;
        });

        // 3. Get target for this week (latest setting)
        const target = goals[0];
        const daysInWeek = 7;

        const actual = {
            calories: thisWeekLogs.reduce((sum, log) => sum + (log.calories || 0), 0),
            protein: thisWeekLogs.reduce((sum, log) => sum + (log.protein || 0), 0),
            fat: thisWeekLogs.reduce((sum, log) => sum + (log.fat || 0), 0),
            carbs: thisWeekLogs.reduce((sum, log) => sum + (log.carbs || 0), 0),
        };

        const targets = {
            calories: target.calories * daysInWeek,
            protein: target.protein * daysInWeek,
            fat: target.fat * daysInWeek,
            carbs: target.carbs * daysInWeek,
        };

        return { actual, targets, targetPerDay: target };
    }, [dietLogs, goals]);

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
                    <h2 className="text-lg font-black text-gray-900">今週の達成状況 (月〜日)</h2>
                </div>

                <div className="grid gap-10">
                    <WeeklyProgressItem 
                        label="合計カロリー" 
                        actual={weeklyStats.actual.calories} 
                        target={weeklyStats.targets.calories} 
                        unit="kcal" 
                        color="rose"
                        perDay={weeklyStats.targetPerDay.calories}
                    />
                    <WeeklyProgressItem 
                        label="タンパク質 (P)" 
                        actual={weeklyStats.actual.protein} 
                        target={weeklyStats.targets.protein} 
                        unit="g" 
                        color="amber"
                        perDay={weeklyStats.targetPerDay.protein}
                    />
                    <WeeklyProgressItem 
                        label="脂質 (F)" 
                        actual={weeklyStats.actual.fat} 
                        target={weeklyStats.targets.fat} 
                        unit="g" 
                        color="emerald"
                        perDay={weeklyStats.targetPerDay.fat}
                    />
                    <WeeklyProgressItem 
                        label="炭水化物 (C)" 
                        actual={weeklyStats.actual.carbs} 
                        target={weeklyStats.targets.carbs} 
                        unit="g" 
                        color="blue"
                        perDay={weeklyStats.targetPerDay.carbs}
                    />
                </div>
            </div>
            
            <div className="text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">Weekly Progress Sync with Trainer Settings</p>
            </div>
        </div>
    )
}

function WeeklyProgressItem({ label, actual, target, unit, color, perDay }: { label: string, actual: number, target: number, unit: string, color: string, perDay: number }) {
    const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
    const colors: Record<string, string> = {
        rose: 'bg-rose-500',
        amber: 'bg-amber-500',
        emerald: 'bg-emerald-500',
        blue: 'bg-blue-500',
    }
    const textColors: Record<string, string> = {
        rose: 'text-rose-600',
        amber: 'text-amber-600',
        emerald: 'text-emerald-600',
        blue: 'text-blue-600',
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-wider">{label}</div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black tabular-nums text-gray-900">{actual.toLocaleString()}</span>
                        <span className="text-sm font-bold text-gray-300">/ {target.toLocaleString()} {unit}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black text-gray-400">1日目標: {perDay}{unit}</div>
                    <div className={`text-xl font-black tabular-nums ${pct >= 100 ? 'text-emerald-500' : textColors[color]}`}>
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
            <div className="flex justify-between text-[8px] font-black text-gray-300 uppercase tracking-widest">
                <span>0%</span>
                <span>50%</span>
                <span>100%達成</span>
            </div>
        </div>
    )
}
