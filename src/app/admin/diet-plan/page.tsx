'use client'

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Member } from '@/types'

// Reusing some logic from members page
import { getStatusDotColor } from '@/lib/utils/member'
import AdminHeader from '@/app/components/AdminHeader'
import HomeTab from '@/components/diet/HomeTab'
import AnalyzeTab from '@/components/diet/AnalyzeTab'
import WeeklySummaryTab from '@/components/diet/WeeklySummaryTab'
import WeightTab from '@/components/diet/WeightTab'
import GoalsTab from '@/components/diet/GoalsTab'
import GoalPlanForm, { type GoalFormValues, type HabitTargetsValues } from '@/components/diet/GoalPlanForm'
import GoalEditModal from '@/components/diet/GoalEditModal'
import { calculateAragonPlan, caloriesFromMacros, NEAT_LEVELS } from '@/lib/utils/dietGoalCalc'

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
const DEFAULT_SUGAR = 280;
const DEFAULT_SALT = 6;

type TabType = 'panel' | 'weight' | 'graph' | 'goals' | 'plan';
type PeriodType = '1w' | '1m' | '3m' | '6m' | '1y' | 'all';

function getRecordDate(record: any) {
    const value = record?.date || record?.recorded_date || record?.created_at || record?.target_date
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

function getWeekRange(weekOffset = 0) {
    const anchor = new Date()
    anchor.setDate(anchor.getDate() + (weekOffset * 7))
    const day = anchor.getDay()
    const daysFromMonday = day === 0 ? 6 : day - 1
    const start = new Date(anchor)
    start.setDate(anchor.getDate() - daysFromMonday)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    const prevEnd = new Date(start)
    prevEnd.setMilliseconds(-1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - 6)
    prevStart.setHours(0, 0, 0, 0)

    return { start, end, prevStart, prevEnd }
}

function filterByRange(records: any[], start: Date, end: Date) {
    return records.filter(record => {
        const date = getRecordDate(record)
        return date && date >= start && date <= end
    })
}

function average(records: any[], key: string) {
    return averageByKeys(records, [key])
}

function averageByKeys(records: any[], keys: string[]) {
    const values = records
        .map(record => {
            const raw = keys.map(key => record?.[key]).find(value => value !== null && value !== undefined)
            return Number(raw || 0)
        })
        .filter(value => Number.isFinite(value) && value > 0)
    if (!values.length) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
}

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
    const [activeTab, setActiveTab] = useState<TabType>('panel')
    const [showDailyRecords, setShowDailyRecords] = useState(false)
    const [editingCurrentPlan, setEditingCurrentPlan] = useState(false)
    // アラゴン式カロリー計算の入力（初回のみ表示するカードで使用）
    const [aragonInput, setAragonInput] = useState({
        targetWeight: '',
        periodWeeks: '12',
        weeklyTrainingHours: '3',
        neat: NEAT_LEVELS[0].value,
    })
    const [goalModal, setGoalModal] = useState<{
        mode: 'new' | 'edit'
        recordId?: string
        initialValues: GoalFormValues
        initialHabitTargets: HabitTargetsValues
    } | null>(null)
    const [analysisPeriod, setAnalysisPeriod] = useState<PeriodType>('1m')
    const [selectedWeek, setSelectedWeek] = useState<string>('')
    const [showWeightAvg, setShowWeightAvg] = useState(false)
    const [summaryWeekOffset, setSummaryWeekOffset] = useState(0)
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
        targetCalories: 1600,
        startDate: today,
        title: ''
    })

    const [lifestyleSettings, setLifestyleSettings] = useState({
        visible_items: { steps: true, sleep: true, water: true, workout: true },
        visible_tabs: { input: true, analyze: true, progress: true }
    })

    const [habitTargets, setHabitTargets] = useState<any>({
        steps: null,
        sleep: null,
        water: null,
        workout: null
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
            const [dietRes, lifestyleRes, trackingRes, logsRes, lifeLogsRes] = await Promise.all([
                fetch(`/api/diet/goals?token=${token}`),
                fetch(`/api/lifestyle/settings?userId=${userId}`),
                fetch(`/api/admin/member-tracking/${userId}`),
                fetch(`/api/diet/logs?token=${token}`),
                fetch(`/api/lifestyle/logs?token=${token}`)
            ])

            if (dietRes.ok) {
                const text = await dietRes.text()
                if (text) {
                    const { data } = JSON.parse(text)
                    setDietHistory(data || [])
                    if (data && data.length > 0) {
                        const latest = data[0]
                        setNutrientForm({
                            protein: latest.protein,
                            fat: latest.fat,
                            carbs: latest.carbs,
                            fiber: latest.fiber || 20,
                            sugar: latest.sugar || (latest.carbs - (latest.fiber || 20)),
                            targetCalories: latest.calories || 1600,
                            salt: latest.salt || 6,
                            startDate: latest.start_date,
                            title: latest.title || ''
                        })
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
                        else setHabitTargets({ steps: null, sleep: null, water: null, workout: null })
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

            if (lifeLogsRes.ok) {
                const text = await lifeLogsRes.text()
                if (text) {
                    const { data } = JSON.parse(text)
                    if (data) setLifestyleHistory(data)
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
    }, [])

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
                        
                        const userId = searchParams.get('userId')
                        if (userId) {
                            const member = fetchedMembers.find((m: Member) => m.id === userId)
                            if (member) setSelectedMember(member)
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

    useEffect(() => {
        if (selectedMember) {
            fetchMemberData(selectedMember.id, selectedMember.access_token || '')
        }
    }, [selectedMember, fetchMemberData])

    // K-2/K-4: 「現在の目標設定」インライン保存とモーダル保存（新規作成・履歴編集）の両方から呼ぶ共通処理
    const saveGoalPlan = async (values: GoalFormValues, targetHabitTargets: HabitTargetsValues): Promise<boolean> => {
        if (!selectedMember) return false
        setMessage('')
        try {
            const dietSave = fetch(`/api/diet/goals?token=${selectedMember.access_token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...values,
                    calories: values.targetCalories
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
                    habit_targets: targetHabitTargets
                })
            })

            const [dietRes, lifestyleRes] = await Promise.all([dietSave, lifestyleSave])

            if (dietRes.ok && lifestyleRes.ok) {
                setMessage('設定を保存しました')
                await fetchMemberData(selectedMember.id, selectedMember.access_token || '')
                setTimeout(() => setMessage(''), 3000)
                return true
            }
            setMessage('保存に失敗しました')
            return false
        } catch (error) {
            console.error('Save error:', error)
            setMessage('エラーが発生しました')
            return false
        }
    }

    const handleSave = async () => {
        setSaving(true)
        await saveGoalPlan(nutrientForm, habitTargets)
        setSaving(false)
    }

    const handleDeleteHistory = async (id: string) => {
        try {
            const response = await fetch(`/api/diet/goals/${id}?token=${selectedMember?.access_token}`, {
                method: 'DELETE'
            })
            if (response.ok) {
                setMessage('履歴を削除しました')
                await fetchMemberData(selectedMember!.id, selectedMember!.access_token || '')
                setTimeout(() => setMessage(''), 3000)
            }
        } catch (error) {
            console.error('Delete history error:', error)
        }
    }

    // K-2: 統合グラフのバーをタップして開く編集モーダル
    const openEditGoalModal = (record: any) => {
        setGoalModal({
            mode: 'edit',
            recordId: record.id,
            initialValues: {
                protein: record.protein,
                fat: record.fat,
                carbs: record.carbs,
                sugar: record.sugar || Math.max(0, record.carbs - (record.fiber || 20)),
                fiber: record.fiber || 20,
                salt: record.salt || 6,
                targetCalories: record.calories,
                startDate: record.start_date,
                title: record.title || ''
            },
            initialHabitTargets: habitTargets,
        })
    }

    // K-4: 新規作成時は現在の設定値をそのまま複製し、開始日だけ今日に初期化する
    const openNewGoalModal = () => {
        setGoalModal({
            mode: 'new',
            initialValues: { ...nutrientForm, startDate: today, title: '' },
            initialHabitTargets: habitTargets,
        })
    }

    const handleModalSave = async (values: GoalFormValues, targetHabitTargets: HabitTargetsValues) => {
        const ok = await saveGoalPlan(values, targetHabitTargets)
        if (ok) setGoalModal(null)
    }

    const handleModalDelete = async () => {
        if (!goalModal?.recordId) return
        await handleDeleteHistory(goalModal.recordId)
        setGoalModal(null)
    }

    const latestWeight = useMemo(() => {
        const sorted = [...weightHistory]
            .filter(record => record.weight || record.weight_kg)
            .sort((a, b) => String(b.date || b.created_at || '').localeCompare(String(a.date || a.created_at || '')))
        const latest = sorted[0]
        const value = latest?.weight ?? latest?.weight_kg
        return value ? Number(value) : null
    }, [weightHistory])

    // アラゴン式カロリー計算（現在体重・目標体重・期間・週トレ時間・NEATから算出）
    const aragonResult = useMemo(() => {
        const targetWeight = parseFloat(aragonInput.targetWeight)
        const periodWeeks = parseFloat(aragonInput.periodWeeks)
        const weeklyTrainingHours = parseFloat(aragonInput.weeklyTrainingHours)
        if (!latestWeight || !targetWeight || !periodWeeks || Number.isNaN(weeklyTrainingHours)) return null
        return calculateAragonPlan({
            currentWeightKg: latestWeight,
            targetWeightKg: targetWeight,
            periodWeeks,
            weeklyTrainingHours,
            neat: aragonInput.neat,
        })
    }, [latestWeight, aragonInput])

    const weeklySummary = useMemo(() => {
        const { start, end, prevStart, prevEnd } = getWeekRange(summaryWeekOffset)
        const weekIntake = filterByRange(intakeHistory, start, end)
        const weekLifestyle = filterByRange(lifestyleHistory, start, end)
        const weekWeight = filterByRange(weightHistory, start, end)
        const prevWeight = filterByRange(weightHistory, prevStart, prevEnd)
        const prevLifestyle = filterByRange(lifestyleHistory, prevStart, prevEnd)
        const targetDateStr = end.toLocaleDateString('sv-SE')
        const currentDietGoal = [...dietHistory]
            .filter(goal => goal?.start_date && goal.start_date <= targetDateStr)
            .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
        const effectiveTargetCalories = Number(currentDietGoal?.calories || nutrientForm.targetCalories)
        const effectiveTargetProtein = Number(currentDietGoal?.protein || nutrientForm.protein)
        const effectiveTargetFat = Number(currentDietGoal?.fat || nutrientForm.fat)
        const effectiveTargetCarbs = Number(currentDietGoal?.carbs || nutrientForm.carbs)
        const effectiveTargetFiber = Number(currentDietGoal?.fiber || nutrientForm.fiber || DEFAULT_FIBER)

        const avgCalories = average(weekIntake, 'calories')
        const avgProtein = average(weekIntake, 'protein')
        const avgFat = average(weekIntake, 'fat')
        const avgCarbs = average(weekIntake, 'carbs')
        const avgFiber = average(weekIntake, 'fiber')
        const avgWeight = average(weekWeight, 'weight') ?? average(weekWeight, 'weight_kg') ?? average(weekLifestyle, 'weight') ?? average(weekLifestyle, 'weight_kg')
        const prevAvgWeight = average(prevWeight, 'weight') ?? average(prevWeight, 'weight_kg') ?? average(prevLifestyle, 'weight') ?? average(prevLifestyle, 'weight_kg')
        const avgSteps = average(weekLifestyle, 'steps')
        const avgWater = averageByKeys(weekLifestyle, ['water_liters', 'water'])
        const prevAvgWater = averageByKeys(prevLifestyle, ['water_liters', 'water'])
        const avgSleep = averageByKeys(weekLifestyle, ['sleep_hours', 'sleep'])
        const workouts = weekLifestyle.filter(record => Number(record?.habits?.workout || record?.workout || 0) > 0).length

        return {
            dateLabel: `${start.getMonth() + 1}/${start.getDate()}〜${end.getMonth() + 1}/${end.getDate()}`,
            targetCalories: effectiveTargetCalories,
            targetProtein: effectiveTargetProtein,
            targetFat: effectiveTargetFat,
            targetCarbs: effectiveTargetCarbs,
            targetFiber: effectiveTargetFiber,
            recordedMeals: weekIntake.length,
            recordedHabits: weekLifestyle.length,
            avgCalories,
            calorieDiff: avgCalories === null ? null : Math.round(avgCalories - effectiveTargetCalories),
            avgProtein,
            avgFat,
            avgCarbs,
            avgFiber,
            avgWeight,
            weightDiff: avgWeight !== null && prevAvgWeight !== null ? avgWeight - prevAvgWeight : null,
            avgSteps,
            avgWater,
            waterDiff: avgWater !== null && prevAvgWater !== null ? avgWater - prevAvgWater : null,
            avgSleep,
            workouts,
        }
    }, [intakeHistory, lifestyleHistory, weightHistory, dietHistory, nutrientForm.targetCalories, summaryWeekOffset])

    // N: 各プランの「実施期間」を横幅に反映するため、開始日〜次の開始日(最新は今日まで)の日数を算出する
    const goalChartData = useMemo(() => {
        const sorted = [...dietHistory]
            .filter(goal => goal?.start_date)
            .sort((a, b) => a.start_date.localeCompare(b.start_date))

        return sorted.map((goal, index) => {
            const [year, month, day] = goal.start_date.split('-')
            const protein = Number(goal.protein || 0)
            const fat = Number(goal.fat || 0)
            const carbs = Number(goal.carbs || 0)
            const calories = Number(goal.calories || 0)
            const proteinCalories = protein * 4
            const fatCalories = fat * 9
            const calculatedCarbCalories = carbs * 4
            const carbCalories = calories > 0
                ? Math.max(0, calories - proteinCalories - fatCalories)
                : calculatedCarbCalories

            const startDate = new Date(goal.start_date)
            const next = sorted[index + 1]
            const endDate = next ? new Date(next.start_date) : new Date()
            const periodDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
            const isOngoing = !next
            const endLabel = isOngoing
                ? '継続中'
                : `${endDate.getMonth() + 1}/${endDate.getDate()}`

            return {
                date: goal.start_date,
                displayDate: `${Number(month)}/${Number(day)}`,
                fullDate: `${year}/${Number(month)}/${Number(day)}`,
                periodDays,
                periodLabel: `${Number(month)}/${Number(day)}〜${endLabel}（${periodDays}日間）`,
                calories,
                protein,
                fat,
                carbs,
                proteinCalories,
                fatCalories,
                carbCalories,
                pfcCalories: calories || (proteinCalories + fatCalories + carbCalories),
            }
        })
    }, [dietHistory])

    // アラゴン式の算出結果（カロリー・P/F/Cとも既に確定済み）をそのまま目標に反映する
    const applyAragonPlanToGoal = () => {
        if (!aragonResult) return
        setNutrientForm(prev => ({
            ...prev,
            protein: aragonResult.protein,
            fat: aragonResult.fat,
            carbs: aragonResult.carbs,
            sugar: Math.max(0, aragonResult.carbs - (prev.fiber || DEFAULT_FIBER)),
            targetCalories: caloriesFromMacros(aragonResult.protein, aragonResult.fat, aragonResult.carbs),
            title: prev.title || 'アラゴン式計算から作成',
        }))
        setEditingCurrentPlan(true)
    }

    if (status === 'loading' || loadingMembers) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div></div>
    }

    const filteredMembers = members.filter(m => 
        m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={`min-h-screen bg-gray-50 pb-12 text-gray-900 ${selectedMember ? 'pt-0' : 'pt-4'}`}>
            <div className="max-w-2xl mx-auto px-4 sm:px-6">
                {!selectedMember ? (
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-8 border-b border-gray-50">
                            <h2 className="text-xl font-normal mb-6 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-brand-500 rounded-full"></span>
                                会員を選択
                            </h2>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="名前やメールアドレスで検索..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all font-normal"
                                />
                                <svg className="absolute left-4 top-4.5 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto px-4 pb-4">
                            {filteredMembers.map(member => (
                                <button key={member.id} onClick={() => setSelectedMember(member)} className="w-full flex items-center px-6 py-5 hover:bg-brand-50/50 transition-all rounded-[2rem] group mt-2">
                                    <div className="flex-1 flex items-center gap-4 text-left">
                                        <div className={`w-3 h-3 rounded-full ${getStatusDotColor(member.status)} shadow-sm`} />
                                        <div>
                                            <div className="font-normal text-gray-800 group-hover:text-brand-600 transition-colors">{member.full_name}</div>
                                            <div className="text-[10px] font-normal text-gray-400 uppercase tracking-widest">{member.email}</div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-normal text-gray-400 bg-gray-50 px-4 py-2 rounded-full group-hover:bg-brand-500 group-hover:text-white transition-all uppercase tracking-widest">選択</div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5 mt-0">
                        <div className="sticky top-16 z-40 max-w-2xl mx-auto space-y-1 bg-gray-50 px-1 pt-1 pb-2 shadow-[0_8px_18px_rgba(249,250,251,0.96)]">
                            <div className="flex items-center justify-center gap-2 px-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(selectedMember.status)}`} />
                                <p className="text-lg sm:text-xl font-normal text-gray-900">
                                    {selectedMember.full_name || selectedMember.email || '会員'}
                                </p>
                            </div>
                            <div className="flex bg-white/95 backdrop-blur-md p-2 rounded-[2.5rem] border border-gray-100 shadow-sm gap-1 overflow-x-auto no-scrollbar">
                                {[
                                    { id: 'panel', label: '週間パネル' },
                                    { id: 'weight', label: '体重' },
                                    { id: 'graph', label: 'グラフ' },
                                    { id: 'goals', label: '目標' },
                                    { id: 'plan', label: 'カロリー設定' }
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`flex-1 py-3 px-4 text-[11px] sm:text-sm font-normal transition-all duration-300 rounded-2xl ${activeTab === tab.id ? 'bg-gray-900 text-white shadow-xl scale-[1.02]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'}`}>
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* J-1: 週間パネルタブ（初期表示）。WeeklySummaryPanel全項目 + 折りたたみ「日別の記録」 */}
                        {!loadingData && activeTab === 'panel' && (
                            <div className="space-y-4 animate-fadeIn">
                                <WeeklySummaryTab
                                    userId={selectedMember.id}
                                    token={selectedMember.access_token!}
                                    isAdmin={true}
                                    weekOffset={summaryWeekOffset}
                                    onWeekOffsetChange={setSummaryWeekOffset}
                                    showWeekSwitcher={true}
                                />

                                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                                    <button
                                        onClick={() => setShowDailyRecords(!showDailyRecords)}
                                        className="w-full flex items-center justify-between px-8 py-6"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                                            <h2 className="text-base font-normal text-gray-800">日別の記録</h2>
                                        </div>
                                        <svg className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${showDailyRecords ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {showDailyRecords && (
                                        <div className="overflow-x-auto px-8 pb-8 animate-fadeIn">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-gray-50">
                                                        <th className="py-4 text-[10px] font-normal text-gray-400 uppercase tracking-widest">日付</th>
                                                        <th className="py-4 text-[10px] font-normal text-gray-400 uppercase tracking-widest text-right">カロリー</th>
                                                        <th className="py-4 text-[10px] font-normal text-gray-400 uppercase tracking-widest text-center">P/F/C (g)</th>
                                                        <th className="py-4 text-[10px] font-normal text-gray-400 uppercase tracking-widest text-center">糖質/繊維/塩</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {intakeHistory.length > 0 ? intakeHistory.map((h, i) => (
                                                        <tr key={i} className="group hover:bg-gray-50 transition-colors">
                                                            <td className="py-5 text-sm font-normal text-gray-900">
                                                                {h.date.slice(5).replace(/-/g, '/')}
                                                                {h.image_url && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[8px] bg-blue-50 text-blue-500 uppercase tracking-tighter font-bold">Image</span>}
                                                            </td>
                                                            <td className="py-5 text-sm font-normal text-gray-900 text-right tabular-nums">{h.calories?.toLocaleString()} <span className="text-[10px] text-gray-300">kcal</span></td>
                                                            <td className="py-5 text-sm font-normal text-gray-600 text-center tabular-nums">
                                                                <span className="text-amber-600">{Math.round(h.protein)}</span>
                                                                <span className="mx-1 text-gray-200">/</span>
                                                                <span className="text-emerald-600">{Math.round(h.fat)}</span>
                                                                <span className="mx-1 text-gray-200">/</span>
                                                                <span className="text-blue-600">{Math.round(h.carbs)}</span>
                                                            </td>
                                                            <td className="py-5 text-sm font-normal text-gray-500 text-center tabular-nums">
                                                                <span className="text-gray-600">{Math.round(h.sugar)}</span>
                                                                <span className="mx-1 text-gray-200">/</span>
                                                                <span className="text-gray-600">{Math.round(h.fiber)}</span>
                                                                <span className="mx-1 text-gray-200">/</span>
                                                                <span className="text-gray-400">{h.salt ?? 0}</span>
                                                            </td>
                                                        </tr>
                                                    )) : (
                                                        <tr>
                                                            <td colSpan={4} className="py-20 text-center text-sm font-normal text-gray-400 italic">記録がまだありません</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* J-1: 体重タブ。PR-J1時点ではWeightWeeklyCompareのみ（推移グラフ+目標体重ラインはPR-J2で追加） */}
                        {!loadingData && activeTab === 'weight' && (
                            <WeightTab userId={selectedMember.id} token={selectedMember.access_token!} isAdmin={true} />
                        )}

                        {/* J-1: グラフタブ。既存AnalyzeTabのグラフ群一式（期間切替そのまま） */}
                        {!loadingData && activeTab === 'graph' && (
                            <AnalyzeTab userId={selectedMember.id} token={selectedMember.access_token!} isAdmin={true} todayDraft={sharedState} showWeeklyGoals={false} />
                        )}

                        {/* M-2: 目標タブ（体重・習慣の成果ゴール。期限＋達成/未達成を管理） */}
                        {!loadingData && activeTab === 'goals' && (
                            <GoalsTab userId={selectedMember.id} token={selectedMember.access_token!} isAdmin={true} />
                        )}

                        {!loadingData && activeTab === 'plan' && (
                            <div className="space-y-12 pb-20 animate-fadeIn">
                                {/* 基礎情報からカロリー計算（アラゴン式）: 最初の目標設定時だけ必要なため、
                                    目標設定の履歴が既にある会員には表示しない */}
                                {dietHistory.length === 0 && (
                                <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100 space-y-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                        <h2 className="text-xl font-normal text-gray-800 tracking-tight">基礎情報からカロリー計算</h2>
                                    </div>

                                    {!latestWeight ? (
                                        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5 text-sm text-gray-500 leading-relaxed">
                                            計算には現在の体重の記録が必要です。会員に体重を記録してもらうと自動で計算できるようになります。
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <DietProfileStat label="現在の体重" value={`${latestWeight}kg`} />
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-normal text-gray-400 uppercase tracking-widest pl-1">最終目標体重(kg)</label>
                                                    <input type="number" value={aragonInput.targetWeight} onChange={(e) => setAragonInput(prev => ({ ...prev, targetWeight: e.target.value }))} placeholder="例: 65" className="w-full bg-gray-50 border-none rounded-xl px-3 py-3 text-sm font-normal focus:ring-2 focus:ring-brand-500" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-normal text-gray-400 uppercase tracking-widest pl-1">目標期間(週間)</label>
                                                    <input type="number" value={aragonInput.periodWeeks} onChange={(e) => setAragonInput(prev => ({ ...prev, periodWeeks: e.target.value }))} className="w-full bg-gray-50 border-none rounded-xl px-3 py-3 text-sm font-normal focus:ring-2 focus:ring-brand-500" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-normal text-gray-400 uppercase tracking-widest pl-1">週のトレーニング時間</label>
                                                    <input type="number" value={aragonInput.weeklyTrainingHours} onChange={(e) => setAragonInput(prev => ({ ...prev, weeklyTrainingHours: e.target.value }))} className="w-full bg-gray-50 border-none rounded-xl px-3 py-3 text-sm font-normal focus:ring-2 focus:ring-brand-500" />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-normal text-gray-400 uppercase tracking-widest pl-1">日常の活動量（NEAT）</label>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    {NEAT_LEVELS.map(level => (
                                                        <button
                                                            key={level.value}
                                                            onClick={() => setAragonInput(prev => ({ ...prev, neat: level.value }))}
                                                            className={`text-xs py-3 px-2 rounded-xl transition-colors ${aragonInput.neat === level.value ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                                        >
                                                            {level.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {aragonResult ? (
                                                <>
                                                    {aragonResult.paceExceeded && (
                                                        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-xs text-amber-800 leading-relaxed">
                                                            希望ペース（週{aragonResult.requestedWeeklyLossKg}kg減）が安全上限（週{aragonResult.maxSafeWeeklyLossKg}kg減）を超えています。筋肉を落とさないため、12週間後の中間目標体重 {aragonResult.tbwKg}kg を採用して計算しています。
                                                        </div>
                                                    )}
                                                    <div className="bg-gray-50/80 rounded-[2rem] p-8 text-center border border-gray-100/50">
                                                        <p className="text-[10px] font-normal text-gray-400 mb-1 uppercase tracking-widest">目標摂取カロリー</p>
                                                        <div className="flex items-baseline justify-center gap-1 mb-4">
                                                            <span className="text-4xl font-normal text-gray-900 tabular-nums">{aragonResult.targetCalories.toLocaleString()}</span>
                                                            <span className="text-sm font-normal text-gray-400">kcal / 日</span>
                                                        </div>
                                                        <p className="text-[11px] text-gray-500">
                                                            <span className="text-amber-500">P {aragonResult.protein}g</span>
                                                            <span className="mx-1 text-gray-300">/</span>
                                                            <span className="text-emerald-500">F {aragonResult.fat}g</span>
                                                            <span className="mx-1 text-gray-300">/</span>
                                                            <span className="text-blue-500">C {aragonResult.carbs}g</span>
                                                        </p>
                                                        <button onClick={applyAragonPlanToGoal} className="mt-4 w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors">目標に反映</button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5 text-sm text-gray-500 leading-relaxed">
                                                    最終目標体重・目標期間・週のトレーニング時間を入力すると計算されます。
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                )}

                                {/* L-2: 現在の目標設定。デフォルトは閲覧専用のコンパクト表示、「編集」で統一フォームを展開 */}
                                <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                                            <h2 className="text-xl font-normal text-gray-800 tracking-tight">現在の目標設定</h2>
                                        </div>
                                        {!editingCurrentPlan && (
                                            <button onClick={() => setEditingCurrentPlan(true)} className="text-xs text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100">編集</button>
                                        )}
                                    </div>
                                    {editingCurrentPlan ? (
                                        <GoalPlanForm
                                            values={nutrientForm}
                                            onValuesChange={setNutrientForm}
                                            habitTargets={habitTargets}
                                            onHabitTargetsChange={setHabitTargets}
                                            showStartDate={false}
                                            onSave={async () => { await handleSave(); setEditingCurrentPlan(false) }}
                                            saving={saving}
                                            saveLabel="設定を保存"
                                            onCancel={() => setEditingCurrentPlan(false)}
                                        />
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-2xl font-normal text-gray-900 tabular-nums">
                                                目標 {Math.round(nutrientForm.targetCalories).toLocaleString()} kcal
                                                <span className="text-sm font-normal text-gray-400 ml-2">
                                                    （P {nutrientForm.protein}g / F {nutrientForm.fat}g / C {nutrientForm.carbs}g）
                                                </span>
                                            </p>
                                            <p className="text-xs font-normal text-gray-400">
                                                水分{habitTargets.water ?? 2}L・{habitTargets.steps ?? 8000}歩・筋トレ週{habitTargets.workout ?? 1}回・睡眠{habitTargets.sleep ?? 7}h
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* L-4: 「新しい目標を追加」はグラフの付属品ではなく同格の機能として独立配置 */}
                                <button onClick={openNewGoalModal} className="w-full text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-4 rounded-2xl shadow-sm transition-colors">新しい目標を追加</button>

                                {/* K-1/K-2/L-1: 統合グラフ（ホバー/タップでツールチップ→編集は2段階）。履歴表は廃止 */}
                                {goalChartData.length > 0 && (
                                    <GoalHistoryCharts
                                        data={goalChartData}
                                        onEditRequest={(date) => {
                                            const record = dietHistory.find(h => h.start_date === date)
                                            if (record) openEditGoalModal(record)
                                        }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {message && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-8 py-4 rounded-2xl font-normal shadow-2xl z-50 animate-slideUp">{message}</div>}

            {/* K-2: 履歴バーのタップ編集・新規プラン作成モーダル */}
            {goalModal && (
                <GoalEditModal
                    title={goalModal.mode === 'new' ? '新規プランの作成' : 'プランの編集'}
                    initialValues={goalModal.initialValues}
                    initialHabitTargets={goalModal.initialHabitTargets}
                    onClose={() => setGoalModal(null)}
                    onSave={handleModalSave}
                    onDelete={goalModal.mode === 'edit' ? handleModalDelete : undefined}
                />
            )}
        </div>
    );
}

function DietProfileStat({ label, value }: { label: string, value: string }) {
    return (
        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
            <div className="text-[10px] text-gray-400 uppercase tracking-widest">{label}</div>
            <div className="mt-1 text-lg text-gray-900">{value}</div>
        </div>
    )
}

/**
 * N: 目標設定の推移グラフ。各プランの棒の横幅を「実施期間の日数」に比例させる。
 * recharts標準のBarChartはカテゴリ軸で全バー等幅になり期間の長短が伝わらないため、
 * flexの幅比率で自前描画する（縦は消費カロリーに応じたPFC積み上げの高さ）。
 */
function GoalHistoryCharts({ data, onEditRequest }: { data: any[], onEditRequest: (date: string) => void }) {
    const [selected, setSelected] = useState<any | null>(null)
    const latest = data[data.length - 1]
    const first = data[0]
    const calorieDiff = latest && first ? latest.calories - first.calories : 0

    const totalDays = data.reduce((sum, d) => sum + d.periodDays, 0) || 1
    const maxCalories = Math.max(...data.map(d => d.pfcCalories), 1)
    const CHART_HEIGHT = 220

    return (
        <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                    <div>
                        <h2 className="text-xl font-normal text-gray-800 tracking-tight">目標設定の推移</h2>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">横幅はプランを続けた期間の長さを表します</p>
                    </div>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                    {data.length}件 / 初回比 {calorieDiff > 0 ? '+' : ''}{calorieDiff.toLocaleString()}kcal
                </span>
            </div>

            {/* L-1踏襲: 常時kcalラベルは廃止。タップで詳細情報カードのみ表示 */}
            <div className="rounded-[2rem] bg-gray-50/80 border border-gray-100 p-5">
                <div className="flex items-end gap-[2px] overflow-x-auto" style={{ height: CHART_HEIGHT }}>
                    {data.map((row, i) => {
                        const widthPct = (row.periodDays / totalDays) * 100
                        const barHeight = Math.max(6, (row.pfcCalories / maxCalories) * (CHART_HEIGHT - 24))
                        const proteinH = row.pfcCalories > 0 ? (row.proteinCalories / row.pfcCalories) * barHeight : 0
                        const fatH = row.pfcCalories > 0 ? (row.fatCalories / row.pfcCalories) * barHeight : 0
                        const carbH = row.pfcCalories > 0 ? (row.carbCalories / row.pfcCalories) * barHeight : 0
                        const isSelected = selected?.date === row.date
                        return (
                            <button
                                key={row.date}
                                onClick={() => setSelected(isSelected ? null : row)}
                                style={{ width: `${widthPct}%`, minWidth: 14 }}
                                className={`flex flex-col justify-end shrink-0 rounded-t-md overflow-hidden transition-opacity ${isSelected ? 'ring-2 ring-brand-400' : 'hover:opacity-80'}`}
                            >
                                <div style={{ height: carbH }} className="bg-blue-500 w-full" />
                                <div style={{ height: fatH }} className="bg-emerald-500 w-full" />
                                <div style={{ height: proteinH }} className="bg-amber-500 w-full rounded-t-md" />
                            </button>
                        )
                    })}
                </div>
                <div className="flex text-[9px] text-gray-400 mt-2 gap-[2px] overflow-x-auto">
                    {data.map(row => (
                        <span key={row.date} style={{ width: `${(row.periodDays / totalDays) * 100}%`, minWidth: 14 }} className="shrink-0 text-center truncate">{row.displayDate}</span>
                    ))}
                </div>
                <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>タンパク質</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>脂質</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>炭水化物</span>
                </div>
                <p className="text-[10px] text-gray-400 text-center mt-3">バーをタップすると詳細と編集ボタンを表示します（横幅=実施期間）</p>

                {/* L-1踏襲: 2段階タップ — 1回目は情報カード表示のみ、編集ボタンでモーダルを開く */}
                {selected && (
                    <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3 animate-fadeIn">
                        <div className="text-xs">
                            <p className="text-gray-400 mb-1">{selected.periodLabel}</p>
                            <p className="text-gray-900 text-sm">
                                {Number(selected.pfcCalories).toLocaleString()} kcal
                                <span className="ml-2 text-gray-500">
                                    <span className="text-amber-500">P {selected.protein}g</span>
                                    <span className="mx-1 text-gray-300">/</span>
                                    <span className="text-emerald-500">F {selected.fat}g</span>
                                    <span className="mx-1 text-gray-300">/</span>
                                    <span className="text-blue-500">C {selected.carbs}g</span>
                                </span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => onEditRequest(selected.date)} className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-full hover:bg-blue-100">このプランを編集</button>
                            <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600 p-2">×</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function DietPlanPage() {
    return (<Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">読み込み中...</div>}><DietPlanPageContent /></Suspense>)
}
