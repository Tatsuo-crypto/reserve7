'use client'

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Member } from '@/types'
import { 
    ComposedChart,
    Bar,
    LineChart,
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Legend,
    BarChart
} from 'recharts'

// Reusing some logic from members page
import { getStatusDotColor } from '@/lib/utils/member'

const GOAL_SUGGESTIONS = [
    'お酒を週2回までにする',
    'お菓子を控える',
    '寝る前1時間はスマホを見ない',
    '揚げ物を控える',
    '21時以降は食べない',
    'ジュースを控える',
    '週3回以上運動する',
    '湯船に浸かる'
]

// TARGET CONSTANTS
const DEFAULT_PROTEIN = 100;
const DEFAULT_FAT = 40;
const DEFAULT_CARBS = 300;
const DEFAULT_FIBER = 20;
const DEFAULT_SALT = 6;

type TabType = 'goals' | 'analysis' | 'weekly';
type PeriodType = '1w' | '1m' | '3m' | '6m' | '1y' | 'all';

function DietPlanPageContent() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [members, setMembers] = useState<Member[]>([])
    const [loadingMembers, setLoadingMembers] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedMember, setSelectedMember] = useState<Member | null>(null)
    
    const [loadingData, setLoadingData] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [activeTab, setActiveTab] = useState<TabType>('goals')
    const [isSettingNewGoal, setIsSettingNewGoal] = useState(false)
    const [analysisPeriod, setAnalysisPeriod] = useState<PeriodType>('1m')
    const [showWeightAvg, setShowWeightAvg] = useState(false)
    const [isWeightListOpen, setIsWeightListOpen] = useState(false)

    const today = new Date().toISOString().split('T')[0];

    const [nutrientForm, setNutrientForm] = useState({
        protein: DEFAULT_PROTEIN,
        fat: DEFAULT_FAT,
        carbs: DEFAULT_CARBS,
        fiber: DEFAULT_FIBER,
        salt: DEFAULT_SALT,
        startDate: today
    })

    const [lifestyleSettings, setLifestyleSettings] = useState({
        visible_items: { steps: true, sleep: true, water: true },
        visible_tabs: { input: true, analyze: true, progress: true }
    })

    const [habitTargets, setHabitTargets] = useState({
        steps: 8000,
        water: 2.0,
        sleep: 7.0
    })

    const [quitGoals, setQuitGoals] = useState<string[]>([])
    const [newQuitGoal, setNewQuitGoal] = useState('')

    // Analysis data
    const [dietHistory, setDietHistory] = useState<any[]>([])
    const [weightHistory, setWeightHistory] = useState<any[]>([])
    const [lifestyleHistory, setLifestyleHistory] = useState<any[]>([])
    const [intakeHistory, setIntakeHistory] = useState<any[]>([])

    const fetchMemberData = useCallback(async (userId: string, token: string) => {
        setLoadingData(true)
        try {
            const [dietRes, lifestyleRes, trackingRes, logsRes] = await Promise.all([
                fetch(`/api/diet/goals?token=${token}`),
                fetch(`/api/lifestyle/settings?userId=${userId}`),
                fetch(`/api/admin/member-tracking/${userId}`),
                fetch(`/api/diet/logs?token=${token}`)
            ])

            if (dietRes.ok) {
                const { data } = await dietRes.json()
                setDietHistory(data || [])
                if (data && data.length > 0) {
                    const latest = data[0]
                    const isOldPreset = latest.protein === 100 && latest.fat === 60 && latest.carbs === 265;
                    setNutrientForm(prev => ({
                        ...prev,
                        protein: isOldPreset ? DEFAULT_PROTEIN : latest.protein,
                        fat: isOldPreset ? DEFAULT_FAT : latest.fat,
                        carbs: isOldPreset ? DEFAULT_CARBS : latest.carbs,
                        fiber: isOldPreset ? DEFAULT_FIBER : (latest.fiber || 20),
                        salt: isOldPreset ? DEFAULT_SALT : (latest.salt || 6),
                        startDate: today
                    }))
                }
            }

            if (lifestyleRes.ok) {
                const { data } = await lifestyleRes.json()
                if (data) {
                    setLifestyleSettings({
                        visible_items: data.visible_items || { steps: true, sleep: true, water: true },
                        visible_tabs: data.visible_tabs || { input: true, analyze: true, progress: true }
                    })
                    if (data.quit_goals) setQuitGoals(data.quit_goals)
                    if (data.habit_targets) setHabitTargets(data.habit_targets)
                }
            }

            if (trackingRes.ok) {
                const json = await trackingRes.json()
                setWeightHistory(json.data?.weightRecords || [])
                setLifestyleHistory(json.data?.lifestyleLogs || [])
            }

            if (logsRes.ok) {
                const { data } = await logsRes.json()
                setIntakeHistory(data || [])
            }
        } catch (error) {
            console.error('Fetch member data error:', error)
        } finally {
            setLoadingData(false)
        }
    }, [today])

    // Fetch members
    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const response = await fetch('/api/admin/members?diet_only=true')
                if (response.ok) {
                    const result = await response.json()
                    const data = result.data || result
                    setMembers(data.members || [])
                }
            } catch (error) {
                console.error('Fetch members error:', error)
            } finally {
                setLoadingMembers(false)
            }
        }
        if (status === 'authenticated') {
            fetchMembers()
        }
    }, [status])

    // Fetch member specific data when selected
    useEffect(() => {
        if (selectedMember) {
            fetchMemberData(selectedMember.id, selectedMember.access_token || '')
        }
    }, [selectedMember, fetchMemberData])

    // Calculate calories
    const pKcal = nutrientForm.protein * 4;
    const fKcal = nutrientForm.fat * 9;
    const cKcal = nutrientForm.carbs * 4;
    const fiberKcal = nutrientForm.fiber * 2;
    const totalKcal = pKcal + fKcal + cKcal + fiberKcal;

    const pPct = totalKcal > 0 ? Math.round((pKcal / totalKcal) * 100) : 0;
    const fPct = totalKcal > 0 ? Math.round((fKcal / totalKcal) * 100) : 0;
    const fiberPct = totalKcal > 0 ? Math.round((fiberKcal / totalKcal) * 100) : 0;
    const cPct = totalKcal > 0 ? Math.max(0, 100 - pPct - fPct - fiberPct) : 0;

    const handleSave = async () => {
        if (!selectedMember) return
        setSaving(true)
        setMessage('')
        try {
            const { startDate, ...nutrients } = nutrientForm
            const dietSave = fetch(`/api/diet/goals?token=${selectedMember.access_token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...nutrients, 
                    calories: totalKcal,
                    startDate: startDate 
                })
            })

            const lifestyleSave = fetch('/api/lifestyle/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedMember.id,
                    visibleItems: lifestyleSettings.visible_items,
                    visibleTabs: lifestyleSettings.visible_tabs,
                    quit_goals: quitGoals,
                    habit_targets: habitTargets
                })
            })

            const [dietRes, lifestyleRes] = await Promise.all([dietSave, lifestyleSave])

            if (dietRes.ok && lifestyleRes.ok) {
                setMessage('ダイエットプランを保存しました')
                fetchMemberData(selectedMember.id, selectedMember.access_token || '')
                setTimeout(() => setMessage(''), 3000)
            } else {
                setMessage('保存に一部失敗しました')
            }
        } catch (error) {
            console.error('Save error:', error)
            setMessage('エラーが発生しました')
        } finally {
            setSaving(false)
        }
    }

    const handleEditHistory = (record: any) => {
        setNutrientForm({
            protein: record.protein,
            fat: record.fat,
            carbs: record.carbs,
            fiber: record.fiber || 20,
            salt: record.salt || 6,
            startDate: record.start_date
        })
        setActiveTab('goals')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleDeleteHistory = async (id: string) => {
        if (!confirm('この設定履歴を削除してもよろしいですか？')) return
        try {
            const response = await fetch(`/api/diet/goals/${id}?token=${selectedMember?.access_token}`, {
                method: 'DELETE'
            })
            if (response.ok) {
                setMessage('履歴を削除しました')
                fetchMemberData(selectedMember!.id, selectedMember!.access_token || '')
                setTimeout(() => setMessage(''), 3000)
            }
        } catch (error) {
            console.error('Delete history error:', error)
        }
    }

    const handleGramChange = (key: 'protein' | 'fat' | 'carbs' | 'fiber' | 'salt', delta: number) => {
        setNutrientForm(prev => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }))
    }

    const handleKcalChange = (key: 'protein' | 'fat' | 'carbs' | 'fiber', delta: number) => {
        const factor = key === 'fat' ? 9 : key === 'fiber' ? 2 : 4;
        const currentKcal = nutrientForm[key] * factor;
        const newKcal = Math.max(0, currentKcal + delta);
        setNutrientForm(prev => ({ ...prev, [key]: Math.round(newKcal / factor) }))
    }

    const handlePctChange = (key: 'protein' | 'fat' | 'carbs', delta: number) => {
        if (totalKcal === 0) return;
        const factor = key === 'fat' ? 9 : 4;
        const currentPct = Math.round(((nutrientForm[key] * factor) / totalKcal) * 100);
        const newPct = Math.max(0, currentPct + delta);
        const newGram = Math.round((totalKcal * (newPct / 100)) / factor);
        setNutrientForm(prev => ({ ...prev, [key]: newGram }))
    }

    const processedWeightData = useMemo(() => {
        if (weightHistory.length === 0 && lifestyleHistory.length === 0) return [];

        // 1. Get date range
        const weightDates = weightHistory.map(r => r.recorded_date);
        const lifestyleDates = lifestyleHistory.map(r => r.date);
        const intakeDates = intakeHistory.map(r => r.date);
        const allDates = Array.from(new Set([...weightDates, ...lifestyleDates, ...intakeDates])).sort();
        
        if (allDates.length === 0) return [];

        const latestDataDate = new Date(allDates[allDates.length - 1]);
        const start = new Date(allDates[0]);
        const end = new Date(); // Default end is today
        
        // 2. Fill daily map
        const dailyMap: { [key: string]: any } = {};
        const current = new Date(start);
        while (current <= end) {
            const dStr = current.toISOString().split('T')[0];
            dailyMap[dStr] = { recorded_date: dStr, weight_kg: null, steps: null };
            current.setDate(current.getDate() + 1);
        }
        
        // Merge weight records
        weightHistory.forEach(r => {
            if (dailyMap[r.recorded_date]) {
                dailyMap[r.recorded_date].weight_kg = r.weight_kg;
            }
        });

        // Merge lifestyle logs (Client entries) - Prioritize weight from client logs if exists
        lifestyleHistory.forEach(r => {
            if (dailyMap[r.date]) {
                if (r.weight) dailyMap[r.date].weight_kg = r.weight;
                if (r.steps) dailyMap[r.date].steps = r.steps;
            }
        });
        
        let result = Object.values(dailyMap).sort((a: any, b: any) => a.recorded_date.localeCompare(b.recorded_date));

        // 3. Apply rolling average for weight if needed
        if (showWeightAvg) {
            result = result.map((d: any, i, arr) => {
                const window = arr.slice(Math.max(0, i - 6), i + 1);
                const weights = window.map(w => w.weight_kg).filter(w => w != null);
                const avgWeight = weights.length > 0 ? weights.reduce((acc, curr) => acc + curr, 0) / weights.length : null;
                return { ...d, weight_kg: avgWeight ? Number(avgWeight.toFixed(1)) : null };
            });
        }

        // 4. Apply period filter
        if (analysisPeriod !== 'all') {
            const filterEnd = (analysisPeriod === '1w') ? new Date(latestDataDate) : new Date();
            const filterStart = new Date(filterEnd);
            
            if (analysisPeriod === '1w') filterStart.setDate(filterEnd.getDate() - 6);
            else if (analysisPeriod === '1m') filterStart.setMonth(filterEnd.getMonth() - 1);
            else if (analysisPeriod === '3m') filterStart.setMonth(filterEnd.getMonth() - 3);
            else if (analysisPeriod === '6m') filterStart.setMonth(filterEnd.getMonth() - 6);
            else if (analysisPeriod === '1y') filterStart.setFullYear(filterEnd.getFullYear() - 1);
            
            const startStr = filterStart.toISOString().split('T')[0];
            const endStr = filterEnd.toISOString().split('T')[0];
            
            result = result.filter(r => r.recorded_date >= startStr && r.recorded_date <= endStr);
        }

        return result;
    }, [weightHistory, lifestyleHistory, intakeHistory, analysisPeriod, showWeightAvg]);

    const weeklyStats = useMemo(() => {
        if (!intakeHistory.length || !dietHistory.length) return null;

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
        const thisWeekLogs = intakeHistory.filter(log => {
            const logDate = new Date(log.date);
            return logDate >= monday && logDate <= sunday;
        });

        // 3. Get target for this week (latest setting)
        const target = dietHistory[0];
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
    }, [intakeHistory, dietHistory]);

    const analysisData = useMemo(() => {
        if (!intakeHistory.length && !lifestyleHistory.length && !weightHistory.length) return [];

        // 1. Get latest date across all data
        const allDates = [
            ...intakeHistory.map(l => l.date), 
            ...lifestyleHistory.map(l => l.date),
            ...weightHistory.map(w => w.recorded_date)
        ].sort();
        
        if (allDates.length === 0) return [];
        const latestDataDate = new Date(allDates[allDates.length - 1]);

        // 2. Determine range based on analysisPeriod
        const filterEnd = (analysisPeriod === '1w') ? new Date(latestDataDate) : new Date();
        const filterStart = new Date(filterEnd);

        if (analysisPeriod === '1w') filterStart.setDate(filterEnd.getDate() - 6);
        else if (analysisPeriod === '1m') filterStart.setMonth(filterEnd.getMonth() - 1);
        else if (analysisPeriod === '3m') filterStart.setMonth(filterEnd.getMonth() - 3);
        else if (analysisPeriod === '6m') filterStart.setMonth(filterEnd.getMonth() - 6);
        else if (analysisPeriod === '1y') filterStart.setFullYear(filterEnd.getFullYear() - 1);
        else if (analysisPeriod === 'all') {
            filterStart.setTime(new Date(allDates[0]).getTime());
        }

        const data: any[] = [];
        const current = new Date(filterStart);
        const limit = new Date(filterEnd);
        
        while (current <= limit) {
            const dStr = current.toISOString().split('T')[0];
            
            // Find intake
            const intake = intakeHistory.find(l => l.date === dStr);
            // Find lifestyle
            const lifestyle = lifestyleHistory.find(l => l.date === dStr);
            // Find target (latest setting before or on this date)
            const target = [...dietHistory].reverse().find(t => t.start_date <= dStr) || dietHistory[dietHistory.length - 1];

            data.push({
                date: dStr,
                calories: intake?.calories || 0,
                protein_kcal: (intake?.protein || 0) * 4,
                fat_kcal: (intake?.fat || 0) * 9,
                carbs_kcal: (intake?.carbs || 0) * 4,
                target_calories: target?.calories || 0,
                steps: lifestyle?.steps || 0,
                sleep: lifestyle?.sleep_hours || 0,
                water: lifestyle?.water_liters || 0,
            });
            current.setDate(current.getDate() + 1);
        }

        return data;
    }, [intakeHistory, lifestyleHistory, weightHistory, dietHistory, analysisPeriod]);

    const dietChartData = useMemo(() => {
        const baseData = [...dietHistory].reverse().map(record => ({
            ...record,
            protein_kcal: record.protein * 4,
            fat_kcal: record.fat * 9,
            carbs_kcal: record.carbs * 4,
            fiber_kcal: (record.fiber || 20) * 2
        }));

        return baseData;
    }, [dietHistory]);

    const [chartView, setChartView] = useState<'all' | 'p' | 'f' | 'c'>('all');

    if (status === 'loading' || loadingMembers) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
            </div>
        )
    }

    const filteredMembers = members.filter(m => 
        m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 py-4 sm:py-6 text-gray-900">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="mb-6 sm:mb-8 text-center relative">
                    <button
                        onClick={() => selectedMember ? setSelectedMember(null) : router.push('/dashboard')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-full transition-all shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight inline-block">ダイエットプラン作成</h1>
                </div>

                {!selectedMember ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-rose-50/30">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="w-2 h-6 bg-rose-500 rounded-full"></span>
                                ① 会員を選択
                            </h2>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="名前やメールアドレスで検索..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all shadow-sm"
                                />
                                <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                            {filteredMembers.map(member => (
                                <button
                                    key={member.id}
                                    onClick={() => setSelectedMember(member)}
                                    className="w-full flex items-center px-6 py-4 hover:bg-rose-50 transition-colors group"
                                >
                                    <div className="flex-1 flex items-center gap-3 text-left">
                                        <span className={`w-2 h-2 rounded-full ${getStatusDotColor(member.status)}`} />
                                        <div>
                                            <div className="font-bold group-hover:text-rose-700 transition-colors">{member.full_name}</div>
                                            <div className="text-xs text-gray-500">{member.email}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full group-hover:bg-rose-100 group-hover:text-rose-600 transition-all">選択</div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
                        {/* Member Status Bar */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-center relative">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center text-rose-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div className="text-lg font-black text-center">{selectedMember.full_name} 様</div>
                            </div>
                            <button onClick={() => setSelectedMember(null)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 hover:text-gray-600 underline">変更する</button>
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm sticky top-2 z-20 gap-1 overflow-x-auto">
                            {[
                                { id: 'goals', label: '目標' },
                                { id: 'analysis', label: '分析' },
                                { id: 'weekly', label: '今週' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabType)}
                                    className={`flex-1 py-3 px-2 min-w-[80px] rounded-xl text-[10px] sm:text-xs font-black transition-all ${activeTab === tab.id ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {loadingData && (
                            <div className="flex justify-center py-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
                            </div>
                        )}

                        {!loadingData && activeTab === 'goals' && (
                            <div className="space-y-6 pb-20 animate-fadeIn">
                                {/* Set New Goal Toggle Button */}
                                <div className="flex justify-center">
                                    <button 
                                        onClick={() => setIsSettingNewGoal(!isSettingNewGoal)}
                                        className={`w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-md border ${isSettingNewGoal ? 'bg-white border-gray-200 text-gray-500' : 'bg-gray-900 border-gray-900 text-white hover:bg-black'}`}
                                    >
                                        {isSettingNewGoal ? (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                入力を閉じる
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                                新しい目標を設定
                                            </>
                                        )}
                                    </button>
                                </div>

                                {isSettingNewGoal && (
                                    <div className="space-y-6 bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm animate-slideDown">
                                        <div className="space-y-6">
                                            <h2 className="text-lg font-black flex items-center gap-2"><span className="w-2 h-6 bg-blue-500 rounded-full"></span>① カロリー・PFC設定</h2>
                                            <div className="space-y-6">
                                                <div className="bg-gray-50/50 p-4 sm:p-5 rounded-2xl border border-gray-100 space-y-3 text-center">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">適用開始日</label>
                                                    <div className="flex justify-center">
                                                        <input type="date" value={nutrientForm.startDate} onChange={e => setNutrientForm({ ...nutrientForm, startDate: e.target.value })} className="bg-white border border-gray-200 rounded-xl px-10 py-3 font-black text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-center text-lg min-w-[240px]" />
                                                    </div>
                                                </div>
                                                <div className="bg-blue-50/30 p-5 sm:p-6 rounded-2xl border border-blue-100 flex flex-col items-center justify-center gap-1">
                                                    <div className="text-[10px] font-black text-blue-300 uppercase tracking-widest">合計カロリー</div>
                                                    <div className="flex items-baseline gap-1.5"><span className="text-4xl sm:text-5xl font-black text-blue-600 tabular-nums">{totalKcal}</span><span className="text-lg font-black text-blue-400">kcal</span></div>
                                                </div>
                                                <NutrientCard label="P (タンパク質)" grams={nutrientForm.protein} kcal={pKcal} pct={pPct} onGramChange={(d) => handleGramChange('protein', d)} onKcalChange={(d) => handleKcalChange('protein', d)} onPctChange={(d) => handlePctChange('protein', d)} color="rose" />
                                                <NutrientCard label="F (脂質)" grams={nutrientForm.fat} kcal={fKcal} pct={fPct} onGramChange={(d) => handleGramChange('fat', d)} onKcalChange={(d) => handleKcalChange('fat', d)} onPctChange={(d) => handlePctChange('fat', d)} color="amber" />
                                                <NutrientCard label="C (炭水化物)" grams={nutrientForm.carbs} kcal={cKcal} pct={cPct} onGramChange={(d) => handleGramChange('carbs', d)} onKcalChange={(d) => handleKcalChange('carbs', d)} onPctChange={(d) => handlePctChange('carbs', d)} color="emerald" />
                                                <NutrientCard label="食物繊維" grams={nutrientForm.fiber} kcal={fiberKcal} onGramChange={(d) => handleGramChange('fiber', d)} onKcalChange={(d) => handleKcalChange('fiber', d)} color="teal" showPct={false} />
                                                <NutrientCard label="塩分" grams={nutrientForm.salt} onGramChange={(d) => handleGramChange('salt', d)} color="gray" showKcal={false} showPct={false} />
                                            </div>
                                        </div>
                                        <div className="space-y-6 pt-6 border-t border-gray-100">
                                            <h2 className="text-lg font-black flex items-center gap-2"><span className="w-2 h-6 bg-teal-500 rounded-full"></span>② 習慣設定</h2>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <HabitConfig label="歩数" unit="歩" active={lifestyleSettings.visible_items.steps} target={habitTargets.steps} onToggle={() => setLifestyleSettings({ ...lifestyleSettings, visible_items: { ...lifestyleSettings.visible_items, steps: !lifestyleSettings.visible_items.steps } })} onTargetChange={(v) => setHabitTargets({...habitTargets, steps: v})} step={500} />
                                                <HabitConfig label="水分" unit="L" active={lifestyleSettings.visible_items.water} target={habitTargets.water} onToggle={() => setLifestyleSettings({ ...lifestyleSettings, visible_items: { ...lifestyleSettings.visible_items, water: !lifestyleSettings.visible_items.water } })} onTargetChange={(v) => setHabitTargets({...habitTargets, water: v})} step={0.1} />
                                                <HabitConfig label="睡眠" unit="時間" active={lifestyleSettings.visible_items.sleep} target={habitTargets.sleep} onToggle={() => setLifestyleSettings({ ...lifestyleSettings, visible_items: { ...lifestyleSettings.visible_items, sleep: !lifestyleSettings.visible_items.sleep } })} onTargetChange={(v) => setHabitTargets({...habitTargets, sleep: v})} step={0.5} />
                                            </div>
                                        </div>
                                        <div className="space-y-6 pt-6 border-t border-gray-100">
                                            <h2 className="text-lg font-black flex items-center gap-2"><span className="w-2 h-6 bg-rose-500 rounded-full"></span>③ その他の目標</h2>
                                            <div className="space-y-6">
                                                <div className="flex flex-wrap gap-2">
                                                    {GOAL_SUGGESTIONS.map(suggestion => (
                                                        <button key={suggestion} onClick={() => quitGoals.includes(suggestion) ? setQuitGoals(quitGoals.filter(g => g !== suggestion)) : setQuitGoals([...quitGoals, suggestion])} className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${quitGoals.includes(suggestion) ? 'bg-rose-500 border-rose-500 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}>{suggestion}</button>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2 border-t border-gray-100 pt-6">
                                                    <input type="text" placeholder="自由に追加..." value={newQuitGoal} onChange={(e) => setNewQuitGoal(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addQuitGoal())} className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-rose-500" />
                                                    <button onClick={addQuitGoal} className="bg-rose-500 text-white px-4 py-2 rounded-xl font-black text-sm hover:bg-rose-600 transition-colors shadow-lg">追加</button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {quitGoals.map((goal, index) => (
                                                        <div key={index} className="flex items-center justify-between bg-rose-50/30 px-4 py-2.5 rounded-xl border border-rose-100">
                                                            <span className="font-black text-rose-900 text-sm">{goal}</span>
                                                            <button onClick={() => setQuitGoals(quitGoals.filter((_, i) => i !== index))} className="text-rose-300 hover:text-rose-600">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-center pt-2">
                                            <button onClick={handleSave} disabled={saving} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2">{saving ? '保存中...' : 'プランを保存する'}</button>
                                        </div>
                                    </div>
                                )}

                                {/* History Section (Only visible when NOT setting a new goal) */}
                                {!isSettingNewGoal && (
                                    dietHistory.length > 0 ? (
                                        <div className="space-y-6">
                                            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <h2 className="text-lg font-black flex items-center gap-2"><span className="w-2 h-6 bg-rose-500 rounded-full"></span>目標設定の推移</h2>
                                                    <div className="flex bg-gray-100 p-1 rounded-xl">
                                                        {[
                                                            { label: 'PFC全て', value: 'all' },
                                                            { label: 'Pのみ', value: 'p' },
                                                            { label: 'Fのみ', value: 'f' },
                                                            { label: 'Cのみ', value: 'c' }
                                                        ].map(v => (
                                                            <button 
                                                                key={v.value} 
                                                                onClick={() => setChartView(v.value as any)}
                                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${chartView === v.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                            >
                                                                {v.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="h-[300px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <ComposedChart data={dietChartData}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                            <XAxis dataKey="start_date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                                            <Tooltip 
                                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} 
                                                                itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                                                            />
                                                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 700 }} />
                                                            
                                                            {(chartView === 'all' || chartView === 'p') && (
                                                                <Bar dataKey="protein_kcal" name="P" stackId={chartView === 'all' ? 'a' : undefined} fill="#fbbf24" />
                                                            )}
                                                            {(chartView === 'all' || chartView === 'f') && (
                                                                <Bar dataKey="fat_kcal" name="F" stackId={chartView === 'all' ? 'a' : undefined} fill="#10b981" />
                                                            )}
                                                            {(chartView === 'all' || chartView === 'c') && (
                                                                <Bar dataKey="carbs_kcal" name="C" stackId={chartView === 'all' ? 'a' : undefined} fill="#3b82f6" />
                                                            )}
                                                            
                                                            <Line type="monotone" dataKey="calories" name="設定カロリー" stroke="#f43f5e" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                                                        </ComposedChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                                    <h2 className="text-lg font-black flex items-center gap-2"><span className="w-2 h-6 bg-gray-900 rounded-full"></span>設定履歴一覧</h2>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm text-left">
                                                        <thead>
                                                            <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                                                <th className="px-6 py-4">日付</th>
                                                                <th className="px-6 py-4 text-center">カロリー</th>
                                                                <th className="px-6 py-4 text-center">PFC</th>
                                                                <th className="px-6 py-4 text-right">操作</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {dietHistory.map((record) => (
                                                                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                                                    <td className="px-6 py-4 font-bold text-xs">{record.start_date}</td>
                                                                    <td className="px-6 py-4 text-center font-black text-rose-600">{record.calories}kcal</td>
                                                                    <td className="px-6 py-4 text-center font-black text-gray-400 text-[10px]">{record.protein} / {record.fat} / {record.carbs}</td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        <button onClick={() => { handleEditHistory(record); setIsSettingNewGoal(true); }} className="text-blue-500 hover:text-blue-700 font-bold text-xs underline">編集</button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-12 text-center text-gray-400 font-bold italic border-2 border-dashed border-gray-100 rounded-2xl">履歴がありません</div>
                                    )
                                )}
                            </div>
                        )}

                        {!loadingData && activeTab === 'analysis' && (
                            <div className="space-y-6 pb-20 animate-fadeIn">
                                {/* Period & Avg Selector */}
                                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-[72px] z-10">
                                    <select
                                        value={analysisPeriod}
                                        onChange={(e) => setAnalysisPeriod(e.target.value as PeriodType)}
                                        className="w-full sm:w-auto bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold outline-none"
                                    >
                                        <option value="1w">7日間</option>
                                        <option value="1m">1ヶ月</option>
                                        <option value="3m">3ヶ月</option>
                                        <option value="6m">6ヶ月</option>
                                        <option value="1y">1年</option>
                                        <option value="all">すべて</option>
                                    </select>
                                    <select
                                        value={showWeightAvg ? 'week' : 'day'}
                                        onChange={(e) => setShowWeightAvg(e.target.value === 'week')}
                                        className="w-full sm:w-auto bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold outline-none"
                                    >
                                        <option value="day">日</option>
                                        <option value="week">週平均</option>
                                    </select>
                                </div>

                                {/* Weight Chart */}
                                <AnalysisChartCard title="体重推移" color="blue">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={processedWeightData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="recorded_date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                            <YAxis axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                                            <Line type="monotone" dataKey="weight_kg" name="体重" stroke="#3b82f6" strokeWidth={4} dot={!showWeightAvg ? { r: 4, strokeWidth: 2, fill: '#fff' } : false} connectNulls />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </AnalysisChartCard>

                                {/* Calorie/PFC Chart */}
                                <AnalysisChartCard title="摂取カロリー・PFC" color="rose">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={analysisData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '10px', fontWeight: 700 }} />
                                            <Bar dataKey="protein_kcal" name="P" stackId="a" fill="#fbbf24" />
                                            <Bar dataKey="fat_kcal" name="F" stackId="a" fill="#10b981" />
                                            <Bar dataKey="carbs_kcal" name="C" stackId="a" fill="#3b82f6" />
                                            <Line type="monotone" dataKey="calories" name="合計摂取" stroke="#f43f5e" strokeWidth={3} dot={false} />
                                            <Line type="monotone" dataKey="target_calories" name="目標" stroke="#e2e8f0" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </AnalysisChartCard>

                                {/* Steps Chart */}
                                <AnalysisChartCard title="歩数" color="emerald">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analysisData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                                            <Bar dataKey="steps" name="歩数" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </AnalysisChartCard>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {/* Sleep Chart */}
                                    <AnalysisChartCard title="睡眠時間" color="indigo">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analysisData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                                                <Bar dataKey="sleep" name="睡眠時間" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </AnalysisChartCard>

                                    {/* Water Chart */}
                                    <AnalysisChartCard title="水分摂取量" color="sky">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analysisData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                                                <Bar dataKey="water" name="水分(L)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </AnalysisChartCard>
                                </div>

                                {/* Weight List (Collapsible) */}
                                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                    <button onClick={() => setIsWeightListOpen(!isWeightListOpen)} className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <h2 className="text-lg font-black flex items-center gap-2"><span className="w-2 h-6 bg-gray-900 rounded-full"></span>体重・歩数記録一覧</h2>
                                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isWeightListOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {isWeightListOpen && (
                                        <div className="overflow-x-auto border-t border-gray-100">
                                            <table className="w-full text-sm text-left">
                                                <thead>
                                                    <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                                        <th className="px-6 py-4">日付</th>
                                                        <th className="px-6 py-4 text-center">体重</th>
                                                        <th className="px-6 py-4 text-center">歩数</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {[...processedWeightData].reverse().map((r, i) => (
                                                        <tr key={i} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 font-bold">{r.recorded_date}</td>
                                                            <td className="px-6 py-4 text-center font-black text-blue-600">{r.weight_kg || '-'} kg</td>
                                                            <td className="px-6 py-4 text-center font-black text-gray-500">{r.steps?.toLocaleString() || '-'} 歩</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {!loadingData && activeTab === 'weekly' && (
                            <div className="space-y-6 pb-20 animate-fadeIn">
                                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-8">
                                    <h2 className="text-xl font-black flex items-center gap-2">
                                        <span className="w-2 h-8 bg-rose-500 rounded-full"></span>
                                        今週の達成状況 (月〜日)
                                    </h2>

                                    {weeklyStats ? (
                                        <div className="grid gap-8">
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
                                    ) : (
                                        <div className="p-12 text-center text-gray-400 font-bold italic border-2 border-dashed border-gray-100 rounded-2xl">今週の記録がありません</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {message && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-8 py-4 rounded-2xl font-black shadow-2xl z-50">{message}</div>}
        </div>
    );

    function addQuitGoal() {
        if (newQuitGoal.trim()) {
            setQuitGoals([...quitGoals, newQuitGoal.trim()])
            setNewQuitGoal('')
        }
    }
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

function WeeklyProgressItem({ label, actual, target, unit, color, perDay }: { label: string, actual: number, target: number, unit: string, color: string, perDay: number }) {
    const pct = Math.min(100, Math.round((actual / target) * 100));
    const colors: Record<string, string> = {
        rose: 'bg-rose-500',
        amber: 'bg-amber-500',
        emerald: 'bg-emerald-500',
        blue: 'bg-blue-500',
    }
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-end">
                <div>
                    <div className="text-sm font-black text-gray-500">{label}</div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black tabular-nums">{actual.toLocaleString()}</span>
                        <span className="text-sm font-black text-gray-400">/ {target.toLocaleString()} {unit}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black text-gray-400">1日目標: {perDay}{unit}</div>
                    <div className={`text-lg font-black tabular-nums ${pct >= 100 ? 'text-emerald-500' : 'text-gray-900'}`}>{pct}%</div>
                </div>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${colors[color]}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[10px] font-bold text-gray-400 text-center italic">(= {perDay} × 7) {unit}</div>
        </div>
    )
}

function NutrientCard({ label, grams, kcal, pct, onGramChange, onKcalChange, onPctChange, color, showKcal = true, showPct = true }: { 
    label: string, grams: number, kcal?: number, pct?: number, onGramChange: (d: number) => void, onKcalChange?: (d: number) => void, onPctChange?: (d: number) => void, color: string, showKcal?: boolean, showPct?: boolean
}) {
    const colorStyles: Record<string, string> = {
        rose: 'text-rose-600 bg-rose-50/30 border-rose-100',
        amber: 'text-amber-600 bg-amber-50/30 border-amber-100',
        emerald: 'text-emerald-600 bg-emerald-50/30 border-emerald-100',
        teal: 'text-teal-600 bg-teal-50/30 border-teal-100',
        gray: 'text-gray-600 bg-gray-50/30 border-gray-100'
    }
    const isThree = showKcal && showPct;
    return (
        <div className={`p-4 rounded-2xl border ${colorStyles[color]} space-y-3 shadow-sm`}>
            <div className="text-base sm:text-lg font-black uppercase tracking-tight">{label}</div>
            <div className={`grid gap-2 ${isThree ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <NutrientControl value={grams} unit="g" onDelta={onGramChange} />
                {showKcal && kcal !== undefined && onKcalChange && <NutrientControl value={kcal} unit="kcal" onDelta={onKcalChange} />}
                {showPct && pct !== undefined && onPctChange && <NutrientControl value={pct} unit="%" onDelta={onPctChange} />}
            </div>
        </div>
    )
}

function NutrientControl({ value, unit, onDelta }: { value: number, unit: string, onDelta: (d: number) => void }) {
    return (
        <div className="bg-white rounded-xl p-2 border border-white flex items-center justify-between shadow-sm">
            <div className="flex-1 flex items-center justify-center gap-1">
                <span className="text-base sm:text-lg font-black tabular-nums">{value}</span>
                <span className="text-[8px] font-bold opacity-30 uppercase">{unit}</span>
            </div>
            <div className="flex flex-col gap-0.5 border-l border-gray-100 pl-2">
                <button onClick={() => onDelta(1)} className="text-gray-300 hover:text-blue-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 15l7-7 7 7" /></svg></button>
                <button onClick={() => onDelta(-1)} className="text-gray-300 hover:text-blue-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 9l-7 7-7-7" /></svg></button>
            </div>
        </div>
    )
}

function HabitConfig({ label, unit, active, target, onToggle, onTargetChange, step }: { label: string, unit: string, active: boolean, target: number, onToggle: () => void, onTargetChange: (v: number) => void, step: number }) {
    return (
        <div className={`p-4 rounded-2xl border-2 transition-all h-full flex flex-col ${active ? 'bg-teal-50 border-teal-200 shadow-md' : 'bg-white border-gray-100 opacity-60'}`}>
            <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-black ${active ? 'text-teal-700' : 'text-gray-400'}`}>{label}</span>
                <button onClick={onToggle} className={`w-10 h-5 rounded-full transition-all relative ${active ? 'bg-teal-500' : 'bg-gray-200'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${active ? 'left-5.5' : 'left-0.5'}`} /></button>
            </div>
            {active && (
                <div className="mt-auto flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-teal-100 shadow-sm">
                    <div className="flex-1 flex items-center justify-center gap-1"><span className="text-lg font-black text-teal-700 tabular-nums">{target}</span><span className="text-[10px] font-bold text-teal-400">{unit}</span></div>
                    <div className="flex flex-col gap-0.5 border-l border-gray-100 pl-3">
                        <button onClick={() => onTargetChange(Number((target + step).toFixed(1)))} className="text-teal-400 hover:text-teal-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 15l7-7 7 7" /></svg></button>
                        <button onClick={() => onTargetChange(Math.max(0, Number((target - step).toFixed(1))))} className="text-teal-400 hover:text-teal-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function DietPlanPage() {
    return (<Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div></div>}><DietPlanPageContent /></Suspense>)
}
