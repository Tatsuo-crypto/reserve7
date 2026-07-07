'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
    ResponsiveContainer, 
    ComposedChart,
    Bar,
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip
} from 'recharts'
import Card from '@/components/ui/Card'

interface PlanTabProps {
    token: string
}

export default function PlanTab({ token }: PlanTabProps) {
    const [goals, setGoals] = useState<any[]>([])
    const [lifestyleSettings, setLifestyleSettings] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [goalsRes, lifeRes] = await Promise.all([
                    fetch(`/api/diet/goals?token=${token}`),
                    fetch(`/api/lifestyle/settings?token=${token}`)
                ])
                if (goalsRes.ok) {
                    const data = await goalsRes.json()
                    setGoals(data.data || [])
                }
                if (lifeRes.ok) {
                    const data = await lifeRes.json()
                    setLifestyleSettings(data.data || null)
                }
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [token])

    const planHistory = useMemo(() => {
        if (!goals.length) return []
        return [...goals].sort((a, b) => a.start_date.localeCompare(b.start_date)).map(g => {
            const p_cal = (g.protein || 0) * 4
            const f_cal = (g.fat || 0) * 9
            // Adjust c_cal to fill the gap to the total calories target
            const c_cal = g.calories - (p_cal + f_cal)
            
            return {
                date: g.start_date,
                displayDate: `${parseInt(g.start_date.split('-')[1], 10)}/${parseInt(g.start_date.split('-')[2], 10)}`,
                calories: g.calories,
                p: g.protein,
                f: g.fat,
                c: g.carbs,
                p_cal,
                f_cal,
                c_cal,
                sugar: g.sugar ?? Math.max(0, (g.carbs || 0) - (g.fiber || 20)),
                fiber: g.fiber || 20,
                salt: g.salt
            }
        })
    }, [goals])

    const currentGoal = planHistory[planHistory.length - 1]
    const reversedHistory = [...planHistory].reverse()

    if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>

    return (
        <div className="space-y-8 animate-fadeIn pb-24">
            {/* 1. Current Plan Overview */}
            <Card padding="lg">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-5 bg-brand-500 rounded-full"></div>
                            <h3 className="text-xl font-normal text-text-primary">現在の目標設定</h3>
                        </div>
                        <p className="text-[10px] font-normal text-text-muted uppercase tracking-widest">目標数値の詳細</p>
                    </div>
                    <div className="px-4 py-1.5 bg-brand-500/15 rounded-full">
                        <span className="text-[10px] font-normal text-brand-300">最終更新: {currentGoal?.date}</span>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Diet Section */}
                    <div className="space-y-4">
                        <p className="text-xs font-normal text-text-muted pl-2">食事・栄養の目標</p>
                        <div className="bg-surface-base rounded-3xl p-6 flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-xs font-normal text-text-muted mb-1">目標摂取カロリー</p>
                                <div className="flex items-baseline gap-1 justify-center">
                                    <span className="text-4xl font-normal text-text-primary">{currentGoal?.calories.toLocaleString()}</span>
                                    <span className="text-sm font-normal text-text-muted">kcal / 日</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <PFCStatCard label="タンパク質" value={currentGoal?.p} unit="g" color="amber" />
                            <PFCStatCard label="脂質" value={currentGoal?.f} unit="g" color="purple" />
                            <PFCStatCard label="炭水化物" value={currentGoal?.c} unit="g" color="blue" />
                            <PFCStatCard label="糖質" value={currentGoal?.sugar} unit="g" color="purple" />
                            <PFCStatCard label="食物繊維" value={currentGoal?.fiber} unit="g" color="teal" />
                            <PFCStatCard label="塩分" value={currentGoal?.salt} unit="g" color="gray" />
                        </div>
                    </div>

                    {/* Lifestyle Section */}
                    <div className="space-y-4 pt-4 border-t border-border-subtle">
                        <p className="text-xs font-normal text-text-muted pl-2">生活習慣の目標</p>
                        <div className="grid grid-cols-2 gap-4">
                            <PFCStatCard label="水分摂取" value={lifestyleSettings?.habit_targets?.water} unit="L" color="sky" />
                            <PFCStatCard label="目標歩数" value={lifestyleSettings?.habit_targets?.steps} unit="歩" color="cyan" />
                            <PFCStatCard label="筋トレ回数" value={lifestyleSettings?.habit_targets?.workout} unit="回/週" color="orange" />
                            <PFCStatCard label="睡眠時間" value={lifestyleSettings?.habit_targets?.sleep} unit="時間" color="violet" />
                        </div>
                    </div>
                </div>
            </Card>

            {/* 2. Goal Transition Chart */}
            <Card padding="lg">
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-5 bg-brand-600 rounded-full"></div>
                        <h3 className="text-xl font-normal text-text-primary">目標カロリーの推移</h3>
                    </div>
                    <p className="text-[10px] font-normal text-text-muted uppercase tracking-widest">PFCバランスの推移 (kcal換算)</p>
                </div>

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={planHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                            <XAxis 
                                dataKey="displayDate" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 700, fill: '#a1a1aa' }} 
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 700, fill: '#a1a1aa' }} 
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                formatter={(value: any, name: any) => [`${Math.round(value)} kcal`, name]}
                            />
                            <Bar dataKey="c_cal" name="炭水化物" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={24} />
                            <Bar dataKey="f_cal" name="脂質" stackId="a" fill="#a855f7" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="p_cal" name="タンパク質" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 flex justify-center gap-6">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div><span className="text-[10px] font-normal text-text-secondary">P</span></div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div><span className="text-[10px] font-normal text-text-secondary">F</span></div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div><span className="text-[10px] font-normal text-text-secondary">C</span></div>
                </div>
            </Card>

            {/* 3. Detailed Goal History Table */}
            <Card padding="lg" className="overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                    <div className="w-1.5 h-5 bg-surface-overlay rounded-full"></div>
                    <h3 className="text-xl font-normal text-text-primary">目標設定の履歴</h3>
                </div>
                
                <div className="overflow-x-auto -mx-8 px-8">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border-subtle">
                                <th className="py-4 text-[10px] font-normal text-text-muted uppercase tracking-widest text-center">開始日</th>
                                <th className="py-4 text-[10px] font-normal text-text-muted uppercase tracking-widest text-center">カロリー</th>
                                <th className="py-4 text-[10px] font-normal text-text-muted uppercase tracking-widest text-center">P / F / C</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {reversedHistory.map((h, i) => {
                                const [y, m, d] = h.date.split('-')
                                const shortDate = `${y.slice(2)}/${parseInt(m, 10)}/${parseInt(d, 10)}`
                                return (
                                    <tr key={i} className="group hover:bg-surface-base/50 transition-colors">
                                        <td className="py-4 text-xs font-normal text-text-secondary whitespace-nowrap text-center">{shortDate}</td>
                                        <td className="py-4 text-xs font-normal text-text-primary text-center">
                                            {h.calories.toLocaleString()}<span className="text-[10px] font-normal text-text-muted ml-0.5">kcal</span>
                                        </td>
                                        <td className="py-4 text-xs font-normal text-text-secondary text-center">
                                            {h.p}/{h.f}/{h.c}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}

function PFCStatCard({ label, value, unit, color }: { label: string, value: number, unit: string, color: string }) {
    const colorMap: any = {
        amber: 'text-amber-500 bg-amber-50',
        cyan: 'text-cyan-500 bg-cyan-50',
        blue: 'text-blue-500 bg-blue-50',
        purple: 'text-purple-500 bg-purple-50',
        teal: 'text-teal-500 bg-teal-50',
        gray: 'text-text-secondary bg-surface-base',
        sky: 'text-sky-500 bg-sky-50',
        orange: 'text-orange-500 bg-orange-50',
        violet: 'text-violet-500 bg-violet-50'
    }

    return (
        <div className="bg-surface-base rounded-3xl p-5 border border-transparent hover:border-border-strong transition-all">
            <p className="text-[10px] font-normal text-text-muted mb-2 uppercase tracking-widest">{label}</p>
            <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-normal ${colorMap[color]?.split(' ')[0]}`}>{value || 0}</span>
                <span className="text-[10px] font-normal text-text-muted">{unit}</span>
            </div>
        </div>
    )
}
