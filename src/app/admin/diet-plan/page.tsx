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
import AdminHeader from '@/app/components/AdminHeader'
import HomeTab from '@/components/diet/HomeTab'
import AnalyzeTab from '@/components/diet/AnalyzeTab'
import ProgressTab from '@/components/diet/ProgressTab'
import GoalModal from '@/components/diet/GoalModal'

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
const DEFAULT_SUGAR = 280; // Added sugar default
const DEFAULT_SALT = 6;

type TabType = 'progress' | 'analyze' | 'plan';
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
    const [activeTab, setActiveTab] = useState<TabType>('progress')
    const [isSettingNewGoal, setIsSettingNewGoal] = useState(false)
    const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null)
    const [analysisPeriod, setAnalysisPeriod] = useState<PeriodType>('1m')
    const [selectedWeek, setSelectedWeek] = useState<string>('')
    const [showWeightAvg, setShowWeightAvg] = useState(false)
    const [isWeightListOpen, setIsWeightListOpen] = useState(false)
    const [sharedState, setSharedState] = useState<any>({
        selectedDate: new Date().toISOString().split('T')[0],
        habits: { workout: 0 }
    })

    const today = new Date().toISOString().split('T')[0];

    const [nutrientForm, setNutrientForm] = useState({
        protein: DEFAULT_PROTEIN,
        fat: DEFAULT_FAT,
        carbs: DEFAULT_CARBS,
        sugar: DEFAULT_SUGAR,
        fiber: DEFAULT_FIBER,
        salt: DEFAULT_SALT,
        targetCalories: 1600, // Added target calories
        startDate: today,
        title: ''
    })

    const [lifestyleSettings, setLifestyleSettings] = useState({
        visible_items: { steps: true, sleep: true, water: true, workout: true },
        visible_tabs: { input: true, analyze: true, progress: true }
    })

    const [habitTargets, setHabitTargets] = useState({
        steps: 8000,
        sleep: 7,
        water: 2,
        workout: 1
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
                const text = await dietRes.text()
                if (text) {
                    const { data } = JSON.parse(text)
                    setDietHistory(data || [])
                    if (data && data.length > 0) {
                        const latest = data[0]
                        const isOldPreset = latest.protein === 100 && latest.fat === 60 && latest.carbs === 265;
                        const calories = latest.calories || 1600;
                        const protein = isOldPreset ? DEFAULT_PROTEIN : latest.protein;
                        const fat = isOldPreset ? DEFAULT_FAT : latest.fat;
                        // Calculate carbs to ensure initial consistency: (Total - P*4 - F*9) / 4
                        const calculatedCarbs = Math.max(0, Math.round((calories - (protein * 4) - (fat * 9)) / 4));
                        const fiber = isOldPreset ? DEFAULT_FIBER : (latest.fiber || 20);
                        const sugar = Math.max(0, calculatedCarbs - fiber);
                        
                        setNutrientForm(prev => ({
                            ...prev,
                            protein,
                            fat,
                            carbs: calculatedCarbs,
                            fiber,
                            sugar,
                            targetCalories: calories,
                            salt: isOldPreset ? DEFAULT_SALT : (latest.salt || 6),
                            startDate: today,
                            title: ''
                        }))
                    }
                }
            }

            if (lifestyleRes.ok) {
                const text = await lifestyleRes.text()
                if (text) {
                    const { data } = JSON.parse(text)
                    if (data) {
                        setLifestyleSettings({
                            visible_items: data.visible_items || { steps: true, sleep: true, water: true, workout: true },
                            visible_tabs: data.visible_tabs || { input: true, analyze: true, progress: true }
                        })
                        if (data.quit_goals) setQuitGoals(data.quit_goals)
                        if (data.habit_targets) setHabitTargets(data.habit_targets)
                    }
                }
            }

            if (trackingRes.ok) {
                const text = await trackingRes.text()
                if (text) {
                    const json = JSON.parse(text)
                    setWeightHistory(json.data?.weightRecords || [])
                    setLifestyleHistory(json.data?.lifestyleLogs || [])
                }
            }

            if (logsRes.ok) {
                const text = await logsRes.text()
                if (text) {
                    const { data } = JSON.parse(text)
                    setIntakeHistory(data || [])
                }
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
                    const text = await response.text()
                    if (text) {
                        const result = JSON.parse(text)
                        const data = result.data || result
                        const fetchedMembers = data.members || []
                        setMembers(fetchedMembers)
                        
                        // Auto-select member if userId is in URL
                        const userId = searchParams.get('userId')
                        if (userId) {
                            const member = fetchedMembers.find((m: Member) => m.id === userId)
                            if (member) {
                                setSelectedMember(member)
                            }
                        }
                    }
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
    }, [status, searchParams])

    // Fetch member specific data when selected
    useEffect(() => {
        if (selectedMember) {
            fetchMemberData(selectedMember.id, selectedMember.access_token || '')
        }
    }, [selectedMember, fetchMemberData])

    // Calculate calories
    const pKcal = nutrientForm.protein * 4;
    const fKcal = nutrientForm.fat * 9;
    const sugarKcal = nutrientForm.sugar * 4;
    const fiberKcal = nutrientForm.fiber * 2;
    const cKcal = sugarKcal + fiberKcal;
    const totalKcal = pKcal + fKcal + sugarKcal + fiberKcal;

    const pPct = totalKcal > 0 ? Math.round((pKcal / totalKcal) * 100) : 0;
    const fPct = totalKcal > 0 ? Math.round((fKcal / totalKcal) * 100) : 0;
    const cPct = totalKcal > 0 ? Math.max(0, 100 - pPct - fPct) : 0;
    const fiberPct = totalKcal > 0 ? Math.round((fiberKcal / totalKcal) * 100) : 0;

    const handleSave = async () => {
        if (!selectedMember) return
        setSaving(true)
        setMessage('')
        try {
            const dietSave = fetch(`/api/diet/goals?token=${selectedMember.access_token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    protein: nutrientForm.protein,
                    fat: nutrientForm.fat,
                    carbs: nutrientForm.carbs,
                    sugar: nutrientForm.sugar,
                    fiber: nutrientForm.fiber,
                    salt: nutrientForm.salt,
                    calories: nutrientForm.targetCalories,
                    startDate: nutrientForm.startDate,
                    title: nutrientForm.title
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
        const calories = record.calories;
        const protein = record.protein;
        const fat = record.fat;
        const calculatedCarbs = Math.max(0, Math.round((calories - (protein * 4) - (fat * 9)) / 4));
        const fiber = record.fiber || 20;
        const sugar = Math.max(0, calculatedCarbs - fiber);

        setNutrientForm({
            protein: protein,
            fat: fat,
            carbs: calculatedCarbs,
            sugar: sugar,
            fiber: fiber,
            salt: record.salt || 6,
            targetCalories: calories,
            startDate: record.start_date,
            title: record.title || ''
        })
        setEditingHistoryId(record.id)
        setActiveTab('plan')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleDeleteHistory = async (id: string) => {
        if (!confirm('この設定履歴を削除してもよろしいですか？')) return false
        try {
            const response = await fetch(`/api/diet/goals/${id}?token=${selectedMember?.access_token}`, {
                method: 'DELETE'
            })
            if (response.ok) {
                setMessage('履歴を削除しました')
                fetchMemberData(selectedMember!.id, selectedMember!.access_token || '')
                setTimeout(() => setMessage(''), 3000)
                return true
            }
            return false
        } catch (error) {
            console.error('Delete history error:', error)
            return false
        }
    }

    const handleGramChange = (key: 'protein' | 'fat' | 'carbs' | 'sugar' | 'fiber' | 'salt', delta: number) => {
        setNutrientForm(prev => {
            const next = { ...prev, [key]: Math.max(0, prev[key] + delta) };
            
            // Sync Carbs and Sugar
            if (key === 'sugar' || key === 'fiber') {
                next.carbs = next.sugar + next.fiber;
            } else if (key === 'carbs') {
                next.sugar = Math.max(0, next.carbs - next.fiber);
            }
            
            // Recalculate total target calories based on new grams
            const pKcal = next.protein * 4;
            const fKcal = next.fat * 9;
            const cKcal = next.carbs * 4;
            next.targetCalories = pKcal + fKcal + cKcal;

            return next;
        });
    }

    const handleTargetCaloriesChange = (val: number) => {
        setNutrientForm(prev => {
            const pKcal = prev.protein * 4;
            const fKcal = prev.fat * 9;
            const remainingKcal = val - pKcal - fKcal;
            const newCarbs = Math.max(0, Math.round(remainingKcal / 4));
            const newSugar = Math.max(0, newCarbs - prev.fiber);
            
            return {
                ...prev,
                targetCalories: val,
                carbs: newCarbs,
                sugar: newSugar
            };
        });
    }

    const handleKcalChange = (key: 'protein' | 'fat' | 'carbs' | 'sugar' | 'fiber', delta: number) => {
        const factor = key === 'fat' ? 9 : key === 'fiber' ? 2 : 4;
        const currentKcal = nutrientForm[key] * factor;
        const newKcal = Math.max(0, currentKcal + delta);
        const newGram = Math.round(newKcal / factor);
        
        handleGramChange(key, newGram - nutrientForm[key]);
    }

    const handlePctChange = (key: 'protein' | 'fat' | 'carbs', delta: number) => {
        if (totalKcal === 0) return;
        const factor = key === 'fat' ? 9 : 4;
        const currentPct = Math.round(((nutrientForm[key] * factor) / totalKcal) * 100);
        const newPct = Math.max(0, currentPct + delta);
        const newGram = Math.round((totalKcal * (newPct / 100)) / factor);
        
        handleGramChange(key, newGram - nutrientForm[key]);
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

    const availableWeeks = useMemo(() => {
        const weeks = [];
        const now = new Date();
        const currentDay = now.getDay();
        const diffToMonday = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
        const thisMonday = new Date(now.setDate(diffToMonday));
        thisMonday.setHours(0,0,0,0);
        
        for (let i = 0; i < 12; i++) {
            const m = new Date(thisMonday);
            m.setDate(m.getDate() - (i * 7));
            const s = new Date(m);
            s.setDate(s.getDate() + 6);
            
            const mStr = m.toISOString().split('T')[0];
            const sStr = s.toISOString().split('T')[0];
            
            let label = `${m.getMonth()+1}/${m.getDate()}〜${s.getMonth()+1}/${s.getDate()}`;
            if (i === 0) label = `今週 (${label})`;
            if (i === 1) label = `先週 (${label})`;
            
            weeks.push({ label, start: mStr, end: sStr, value: mStr });
        }
        return weeks;
    }, []);

    useEffect(() => {
        if (!selectedWeek && availableWeeks.length > 0) {
            setSelectedWeek(availableWeeks[0].value);
        }
    }, [availableWeeks, selectedWeek]);

    const weeklyStats = useMemo(() => {
        if (!selectedWeek || !availableWeeks.length || !dietHistory.length) return null;
        const week = availableWeeks.find(w => w.value === selectedWeek) || availableWeeks[0];
        
        const logs = intakeHistory.filter(l => l.date >= week.start && l.date <= week.end);
        const lifeLogs = lifestyleHistory.filter(l => l.date >= week.start && l.date <= week.end);
        
        const target = dietHistory.find(t => t.start_date <= week.end) || dietHistory[dietHistory.length - 1];

        const daysWithDiet = logs.length || 1;
        const daysWithLife = lifeLogs.length || 1;

        const sum = {
            calories: logs.reduce((s, l) => s + (l.calories || 0), 0),
            protein: logs.reduce((s, l) => s + (l.protein || 0), 0),
            fat: logs.reduce((s, l) => s + (l.fat || 0), 0),
            carbs: logs.reduce((s, l) => s + (l.carbs || 0), 0),
            fiber: logs.reduce((s, l) => s + (l.fiber || 0), 0),
            sleep: Number(lifeLogs.reduce((s, l) => s + (l.sleep_hours || l.sleep || 0), 0).toFixed(1)),
            workout: Number(lifeLogs.reduce((s, l) => s + (l.habits?.workout || 0), 0).toFixed(1)),
            steps: lifeLogs.reduce((s, l) => s + (l.steps || 0), 0),
            water: Number(lifeLogs.reduce((s, l) => s + (l.water_liters || l.water || 0), 0).toFixed(1))
        };

        const avg = {
            calories: Math.round(sum.calories / daysWithDiet),
            protein: Math.round(sum.protein / daysWithDiet),
            fat: Math.round(sum.fat / daysWithDiet),
            carbs: Math.round(sum.carbs / daysWithDiet),
            fiber: Math.round(sum.fiber / daysWithDiet),
            sleep: Number((sum.sleep / daysWithLife).toFixed(1)),
            workout: Number((sum.workout / daysWithLife).toFixed(1)),
            steps: Math.round(sum.steps / daysWithLife),
            water: Number((sum.water / daysWithLife).toFixed(1))
        };

        return { sum, avg, target, habitTargets };
    }, [selectedWeek, intakeHistory, lifestyleHistory, dietHistory, availableWeeks, habitTargets]);

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
            const target = dietHistory.find(t => t.start_date <= dStr) || dietHistory[dietHistory.length - 1];

            data.push({
                date: dStr,
                calories: intake?.calories || 0,
                protein_kcal: (intake?.protein || 0) * 4,
                fat_kcal: (intake?.fat || 0) * 9,
                carbs_kcal: (intake?.carbs || 0) * 4,
                protein: intake?.protein || 0,
                fat: intake?.fat || 0,
                carbs: intake?.carbs || 0,
                fiber: intake?.fiber || 0,
                target_calories: target?.calories || null,
                target_protein: target?.protein || null,
                target_fat: target?.fat || null,
                target_carbs: target?.carbs || null,
                target_fiber: target?.fiber || null,
                steps: lifestyle?.steps || 0,
                sleep: lifestyle?.sleep_hours || lifestyle?.sleep || 0,
                water: lifestyle?.water_liters || lifestyle?.water || 0,
                workout: lifestyle?.habits?.workout || 0,
                target_steps: habitTargets?.steps || 8000,
                target_sleep: habitTargets?.sleep || 8,
                target_water: habitTargets?.water || 2,
                target_workout: habitTargets?.workout || 1,
            });
            current.setDate(current.getDate() + 1);
        }

        return data;
    }, [intakeHistory, lifestyleHistory, weightHistory, dietHistory, analysisPeriod]);

    const dietChartData = useMemo(() => {
        return [...dietHistory].sort((a, b) => a.start_date.localeCompare(b.start_date)).map(record => {
            const p_kcal = (record.protein || 0) * 4;
            const f_kcal = (record.fat || 0) * 9;
            // Gap-filling logic from member view to keep heights consistent
            const c_kcal = record.calories - (p_kcal + f_kcal);
            
            return {
                ...record,
                displayDate: `${parseInt(record.start_date.split('-')[1], 10)}/${parseInt(record.start_date.split('-')[2], 10)}`,
                protein_kcal: p_kcal,
                fat_kcal: f_kcal,
                carbs_kcal: c_kcal
            };
        });
    }, [dietHistory]);

    const [chartView, setChartView] = useState<'all' | 'p' | 'f' | 'c'>('all');

    if (status === 'loading' || loadingMembers) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
            </div>
        );
    }

    const filteredMembers = members.filter(m => 
        m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 py-4 sm:py-6 text-gray-900">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className={`${selectedMember ? 'mb-16' : 'mb-6 sm:mb-8'} text-center relative`}>
                    <button
                        onClick={() => selectedMember ? setSelectedMember(null) : router.push('/dashboard')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-full transition-all shadow-sm border border-gray-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    {!selectedMember ? (
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight inline-block text-gray-900">ダイエット管理</h1>
                    ) : (
                        <div className="flex flex-col items-center mx-auto">
                            <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-2">{selectedMember.full_name}</h1>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Active Plan</span>
                            </div>
                        </div>
                    )}
                    {selectedMember && (
                        <button 
                            onClick={() => setSelectedMember(null)} 
                            className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 hover:text-rose-500 bg-white px-4 py-2 rounded-full uppercase tracking-widest border border-gray-100 shadow-sm transition-all"
                        >
                            会員変更
                        </button>
                    )}
                </div>

                {!selectedMember ? (
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-8 border-b border-gray-50">
                            <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-rose-500 rounded-full"></span>
                                会員を選択
                            </h2>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="名前やメールアドレスで検索..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none transition-all font-bold"
                                />
                                <svg className="absolute left-4 top-4.5 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto px-4 pb-4">
                            {filteredMembers.map(member => (
                                <button
                                    key={member.id}
                                    onClick={() => setSelectedMember(member)}
                                    className="w-full flex items-center px-6 py-5 hover:bg-rose-50/50 transition-all rounded-[2rem] group mt-2"
                                >
                                    <div className="flex-1 flex items-center gap-4 text-left">
                                        <div className={`w-3 h-3 rounded-full ${getStatusDotColor(member.status)} shadow-sm`} />
                                        <div>
                                            <div className="font-black text-gray-800 group-hover:text-rose-600 transition-colors">{member.full_name}</div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{member.email}</div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-black text-gray-400 bg-gray-50 px-4 py-2 rounded-full group-hover:bg-rose-500 group-hover:text-white transition-all uppercase tracking-widest">選択</div>
                                </button>
                            ))}
                            {filteredMembers.length === 0 && (
                                <div className="py-20 text-center text-gray-400 italic font-bold">会員が見つかりません</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-12"> {/* Increased spacing between tabs and content */}
                        <div className="flex bg-white/80 backdrop-blur-md p-2 rounded-[2.5rem] border border-gray-100 shadow-sm sticky top-0 z-30 gap-1 overflow-x-auto no-scrollbar">
                            {[
                                { id: 'progress', label: '週間目標' },
                                { id: 'analyze', label: '分析' },
                                { id: 'plan', label: 'プラン' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabType)}
                                    className={`flex-1 py-4 px-6 min-w-[100px] rounded-[2rem] text-xs font-black transition-all ${activeTab === tab.id ? 'bg-gray-900 text-white shadow-xl scale-[1.02]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {loadingData && (
                            <div className="flex justify-center py-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-600"></div>
                            </div>
                        )}


                        {!loadingData && activeTab === 'progress' && selectedMember && (
                            <ProgressTab 
                                userId={selectedMember.id}
                                token={selectedMember.access_token!}
                            />
                        )}

                        {!loadingData && activeTab === 'analyze' && (
                            <AnalyzeTab 
                                userId={selectedMember.id} 
                                token={selectedMember.access_token!} 
                                isAdmin={true} 
                                todayDraft={sharedState} 
                            />
                        )}

                        {!loadingData && activeTab === 'plan' && (
                            <div className="space-y-12 pb-20 animate-fadeIn">
                                {/* Current Goal Summary Card */}
                                {!isSettingNewGoal && (
                                    <div className="bg-white rounded-[3.5rem] p-10 sm:p-14 shadow-sm border border-gray-100 space-y-14">
                                        {/* Header */}
                                        <div className="flex flex-col gap-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-7 bg-orange-500 rounded-full"></div>
                                                <h2 className="text-3xl font-black text-gray-900 tracking-tight">現在の目標設定</h2>
                                            </div>
                                        </div>

                                        {/* Nutrition Section */}
                                        <div className="space-y-10">
                                            {/* Action Button Moved Above Section Title */}
                                            <button 
                                                onClick={() => {
                                                    setNutrientForm({
                                                        protein: DEFAULT_PROTEIN,
                                                        fat: DEFAULT_FAT,
                                                        carbs: DEFAULT_CARBS,
                                                        sugar: DEFAULT_SUGAR,
                                                        fiber: DEFAULT_FIBER,
                                                        salt: DEFAULT_SALT,
                                                        targetCalories: 1600,
                                                        startDate: today,
                                                        title: ''
                                                    });
                                                    setEditingHistoryId(null);
                                                    setIsSettingNewGoal(true);
                                                }}
                                                className="w-full py-5 rounded-[2rem] bg-gray-900 text-white font-black text-sm hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                                新しいプランに変更
                                            </button>

                                            <div className="space-y-1">
                                                <h3 className="text-base font-black text-gray-400 tracking-widest uppercase">食事・栄養の目標</h3>
                                            </div>

                                            {/* Big Calorie Card */}
                                            <div className="bg-gray-50/50 rounded-[3rem] p-12 text-center space-y-3 border border-gray-100/50">
                                                <div className="text-xs font-black text-gray-400 uppercase tracking-widest">目標摂取カロリー</div>
                                                <div className="flex items-baseline justify-center gap-2">
                                                    <span className="text-6xl font-black text-gray-900 tabular-nums">{nutrientForm.targetCalories.toLocaleString()}</span>
                                                    <span className="text-base font-black text-gray-400">kcal / 日</span>
                                                </div>
                                            </div>

                                            {/* Nutrient Grid */}
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="bg-gray-50/50 rounded-[2.5rem] p-8 space-y-4 border border-gray-100/50">
                                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">タンパク質</div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-4xl font-black text-orange-500 tabular-nums">{nutrientForm.protein}</span>
                                                        <span className="text-xs font-bold text-gray-400 uppercase">g</span>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50/50 rounded-[2.5rem] p-8 space-y-4 border border-gray-100/50">
                                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">脂質</div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-4xl font-black text-teal-500 tabular-nums">{nutrientForm.fat}</span>
                                                        <span className="text-xs font-bold text-gray-400 uppercase">g</span>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50/50 rounded-[2.5rem] p-8 space-y-4 border border-gray-100/50">
                                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">炭水化物</div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-4xl font-black text-blue-500 tabular-nums">{nutrientForm.carbs}</span>
                                                        <span className="text-xs font-bold text-gray-400 uppercase">g</span>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50/50 rounded-[2.5rem] p-8 space-y-4 border border-gray-100/50">
                                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">糖質</div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-4xl font-black text-purple-500 tabular-nums">{nutrientForm.sugar}</span>
                                                        <span className="text-xs font-bold text-gray-400 uppercase">g</span>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50/50 rounded-[2.5rem] p-8 space-y-4 border border-gray-100/50">
                                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">食物繊維</div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-4xl font-black text-rose-500 tabular-nums">{nutrientForm.fiber}</span>
                                                        <span className="text-xs font-bold text-gray-400 uppercase">g</span>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50/50 rounded-[2.5rem] p-8 space-y-4 border border-gray-100/50">
                                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">塩分</div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-4xl font-black text-gray-500 tabular-nums">{nutrientForm.salt}</span>
                                                        <span className="text-xs font-bold text-gray-400 uppercase">g</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Habits Section */}
                                        <div className="space-y-10 pt-6">
                                            <div className="space-y-1">
                                                <h3 className="text-base font-black text-gray-400 tracking-widest uppercase">生活習慣の目標</h3>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="bg-gray-50/50 rounded-[2.5rem] p-8 space-y-4 border border-gray-100/50">
                                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">水分摂取</div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-4xl font-black text-blue-500 tabular-nums">{habitTargets.water}</span>
                                                        <span className="text-xs font-bold text-gray-400 uppercase">L</span>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50/50 rounded-[2.5rem] p-8 space-y-4 border border-gray-100/50">
                                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">目標歩数</div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-4xl font-black text-teal-500 tabular-nums">{habitTargets.steps.toLocaleString()}</span>
                                                        <span className="text-xs font-bold text-gray-400 uppercase">歩</span>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50/50 rounded-[2.5rem] p-8 space-y-4 border border-gray-100/50">
                                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">筋トレ回数</div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-4xl font-black text-orange-500 tabular-nums">{habitTargets.workout}</span>
                                                        <span className="text-xs font-bold text-gray-400 uppercase">回 / 週</span>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50/50 rounded-[2.5rem] p-8 space-y-4 border border-gray-100/50">
                                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">睡眠時間</div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-4xl font-black text-indigo-500 tabular-nums">{habitTargets.sleep}</span>
                                                        <span className="text-xs font-bold text-gray-400 uppercase">時間</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isSettingNewGoal && (
                                    <div className="space-y-6 bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm animate-slideDown">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-xl font-black flex items-center gap-2"><span className="w-2 h-8 bg-blue-500 rounded-full"></span>目標設定の編集</h2>
                                            <button 
                                                onClick={async () => {
                                                    if (editingHistoryId) {
                                                        const success = await handleDeleteHistory(editingHistoryId);
                                                        if (success) {
                                                            setIsSettingNewGoal(false);
                                                            setEditingHistoryId(null);
                                                        }
                                                    } else {
                                                        setIsSettingNewGoal(false);
                                                    }
                                                }} 
                                                className="p-3 bg-gray-100 rounded-full hover:bg-rose-100 hover:text-rose-600 transition-colors group"
                                            >
                                                <svg className="w-5 h-5 text-gray-500 group-hover:text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>

                                        <div className="space-y-8">
                                            <div className="space-y-6">
                                                <h3 className="text-sm font-black text-gray-400 tracking-widest">① カロリー・PFC設定</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 space-y-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">適用開始日</label>
                                                        <input type="date" value={nutrientForm.startDate} onChange={e => setNutrientForm({ ...nutrientForm, startDate: e.target.value })} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                                                    </div>
                                                    <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 space-y-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">タイトル（任意）</label>
                                                        <input type="text" placeholder="例: 増量期" value={nutrientForm.title} onChange={e => setNutrientForm({ ...nutrientForm, title: e.target.value })} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-rose-500 p-8 sm:p-10 rounded-[3rem] shadow-xl shadow-rose-200 flex flex-col items-center justify-center gap-2 group transition-all hover:scale-[1.02] w-full overflow-hidden">
                                                    <div className="text-[10px] font-black text-rose-100 uppercase tracking-widest opacity-80">目標摂取カロリー設定</div>
                                                    <div className="flex items-baseline gap-2 sm:gap-3 w-full justify-center">
                                                        <input 
                                                            type="number" 
                                                            value={nutrientForm.targetCalories} 
                                                            onChange={e => handleTargetCaloriesChange(parseInt(e.target.value) || 0)}
                                                            className="w-[120px] sm:w-40 bg-white/20 border-b-2 border-white/40 focus:border-white outline-none text-4xl sm:text-6xl font-black text-white tabular-nums text-center transition-all p-1 sm:p-2 rounded-xl"
                                                        />
                                                        <span className="text-lg sm:text-2xl font-black text-rose-100">kcal</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <NutrientCard label="タンパク質" grams={nutrientForm.protein} kcal={pKcal} onGramChange={(d) => handleGramChange('protein', d)} color="rose" showPct={false} />
                                                    <NutrientCard label="脂質" grams={nutrientForm.fat} kcal={fKcal} onGramChange={(d) => handleGramChange('fat', d)} color="amber" showPct={false} />
                                                    <NutrientCard label="炭水化物" grams={nutrientForm.carbs} kcal={cKcal} onGramChange={(d) => handleGramChange('carbs', d)} color="blue" showPct={false} />
                                                    <NutrientCard label="糖質" grams={nutrientForm.sugar} kcal={sugarKcal} onGramChange={(d) => handleGramChange('sugar', d)} color="purple" showPct={false} />
                                                    <NutrientCard label="食物繊維" grams={nutrientForm.fiber} kcal={fiberKcal} onGramChange={(d) => handleGramChange('fiber', d)} color="rose" showPct={false} />
                                                    <NutrientCard label="塩分" grams={nutrientForm.salt} onGramChange={(d) => handleGramChange('salt', d)} color="gray" showKcal={false} showPct={false} />
                                                </div>
                                            </div>

                                            <div className="space-y-6 pt-6 border-t border-gray-100">
                                                <h3 className="text-sm font-black text-gray-400 tracking-widest">② 習慣設定</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                                    <HabitConfig label="歩数" unit="歩" active={lifestyleSettings.visible_items.steps} target={habitTargets.steps} onToggle={() => setLifestyleSettings({ ...lifestyleSettings, visible_items: { ...lifestyleSettings.visible_items, steps: !lifestyleSettings.visible_items.steps } })} onTargetChange={(v) => setHabitTargets({...habitTargets, steps: v})} step={500} />
                                                    <HabitConfig label="水分" unit="L" active={lifestyleSettings.visible_items.water} target={habitTargets.water} onToggle={() => setLifestyleSettings({ ...lifestyleSettings, visible_items: { ...lifestyleSettings.visible_items, water: !lifestyleSettings.visible_items.water } })} onTargetChange={(v) => setHabitTargets({...habitTargets, water: v})} step={0.1} />
                                                    <HabitConfig label="睡眠" unit="時間" active={lifestyleSettings.visible_items.sleep} target={habitTargets.sleep} onToggle={() => setLifestyleSettings({ ...lifestyleSettings, visible_items: { ...lifestyleSettings.visible_items, sleep: !lifestyleSettings.visible_items.sleep } })} onTargetChange={(v) => setHabitTargets({...habitTargets, sleep: v})} step={0.5} />
                                                    <HabitConfig label="筋トレ" unit="回" active={lifestyleSettings.visible_items.workout ?? true} target={habitTargets.workout ?? 1} onToggle={() => setLifestyleSettings({ ...lifestyleSettings, visible_items: { ...lifestyleSettings.visible_items, workout: !lifestyleSettings.visible_items.workout } })} onTargetChange={(v) => setHabitTargets({...habitTargets, workout: v})} step={1} />
                                                </div>
                                            </div>

                                            <div className="space-y-6 pt-6 border-t border-gray-100">
                                                <h3 className="text-sm font-black text-gray-400 tracking-widest">③ 取り組む習慣</h3>
                                                <div className="space-y-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        {GOAL_SUGGESTIONS.map(suggestion => (
                                                            <button key={suggestion} onClick={() => quitGoals.includes(suggestion) ? setQuitGoals(quitGoals.filter(g => g !== suggestion)) : setQuitGoals([...quitGoals, suggestion])} className={`px-4 py-2 rounded-full text-[11px] font-black border transition-all ${quitGoals.includes(suggestion) ? 'bg-orange-500 border-orange-500 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500 hover:border-orange-300'}`}>{suggestion}</button>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input type="text" placeholder="自由に追加..." value={newQuitGoal} onChange={(e) => setNewQuitGoal(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addQuitGoal())} className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500" />
                                                        <button onClick={addQuitGoal} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-orange-600 transition-colors shadow-lg">追加</button>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {quitGoals.map((goal, index) => (
                                                            <div key={index} className="flex items-center justify-between bg-orange-50/30 px-5 py-3 rounded-[1.5rem] border border-orange-100">
                                                                <span className="font-black text-orange-900 text-sm">{goal}</span>
                                                                <button onClick={() => setQuitGoals(quitGoals.filter((_, i) => i !== index))} className="text-orange-300 hover:text-orange-600 p-1">
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-4 pt-6">
                                                <button onClick={() => setIsSettingNewGoal(false)} className="flex-1 bg-white border border-gray-200 text-gray-500 py-5 rounded-[2rem] font-black text-lg hover:bg-gray-50 transition-all">キャンセル</button>
                                                <button onClick={handleSave} disabled={saving} className="flex-[2] bg-gray-900 text-white py-5 rounded-[2rem] font-black text-lg shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2">{saving ? '保存中...' : '新しいプランを適用する'}</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* History Chart Section */}
                                {!isSettingNewGoal && dietHistory.length > 0 && (
                                    <div className="bg-white rounded-[3rem] p-10 sm:p-14 shadow-sm border border-gray-100 space-y-10">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-7 bg-blue-500 rounded-full"></div>
                                                <h2 className="text-3xl font-black text-gray-900 tracking-tight">目標カロリーの推移</h2>
                                            </div>
                                            <p className="text-sm font-bold text-gray-400 ml-4.5">PFCバランスの推移 (KCAL換算)</p>
                                        </div>

                                        <div className="flex bg-gray-100/50 p-2 rounded-2xl w-fit mx-auto"> {/* Centered tabs */}
                                            {[
                                                { label: 'PFC', value: 'all' },
                                                { label: 'P', value: 'p' },
                                                { label: 'F', value: 'f' },
                                                { label: 'C', value: 'c' }
                                            ].map(v => (
                                                <button 
                                                    key={v.value} 
                                                    onClick={() => setChartView(v.value as any)}
                                                    className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${chartView === v.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                >
                                                    {v.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={dietChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis 
                                                        dataKey="displayDate" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                                                    />
                                                    <YAxis 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fontSize: 10, fontWeight: 700, fill: '#cbd5e1' }} 
                                                    />
                                                    <Tooltip 
                                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                                        itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                                        formatter={(value: any, name: string) => [`${Math.round(value)} kcal`, name]}
                                                    />
                                                    <Legend 
                                                        align="center" 
                                                        verticalAlign="bottom" 
                                                        iconType="circle" 
                                                        wrapperStyle={{ paddingTop: '40px', fontSize: '12px', fontWeight: 800 }}
                                                        payload={[
                                                            { value: 'P', type: 'circle', color: '#f59e0b' },
                                                            { value: 'F', type: 'circle', color: '#10b981' },
                                                            { value: 'C', type: 'circle', color: '#3b82f6' }
                                                        ]}
                                                    />
                                                    
                                                    {/* Stacking Order: Bottom(C) -> Middle(F) -> Top(P) - Consistent with Client View */}
                                                    {(chartView === 'all' || chartView === 'c') && (
                                                        <Bar dataKey="carbs_kcal" name="C" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={24} isAnimationActive={false} />
                                                    )}
                                                    {(chartView === 'all' || chartView === 'f') && (
                                                        <Bar dataKey="fat_kcal" name="F" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                                                    )}
                                                    {(chartView === 'all' || chartView === 'p') && (
                                                        <Bar dataKey="protein_kcal" name="P" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                                                    )}
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* History List */}
                                        <div className="pt-10 border-t border-gray-50">
                                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">設定履歴一覧</h4>
                                            <div className="space-y-4">
                                                {dietHistory.map((record) => {
                                                    const dateParts = record.start_date.split('-');
                                                    const formattedDate = dateParts.length === 3 
                                                        ? `${dateParts[0].slice(2)}/${parseInt(dateParts[1], 10)}/${parseInt(dateParts[2], 10)}` 
                                                        : record.start_date;
                                                    
                                                    return (
                                                        <div key={record.id} className="flex items-center justify-between p-6 bg-gray-50/50 rounded-3xl border border-gray-100/50 hover:bg-gray-50 transition-colors">
                                                            <div className="flex items-center gap-6">
                                                                <div className="text-base font-black text-gray-900">{formattedDate}</div>
                                                            </div>
                                                            <div className="flex items-center gap-8">
                                                                <div className="text-base font-black text-orange-600">{record.calories}<span className="text-xs ml-1">kcal</span></div>
                                                                <button onClick={() => { handleEditHistory(record); setIsSettingNewGoal(true); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-2xl transition-colors">
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
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
            <h3 className="text-sm font-black text-gray-500 tracking-widest">{title}</h3>
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

function NutrientCard({ label, grams, kcal, onGramChange, onKcalChange, color, showKcal = true, showPct = true }: { 
    label: string, grams: number, kcal?: number, onGramChange: (d: number) => void, onKcalChange?: (d: number) => void, color: string, showKcal?: boolean, showPct?: boolean
}) {
    const colorStyles: Record<string, string> = {
        rose: 'text-rose-600 bg-rose-50/30 border-rose-100',
        amber: 'text-amber-600 bg-amber-50/30 border-amber-100',
        emerald: 'text-emerald-600 bg-emerald-50/30 border-emerald-100',
        blue: 'text-blue-600 bg-blue-50/30 border-blue-100',
        purple: 'text-purple-600 bg-purple-50/30 border-purple-100',
        gray: 'text-gray-600 bg-gray-50/30 border-gray-100'
    }
    const isTwo = showKcal && kcal !== undefined;
    return (
        <div className={`p-4 rounded-2xl border ${colorStyles[color] || colorStyles.gray} space-y-3 shadow-sm`}>
            <div className="text-base sm:text-lg font-black uppercase tracking-tight">{label}</div>
            <div className={`grid gap-2 ${isTwo ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <NutrientControl value={grams} unit="g" onDelta={onGramChange} />
                {showKcal && kcal !== undefined && (
                    <div className="bg-white/40 rounded-xl p-2 border border-white/50 flex items-center justify-center gap-1 shadow-inner">
                        <span className="text-base sm:text-lg font-black tabular-nums">{Math.round(kcal)}</span>
                        <span className="text-[8px] font-bold opacity-30 uppercase">kcal</span>
                    </div>
                )}
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
